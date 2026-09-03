/**
 * SetuCare Step 13 — Missed Follow-Up Detection & Escalation Job
 *
 * Run modes:
 *   1. Daily cron — scheduled in server/src/index.js via node-cron
 *   2. On-demand  — POST /api/admin/run-followup-check (admin/program_manager)
 *      Same function both ways; this is the demo-ability path.
 *
 * What it does per run:
 *   A) Overdue sweep (dueDate < today, status 'pending')
 *      → marks missed
 *      → Tier-1: notifies assignedWorker once (notifiedAt guard)
 *      → Tier-2: 7+ days overdue → fan out to all MOs at assignedFacility (escalatedAt guard)
 *
 *   B) Due-today reminders (dueDate === today, status 'pending')
 *      → notifies assignedWorker (no guard needed — job runs once/day)
 *
 * Idempotency:
 *   notifiedAt  prevents duplicate Tier-1 notifications on repeated runs
 *   escalatedAt prevents duplicate Tier-2 fan-out on repeated runs
 *   A 'missed' follow-up that's already been notified is simply skipped
 */

const FollowUp     = require('../models/FollowUp');
const Notification = require('../models/Notification');
const User         = require('../models/User');

// Adjustable thresholds (days) — change these without touching logic
const ESCALATION_THRESHOLD_DAYS = 7;

/**
 * Emit a socket notification to a user room if Socket.IO is available.
 * Swallows errors silently — sockets are nice-to-have, not required for correctness.
 */
function emitNotification(payload) {
  try {
    const { getIO } = require('../socket');
    const io = getIO();
    io.to(`user:${payload.recipientUser}`).emit('notification:new', payload);
  } catch (_) {
    // Socket not available (e.g. test environment) — silent
  }
}

/**
 * Step 14 — Emit a follow-up status change to the facility room so the
 * dashboard follow-up panel updates live without a page refresh.
 *
 * @param {string|ObjectId} facilityId
 * @param {'followup:missed'|'followup:due_today'} event
 * @param {object} payload  — forwarded as-is to subscribed clients
 */
function emitFacilityFollowUp(facilityId, event, payload) {
  try {
    const { getIO } = require('../socket');
    getIO().to(`facility:${facilityId}`).emit(event, payload);
  } catch (_) {
    // Socket not available — silent
  }
}

/**
 * runFollowUpCheck — core detection function.
 * Returns a summary object for the manual API response.
 */
