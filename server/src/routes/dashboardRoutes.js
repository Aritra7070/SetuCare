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
const { getFacilityDashboard, getProgramDashboard } = require('../controllers/dashboardController');

router.get(
  '/facility',
  protect,
  roleGuard('medical_officer', 'specialist', 'admin'),
  getFacilityDashboard
);

// GET /api/dashboard/program?window=7d|30d|90d
// Access: program_manager, admin ONLY — not medical_officer (PRD §7)
router.get(
  '/program',
  protect,
  roleGuard('program_manager', 'admin'),
  getProgramDashboard
);

module.exports = router;
