const express = require('express');
const router  = express.Router();
const { completeFollowUp, getPatientFollowUps } = require('../controllers/followUpController');
const { protect }   = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// GET /api/followups?patient=:id — cross-facility read
router.get('/', protect, getPatientFollowUps);

// PATCH /api/followups/:id/complete — manual completion fallback (MUST be before /:id)
router.patch(
  '/:id/complete',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  completeFollowUp
);

module.exports = router;
