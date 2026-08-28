const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Follow-up requires a patient reference'],
    },
    cohortType: {
      type: String,
      enum: ['maternal', 'child', 'chronic'],
      required: [true, 'Please specify cohort type (maternal, child, chronic)'],
    },
    relatedEncounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Encounter',
    },
    assignedFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, 'Follow-up requires an assigned facility'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Please specify a due date for the follow-up'],
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'missed'],
      default: 'pending',
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FollowUp', followUpSchema);
