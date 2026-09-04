const express = require('express');
const router  = express.Router();
const { updateStockItem, getMyStock, getStockSummary } = require('../controllers/stockController');
const { protect }   = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// GET /api/stock/my — own facility inventory (must be before /:itemId)
router.get('/my', protect, getMyStock);

// GET /api/stock/facility/:facilityId/summary — cross-facility read (PRD §6)
// No facilityScope — any authenticated user can read any facility's summary
router.get('/facility/:facilityId/summary', protect, getStockSummary);

// PATCH /api/stock/:itemId — update quantity (any facility member)
router.patch('/:itemId', protect, updateStockItem);

module.exports = router;
