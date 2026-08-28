const Patient = require('../models/Patient');
const Facility = require('../models/Facility');
const Encounter = require('../models/Encounter');
const ScanLog = require('../models/ScanLog');
const { generateUniquePHID } = require('../utils/phidGenerator');
const { generateQRCodeDataUrl } = require('../utils/qrGenerator');

/**
 * Calculate age in full years from Date of Birth
 */
const calculateAge = (dob) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * @desc    Check for potential duplicate patient records (Soft-Match Warning)
 * @route   GET /api/patients/check-duplicate
 * @access  Private (Frontline Worker, Medical Officer, Admin)
 */
const checkDuplicate = async (req, res) => {
  try {
    const { name, dob, phone, excludeId } = req.query;

    if (!name && !dob && !phone) {
      return res.status(200).json({
        success: true,
        duplicateFound: false,
        candidates: [],
      });
    }

    const orConditions = [];

    // Match criteria 1: Exact phone match
    if (phone && phone.trim().length >= 7) {
      orConditions.push({ phone: phone.trim() });
    }

    // Match criteria 2: Matching DOB AND Name fuzzy match
    if (name && dob) {
      const cleanName = name.trim();
      const dobDate = new Date(dob);
      if (!isNaN(dobDate.getTime())) {
        // Match same day
        const startOfDay = new Date(dobDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(dobDate.setHours(23, 59, 59, 999));

        orConditions.push({
          dob: { $gte: startOfDay, $lte: endOfDay },
          name: { $regex: new RegExp(cleanName.replace(/[^a-zA-Z\s]/g, ''), 'i') },
        });
      }
    }

    if (orConditions.length === 0) {
      return res.status(200).json({
        success: true,
        duplicateFound: false,
        candidates: [],
      });
    }

    const query = { $or: orConditions };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const matches = await Patient.find(query)
      .populate('registeredAtFacility', 'name tier district shortCode')
      .limit(5);

    const candidates = matches.map((m) => {
      let matchReason = 'Potential duplicate match';
      if (phone && m.phone === phone.trim()) {
        matchReason = 'Identical mobile phone number';
      } else if (name && dob) {
        matchReason = 'Matching name & date of birth';
      }

      return {
        _id: m._id,
        phid: m.phid,
        name: m.name,
        dob: m.dob,
        gender: m.gender,
        guardianName: m.guardianName,
        phone: m.phone,
        address: m.address,
        facility: m.registeredAtFacility?.name || 'Unknown',
        matchReason,
      };
    });

    res.status(200).json({
      success: true,
      duplicateFound: candidates.length > 0,
      candidateCount: candidates.length,
      candidates,
    });
  } catch (error) {
    console.error('[Patient Controller] checkDuplicate Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform duplicate check',
    });
  }
};

/**
 * @desc    Register a new patient and generate unique PHID + QR Code
 * @route   POST /api/patients
 * @access  Private (Frontline Worker, Medical Officer, Admin)
 */
const registerPatient = async (req, res) => {
  try {
    const {
      name,
      dob,
      gender,
      guardianName,
      phone,
      address,
      preferredLanguage,
      facilityId, // optional override for admin
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Patient name is required.',
      });
    }

    // 1. Determine Registering Facility
    let facility;
    if (req.user.role === 'admin' && facilityId) {
      facility = await Facility.findById(facilityId);
    } else {
      const targetFacilityId = req.user.facility?._id || req.user.facility;
      if (!targetFacilityId) {
        // Fallback for admin if not provided
        facility = await Facility.findOne({ active: true });
      } else {
        facility = await Facility.findById(targetFacilityId);
      }
    }

    if (!facility) {
      return res.status(400).json({
        success: false,
        message: 'Valid health facility registration assignment required.',
      });
    }

    // 2. Validate Minor Guardian Requirement (Age < 18)
    if (dob) {
      const age = calculateAge(dob);
      if (age !== null && age < 18) {
        if (!guardianName || !guardianName.trim()) {
          return res.status(400).json({
            success: false,
            message: `Patient is a minor (${age} years old). Guardian name is required.`,
          });
        }
      }
    }

    // 3. Generate Unique, Collision-Safe PHID
    const phid = await generateUniquePHID(facility);

    // 4. Create Patient Document
    const patient = await Patient.create({
      phid,
      name: name.trim(),
      dob: dob ? new Date(dob) : undefined,
      gender: gender || 'female',
      guardianName: guardianName ? guardianName.trim() : undefined,
      phone: phone ? phone.trim() : undefined,
      address: address ? address.trim() : undefined,
      registeredAtFacility: facility._id,
      preferredLanguage: preferredLanguage || 'mr',
    });

    // 5. Generate High-Res Scannable QR Code Data URI
    const qrCodeDataUrl = await generateQRCodeDataUrl(phid);

    const populated = await Patient.findById(patient._id).populate(
      'registeredAtFacility',
      'name tier district state shortCode contactPhone'
    );

    res.status(201).json({
      success: true,
      message: `Patient registered successfully with PHID ${phid}`,
      patient: populated,
      qrCodeDataUrl,
    });
  } catch (error) {
    console.error('[Patient Controller] registerPatient Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to register patient',
    });
  }
};

