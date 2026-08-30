const Referral = require('../models/Referral');
const Encounter = require('../models/Encounter');
const Patient = require('../models/Patient');
const Facility = require('../models/Facility');
const Notification = require('../models/Notification');
const { getIO } = require('../socket');

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
      createdBy: req.user._id,           // Step 9: needed to target closed-notification
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

/**
 * @desc    Advance a referral's status by exactly one step
 * @route   PATCH /api/referrals/:id/status
 * @access  Private (medical_officer, specialist) — receiving facility only
 *
 * Transition rules (PRD §2):
 *   created → acknowledged → seen → closed (strict one-step, no skipping)
 *   Only req.user.facility === referral.toFacility may transition
 *   closed requires outcomeNotes
 *
 * On every transition: appends statusHistory, emits referral:statusUpdated
 *   to patient:<patientId> room (live chip update on any timeline viewer)
 * On closed: also creates a Notification for createdBy and emits
 *   notification:new to user:<createdBy> room
 */
const VALID_TRANSITIONS = {
  created:      'acknowledged',
  acknowledged: 'seen',
  seen:         'closed',
};

const updateReferralStatus = async (req, res) => {
  try {
    const { status: newStatus, outcomeNotes } = req.body;

    if (!newStatus) {
      return res.status(400).json({ success: false, message: 'New status is required.' });
    }

    // ── Fetch referral with full population needed for emit payload ──
    const referral = await Referral.findById(req.params.id)
      .populate('patient',         'phid name')
      .populate('fromFacility',    'name tier shortCode')
      .populate('toFacility',      'name tier shortCode')
      .populate('createdBy',       'name role');

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found.' });
    }

    // ── Only the receiving facility may transition status ──
    const userFacilityId = (req.user.facility?._id || req.user.facility)?.toString();
    const toFacilityId   = referral.toFacility._id?.toString() || referral.toFacility?.toString();

    if (!userFacilityId || userFacilityId !== toFacilityId) {
      return res.status(403).json({
        success: false,
        message: 'Only a user at the receiving facility can update this referral status.',
      });
    }

    // ── Validate transition is exactly one step forward ──
    const expectedNext = VALID_TRANSITIONS[referral.status];
    if (!expectedNext) {
      return res.status(400).json({
        success: false,
        message: `Referral is already in its terminal state: '${referral.status}'.`,
      });
    }
    if (newStatus !== expectedNext) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition. Current status is '${referral.status}'; next allowed status is '${expectedNext}'.`,
        currentStatus: referral.status,
        allowedNext:   expectedNext,
      });
    }

    // ── closed requires outcomeNotes ──
    if (newStatus === 'closed') {
      if (!outcomeNotes || !outcomeNotes.trim()) {
        return res.status(400).json({
          success: false,
          message: 'outcomeNotes is required when closing a referral.',
        });
      }
      referral.outcomeNotes = outcomeNotes.trim();
    }

    // ── Apply transition ──
    referral.status = newStatus;
    referral.statusHistory.push({
      status:    newStatus,
      timestamp: new Date(),
      updatedBy: req.user._id,
    });

    await referral.save();

    // ── Build a clean payload for socket emission ──
    // Only the fields the client needs to update the chip — keeps the event small.
    const chipPayload = {
      referralId:  referral._id.toString(),
      patientId:   referral.patient._id.toString(),
      status:      referral.status,
      toFacility: {
        name:  referral.toFacility.name,
        tier:  referral.toFacility.tier,
        shortCode: referral.toFacility.shortCode,
      },
      updatedAt:   new Date().toISOString(),
    };

    // ── Emit to patient room — updates live timeline chips for anyone watching ──
    try {
      const io = getIO();
      io.to(`patient:${referral.patient._id}`).emit('referral:statusUpdated', chipPayload);
    } catch (socketErr) {
      // Don't fail the HTTP response if Socket.IO isn't ready (e.g. test environment)
      console.warn('[Referral Controller] Socket emit skipped:', socketErr.message);
    }

    // ── On closed: create Notification + emit to referring worker ──
    if (newStatus === 'closed' && referral.createdBy) {
      const createdById = referral.createdBy._id?.toString() || referral.createdBy.toString();
      const notifMessage =
        `Your referral for ${referral.patient.name} to ` +
        `${referral.toFacility.name} has been closed. ` +
        `Outcome: ${referral.outcomeNotes}`;

      // Fire-and-forget — don't block the response on notification save
      Notification.create({
        recipientUser: createdById,
        type:          'referral_closed',
        referral:      referral._id,
        patient:       referral.patient._id,
        message:       notifMessage,
        read:          false,
      }).then((notif) => {
        try {
          const io = getIO();
          io.to(`user:${createdById}`).emit('notification:new', {
            _id:       notif._id.toString(),
            type:      notif.type,
            message:   notif.message,
            referralId: referral._id.toString(),
            patientId:  referral.patient._id.toString(),
            patientName: referral.patient.name,
            createdAt: notif.createdAt,
            read:      false,
          });
        } catch (e) {
          console.warn('[Referral Controller] Notification socket emit skipped:', e.message);
        }
      }).catch((e) => {
        console.error('[Referral Controller] Failed to save Notification:', e.message);
      });
    }

    res.status(200).json({
      success: true,
      message: `Referral status updated to '${newStatus}'`,
      referral: {
        _id:            referral._id,
        status:         referral.status,
        outcomeNotes:   referral.outcomeNotes,
        statusHistory:  referral.statusHistory,
        updatedAt:      new Date(),
      },
    });
  } catch (error) {
    console.error('[Referral Controller] UpdateStatus Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update referral status.' });
  }
};

module.exports = { createReferral, getReferralById, getPatientReferrals, updateReferralStatus };
