const mongoose = require('mongoose');

const teleconsultSessionSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    sourceEncounter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Encounter',
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedFromFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
    },
    targetFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
      index: true,
    },
    // Unique room ID — both peers connect to this room via PeerJS
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['requested', 'active', 'ended', 'declined'],
      default: 'requested',
      index: true,
    },
    requestedAt: { type: Date, default: Date.now },
    startedAt:   { type: Date },
    endedAt:     { type: Date },
    // Optional post-call notes — can link back to an Encounter via Step 5
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeleconsultSession', teleconsultSessionSchema);
