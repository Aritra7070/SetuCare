/**
 * SetuCare Socket.IO Server — Step 9
 *
 * Initialisation pattern: call initSocket(httpServer) once in index.js,
 * then call getIO() anywhere in the codebase (controllers, etc.) to emit.
 *
 * Room design (PRD §4):
 *   user:<userId>      — joined on connect; receives personal notifications
 *   patient:<patientId> — joined when client navigates to a patient timeline;
 *                         receives live referral status chip updates
 *
 * Auth: JWT is read from the httpOnly cookie (same token the REST API uses).
 * Unauthenticated sockets are rejected before any room logic runs.
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const User = require('./models/User');

let _io = null;

/**
 * Initialise Socket.IO on the provided http.Server.
 * Must be called exactly once, before app starts listening.
 */
function initSocket(httpServer) {
  _io = new Server(httpServer, {
    cors: {
      origin: [
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ],
      credentials: true,   // required so the browser sends the httpOnly cookie
    },
    // Prefer WebSocket, fall back to long-polling
    transports: ['websocket', 'polling'],
  });

  // ── Authentication middleware ──
  // Runs before the connection event; rejects unauthenticated sockets cleanly.
  _io.use(async (socket, next) => {
    try {
      // 1. Try httpOnly cookie (primary — matches REST auth flow)
      let token = null;
      const rawCookie = socket.handshake.headers?.cookie;
      if (rawCookie) {
        const parsed = cookie.parse(rawCookie);
        token = parsed.token || null;
      }

      // 2. Fallback: bearer token in auth handshake (useful for API testing)
      if (!token && socket.handshake.auth?.token) {
        token = socket.handshake.auth.token;
      }

      if (!token) {
        return next(new Error('Authentication required: no token provided'));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'setucare_jwt_secret_dev_2026_phase1_secure_key'
      );

      const user = await User.findById(decoded.id).populate('facility', 'name tier shortCode');
      if (!user) {
        return next(new Error('Authentication required: user not found'));
      }

      // Attach user to socket for use in connection handler
      socket.user = {
        _id:      user._id.toString(),
        name:     user.name,
        role:     user.role,
        facility: user.facility,
      };

      next();
    } catch (err) {
      console.error('[Socket] Auth error:', err.message);
      next(new Error('Authentication failed'));
    }
  });

  // ── Connection handler ──
  _io.on('connection', (socket) => {
    const { _id: userId, name, role } = socket.user;

    // Every authenticated user joins their personal room immediately
    socket.join(`user:${userId}`);
    console.log(`[Socket] ${name} (${role}) connected — joined user:${userId}`);

    // ── Client joins a patient room when it opens a timeline ──
    socket.on('join:patient', ({ patientId } = {}) => {
      if (!patientId) return;
      socket.join(`patient:${patientId}`);
      console.log(`[Socket] ${name} joined patient:${patientId}`);
    });

    // ── Client leaves a patient room when it closes the timeline ──
    socket.on('leave:patient', ({ patientId } = {}) => {
      if (!patientId) return;
      socket.leave(`patient:${patientId}`);
      console.log(`[Socket] ${name} left patient:${patientId}`);
    });

    // ── Client joins their facility's inbox room (Step 10) ──
    // Automatically joined using the facility from the authenticated user record,
    // so clients cannot subscribe to a facility room they don't belong to.
    socket.on('join:facility', ({ facilityId } = {}) => {
      // Enforce: facilityId must match the authenticated user's own facility
      const userFacilityId = socket.user?.facility?._id?.toString()
        || socket.user?.facility?.toString();
      if (!facilityId || facilityId !== userFacilityId) return;
      socket.join(`facility:${facilityId}`);
      console.log(`[Socket] ${name} joined facility:${facilityId}`);
    });

    socket.on('leave:facility', ({ facilityId } = {}) => {
      socket.leave(`facility:${facilityId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] ${name} disconnected — ${reason}`);
    });
  });

  console.log('[Socket] Socket.IO initialised');
  return _io;
}

/**
 * Return the singleton Socket.IO instance.
 * Throws if called before initSocket().
 */
function getIO() {
  if (!_io) {
    throw new Error('[Socket] getIO() called before initSocket(). Check server startup order.');
  }
  return _io;
}

module.exports = { initSocket, getIO };
