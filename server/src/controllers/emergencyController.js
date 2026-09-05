/**
 * SetuCare Step 19 — Emergency Escalation Controller
 *
 * Two endpoints:
 *
 *   POST /api/emergency/declare
 *     Creates a minimal Encounter + an emergency Referral in one atomic action.
 *     Bypasses the triage rule engine — riskLevel is forced to 'emergency'.
 *     Routing uses walkToDistrictHospital() from the existing Step 7 helper.
 *     Emits 'referral:emergency' to the destination facility room.
 *
 *   PATCH /api/emergency/:referralId/escalate
 *     Escalates an existing referral to emergency status.
 *     Sets isEmergency=true, escalatedAt=now — does NOT change status.
 *     Re-fires 'referral:emergency' so the receiving facility gets the alert again.
 */

const Encounter  = require('../models/Encounter');
const Referral   = require('../models/Referral');
const Patient    = require('../models/Patient');
const Facility   = require('../models/Facility');
const { walkToDistrictHospital } = require('../utils/triageEngine');
const { getIO }  = require('../socket');

// ---------------------------------------------------------------------------
// Helper — emit the referral:emergency socket event to a facility room.
// Extracted so both declare and escalate share the same payload shape.
// ---------------------------------------------------------------------------
function emitEmergencyAlert(io, facilityId, payload) {
  try {
    io.to(`facility:${facilityId}`).emit('referral:emergency', payload);
  } catch (e) {
    console.warn('[Emergency] socket emit skipped:', e.message);
  }
}

// ---------------------------------------------------------------------------
// POST /api/emergency/declare
// ---------------------------------------------------------------------------
const declareEmergency = async (req, res) => {
  try {
    const { patient: patientId, vitals, description } = req.body;

    if (!patientId) {
      return res.status(400).json({ success: false, message: 'patient is required.' });
    }

    // ── Resolve worker's facility ──
    const fromFacilityId = req.user.facility?._id || req.user.facility;
    if (!fromFacilityId) {
      return res.status(400).json({
        success: false,
        message: 'Your account is not linked to a facility. Cannot declare an emergency.',
      });
    }

    // ── Verify patient ──
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    // ── Route to nearest district hospital via Step 7 chain-walker ──
    const districtHospital = await walkToDistrictHospital(fromFacilityId);
    if (!districtHospital) {
      return res.status(500).json({
        success: false,
        message: 'Could not find a district hospital in this facility\'s referral chain.',
      });
    }

    // ── Guard: cannot refer to self (if worker is already at district hospital) ──
    if (districtHospital._id.toString() === fromFacilityId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'This facility is the district hospital — emergency referral to self is not valid. Contact the specialist on duty directly.',
      });
    }

    const fromFacility = await Facility.findById(fromFacilityId).lean();

    const rationaleText = description?.trim()
      || 'Emergency declared by frontline worker — clinical judgment override';

    // ── Step 1: Create minimal Encounter with forced emergency triage ──
    const encounter = await Encounter.create({
      patient:      patient._id,
      facility:     fromFacilityId,
      worker:       req.user._id,
      encounterType: 'walk_in',
      // Vitals are optional — include if provided
      ...(vitals && { vitals }),
      triageResult: {
        riskLevel:        'emergency',
        rationale:        rationaleText,
        suggestedFacility: districtHospital._id,
        suggestedRouting: `${districtHospital.name} (${districtHospital.tier.replace('_', ' ')})`,
        tierSkipped:      true,           // always true — emergency skips tiers
        scoredAt:         new Date(),
      },
    });

    // ── Step 2: Create emergency Referral ──
    const referral = await Referral.create({
      patient:         patient._id,
      sourceEncounter: encounter._id,
      fromFacility:    fromFacilityId,
      toFacility:      districtHospital._id,
      createdBy:       req.user._id,
      reason:          rationaleText,
      status:          'created',
      isEmergency:     true,
      statusHistory:   [{ status: 'created', timestamp: new Date(), updatedBy: req.user._id }],
    });

    // ── Populate for response ──
    const populated = await Referral.findById(referral._id)
      .populate('patient',         'phid name dob gender')
      .populate('sourceEncounter', 'encounterType createdAt vitals triageResult')
      .populate('fromFacility',    'name tier district shortCode')
      .populate('toFacility',      'name tier district shortCode contactPhone');

    // ── Respond immediately ──
    res.status(201).json({
      success: true,
      message: `Emergency declared — routed to ${districtHospital.name} and facility notified.`,
      referral: populated,
      routedTo: {
        name:      districtHospital.name,
        tier:      districtHospital.tier,
        district:  districtHospital.district,
        shortCode: districtHospital.shortCode,
        contactPhone: districtHospital.contactPhone,
      },
    });

    // ── Step 3: Emit emergency alert AFTER response ──
    const io = getIO();
    const alertPayload = {
      referralId:   referral._id.toString(),
      patientName:  patient.name,
      patientPhid:  patient.phid,
      patientId:    patient._id.toString(),
      fromFacility: { name: fromFacility?.name, tier: fromFacility?.tier },
      reason:       rationaleText,
      riskLevel:    'emergency',
      isEmergency:  true,
      escalatedAt:  null,                 // declared at creation, not escalated
      createdAt:    referral.createdAt,
      status:       'created',
    };
    emitEmergencyAlert(io, districtHospital._id.toString(), alertPayload);

  } catch (error) {
    console.error('[Emergency] declareEmergency error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to declare emergency.' });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/emergency/:referralId/escalate
// ---------------------------------------------------------------------------
const escalateReferral = async (req, res) => {
  try {
    const { referralId } = req.params;
    const { reason }     = req.body;           // optional escalation note

    const referral = await Referral.findById(referralId)
      .populate('patient',      'phid name _id')
      .populate('fromFacility', 'name tier district shortCode')
      .populate('toFacility',   'name tier district shortCode contactPhone _id');

    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found.' });
    }

    if (referral.status === 'closed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot escalate a closed referral.',
      });
    }

    if (referral.isEmergency) {
      return res.status(400).json({
        success: false,
        message: 'This referral is already marked as emergency.',
      });
    }

    const escalatedAt = new Date();
    referral.isEmergency = true;
    referral.escalatedAt = escalatedAt;
    await referral.save();

    res.status(200).json({
      success: true,
      message: `Referral escalated to emergency — ${referral.toFacility?.name} re-alerted.`,
      referral,
    });

    // ── Re-fire the alert AFTER response ──
    const io = getIO();
    const escalationReason = reason?.trim()
      || `Condition deteriorated — escalated to emergency by ${req.user.name}`;

    const alertPayload = {
      referralId:   referral._id.toString(),
      patientName:  referral.patient?.name,
      patientPhid:  referral.patient?.phid,
      patientId:    referral.patient?._id?.toString(),
      fromFacility: { name: referral.fromFacility?.name, tier: referral.fromFacility?.tier },
      reason:       escalationReason,
      riskLevel:    'emergency',
      isEmergency:  true,
      escalatedAt:  escalatedAt.toISOString(),
      createdAt:    referral.createdAt,
      status:       referral.status,        // does NOT reset status
    };
    emitEmergencyAlert(io, referral.toFacility?._id?.toString(), alertPayload);

  } catch (error) {
    console.error('[Emergency] escalateReferral error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to escalate referral.' });
  }
};

module.exports = { declareEmergency, escalateReferral };
