const express = require('express');
const router = express.Router();
const {
  createEncounter,
  getEncounterById,
  getPatientEncounters,
} = require('../controllers/encounterController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// Create an encounter
router.post(
  '/',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'specialist', 'admin'),
  createEncounter
);

// Get single encounter detail
router.get('/:id', protect, getEncounterById);

// Get encounters by patient PHID
router.get('/patient/:phid', protect, getPatientEncounters);

module.exports = router;
