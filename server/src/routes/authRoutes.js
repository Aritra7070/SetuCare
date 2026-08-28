const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  getMe,
  testRoleGuard,
  testFacilityScope,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');
const { facilityScope } = require('../middleware/facilityScope');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);

// Verification routes for testing middleware functionality
router.get(
  '/test-role-guard',
  protect,
  roleGuard('medical_officer', 'specialist', 'admin'),
  testRoleGuard
);

router.get(
  '/test-admin-only',
  protect,
  roleGuard('admin'),
  testRoleGuard
);

router.get(
  '/test-frontline-only',
  protect,
  roleGuard('frontline_worker'),
  testRoleGuard
);

router.get(
  '/test-facility-scope',
  protect,
  facilityScope(),
  testFacilityScope
);

module.exports = router;
