const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'FollowUp requires a patient reference'],
      index: true,
    },
    cohortType: {
      type: String,
      enum: ['maternal', 'child', 'chronic'],
      required: [true, 'Please specify cohort type'],
      index: true,
    },
    // Human-readable task name e.g. "ANC-3", "Chronic check-in", "Child growth check"
    title: {
      type: String,
      trim: true,
      default: 'Follow-up visit',
    },
    relatedEncounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Encounter',
    },
    // Worker assigned — the one who logged the triggering Encounter (PRD §8.1)
    assignedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    assignedFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, 'FollowUp requires an assigned facility'],
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Please specify a due date for the follow-up'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'missed'],
      default: 'pending',
      index: true,
    },
    completedAt: { type: Date },
    notes:       { type: String, trim: true },
    // Step 13 — idempotency guards (prevent re-notification on repeat job runs)
    notifiedAt:  { type: Date, default: null }, // set when worker notification fires
    escalatedAt: { type: Date, default: null }, // set when MO escalation fires
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FollowUp', followUpSchema);
