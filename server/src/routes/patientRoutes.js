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
} = require('../controllers/patientController');
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

// Update patient demographic details
router.patch(
  '/:id',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'admin'),
  updatePatient
);

module.exports = router;
