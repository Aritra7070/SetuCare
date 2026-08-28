const mongoose = require('mongoose');

const scanLogSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    phid: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
      index: true,
    },
    scanSource: {
      type: String,
      enum: ['camera_qr', 'file_upload', 'manual_entry', 'direct_lookup'],
      default: 'camera_qr',
    },
    scannedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ScanLog', scanLogSchema);
