/**
 * SetuCare Step 12 — Follow-Up Scheduling Engine
 *
 * All scheduling logic lives here. Nothing in this file touches MongoDB —
 * it returns plain data structures that the caller saves. Keeps it testable
 * and reusable from both the enrollment side-effect and the completion hook.
 *
 * Exports:
 *   generateMaternalSchedule(edd)          → [{ title, dueDate }] future milestones only
 *   getChronicInterval(conditions)         → Number (days), shortest-wins
 *   getChildInterval(ageYears)             → Number (days) by age bracket
 *   applyScheduling(options)               → async, creates FollowUp docs in MongoDB
 *   completePendingFollowUp(options)       → async, marks earliest pending complete + schedules next
 */

const FollowUp = require('../models/FollowUp');
const Patient  = require('../models/Patient');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Maternal milestones — offset in weeks relative to EDD (negative = before EDD)
const MATERNAL_MILESTONES = [
  { title: 'ANC-2',          weeksFromEdd: -14 },
  { title: 'ANC-3',          weeksFromEdd: -8  },
  { title: 'ANC-4',          weeksFromEdd: -4  },
  { title: 'Postnatal check', weeksFromEdd:  1  },
];

// Chronic cadence by condition (days). Shortest among patient's conditions wins.
const CHRONIC_CADENCE = {
  hypertension: 30,
  heart_disease: 30,
  tuberculosis: 30,
  diabetes: 90,
  asthma: 90,
  epilepsy: 90,
};
const CHRONIC_DEFAULT_INTERVAL = 60; // other / unspecified

// Child cadence by age bracket (days)
const CHILD_CADENCE = [
  { maxAgeYears: 1,   intervalDays: 30  },
  { maxAgeYears: 2,   intervalDays: 90  },
  { maxAgeYears: 5,   intervalDays: 180 },
];

// ---------------------------------------------------------------------------
// Pure helpers (no DB)
// ---------------------------------------------------------------------------

/**
 * Returns array of { title, dueDate } for all future ANC milestones.
 * Past milestones are silently excluded.
 */
function generateMaternalSchedule(edd) {
  if (!edd) return [];
  const eddDate = new Date(edd);
  const now     = new Date();
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  return MATERNAL_MILESTONES
    .map(({ title, weeksFromEdd }) => ({
      title,
      dueDate: new Date(eddDate.getTime() + weeksFromEdd * MS_PER_WEEK),
    }))
    .filter(({ dueDate }) => dueDate > now);
}

/**
 * Returns the shortest cadence (days) for the given conditions array.
 * Falls back to CHRONIC_DEFAULT_INTERVAL if no known conditions provided.
 */
function getChronicInterval(conditions = []) {
  if (!conditions.length) return CHRONIC_DEFAULT_INTERVAL;
  const intervals = conditions
    .map((c) => CHRONIC_CADENCE[c])
    .filter(Boolean);
  return intervals.length ? Math.min(...intervals) : CHRONIC_DEFAULT_INTERVAL;
}

/**
 * Returns the rolling check-in interval (days) for a child of the given age in years.
 */
function getChildInterval(ageYears) {
  for (const bracket of CHILD_CADENCE) {
    if (ageYears < bracket.maxAgeYears) return bracket.intervalDays;
  }
  return null; // age ≥ 5 — no child follow-up needed
}

// ---------------------------------------------------------------------------
// DB-touching helpers
// ---------------------------------------------------------------------------

/**
 * Add days to a date (returns new Date, doesn't mutate).
 */
