const mongoose = require('mongoose');
const { SYMPTOM_TAGS } = require('../utils/symptomTags');
const { CHRONIC_CONDITIONS } = require('../utils/chronicConditions');

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
      // PRD §3: structured numbers so Step 7 can compare systolic > 140, etc.
      bp: {
        systolic: { type: Number },
        diastolic: { type: Number },
      },
      tempC: { type: Number },
      pulse: { type: Number },
      weightKg: { type: Number },
      spo2: { type: Number },
    },
    // PRD §3: controlled tag IDs validated against SYMPTOM_TAGS vocab.
    // Step 7 triage rule engine pattern-matches these IDs directly.
    symptoms: [
      {
        type: String,
        trim: true,
        enum: {
          values: SYMPTOM_TAGS,
          message: '"{VALUE}" is not a recognised symptom tag. Use a valid SYMPTOM_TAGS id.',
        },
      },
    ],
    // Free-text catch-all — NOT parsed by triage (PRD §3)
    otherSymptoms: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    triageResult: {
      riskLevel: {
        type: String,
        enum: ['routine', 'urgent', 'emergency'],
      },
      // Human-readable explanation — always shown alongside the badge
      rationale: {
        type: String,
        trim: true,
      },
      // Display string kept for fast rendering: "Nashik District Hospital (district hospital)"
      suggestedRouting: {
        type: String,
        trim: true,
      },
      // Facility ObjectId — Step 8 referral form pre-fills from this
      suggestedFacility: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Facility',
        default: null,
      },
      // PRD §2: true when emergency routing skipped tiers straight to district_hospital
      tierSkipped: {
        type: Boolean,
        default: false,
      },
      // ISO timestamp of when triage was last run
      scoredAt: {
        type: Date,
      },
    },
    encounterType: {
      type: String,
      enum: ['walk_in', 'follow_up', 'referral_consult'],
      default: 'walk_in',
    },
    // Step 11 — clinical flags captured at visit time (immutable with the encounter)
    // These trigger cohort enrollment as a server-side side effect on creation.
    clinicalFlags: {
      pregnant: { type: Boolean },
      expectedDeliveryDate: { type: Date },
      chronicConditions: [
        {
          type: String,
          trim: true,
          enum: {
            values: CHRONIC_CONDITIONS,
            message: '"{VALUE}" is not a recognised chronic condition tag.',
          },
        },
      ],
      otherConditions: { type: String, trim: true }, // free-text catch-all
    },
  },
  {
    // PRD §5: immutable audit trail — updatedAt intentionally omitted
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('Encounter', encounterSchema);
