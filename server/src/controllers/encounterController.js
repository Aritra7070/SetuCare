const Encounter = require('../models/Encounter');
const Patient = require('../models/Patient');
const Facility = require('../models/Facility');

/**
 * @desc    Create a new clinical encounter for a patient
 * @route   POST /api/encounters
 * @access  Private (Frontline Worker, Medical Officer, Specialist, Admin)
 */
const createEncounter = async (req, res) => {
  try {
    const {
      patientId,
      vitals,
      symptoms,
      notes,
      encounterType,
      facilityId, // optional override for admin
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required to create an encounter.',
      });
    }

    // 1. Verify Patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.',
      });
    }

    // 2. Determine Facility (Auto-stamped from user session)
    let facility;
    if (req.user.role === 'admin' && facilityId) {
      facility = await Facility.findById(facilityId);
    } else {
      const targetFacilityId = req.user.facility?._id || req.user.facility;
      if (targetFacilityId) {
        facility = await Facility.findById(targetFacilityId);
      } else {
        // Fallback for admin if not attached to a specific facility
        facility = await Facility.findOne({ active: true });
      }
    }

    if (!facility) {
      return res.status(400).json({
        success: false,
        message: 'A valid attending facility is required to record an encounter.',
      });
    }

    // 3. Format vitals (numeric casts where provided)
    const formattedVitals = {};
    if (vitals) {
      if (vitals.bp) formattedVitals.bp = vitals.bp.trim();
      if (vitals.tempC !== undefined && vitals.tempC !== '') {
        formattedVitals.tempC = Number(vitals.tempC);
      }
      if (vitals.pulse !== undefined && vitals.pulse !== '') {
        formattedVitals.pulse = Number(vitals.pulse);
      }
      if (vitals.weightKg !== undefined && vitals.weightKg !== '') {
        formattedVitals.weightKg = Number(vitals.weightKg);
      }
      if (vitals.spo2 !== undefined && vitals.spo2 !== '') {
        formattedVitals.spo2 = Number(vitals.spo2);
      }
    }

    // 4. Create Encounter Document (triageResult left null / unset for Step 5)
    const encounter = await Encounter.create({
      patient: patient._id,
      facility: facility._id,
      worker: req.user._id, // Auto-stamped worker identity
      vitals: formattedVitals,
      symptoms: Array.isArray(symptoms) ? symptoms.filter(Boolean) : [],
      triageResult: null, // Staged for Step 7
      encounterType: encounterType || 'walk_in',
      notes: notes ? notes.trim() : undefined,
    });

    const populatedEncounter = await Encounter.findById(encounter._id)
      .populate('facility', 'name tier district state shortCode contactPhone')
      .populate('worker', 'name role preferredLanguage')
      .populate('patient', 'phid name dob gender');

    res.status(201).json({
      success: true,
      message: 'Clinical encounter recorded successfully',
      encounter: populatedEncounter,
    });
  } catch (error) {
    console.error('[Encounter Controller] Create Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record encounter',
    });
  }
};

/**
 * @desc    Get single encounter details
 * @route   GET /api/encounters/:id
 * @access  Private (Authenticated users)
 */
const getEncounterById = async (req, res) => {
  try {
    const encounter = await Encounter.findById(req.params.id)
      .populate('facility', 'name tier district state shortCode contactPhone')
      .populate('worker', 'name role')
      .populate('patient', 'phid name dob gender phone address');

    if (!encounter) {
      return res.status(404).json({
        success: false,
        message: 'Encounter not found',
      });
    }

    res.status(200).json({
      success: true,
      encounter,
    });
  } catch (error) {
    console.error('[Encounter Controller] GetById Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve encounter details',
    });
  }
};

/**
 * @desc    Get all encounters for a specific patient by PHID
 * @route   GET /api/encounters/patient/:phid (or /api/patients/:phid/encounters)
 * @access  Private (Authenticated users)
 */
const getPatientEncounters = async (req, res) => {
  try {
    const rawPhid = req.params.phid ? req.params.phid.trim() : '';

    const patient = await Patient.findOne({
      phid: new RegExp('^' + rawPhid + '$', 'i'),
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: `Patient with PHID '${rawPhid}' not found`,
      });
    }

    const encounters = await Encounter.find({ patient: patient._id })
      .populate('facility', 'name tier district state shortCode')
      .populate('worker', 'name role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: encounters.length,
      patient: {
        _id: patient._id,
        phid: patient.phid,
        name: patient.name,
      },
      encounters,
    });
  } catch (error) {
    console.error('[Encounter Controller] GetPatientEncounters Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve patient encounters',
    });
  }
};

module.exports = {
  createEncounter,
  getEncounterById,
  getPatientEncounters,
};
