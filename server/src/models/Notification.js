const mongoose = require('mongoose');

/**
 * Notification — persisted alerts for events that matter even when the
 * recipient is not currently looking at the relevant screen.
 *
 * Step 9 uses type 'referral_closed' exclusively.
 * Future steps can add new types (referral_acknowledged, follow_up_due, etc.)
 * without schema migrations — just add values to the enum.
 */
const notificationSchema = new mongoose.Schema(
  {
    recipientUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'referral_closed',
        'referral_acknowledged',
        'referral_seen',
        'follow_up_due',
        'follow_up_due_today',   // Step 13 — same-day reminder to assigned worker
        'follow_up_missed',      // Step 13 — Tier-1: assigned worker
        'follow_up_escalated',   // Step 13 — Tier-2: MO at assigned facility
      ],
      required: true,
    },
    // The referral this notification concerns
    referral: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Referral',
    },
    // The follow-up this notification concerns (Step 13)
    followUp: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FollowUp',
    },
    // The patient this notification concerns (for deep-link navigation)
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
    },
    message: {
      type: String,
      trim: true,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
