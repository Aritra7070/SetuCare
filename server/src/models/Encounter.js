const mongoose = require('mongoose');

const encounterSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Encounter requires a patient reference'],
    },
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, 'Encounter requires a facility reference'],
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Encounter requires a healthcare worker reference'],
    },
    vitals: {
      bp: { type: String, trim: true },
      tempC: { type: Number },
      pulse: { type: Number },
      weightKg: { type: Number },
      spo2: { type: Number },
    },
    symptoms: [
      {
        type: String,
        trim: true,
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
    triageResult: {
      riskLevel: {
        type: String,
        enum: ['routine', 'urgent', 'emergency'],
      },
      suggestedRouting: {
        type: String,
        trim: true,
      },
    },
    encounterType: {
      type: String,
      enum: ['walk_in', 'follow_up', 'referral_consult'],
      default: 'walk_in',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('Encounter', encounterSchema);
