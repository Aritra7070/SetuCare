const express = require('express');
const router = express.Router();
const {
  createReferral,
  getReferralById,
  getPatientReferrals,
  updateReferralStatus,
} = require('../controllers/referralController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// POST /api/referrals — create referral (fromFacility auto-stamped from token)
router.post(
  '/',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  createReferral
);

// GET /api/referrals?patient=:patientId — cross-facility read
router.get('/', protect, getPatientReferrals);

// PATCH /api/referrals/:id/status — advance status one step (receiving facility only)
// Must be declared BEFORE /:id GET to avoid Express swallowing the /status segment
router.patch(
  '/:id/status',
  protect,
  roleGuard('medical_officer', 'specialist', 'admin'),
  updateReferralStatus
);

// GET /api/referrals/:id — single referral detail
router.get('/:id', protect, getReferralById);

module.exports = router;