function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * applyScheduling — generates FollowUp documents for a given cohort type.
 *
 * @param {Object} opts
 *   patient        Patient document (must have cohortMemberships, dob)
 *   cohortType     'maternal' | 'chronic' | 'child'
 *   workerId       ObjectId — assigned worker (the triggering encounter's worker)
 *   facilityId     ObjectId — assigned facility
 *   encounterId    ObjectId — the triggering encounter (optional)
 */
async function applyScheduling({ patient, cohortType, workerId, facilityId, encounterId } = {}) {
  const base = {
    patient:         patient._id,
    cohortType,
    assignedWorker:  workerId,
    assignedFacility: facilityId,
    relatedEncounter: encounterId,
    status: 'pending',
  };

  if (cohortType === 'maternal') {
    const membership = patient.cohortMemberships?.find(
      (m) => m.cohortType === 'maternal' && m.status === 'active'
    );
    if (!membership) return;

    const edd = membership.metadata?.expectedDeliveryDate;

    if (edd) {
      // Clear any not-yet-completed placeholder before generating real milestones
      await FollowUp.deleteMany({
        patient: patient._id,
        cohortType: 'maternal',
        status: 'pending',
        title: 'ANC check-in / Obtain EDD',
      });

      const milestones = generateMaternalSchedule(edd);
      if (!milestones.length) return;

      // Avoid duplicate milestones (re-running if EDD updates)
      const existingTitles = await FollowUp.find({
        patient: patient._id,
        cohortType: 'maternal',
        status: 'pending',
      }).distinct('title');

      const toCreate = milestones.filter((m) => !existingTitles.includes(m.title));
      if (!toCreate.length) return;

      await FollowUp.insertMany(
        toCreate.map((m) => ({ ...base, title: m.title, dueDate: m.dueDate }))
      );
    } else {
      // EDD unknown — create placeholder only if none exists
      const existingPlaceholder = await FollowUp.findOne({
        patient: patient._id,
        cohortType: 'maternal',
        status: 'pending',
      });
      if (!existingPlaceholder) {
        await FollowUp.create({
          ...base,
          title: 'ANC check-in / Obtain EDD',
          dueDate: addDays(new Date(), 14),
        });
      }
    }

  } else if (cohortType === 'chronic') {
    const membership = patient.cohortMemberships?.find(
      (m) => m.cohortType === 'chronic' && m.status === 'active'
    );
    if (!membership) return;

    // Don't generate if one is already pending
    const existing = await FollowUp.findOne({
      patient: patient._id,
      cohortType: 'chronic',
      status: 'pending',
    });
    if (existing) return;

    const intervalDays = getChronicInterval(membership.metadata?.conditions || []);
    await FollowUp.create({
      ...base,
      title: 'Chronic condition check-in',
      dueDate: addDays(new Date(), intervalDays),
    });

  } else if (cohortType === 'child') {
    if (!patient.dob) return;

    const ageYears = (Date.now() - new Date(patient.dob).getTime())
      / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears >= 5) return;

    // Don't generate if one is already pending
    const existing = await FollowUp.findOne({
      patient: patient._id,
      cohortType: 'child',
      status: 'pending',
    });
    if (existing) return;

    const intervalDays = getChildInterval(ageYears);
    if (!intervalDays) return;

    await FollowUp.create({
      ...base,
      title: 'Child growth & immunisation check',
      dueDate: addDays(new Date(), intervalDays),
    });
  }
}

/**
 * completePendingFollowUp — marks the earliest pending FollowUp for a patient
 * as completed, then generates the next occurrence.
 *
 * Called from:
 *   a) createEncounter when encounterType === 'follow_up'
 *   b) PATCH /api/followups/:id/complete (manual fallback)
 *
 * @param {Object} opts
 *   patientId      ObjectId
 *   followUpId     ObjectId | null  (null = auto-find earliest pending)
 *   workerId       ObjectId
 *   facilityId     ObjectId
 *   encounterId    ObjectId | null
 *   notes          String | null
 */
async function completePendingFollowUp({
  patientId,
  followUpId = null,
  workerId,
  facilityId,
  encounterId = null,
  notes = null,
} = {}) {
  // Find the target FollowUp
  const followUp = followUpId
    ? await FollowUp.findOne({ _id: followUpId, patient: patientId, status: 'pending' })
    : await FollowUp.findOne({ patient: patientId, status: 'pending' }).sort({ dueDate: 1 });

  if (!followUp) return null;

  followUp.status      = 'completed';
  followUp.completedAt = new Date();
  if (notes) followUp.notes = notes;
  await followUp.save();

  // Generate next occurrence if membership is still active
  const patient = await Patient.findById(patientId);
  if (!patient) return followUp;

  const { cohortType } = followUp;

  if (cohortType === 'maternal') {
    // Maternal is milestone-based — next milestone already exists in the schedule.
    // No new generation needed unless there are no more pending milestones,
    // in which case nothing to do.
    return followUp;
  }

  // For chronic and child: generate the next rolling occurrence
  const membership = cohortType === 'chronic'
    ? patient.cohortMemberships?.find(
        (m) => m.cohortType === 'chronic' && m.status === 'active'
      )
    : null; // child doesn't use memberships

  // Don't generate next if membership is deactivated/completed
  if (cohortType === 'chronic' && !membership) return followUp;

  await applyScheduling({
    patient,
    cohortType,
    workerId,
    facilityId,
    encounterId,
  });

  return followUp;
}

module.exports = {
  generateMaternalSchedule,
  getChronicInterval,
  getChildInterval,
  applyScheduling,
  completePendingFollowUp,
};
