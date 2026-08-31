const express = require('express');
const router = express.Router();
const {
  checkDuplicate,
  registerPatient,
  lookupPatientByPHID,
  recordScanLog,
  getPatientCard,
  getPatients,
  getPatientById,
  updatePatient,
  getPatientTimeline,
  updateCohortStatus,
} = require('../controllers/patientController');
const { getPatientEncounters } = require('../controllers/encounterController');
const { protect } = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// Check duplicate candidates
router.get(
  '/check-duplicate',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  checkDuplicate
);

// Cross-Facility Patient Lookup by PHID (Any authenticated user, bypasses facilityScope)
router.get('/lookup/:phid', protect, lookupPatientByPHID);

// Patient encounters list (PHID-based, used by encounterController alias)
router.get('/:phid/encounters', protect, getPatientEncounters);

// Step 6 — Longitudinal timeline: single round-trip, no facilityScope
// PRD §3: any authenticated user; cross-facility read is the feature
router.get('/:phid/timeline', protect, getPatientTimeline);

// Explicit scan event audit logging
router.post('/lookup/:phid/scan-log', protect, recordScanLog);

// Get printable card with QR code
router.get(
  '/:id/card',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'specialist', 'program_manager', 'admin'),
  getPatientCard
);

// Register new patient
router.post(
  '/',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  registerPatient
);

// Get patient list
router.get('/', protect, getPatients);

// Get single patient
router.get('/:id', protect, getPatientById);

// Step 11 — complete or deactivate a cohort membership (before /:id to avoid swallowing)
router.patch(
  '/:id/cohort-status',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  updateCohortStatus
);

// Update patient demographic details
router.patch(
  '/:id',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  updatePatient
);

module.exports = router;