/**
 * @desc    Cross-Facility Patient Lookup by PHID + Encounters History
 * @route   GET /api/patients/lookup/:phid
 * @access  Private (Any authenticated clinical worker - Intentionally bypasses facilityScope)
 */
const lookupPatientByPHID = async (req, res) => {
  try {
    const rawPhid = req.params.phid ? req.params.phid.trim() : '';

    if (!rawPhid) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid Patient Health ID (PHID)',
      });
    }

    // Case-insensitive exact match
    const patient = await Patient.findOne({
      phid: new RegExp('^' + rawPhid + '$', 'i'),
    }).populate(
      'registeredAtFacility',
      'name tier district state shortCode contactPhone location'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `No patient record found for PHID '${rawPhid}'`,
        searchedPhid: rawPhid,
      });
    }

    // Fetch existing encounters (empty for now until Step 5, but structurally ready)
    const encounters = await Encounter.find({ patient: patient._id })
      .populate('facility', 'name tier district shortCode')
      .populate('worker', 'name role')
      .sort({ createdAt: -1 });

    const qrCodeDataUrl = await generateQRCodeDataUrl(patient.phid);
    const age = calculateAge(patient.dob);

    // Fire-and-forget scan event audit log
    const scanSource = req.query.source || 'direct_lookup';
    const scanningFacilityId =
      req.user.facility?._id || req.user.facility || patient.registeredAtFacility?._id;

    if (scanningFacilityId) {
      ScanLog.create({
        patient: patient._id,
        phid: patient.phid,
        worker: req.user._id,
        facility: scanningFacilityId,
        scanSource: ['camera_qr', 'file_upload', 'manual_entry', 'direct_lookup'].includes(scanSource)
          ? scanSource
          : 'direct_lookup',
        scannedAt: new Date(),
      }).catch((err) => {
        console.error('[ScanLog] Non-blocking scan log save error:', err.message);
      });
    }

    // Determine cross-facility access context
    const userFacilityId = (req.user.facility?._id || req.user.facility || '').toString();
    const patientOriginFacilityId = (patient.registeredAtFacility?._id || '').toString();
    const isCrossFacility = Boolean(userFacilityId && patientOriginFacilityId && userFacilityId !== patientOriginFacilityId);

    res.status(200).json({
      success: true,
      patient,
      age,
      qrCodeDataUrl,
      encounters,
      encounterCount: encounters.length,
      scanContext: {
        scannedByWorker: req.user.name,
        workerRole: req.user.role,
        scannedAtFacility: req.user.facility?.name || 'Local Health Facility',
        isCrossFacility,
      },
    });
  } catch (error) {
    console.error('[Patient Controller] lookupPatientByPHID Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to lookup patient record',
    });
  }
};

/**
 * @desc    Explicit Scan Log Recording Endpoint
 * @route   POST /api/patients/lookup/:phid/scan-log
 * @access  Private (Any authenticated clinical worker)
 */
const recordScanLog = async (req, res) => {
  try {
    const rawPhid = req.params.phid ? req.params.phid.trim() : '';
    const { scanSource } = req.body;

    const patient = await Patient.findOne({
      phid: new RegExp('^' + rawPhid + '$', 'i'),
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `Cannot log scan: Patient with PHID '${rawPhid}' not found`,
      });
    }

    const facilityId = req.user.facility?._id || req.user.facility || patient.registeredAtFacility;

    const scanLog = await ScanLog.create({
      patient: patient._id,
      phid: patient.phid,
      worker: req.user._id,
      facility: facilityId,
      scanSource: scanSource || 'camera_qr',
      scannedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Scan event logged successfully',
      scanLog,
    });
  } catch (error) {
    console.error('[Patient Controller] recordScanLog Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record scan log',
    });
  }
};

