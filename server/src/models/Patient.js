const mongoose = require('mongoose');

const cohortMembershipSchema = new mongoose.Schema(
  {
    cohortType: {
      type: String,
      enum: ['maternal', 'chronic'],
      required: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'inactive'],
      default: 'active',
    },
    metadata: {
      // maternal only
      expectedDeliveryDate: { type: Date },
      // chronic only — controlled tag list (see chronicConditions.js)
      conditions: [{ type: String, trim: true }],
    },
  },
  { _id: true }
);

const patientSchema = new mongoose.Schema(
  {
    phid: {
      type: String,
      required: [true, 'Patient Health ID (PHID) is required'],
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Patient name is required'],
      trim: true,
    },
    dob: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
    guardianName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    registeredAtFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'as', 'bn', 'brx', 'doi', 'gu', 'hi', 'kn', 'ks', 'kok', 'mai', 'ml', 'mni', 'mr', 'ne', 'or', 'pa', 'sa', 'sat', 'sd', 'ta', 'te', 'ur'],
      default: 'mr',
    },
    // Step 11 — high-risk cohort memberships
    // Child cohort is NOT stored here — computed live from dob < 5 years
    cohortMemberships: [cohortMembershipSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Patient', patientSchema);
