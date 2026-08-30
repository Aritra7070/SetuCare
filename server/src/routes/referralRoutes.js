const express = require('express');
const router = express.Router();
const {
  createReferral,
  getReferralById,
  getPatientReferrals,
  updateReferralStatus,
  getInbox,
} = require('../controllers/referralController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// POST /api/referrals
router.post(
  '/',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  createReferral
);

// GET /api/referrals?patient=:patientId — cross-facility read
router.get('/', protect, getPatientReferrals);

// GET /api/referrals/inbox — facility-scoped inbox (MUST be before /:id)
router.get(
  '/inbox',
  protect,
  roleGuard('medical_officer', 'specialist', 'admin'),
  getInbox
);

// PATCH /api/referrals/:id/status (MUST be before /:id GET)
router.patch(
  '/:id/status',
  protect,
  roleGuard('medical_officer', 'specialist', 'admin'),
  updateReferralStatus
);

// GET /api/referrals/:id
router.get('/:id', protect, getReferralById);

module.exports = router;
