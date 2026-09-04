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
const Facility  = require('../models/Facility');
const StockItem = require('../models/StockItem');

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

// ── Median helper — pure JS, no extra dep ──────────────────────────────────
function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * @desc  District-level rollup dashboard for program managers
 * @route GET /api/dashboard/program?window=7d|30d|90d
 * @access Private — program_manager, admin ONLY
 *
 * Response shape:
 * {
 *   window, windowDays,
 *   summary: {
 *     totalReferrals, closedReferrals, completionRate,
 *     medianTimeToCloseHours, meanTimeToCloseHours,
 *     totalFollowUpsDue, missedFollowUps, missedRate,
 *     missedByCohort: { maternal, child, chronic }
 *   },
 *   facilities: [
 *     { facilityId, name, tier, district,
 *       completionRate, medianTimeToCloseHours,
 *       missedFollowUpRate, stockAlertsCount }
 *     // sorted worst-first by completionRate (ascending)
 *   ]
 * }
 *
 * Not live — refresh-on-load + manual refresh button (PRD §5).
 * Scaling note: at district scale, pre-computed rollups would replace this
 * live aggregation — noted in PRD as a known consideration, not built here.
 */
const getProgramDashboard = async (req, res) => {
  try {
    // ── Window parameter ────────────────────────────────────────────────────
    const VALID_WINDOWS = { '7d': 7, '30d': 30, '90d': 90 };
    const windowParam = req.query.window || '30d';
    const windowDays  = VALID_WINDOWS[windowParam] || 30;
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // ── Fetch all data in parallel ──────────────────────────────────────────
    const [
      allFacilities,
      referralsInWindow,
      followUpsInWindow,
      stockAlerts,
    ] = await Promise.all([
      Facility.find({ active: true }).select('_id name tier district shortCode').lean(),

      // All referrals created in window — include statusHistory for time-to-close
      Referral.find({ createdAt: { $gte: windowStart } })
        .select('status createdAt fromFacility toFacility statusHistory')
        .lean(),

      // All follow-ups whose dueDate falls in window
      FollowUp.find({ dueDate: { $gte: windowStart } })
        .select('status cohortType assignedFacility')
        .lean(),

      // Current low/out stock items — not time-windowed (snapshot)
      StockItem.find({ currentQuantity: { $lte: 0 } }).select('facility currentQuantity thresholdQuantity').lean(),
    ]);

    // ── Also grab items that are low (0 < qty <= threshold) ──────────────
    const lowStockItems = await StockItem.find({
      $expr: {
        $and: [
          { $gt: ['$currentQuantity', 0] },
          { $lte: ['$currentQuantity', '$thresholdQuantity'] }
        ]
      }
    }).select('facility').lean();

    const allAlertItems = [...stockAlerts, ...lowStockItems];

    // ── Pre-index by facility for O(1) lookups ──────────────────────────────
    const facilityMap = {};
    for (const f of allFacilities) {
      facilityMap[f._id.toString()] = {
        ...f,
        referrals:    [],   // created in window FROM or TO this facility
        followUps:    [],   // dueDate in window, assigned here
        stockAlerts:  0,
      };
    }

    // Stock alert counts per facility
    for (const item of allAlertItems) {
      const fid = item.facility?.toString();
      if (fid && facilityMap[fid]) facilityMap[fid].stockAlerts++;
    }

    // Assign follow-ups to their facility
    for (const fu of followUpsInWindow) {
      const fid = fu.assignedFacility?.toString();
      if (fid && facilityMap[fid]) facilityMap[fid].followUps.push(fu);
    }

    // ── District-wide referral aggregation ─────────────────────────────────
    let totalReferrals = referralsInWindow.length;
    let closedReferrals = 0;
    const closedDurationsHours = []; // for median/mean time-to-close

    for (const ref of referralsInWindow) {
      if (ref.status === 'closed') {
        closedReferrals++;
        // Find the closed entry in statusHistory
        const closedEntry = ref.statusHistory?.find(h => h.status === 'closed');
        if (closedEntry) {
          const diffHours =
            (new Date(closedEntry.timestamp) - new Date(ref.createdAt)) / 3_600_000;
          if (diffHours >= 0) closedDurationsHours.push(diffHours);
        }
      }

      // Tag referral to fromFacility for per-facility stats
      const fid = ref.fromFacility?.toString();
      if (fid && facilityMap[fid]) facilityMap[fid].referrals.push(ref);
    }

    // ── District-wide follow-up aggregation ────────────────────────────────
    const missedAll = followUpsInWindow.filter(fu => fu.status === 'missed');
    const dueAll    = followUpsInWindow.filter(fu => fu.status !== 'completed');

    const missedByCohort = { maternal: 0, child: 0, chronic: 0 };
    for (const fu of missedAll) {
      if (fu.cohortType in missedByCohort) missedByCohort[fu.cohortType]++;
    }

    const medianHours = median(closedDurationsHours);
    const meanHours   = closedDurationsHours.length
      ? closedDurationsHours.reduce((a, b) => a + b, 0) / closedDurationsHours.length
      : null;

    // ── Per-facility rollup ────────────────────────────────────────────────
    const facilities = allFacilities.map(f => {
      const fid = f._id.toString();
      const fd  = facilityMap[fid];

      const fTotal   = fd.referrals.length;
      const fClosed  = fd.referrals.filter(r => r.status === 'closed').length;
      const fRate    = fTotal > 0 ? Math.round((fClosed / fTotal) * 100) : null;

      // Median time-to-close for this facility
      const fDurations = [];
      for (const r of fd.referrals) {
        if (r.status === 'closed') {
          const ce = r.statusHistory?.find(h => h.status === 'closed');
          if (ce) {
            const h = (new Date(ce.timestamp) - new Date(r.createdAt)) / 3_600_000;
            if (h >= 0) fDurations.push(h);
          }
        }
      }

      const fMissed = fd.followUps.filter(fu => fu.status === 'missed').length;
      const fDue    = fd.followUps.filter(fu => fu.status !== 'completed').length;
      const fMissedRate = fDue > 0 ? Math.round((fMissed / fDue) * 100) : null;

      return {
        facilityId:              fid,
        name:                    f.name,
        tier:                    f.tier,
        district:                f.district,
        shortCode:               f.shortCode,
        totalReferrals:          fTotal,
        completionRate:          fRate,          // null = no data
        medianTimeToCloseHours:  median(fDurations),
        missedFollowUps:         fMissed,
        totalFollowUpsDue:       fDue,
        missedFollowUpRate:      fMissedRate,    // null = no data
        stockAlertsCount:        fd.stockAlerts,
      };
    });

    // ── Sort worst-first by completionRate (ascending, nulls last) ─────────
    facilities.sort((a, b) => {
      if (a.completionRate === null && b.completionRate === null) return 0;
      if (a.completionRate === null) return 1;  // no data → bottom
      if (b.completionRate === null) return -1;
      return a.completionRate - b.completionRate; // lowest rate first
    });

    res.status(200).json({
      success: true,
      window:   windowParam,
      windowDays,
      summary: {
        totalReferrals,
        closedReferrals,
        completionRate: totalReferrals > 0
          ? Math.round((closedReferrals / totalReferrals) * 100)
          : null,
        medianTimeToCloseHours: medianHours !== null ? Math.round(medianHours * 10) / 10 : null,
        meanTimeToCloseHours:   meanHours   !== null ? Math.round(meanHours   * 10) / 10 : null,
        totalFollowUpsDue: dueAll.length,
        missedFollowUps:   missedAll.length,
        missedRate: dueAll.length > 0
          ? Math.round((missedAll.length / dueAll.length) * 100)
          : null,
        missedByCohort,
      },
      facilities,
    });
  } catch (error) {
    console.error('[Dashboard] getProgramDashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load program dashboard',
    });
  }
};

module.exports = { getFacilityDashboard, getProgramDashboard };
