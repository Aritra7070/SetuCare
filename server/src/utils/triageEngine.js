/**
 * SetuCare Digital Triage Rule Engine — Step 7
 *
 * Converts an Encounter's structured vitals + symptom IDs into:
 *   { riskLevel, rationale, suggestedFacility }
 *
 * Design constraints (from PRD §1 and §3):
 *   - No ML — pure rule table, highest severity wins
 *   - Every output carries a human-readable rationale string
 *   - Emergency routing skips tiers straight to a district_hospital
 *   - Urgent routing suggests the immediate parentFacility (one tier up)
 *   - Routine produces no routing suggestion
 *
 * The function is pure (no DB calls) — the controller handles DB reads/writes.
 * The separate walkToDistrictHospital() helper is exported for reuse by Step 19.
 */

const Facility = require('../models/Facility');

// ---------------------------------------------------------------------------
// Rule table
// Each rule: { test(vitals, symptoms) → bool, riskLevel, rationale }
// Checked in declaration order — first match wins within each priority group.
// Emergency rules are listed first so they always take precedence.
// ---------------------------------------------------------------------------

/** @param {string[]} symptoms @param {...string} tags */
const has = (symptoms, ...tags) => tags.every((t) => symptoms.includes(t));
const hasAny = (symptoms, ...tags) => tags.some((t) => symptoms.includes(t));

const RULES = [
  // ── Priority 1: Emergency ──────────────────────────────────────────────
  {
    riskLevel: 'emergency',
    rationale: 'Critically low oxygen saturation',
    test: (v) => v.spo2 != null && v.spo2 < 85,
  },
  {
    riskLevel: 'emergency',
    rationale: 'Blood pressure in a dangerous range',
    test: (v) =>
      v.bp?.systolic != null && (v.bp.systolic > 180 || v.bp.systolic < 80),
  },
  {
    riskLevel: 'emergency',
    rationale: 'Body temperature in a dangerous range',
    test: (v) => v.tempC != null && (v.tempC > 40 || v.tempC < 35),
  },
  {
    riskLevel: 'emergency',
    rationale: 'Heart rate in a critical range',
    test: (v) => v.pulse != null && (v.pulse > 150 || v.pulse < 40),
  },
  {
    riskLevel: 'emergency',
    rationale: 'Possible obstetric emergency',
    test: (_, s) => has(s, 'anc_bleeding', 'anc_reduced_movement'),
  },
  {
    riskLevel: 'emergency',
    rationale: 'Possible cardiac / respiratory emergency signs',
    test: (_, s) => has(s, 'breathlessness', 'anc_swelling'),
  },

  // ── Priority 2: Urgent ─────────────────────────────────────────────────
  {
    riskLevel: 'urgent',
    rationale: 'Reduced fetal movement needs prompt evaluation',
    test: (_, s) => s.includes('anc_reduced_movement'),
  },
  {
    riskLevel: 'urgent',
    rationale: 'Possible infection with dehydration risk',
    test: (_, s) => has(s, 'fever', 'vomiting'),
  },
  {
    riskLevel: 'urgent',
    rationale: 'Oxygen saturation below normal',
    test: (v) => v.spo2 != null && v.spo2 >= 85 && v.spo2 <= 94,
  },
  {
    riskLevel: 'urgent',
    rationale: 'Elevated blood pressure',
    test: (v) =>
      v.bp?.systolic != null &&
      v.bp.systolic >= 140 &&
      v.bp.systolic <= 180,
  },

  // ── Priority 3: Routine fallback ───────────────────────────────────────
  {
    riskLevel: 'routine',
    rationale: 'No red-flag findings; continue routine care',
    test: () => true,
  },
];

// ---------------------------------------------------------------------------
// Facility-chain walker
// Walks the parentFacility chain from `startFacilityId` until it finds a
// district_hospital tier. Returns that Facility document, or null if the
// chain has no district_hospital (shouldn't happen in a well-seeded network).
//
// Exported separately so Step 19 emergency escalation can reuse this without
// importing the whole rule engine.
// ---------------------------------------------------------------------------

/** @param {string|import('mongoose').Types.ObjectId} startFacilityId */
async function walkToDistrictHospital(startFacilityId) {
  let currentId = startFacilityId;
  const visited = new Set(); // guard against circular references in bad seed data

  while (currentId) {
    if (visited.has(currentId.toString())) break;
    visited.add(currentId.toString());

    const facility = await Facility.findById(currentId).lean();
    if (!facility) break;

    if (facility.tier === 'district_hospital') return facility;

    currentId = facility.parentFacility || null;
  }

  // Fallback: if no district_hospital found in chain, return any active one
  return Facility.findOne({ tier: 'district_hospital', active: true }).lean();
}

// ---------------------------------------------------------------------------
// Main engine function
// Does NOT touch the database — caller provides vitals/symptoms/facilityId.
// Returns { riskLevel, rationale, suggestedFacility } where suggestedFacility
// is a Facility document (or null for routine).
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   vitals: { bp?: { systolic?: number, diastolic?: number }, tempC?: number, pulse?: number, spo2?: number, weightKg?: number },
 *   symptoms: string[],
 *   facilityId: string|import('mongoose').Types.ObjectId
 * }} input
 * @returns {Promise<{ riskLevel: string, rationale: string, suggestedFacility: object|null }>}
 */
async function runTriage({ vitals = {}, symptoms = [], facilityId }) {
  const v = vitals;
  const s = Array.isArray(symptoms) ? symptoms : [];

  // Evaluate rules in order — first match wins
  let matchedRule = null;
  for (const rule of RULES) {
    if (rule.test(v, s)) {
      matchedRule = rule;
      break;
    }
  }

  // Should never happen (routine fallback always matches), but be defensive
  if (!matchedRule) {
    return {
      riskLevel: 'routine',
      rationale: 'No red-flag findings; continue routine care',
      suggestedFacility: null,
    };
  }

  let suggestedFacility = null;

  if (matchedRule.riskLevel === 'emergency' && facilityId) {
    // Skip tiers — walk chain all the way to a district_hospital
    suggestedFacility = await walkToDistrictHospital(facilityId);
  } else if (matchedRule.riskLevel === 'urgent' && facilityId) {
    // One tier up — just the immediate parentFacility
    const current = await Facility.findById(facilityId).lean();
    if (current?.parentFacility) {
      suggestedFacility = await Facility.findById(current.parentFacility).lean();
    }
    // If no parentFacility (e.g. already at top tier), walk to district hospital
    if (!suggestedFacility) {
      suggestedFacility = await walkToDistrictHospital(facilityId);
    }
  }

  return {
    riskLevel: matchedRule.riskLevel,
    rationale: matchedRule.rationale,
    suggestedFacility,
  };
}

module.exports = { runTriage, walkToDistrictHospital };
