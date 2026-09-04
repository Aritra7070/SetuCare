const StockItem    = require('../models/StockItem');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const { getIO }    = require('../socket');

// ---------------------------------------------------------------------------
// Low-stock notification helper — mirrors Step 13 fan-out pattern
// ---------------------------------------------------------------------------
async function notifyLowStock(stockItem, updatedByName) {
  if (!stockItem.facility) return;
  try {
    const medOfficers = await User.find({
      facility: stockItem.facility,
      role:     'medical_officer',
    }).select('_id');

    // Also notify admin users at this facility
    const admins = await User.find({
      facility: stockItem.facility,
      role:     'admin',
    }).select('_id');

    const recipients = [...medOfficers, ...admins];
    if (!recipients.length) return;

    const statusLabel = stockItem.currentQuantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK';
    const message =
      `${statusLabel}: ${stockItem.name} at your facility — ` +
      `${stockItem.currentQuantity} ${stockItem.unit} remaining` +
      (updatedByName ? ` (updated by ${updatedByName})` : '');

    for (const r of recipients) {
      const notif = await Notification.create({
        recipientUser: r._id,
        type:    'stock_low',
        patient: null,
        message,
        read:    false,
      });

      try {
        const io = getIO();
        io.to(`user:${r._id}`).emit('notification:new', {
          _id:       notif._id.toString(),
          type:      notif.type,
          message,
          createdAt: notif.createdAt,
          read:      false,
        });
      } catch (_) {}
    }
  } catch (err) {
    console.error('[Stock] Notification error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/stock/:itemId — update quantity (any facility member)
// ---------------------------------------------------------------------------
const updateStockItem = async (req, res) => {
  try {
    const { currentQuantity } = req.body;

    if (currentQuantity === undefined || currentQuantity === null) {
      return res.status(400).json({ success: false, message: 'currentQuantity is required.' });
    }
    const qty = Number(currentQuantity);
    if (isNaN(qty) || qty < 0) {
      return res.status(400).json({ success: false, message: 'currentQuantity must be a non-negative number.' });
    }

    const item = await StockItem.findById(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Stock item not found.' });

    // Facility check — any member of the item's facility may update
    const userFacilityId = (req.user.facility?._id || req.user.facility)?.toString();
    if (req.user.role !== 'admin' && userFacilityId !== item.facility?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only update stock for your own facility.',
      });
    }

    const wasAboveThreshold = item.currentQuantity > item.thresholdQuantity;
    const wasLowOrOut       = item.currentQuantity <= item.thresholdQuantity;

    item.currentQuantity  = qty;
    item.lastUpdatedBy    = req.user._id;
    item.lastUpdatedAt    = new Date();

    const nowLow  = qty <= item.thresholdQuantity;
    const nowOut  = qty === 0;

    // ── Low-stock notification logic ──
    // Fire notification only when crossing INTO low/out (not already notified)
    if (nowLow && wasAboveThreshold && !item.lowStockNotifiedAt) {
      await item.save();
      item.lowStockNotifiedAt = new Date();
      await item.save();
      notifyLowStock(item, req.user.name); // fire-and-forget
    } else if (!nowLow && wasLowOrOut) {
      // Recovered above threshold — re-arm the alert
      item.lowStockNotifiedAt = null;
      await item.save();
    } else {
      await item.save();
    }

    res.status(200).json({
      success: true,
      message: `${item.name} updated to ${qty} ${item.unit}`,
      item: item.toJSON(),
    });
  } catch (error) {
    console.error('[Stock Controller] update Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update stock item.' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/stock/my — own facility full inventory list
// ---------------------------------------------------------------------------
const getMyStock = async (req, res) => {
  try {
    const facilityId = req.user.facility?._id || req.user.facility;
    if (!facilityId) {
      return res.status(400).json({ success: false, message: 'No facility linked to your account.' });
    }

    const { category } = req.query;
    const filter = { facility: facilityId };
    if (category) filter.category = category;

    const items = await StockItem.find(filter)
      .populate('lastUpdatedBy', 'name role')
      .sort({ category: 1, name: 1 });

    res.status(200).json({ success: true, count: items.length, items: items.map(i => i.toJSON()) });
  } catch (error) {
    console.error('[Stock Controller] getMyStock Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve stock.' });
  }
};

// ---------------------------------------------------------------------------
// GET /api/stock/facility/:facilityId/summary — cross-facility read (PRD §6)
// Returns lightweight status only — no full quantities for referring workers
// ---------------------------------------------------------------------------
const getStockSummary = async (req, res) => {
  try {
    const { facilityId } = req.params;
    const { category }   = req.query;

    const filter = { facility: facilityId };
    if (category) filter.category = category;

    const items = await StockItem.find(filter).sort({ category: 1, name: 1 });

    // Lightweight payload: name, category, unit, status only (no quantities)
    const summary = items.map(i => ({
      _id:      i._id,
      name:     i.name,
      category: i.category,
      itemType: i.itemType,
      unit:     i.unit,
      status:   i.status, // available | low | out
    }));

    res.status(200).json({ success: true, count: summary.length, summary });
  } catch (error) {
    console.error('[Stock Controller] getStockSummary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve stock summary.' });
  }
};

module.exports = { updateStockItem, getMyStock, getStockSummary };
