const mongoose = require('mongoose');

/**
 * StockItem — one document per facility per catalog item.
 *
 * Stock status (available / low / out) is COMPUTED at query time, not stored:
 *   out       qty === 0
 *   low       0 < qty <= threshold
 *   available qty > threshold
 *
 * lowStockNotifiedAt enables alert re-arming:
 *   Set when a stock-out/low notification fires.
 *   Cleared when qty recovers above threshold.
 *   This means a second stock-out after recovery will re-notify, not stay silent.
 */
const stockItemSchema = new mongoose.Schema(
  {
    facility: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['medicine', 'diagnostic_test'],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      required: true,
    },
    category: {
      type: String,
      enum: ['maternal', 'chronic', 'general'],
      required: true,
      index: true,
    },
    currentQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'units',
    },
    thresholdQuantity: {
      type: Number,
      default: 5,
      min: 0,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastUpdatedAt: {
      type: Date,
    },
    // Idempotency guard for low-stock notifications (Step 15 §5)
    lowStockNotifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index — fast per-facility + per-category lookups
stockItemSchema.index({ facility: 1, category: 1 });
stockItemSchema.index({ facility: 1, name: 1 }, { unique: true });

/**
 * Virtual: computed stock status — never stored, always fresh.
 */
stockItemSchema.virtual('status').get(function () {
  if (this.currentQuantity === 0) return 'out';
  if (this.currentQuantity <= this.thresholdQuantity) return 'low';
  return 'available';
});

stockItemSchema.set('toJSON', { virtuals: true });
stockItemSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StockItem', stockItemSchema);
