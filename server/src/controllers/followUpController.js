const FollowUp = require('../models/FollowUp');
const Patient  = require('../models/Patient');
const { completePendingFollowUp } = require('../utils/schedulingEngine');

/**
 * @desc    Manually complete a FollowUp (phone check-in fallback path — PRD §5)
 * @route   PATCH /api/followups/:id/complete
 * @access  Private (frontline_worker, medical_officer, admin)
 */
const completeFollowUp = async (req, res) => {
  try {
    const { notes } = req.body;

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      return res.status(404).json({ success: false, message: 'FollowUp not found.' });
    }
    if (followUp.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `FollowUp is already '${followUp.status}' — cannot complete again.`,
      });
    }

    const facilityId = req.user.facility?._id || req.user.facility;

    const completed = await completePendingFollowUp({
      patientId:  followUp.patient,
      followUpId: followUp._id,
      workerId:   req.user._id,
      facilityId,
      notes,
    });

    res.status(200).json({
      success: true,
      message: 'FollowUp marked complete. Next occurrence scheduled if applicable.',
      followUp: completed,
    });
  } catch (error) {
    console.error('[FollowUp Controller] complete Error:', error);
    res.status(500).json({ success: false, message: 'Failed to complete follow-up.' });
  }
};

/**
 * @desc    Get all follow-ups for a patient
 * @route   GET /api/followups?patient=:patientId
 * @access  Private (any authenticated user — cross-facility read)
 */
const getPatientFollowUps = async (req, res) => {
  try {
    const { patient: patientId, status } = req.query;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Provide ?patient=<id> query param.' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found.' });
    }

    const filter = { patient: patient._id };
    if (status) filter.status = status;

    const followUps = await FollowUp.find(filter)
      .populate('assignedWorker',   'name role')
      .populate('assignedFacility', 'name tier shortCode district')
      .populate('relatedEncounter', 'encounterType createdAt')
      .sort({ dueDate: 1 }); // soonest first

    res.status(200).json({ success: true, count: followUps.length, followUps });
  } catch (error) {
    console.error('[FollowUp Controller] getPatientFollowUps Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve follow-ups.' });
  }
};

module.exports = { completeFollowUp, getPatientFollowUps };