async function runFollowUpCheck() {
  const now     = new Date();
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const escalationCutoff = new Date(today.getTime() - ESCALATION_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const summary = {
    missedMarked: 0,
    workerNotified: 0,
    escalated: 0,
    dueTodayReminders: 0,
    errors: [],
  };

  // ── A. Overdue sweep ─────────────────────────────────────────────────────
  const overdueFollowUps = await FollowUp.find({
    status: 'pending',
    dueDate: { $lt: today },
  })
    .populate('patient',         'name phid')
    .populate('assignedWorker',  '_id name')
    .populate('assignedFacility', '_id name');

  for (const fu of overdueFollowUps) {
    try {
      let dirty = false;

      // Mark missed (status was 'pending')
      fu.status = 'missed';
      dirty = true;
      summary.missedMarked++;

      // Step 14 — push to facility dashboard room so follow-up panel updates live
      if (fu.assignedFacility) {
        emitFacilityFollowUp(fu.assignedFacility._id, 'followup:missed', {
          followUpId:  fu._id.toString(),
          cohortType:  fu.cohortType,
          patientId:   fu.patient?._id?.toString(),
          patientName: fu.patient?.name,
          dueDate:     fu.dueDate,
        });
      }

      // ── Tier-1: worker notification (once only) ──
      if (fu.assignedWorker && !fu.notifiedAt) {
        const msg =
          `Missed follow-up: ${fu.patient?.name || 'Patient'} — ` +
          `${fu.title} was due ${fu.dueDate.toDateString()}`;

        const notif = await Notification.create({
          recipientUser: fu.assignedWorker._id,
          type:    'follow_up_missed',
          followUp: fu._id,
          patient:  fu.patient?._id,
          message:  msg,
          read:     false,
        });

        emitNotification({
          recipientUser: fu.assignedWorker._id.toString(),
          _id:       notif._id.toString(),
          type:      notif.type,
          message:   msg,
          followUpId: fu._id.toString(),
          patientId:  fu.patient?._id?.toString(),
          patientName: fu.patient?.name,
          createdAt: notif.createdAt,
          read: false,
        });

        fu.notifiedAt = now;
        summary.workerNotified++;
      }

      // ── Tier-2: escalation to MOs (7+ days overdue, once only) ──
      if (fu.dueDate < escalationCutoff && !fu.escalatedAt && fu.assignedFacility) {
        const medOfficers = await User.find({
          facility: fu.assignedFacility._id,
          role:     'medical_officer',
        }).select('_id name');

        if (medOfficers.length > 0) {
          const escalationMsg =
            `ESCALATION: Follow-up for ${fu.patient?.name || 'Patient'} ` +
            `(${fu.patient?.phid || ''}) has been missed for 7+ days — ` +
            `${fu.title} was due ${fu.dueDate.toDateString()}. ` +
            `Assigned to: ${fu.assignedWorker?.name || 'unassigned'}.`;

          for (const mo of medOfficers) {
            const notif = await Notification.create({
              recipientUser: mo._id,
              type:    'follow_up_escalated',
              followUp: fu._id,
              patient:  fu.patient?._id,
              message:  escalationMsg,
              read:     false,
            });

            emitNotification({
              recipientUser: mo._id.toString(),
              _id:       notif._id.toString(),
              type:      notif.type,
              message:   escalationMsg,
              followUpId: fu._id.toString(),
              patientId:  fu.patient?._id?.toString(),
              patientName: fu.patient?.name,
              createdAt: notif.createdAt,
              read: false,
            });
          }

          fu.escalatedAt = now;
          summary.escalated++;
        }
      }

      if (dirty) await fu.save();
    } catch (err) {
      console.error(`[FollowUpJob] Error processing followUp ${fu._id}:`, err.message);
      summary.errors.push({ followUpId: fu._id.toString(), error: err.message });
    }
  }

  // ── B. Due-today reminders ───────────────────────────────────────────────
  const dueTodayFollowUps = await FollowUp.find({
    status:  'pending',
    dueDate: { $gte: today, $lt: tomorrow },
  })
    .populate('patient',          'name phid')
    .populate('assignedWorker',   '_id name')
    .populate('assignedFacility', '_id name');

  for (const fu of dueTodayFollowUps) {
    try {
      if (!fu.assignedWorker) continue;

      const msg =
        `Follow-up due today: ${fu.patient?.name || 'Patient'} — ${fu.title}`;

      const notif = await Notification.create({
        recipientUser: fu.assignedWorker._id,
        type:    'follow_up_due_today',
        followUp: fu._id,
        patient:  fu.patient?._id,
        message:  msg,
        read:     false,
      });

      emitNotification({
        recipientUser: fu.assignedWorker._id.toString(),
        _id:       notif._id.toString(),
        type:      notif.type,
        message:   msg,
        followUpId: fu._id.toString(),
        patientId:  fu.patient?._id?.toString(),
        patientName: fu.patient?.name,
        createdAt: notif.createdAt,
        read: false,
      });

      // Step 14 — push to facility dashboard room so follow-up panel updates live
      if (fu.assignedFacility) {
        emitFacilityFollowUp(fu.assignedFacility, 'followup:due_today', {
          followUpId:  fu._id.toString(),
          cohortType:  fu.cohortType,
          patientId:   fu.patient?._id?.toString(),
          patientName: fu.patient?.name,
          dueDate:     fu.dueDate,
        });
      }

      summary.dueTodayReminders++;
    } catch (err) {
      console.error(`[FollowUpJob] Error on due-today ${fu._id}:`, err.message);
      summary.errors.push({ followUpId: fu._id.toString(), error: err.message });
    }
  }

  console.log(
    `[FollowUpJob] Run complete — missed: ${summary.missedMarked}, ` +
    `notified: ${summary.workerNotified}, escalated: ${summary.escalated}, ` +
    `due-today: ${summary.dueTodayReminders}, errors: ${summary.errors.length}`
  );

  return summary;
}

module.exports = { runFollowUpCheck };
