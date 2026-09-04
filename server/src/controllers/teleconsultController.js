const { v4: uuidv4 } = require('uuid');
const TeleconsultSession = require('../models/TeleconsultSession');
const Patient  = require('../models/Patient');
const Facility = require('../models/Facility');
const { getIO } = require('../socket');

// ---------------------------------------------------------------------------
// POST /api/teleconsult/request
// Creates a session and emits teleconsult:requested to the target facility room
// ---------------------------------------------------------------------------
const requestSession = async (req, res) => {
  try {
    const { patient: patientId, sourceEncounter, targetFacility: targetFacilityId } = req.body;

    if (!patientId || !sourceEncounter || !targetFacilityId) {
      return res.status(400).json({
        success: false,
        message: 'patient, sourceEncounter, and targetFacility are required.',
      });
    }

    const fromFacilityId = req.user.facility?._id || req.user.facility;
    if (!fromFacilityId) {
      return res.status(400).json({ success: false, message: 'Your account has no facility.' });
    }
    if (fromFacilityId.toString() === targetFacilityId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot request a teleconsult within the same facility.' });
    }

    const [patient, targetFacility] = await Promise.all([
      Patient.findById(patientId).select('name phid'),
      Facility.findById(targetFacilityId).select('name tier'),
    ]);
    if (!patient)       return res.status(404).json({ success: false, message: 'Patient not found.' });
    if (!targetFacility) return res.status(404).json({ success: false, message: 'Target facility not found.' });

    const roomId = `tc-${uuidv4()}`;

    const session = await TeleconsultSession.create({
      patient: patientId,
      sourceEncounter,
      requestedBy: req.user._id,
      requestedFromFacility: fromFacilityId,
      targetFacility: targetFacilityId,
      roomId,
      status: 'requested',
      requestedAt: new Date(),
    });

    const populated = await TeleconsultSession.findById(session._id)
      .populate('patient',                'name phid')
      .populate('requestedBy',            'name role')
      .populate('requestedFromFacility',  'name tier shortCode')
      .populate('targetFacility',         'name tier shortCode');

    // Emit live to target facility room (Step 9/10 pattern)
    try {
      const io = getIO();
      io.to(`facility:${targetFacilityId}`).emit('teleconsult:requested', {
        sessionId:     session._id.toString(),
        roomId,
        patientName:   patient.name,
        patientPhid:   patient.phid,
        patientId:     patient._id.toString(),
        fromFacility:  { name: populated.requestedFromFacility?.name, tier: populated.requestedFromFacility?.tier },
        requestedBy:   { name: req.user.name, role: req.user.role },
        requestedAt:   session.requestedAt,
      });
    } catch (_) {}

    res.status(201).json({ success: true, session: populated });
  } catch (error) {
    console.error('[Teleconsult] requestSession error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/teleconsult/:id/join
// Sets status active, records startedAt, returns roomId
// ---------------------------------------------------------------------------
const joinSession = async (req, res) => {
  try {
    const session = await TeleconsultSession.findById(req.params.id)
      .populate('patient',            'name phid _id')
      .populate('requestedBy',        '_id name')
      .populate('requestedFromFacility', '_id');

    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    if (session.status !== 'requested') {
      return res.status(400).json({ success: false, message: `Session is already '${session.status}'.` });
    }

    // Only a user at targetFacility may join
    const userFacId = (req.user.facility?._id || req.user.facility)?.toString();
    if (userFacId !== session.targetFacility.toString()) {
      return res.status(403).json({ success: false, message: 'Only a user at the target facility may join this session.' });
    }

    session.status    = 'active';
    session.startedAt = new Date();
    await session.save();

    // Notify the requesting worker's personal room
    try {
      const io = getIO();
      io.to(`user:${session.requestedBy._id}`).emit('teleconsult:joined', {
        sessionId: session._id.toString(),
        roomId:    session.roomId,
        joinedBy:  req.user.name,
        startedAt: session.startedAt,
      });
    } catch (_) {}

    res.status(200).json({ success: true, roomId: session.roomId, session });
  } catch (error) {
    console.error('[Teleconsult] joinSession error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/teleconsult/:id/end
// Either party can end. Optional notes field.
// ---------------------------------------------------------------------------
const endSession = async (req, res) => {
  try {
    const { notes, declined } = req.body;

    const session = await TeleconsultSession.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    if (session.status === 'ended' || session.status === 'declined') {
      return res.status(400).json({ success: false, message: `Session is already '${session.status}'.` });
    }

    session.status  = declined ? 'declined' : 'ended';
    session.endedAt = new Date();
    if (notes) session.notes = notes.trim();
    await session.save();

    // Emit to both facility rooms so both UIs update
    try {
      const io = getIO();
      const payload = { sessionId: session._id.toString(), status: session.status, endedAt: session.endedAt };
      io.to(`facility:${session.requestedFromFacility}`).emit('teleconsult:ended', payload);
      io.to(`facility:${session.targetFacility}`).emit('teleconsult:ended', payload);
    } catch (_) {}

    res.status(200).json({ success: true, session });
  } catch (error) {
    console.error('[Teleconsult] endSession error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/teleconsult/:id — fetch session detail (for VideoRoom to poll status)
// ---------------------------------------------------------------------------
const getSession = async (req, res) => {
  try {
    const session = await TeleconsultSession.findById(req.params.id)
      .populate('patient',              'name phid dob gender')
      .populate('requestedBy',          'name role')
      .populate('requestedFromFacility','name tier shortCode')
      .populate('targetFacility',       'name tier shortCode');

    if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });
    res.status(200).json({ success: true, session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { requestSession, joinSession, endSession, getSession };