/**
 * @desc    Get printable patient card data + scannable QR code
 * @route   GET /api/patients/:id/card
 * @access  Private (Frontline Worker, Medical Officer, Admin)
 */
const getPatientCard = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate(
      'registeredAtFacility',
      'name tier district state shortCode contactPhone location'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found',
      });
    }

    // Generate fresh QR code data URL
    const qrCodeDataUrl = await generateQRCodeDataUrl(patient.phid);
    const age = calculateAge(patient.dob);

    res.status(200).json({
      success: true,
      patient,
      age,
      qrCodeDataUrl,
      cardMetadata: {
        issuedAt: patient.createdAt,
        network: 'Maharashtra Stepped-Care Public Health Network',
        scheme: 'SetuCare Patient Health ID (PHID)',
      },
    });
  } catch (error) {
    console.error('[Patient Controller] getPatientCard Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate patient card data',
    });
  }
};

/**
 * @desc    Get list of patients (Scoped by facility if frontline/MO)
 * @route   GET /api/patients
 * @access  Private
 */
const getPatients = async (req, res) => {
  try {
    const { search, gender, facilityId } = req.query;

    let filter = {};

    // Apply facility scoping unless admin / program manager
    if (req.user.role !== 'admin' && req.user.role !== 'program_manager') {
      const userFacility = req.user.facility?._id || req.user.facility;
      if (userFacility) {
        filter.registeredAtFacility = userFacility;
      }
    } else if (facilityId) {
      filter.registeredAtFacility = facilityId;
    }

    if (gender) {
      filter.gender = gender;
    }

    if (search) {
      const cleanSearch = search.trim();
      filter.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { phid: { $regex: cleanSearch, $options: 'i' } },
        { phone: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const patients = await Patient.find(filter)
      .populate('registeredAtFacility', 'name tier district shortCode')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error) {
    console.error('[Patient Controller] getPatients Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve patients list',
    });
  }
};

/**
 * @desc    Get single patient details by ID
 * @route   GET /api/patients/:id
 * @access  Private
 */
const getPatientById = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id).populate(
      'registeredAtFacility',
      'name tier district state shortCode contactPhone'
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found',
      });
    }

    const age = calculateAge(patient.dob);

    res.status(200).json({
      success: true,
      patient,
      age,
    });
  } catch (error) {
    console.error('[Patient Controller] getPatientById Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve patient details',
    });
  }
};

/**
 * @desc    Update patient demographic information (fixes typos / address updates)
 * @route   PATCH /api/patients/:id
 * @access  Private (Frontline Worker, Medical Officer, Admin)
 */
const updatePatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient record not found',
      });
    }

    const {
      name,
      dob,
      gender,
      guardianName,
      phone,
      address,
      preferredLanguage,
    } = req.body;

    const newDob = dob ? new Date(dob) : patient.dob;
    const newGuardian = guardianName !== undefined ? guardianName.trim() : patient.guardianName;

    // Validate minor check on update
    if (newDob) {
      const age = calculateAge(newDob);
      if (age !== null && age < 18 && !newGuardian) {
        return res.status(400).json({
          success: false,
          message: `Patient is a minor (${age} years old). Guardian name is required.`,
        });
      }
    }

    if (name) patient.name = name.trim();
    if (dob) patient.dob = new Date(dob);
    if (gender) patient.gender = gender;
    if (guardianName !== undefined) patient.guardianName = newGuardian;
    if (phone !== undefined) patient.phone = phone ? phone.trim() : '';
    if (address !== undefined) patient.address = address ? address.trim() : '';
    if (preferredLanguage) patient.preferredLanguage = preferredLanguage;

    await patient.save();

    const updated = await Patient.findById(patient._id).populate(
      'registeredAtFacility',
      'name tier district shortCode'
    );

    res.status(200).json({
      success: true,
      message: 'Patient demographics updated successfully',
      patient: updated,
    });
  } catch (error) {
    console.error('[Patient Controller] updatePatient Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update patient record',
    });
  }
};

module.exports = {
  checkDuplicate,
  registerPatient,
  lookupPatientByPHID,
  recordScanLog,
  getPatientCard,
  getPatients,
  getPatientById,
  updatePatient,
  calculateAge,
};
