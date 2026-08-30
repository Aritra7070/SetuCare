const Referral = require('../models/Referral');
const Encounter = require('../models/Encounter');
const Patient = require('../models/Patient');
const Facility = require('../models/Facility');

/**
 * @desc    Create a new referral from a source encounter
 * @route   POST /api/referrals
 * @access  Private (frontline_worker, medical_officer)
 *
 * Rules (PRD §3):
 *   - One referral per sourceEncounter (unique constraint enforced here + on model)
 *   - fromFacility auto-stamped from req.user — never trusted from body
 *   - toFacility must differ from fromFacility
 *   - sourceEncounter must belong to the stated patient
 *   - Triage optional — worker clinical judgment alone is valid
 */
const createReferral = async (req, res) => {
  try {
    const { patient: patientId, sourceEncounter: encounterId, toFacility: toFacilityId, reason } = req.body;

    // ── Basic presence checks ──
    if (!patientId || !encounterId || !toFacilityId) {
      return res.status(400).json({
        success: false,
        message: 'patient, sourceEncounter, and toFacility are all required.',
      });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A referral reason is required.',
      });
    }

    // ── Resolve fromFacility from session — never trusted from body ──
    const fromFacilityId = req.user.facility?._id || req.user.facility;
    if (!fromFacilityId) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not linked to a facility. Cannot create a referral.',
      });
    }

    // ── Verify patient exists ──
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // ── Verify encounter exists and belongs to this patient ──
    const encounter = await Encounter.findById(encounterId);
    if (!encounter) {
      return res.status(404).json({ success: false, message: 'Source encounter not found.' });
    }
    if (encounter.patient.toString() !== patient._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Source encounter does not belong to the stated patient.',
      });
    }

    // ── One referral per encounter ──
    const existing = await Referral.findOne({ sourceEncounter: encounterId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A referral already exists for this encounter. To refer again, log a new encounter first.',
        existingReferralId: existing._id,
      });
    }

    // ── toFacility must exist and differ from fromFacility ──
    const toFacility = await Facility.findById(toFacilityId);
    if (!toFacility) {
      return res.status(404).json({ success: false, message: 'Destination facility not found.' });
    }
    if (fromFacilityId.toString() === toFacilityId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'fromFacility and toFacility must be different facilities.',
      });
    }

    // ── Create referral ──
    const referral = await Referral.create({
      patient: patient._id,
      sourceEncounter: encounter._id,
      fromFacility: fromFacilityId,
      toFacility: toFacility._id,
      reason: reason.trim(),
      status: 'created',
      statusHistory: [
        { status: 'created', timestamp: new Date(), updatedBy: req.user._id },
      ],
    });

    const populated = await Referral.findById(referral._id)
      .populate('patient', 'phid name dob gender')
      .populate('sourceEncounter', 'encounterType createdAt vitals symptoms triageResult')
      .populate('fromFacility', 'name tier district shortCode')
      .populate('toFacility', 'name tier district shortCode contactPhone');

    res.status(201).json({
      success: true,
      message: `Referral created — sent to ${toFacility.name}`,
      referral: populated,
    });
  } catch (error) {
    // Mongoose duplicate key on sourceEncounter unique index
    if (error.code === 11000 && error.keyPattern?.sourceEncounter) {
      return res.status(409).json({
        success: false,
        message: 'A referral already exists for this encounter.',
      });
    }
    console.error('[Referral Controller] Create Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create referral.' });
  }
};

/**
 * @desc    Get single referral by ID
 * @route   GET /api/referrals/:id
 * @access  Private (any authenticated user — cross-facility read)
 */
const getReferralById = async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id)
      .populate('patient', 'phid name dob gender')
      .populate('sourceEncounter', 'encounterType createdAt vitals symptoms notes triageResult')
      .populate('fromFacility', 'name tier district shortCode contactPhone')
      .populate('toFacility', 'name tier district shortCode contactPhone')
      .populate('statusHistory.updatedBy', 'name role');

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found.' });
    }

    res.status(200).json({ success: true, referral });
  } catch (error) {
    console.error('[Referral Controller] GetById Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve referral.' });
  }
};

/**
 * @desc    Get all referrals for a patient
 * @route   GET /api/referrals?patient=:patientId
 * @access  Private (any authenticated user — cross-facility read, PRD §4)
 */
const getPatientReferrals = async (req, res) => {
  try {
    const { patient: patientId } = req.query;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Provide ?patient=<id> query param.' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const referrals = await Referral.find({ patient: patient._id })
      .populate('sourceEncounter', 'encounterType createdAt')
      .populate('fromFacility', 'name tier district shortCode')
      .populate('toFacility', 'name tier district shortCode')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: referrals.length, referrals });
  } catch (error) {
    console.error('[Referral Controller] GetPatientReferrals Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve referrals.' });
  }
};

module.exports = { createReferral, getReferralById, getPatientReferrals };
