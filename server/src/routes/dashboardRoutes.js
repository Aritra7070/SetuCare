/**
 * SetuCare Step 14 — Dashboard Routes
 *
 * GET /api/dashboard/facility
 *   Facility-scoped snapshot (referral backlog, follow-up gaps, today's activity).
 *   Access: medical_officer, specialist, admin
 */

const express = require('express');
const router  = express.Router();

const { protect }   = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { getFacilityDashboard } = require('../controllers/dashboardController');

router.get(
  '/facility',
  protect,
  roleGuard('medical_officer', 'specialist', 'admin'),
  getFacilityDashboard
);

module.exports = router;
