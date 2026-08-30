const express = require('express');
const router = express.Router();
const { createReferral, getReferralById, getPatientReferrals } = require('../controllers/referralController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// POST /api/referrals — create referral (fromFacility auto-stamped from token)
// PRD §3: frontline_worker and medical_officer only; no PUT/DELETE
router.post(
  '/',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  createReferral
);

// GET /api/referrals?patient=:patientId — all referrals for a patient
// PRD §4: cross-facility read — no facilityScope applied
router.get('/', protect, getPatientReferrals);

// GET /api/referrals/:id — single referral detail
router.get('/:id', protect, getReferralById);

module.exports = router;
