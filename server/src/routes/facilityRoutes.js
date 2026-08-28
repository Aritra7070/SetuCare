const express = require('express');
const router = express.Router();
const {
  createFacility,
  getFacilities,
  getFacilityTree,
  getFacilityById,
  updateFacility,
  deleteFacility,
  seedFacilities,
} = require('../controllers/facilityController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// Read routes (Accessible for registration & authenticated navigation)
router.get('/', getFacilities);
router.get('/tree', getFacilityTree);
router.get('/:id', getFacilityById);

// Admin-only mutation routes
router.post('/', protect, roleGuard('admin'), createFacility);
router.patch('/:id', protect, roleGuard('admin'), updateFacility);
router.delete('/:id', protect, roleGuard('admin'), deleteFacility);
router.post('/seed', protect, roleGuard('admin'), seedFacilities);

module.exports = router;
