const express = require('express');
const router  = express.Router();
const { declareEmergency, escalateReferral } = require('../controllers/emergencyController');
const { protect }   = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// POST /api/emergency/declare
// Any clinician or frontline worker can declare an emergency.
router.post(
  '/declare',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'specialist', 'admin'),
  declareEmergency
);

// PATCH /api/emergency/:referralId/escalate
// Only receiving-side roles that manage referrals can escalate existing ones.
// frontline_worker is intentionally included — they created it and may notice deterioration.
router.patch(
  '/:referralId/escalate',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'specialist', 'admin'),
  escalateReferral
);

module.exports = router;
