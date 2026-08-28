const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a facility name'],
      trim: true,
    },
    shortCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    tier: {
      type: String,
      enum: ['sub_centre', 'phc', 'rural_hospital', 'district_hospital'],
      required: [true, 'Please specify facility tier'],
      index: true,
    },
    parentFacility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      default: null,
      index: true,
    },
    location: {
      lat: {
        type: Number,
      },
      lng: {
        type: Number,
      },
    },
    district: {
      type: String,
      trim: true,
      index: true,
    },
    state: {
      type: String,
      default: 'Maharashtra',
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Facility', facilitySchema);
