const express = require('express');
const router = express.Router();
const {
  createEncounter,
  getEncounterById,
  getPatientEncounters,
  triageEncounter,
} = require('../controllers/encounterController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// POST /api/encounters — create encounter (facility + worker auto-stamped from token)
// PRD §4: write access is facility-scoped (worker's own facility only)
// PRD §5: no PUT/DELETE routes — encounters are append-only
router.post(
  '/',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'specialist', 'admin'),
  createEncounter
);

// GET /api/encounters?patient=:patientId — PRD §4 query-param form
// PRD §4: cross-facility read — facilityScope middleware intentionally NOT applied
router.get('/', protect, getPatientEncounters);

// IMPORTANT: /patient/:phid must be declared BEFORE /:id
// Express evaluates routes top-to-bottom; placing /:id first would swallow /patient/:phid.

// GET /api/encounters/patient/:phid — PHID-based lookup (used by patientRoutes alias too)
router.get('/patient/:phid', protect, getPatientEncounters);

// POST /api/encounters/:id/triage — run rule engine, write result back
// Must be declared BEFORE GET /:id so Express doesn't swallow the /triage segment
router.post(
  '/:id/triage',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  triageEncounter
);

// GET /api/encounters/:id — single encounter detail
router.get('/:id', protect, getEncounterById);

module.exports = router;
