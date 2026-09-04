const express = require('express');
const router  = express.Router();
const { requestSession, joinSession, endSession, getSession } = require('../controllers/teleconsultController');
const { protect }   = require('../middleware/auth');
const { roleGuard } = require('../middleware/roleGuard');

// POST /api/teleconsult/request — any clinical role can initiate
router.post('/request',
  protect,
  roleGuard('frontline_worker', 'medical_officer', 'specialist', 'admin'),
  requestSession
);

// PATCH /api/teleconsult/:id/join — receiving medical officer / specialist
// Must be declared before /:id GET
router.patch('/:id/join',
  protect,
  roleGuard('medical_officer', 'specialist', 'admin'),
  joinSession
);

// PATCH /api/teleconsult/:id/end — either participant
router.patch('/:id/end',
  protect,
  endSession
);

// GET /api/teleconsult/:id — session detail
router.get('/:id', protect, getSession);

module.exports = router;
