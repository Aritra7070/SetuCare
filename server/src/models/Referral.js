const mongoose = require('mongoose');

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['created', 'acknowledged', 'seen', 'closed'],
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: false }
);

const referralSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Referral requires a patient reference'],
    },
    sourceEncounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Encounter',
      required: [true, 'Referral requires a source encounter reference'],
      unique: true, // PRD §3: one referral per encounter, enforced at DB layer
    },
    fromFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, 'Referral requires a referring origin facility'],
    },
    toFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: [true, 'Referral requires a destination facility'],
    },
    // PRD §4 / Step 9: the worker who created the referral.
    // Used to target the closed-referral notification back to them.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reason: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['created', 'acknowledged', 'seen', 'closed'],
      default: 'created',
    },
    statusHistory: [statusHistorySchema],
    outcomeNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-push initial status to statusHistory on creation if empty
referralSchema.pre('save', function (next) {
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
      {
        status: this.status || 'created',
        timestamp: new Date(),
      },
    ];
  }
  next();
});

module.exports = mongoose.model('Referral', referralSchema);
