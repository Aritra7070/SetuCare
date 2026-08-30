const Encounter = require('../models/Encounter');
const Patient = require('../models/Patient');
const Facility = require('../models/Facility');
const { SYMPTOM_TAGS } = require('../utils/symptomTags');
const { runTriage } = require('../utils/triageEngine');

/**
 * @desc    Create a new clinical encounter for a patient
 * @route   POST /api/encounters
 * @access  Private (frontline_worker, medical_officer, specialist, admin)
 *
 * PRD §4: facility and worker are auto-stamped from req.user — never trusted from body.
 * PRD §5: no PUT/DELETE routes exist — encounters are append-only.
 */
const createEncounter = async (req, res) => {
  try {
    const {
      patientId,
      vitals,
      symptoms,
      otherSymptoms,
      notes,
      encounterType,
      facilityId, // admin-only override
    } = req.body;

    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID is required to create an encounter.',
      });
    }

    // 1. Verify patient exists
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found.',
      });
    }

    // 2. Determine facility — auto-stamped from session; admin may override
    let facility;
    if (req.user.role === 'admin' && facilityId) {
      facility = await Facility.findById(facilityId);
    } else {
      const targetFacilityId = req.user.facility?._id || req.user.facility;
      if (targetFacilityId) {
        facility = await Facility.findById(targetFacilityId);
      } else {
        facility = await Facility.findOne({ active: true });
      }
    }

    if (!facility) {
      return res.status(400).json({
        success: false,
        message: 'A valid attending facility is required to record an encounter.',
      });
    }

    // 3. Parse vitals — PRD §3: bp stored as {systolic, diastolic} Numbers
    const formattedVitals = {};
    if (vitals) {
      // Accept either structured { systolic, diastolic } or legacy "120/80" string
      if (vitals.bp !== undefined && vitals.bp !== null && vitals.bp !== '') {
        if (typeof vitals.bp === 'object') {
          // Preferred: { systolic: 120, diastolic: 80 }
          const sys = vitals.bp.systolic !== undefined && vitals.bp.systolic !== ''
            ? Number(vitals.bp.systolic) : undefined;
          const dia = vitals.bp.diastolic !== undefined && vitals.bp.diastolic !== ''
            ? Number(vitals.bp.diastolic) : undefined;
          if (sys !== undefined || dia !== undefined) {
            formattedVitals.bp = {};
            if (sys !== undefined && !isNaN(sys)) formattedVitals.bp.systolic = sys;
            if (dia !== undefined && !isNaN(dia)) formattedVitals.bp.diastolic = dia;
          }
        } else if (typeof vitals.bp === 'string' && vitals.bp.includes('/')) {
          // Graceful fallback for legacy string "120/80"
          const [sys, dia] = vitals.bp.split('/').map((n) => Number(n.trim()));
          formattedVitals.bp = {};
          if (!isNaN(sys)) formattedVitals.bp.systolic = sys;
          if (!isNaN(dia)) formattedVitals.bp.diastolic = dia;
        }
      }
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

    // 4. Validate symptom tags — PRD §3: controlled vocab, unknown tags are dropped
    //    (warn in response rather than hard-block, consistent with PRD's lenient stance)
    const rawSymptoms = Array.isArray(symptoms) ? symptoms.filter(Boolean) : [];
    const validSymptoms = rawSymptoms.filter((s) => SYMPTOM_TAGS.includes(s));
    const unknownSymptoms = rawSymptoms.filter((s) => !SYMPTOM_TAGS.includes(s));

    // 5. Create encounter — triageResult staged null for Step 7
    const encounter = await Encounter.create({
      patient: patient._id,
      facility: facility._id,
      worker: req.user._id,
      vitals: formattedVitals,
      symptoms: validSymptoms,
      otherSymptoms: otherSymptoms ? otherSymptoms.trim() : undefined,
      triageResult: null,
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
      ...(unknownSymptoms.length > 0 && {
        warnings: [
          `The following symptom tags were not recognised and were omitted: ${unknownSymptoms.join(', ')}`,
        ],
      }),
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
 * @access  Private (any authenticated user)
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
 * @desc    Get all encounters for a patient
 * @route   GET /api/encounters?patient=:patientId  (MongoDB _id)
 *          GET /api/encounters/patient/:phid        (PHID string)
 * @access  Private (any authenticated user)
 *
 * PRD §4: deliberately NOT facility-scoped — cross-facility read is the feature.
 * A PHC doctor must be able to see a sub-centre's encounter from last week.
 */
const getPatientEncounters = async (req, res) => {
  try {
    let patient;

    if (req.query.patient) {
      // Query-param form: GET /api/encounters?patient=<MongoDB _id>
      patient = await Patient.findById(req.query.patient);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient not found',
        });
      }
    } else if (req.params.phid) {
      // Path-param form: GET /api/encounters/patient/:phid
      const rawPhid = req.params.phid.trim();
      patient = await Patient.findOne({
        phid: new RegExp('^' + rawPhid + '$', 'i'),
      });
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: `Patient with PHID '${rawPhid}' not found`,
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Provide either ?patient=<id> query param or use /patient/:phid path.',
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

/**
 * @desc    Run the digital triage rule engine against a stored Encounter
 * @route   POST /api/encounters/:id/triage
 * @access  Private (frontline_worker, medical_officer)
 *
 * PRD §4 immutability note: this does NOT contradict Step 5's append-only rule.
 * Clinical content (vitals/symptoms/notes) entered by a human is never touched.
 * triageResult is a system-computed annotation that can be safely (re-)written.
 * Re-running against the same Encounter overwrites the previous result — idempotent.
 */
const triageEncounter = async (req, res) => {
  try {
    const encounter = await Encounter.findById(req.params.id)
      .populate('facility', 'name tier district state shortCode parentFacility');

    if (!encounter) {
      return res.status(404).json({
        success: false,
        message: 'Encounter not found',
      });
    }

    // Run pure rule engine — no DB side-effects inside
    const { riskLevel, rationale, suggestedFacility } = await runTriage({
      vitals: encounter.vitals || {},
      symptoms: encounter.symptoms || [],
      facilityId: encounter.facility?._id || encounter.facility,
    });

    // Build suggestedRouting display string
    const suggestedRouting = suggestedFacility
      ? `${suggestedFacility.name} (${suggestedFacility.tier?.replace(/_/g, ' ')})`
      : null;

    // Write result back — only the triageResult subdoc is touched
    encounter.triageResult = {
      riskLevel,
      rationale,
      suggestedRouting,
      suggestedFacility: suggestedFacility?._id || null,
      scoredAt: new Date(),
    };

    await encounter.save();

    // Re-fetch with full population so the response matches what the timeline renders
    const populated = await Encounter.findById(encounter._id)
      .populate('facility', 'name tier district state shortCode contactPhone')
      .populate('worker', 'name role')
      .populate('patient', 'phid name dob gender')
      .populate('triageResult.suggestedFacility', 'name tier district state shortCode contactPhone');

    res.status(200).json({
      success: true,
      message: `Triage complete — risk level: ${riskLevel}`,
      encounter: populated,
      triageResult: {
        riskLevel,
        rationale,
        suggestedRouting,
        suggestedFacility: suggestedFacility
          ? {
              _id: suggestedFacility._id,
              name: suggestedFacility.name,
              tier: suggestedFacility.tier,
              district: suggestedFacility.district,
              shortCode: suggestedFacility.shortCode,
            }
          : null,
        scoredAt: encounter.triageResult.scoredAt,
      },
    });
  } catch (error) {
    console.error('[Encounter Controller] Triage Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to run triage',
    });
  }
};

module.exports = {
  createEncounter,
  getEncounterById,
  getPatientEncounters,
  triageEncounter,
};
