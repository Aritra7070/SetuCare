/**
 * SetuCare Step 14 — Facility Dashboard Controller
 *
 * GET /api/dashboard/facility
 *   Implicitly scoped to req.user.facility — no facility id in the URL.
 *   This prevents an MO at Facility A from reading Facility B's numbers.
 *
 * Access: medical_officer, specialist, admin
 *
 * Response shape:
 * {
 *   referrals: {
 *     incoming: { unacknowledged, overdue, inProgress },
 *     outgoing: { open, closed }
 *   },
 *   followUps: {
 *     missedCount, dueTodayCount,
 *     byCohort: { maternal, child, chronic }
 *   },
 *   activity: { encountersToday }
 * }
 *
 * "Overdue" reuses Step 10's SLA thresholds:
 *   emergency → 30 min, urgent → 4 h, routine/none → 24 h
 */

const Referral  = require('../models/Referral');
const FollowUp  = require('../models/FollowUp');
const Encounter = require('../models/Encounter');

// ── SLA thresholds — identical to referralController getInbox ──
const OVERDUE_MS = {
  emergency: 30 * 60 * 1000,       // 30 minutes
  urgent:    4  * 60 * 60 * 1000,  // 4 hours
  routine:   24 * 60 * 60 * 1000,  // 24 hours
  none:      24 * 60 * 60 * 1000,  // no triage → treat as routine
};

/**
 * @desc  Facility-level snapshot dashboard
 * @route GET /api/dashboard/facility
 * @access Private — medical_officer, specialist, admin
 */
const getFacilityDashboard = async (req, res) => {
  try {
    const facilityId = req.user.facility?._id || req.user.facility;

    if (!facilityId) {
      return res.status(400).json({
        success: false,
        message: 'Your account has no assigned facility. Cannot load dashboard.',
      });
    }

    const now   = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);                                  // midnight local
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // ── Run all aggregations in parallel ────────────────────────────────────

    const [
      incomingOpen,      // referrals arriving at this facility, not yet closed
      outgoingReferrals, // referrals sent FROM this facility (any status)
      missedFollowUps,   // status === 'missed', assigned to this facility
      dueTodayFollowUps, // status === 'pending', dueDate today, assigned here
      encountersToday,   // encounters logged at this facility today
    ] = await Promise.all([

      // Panel A — incoming unacknowledged + in-progress
      Referral.find({ toFacility: facilityId, status: { $ne: 'closed' } })
        .select('status createdAt sourceEncounter')
        .populate({ path: 'sourceEncounter', select: 'triageResult createdAt' })
        .lean(),

      // Panel A — outgoing open/closed counts
      Referral.find({ fromFacility: facilityId })
        .select('status')
        .lean(),

      // Panel B — missed follow-ups (broken down by cohort)
      FollowUp.find({ assignedFacility: facilityId, status: 'missed' })
        .select('cohortType')
        .lean(),

      // Panel B — due today
      FollowUp.find({
        assignedFacility: facilityId,
        status:  'pending',
        dueDate: { $gte: today, $lt: tomorrow },
      })
        .select('cohortType')
        .lean(),

      // Panel C — encounters today
      Encounter.countDocuments({
        facility:  facilityId,
        createdAt: { $gte: today, $lt: tomorrow },
      }),
    ]);

    // ── Panel A: Referral Backlog ────────────────────────────────────────────

    let unacknowledged = 0;
    let overdue        = 0;
    let inProgress     = 0;

    for (const r of incomingOpen) {
      if (r.status === 'created') {
        unacknowledged++;
        // Check SLA overdue
        const riskLevel = r.sourceEncounter?.triageResult?.riskLevel || 'none';
        const threshold = OVERDUE_MS[riskLevel] ?? OVERDUE_MS.none;
        const ageMs     = now - new Date(r.createdAt).getTime();
        if (ageMs > threshold) overdue++;
      } else {
        // acknowledged or seen
        inProgress++;
      }
    }

    const outgoingOpen   = outgoingReferrals.filter(r => r.status !== 'closed').length;
    const outgoingClosed = outgoingReferrals.filter(r => r.status === 'closed').length;

    // ── Panel B: Follow-Up Status ────────────────────────────────────────────

    // Missed counts by cohort
    const missedByCohort = { maternal: 0, child: 0, chronic: 0 };
    for (const fu of missedFollowUps) {
      if (fu.cohortType in missedByCohort) missedByCohort[fu.cohortType]++;
    }

    // ── Assemble response ────────────────────────────────────────────────────

    res.status(200).json({
      success: true,
      facilityId: facilityId.toString(),
      referrals: {
        incoming: {
          unacknowledged,
          overdue,
          inProgress,
        },
        outgoing: {
          open:   outgoingOpen,
          closed: outgoingClosed,
        },
      },
      followUps: {
        missedCount:    missedFollowUps.length,
        dueTodayCount:  dueTodayFollowUps.length,
        byCohort:       missedByCohort,
      },
      activity: {
        encountersToday,
      },
    });
  } catch (error) {
    console.error('[Dashboard] getFacilityDashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load facility dashboard',
    });
  }
};

module.exports = { getFacilityDashboard };
