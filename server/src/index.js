const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables before anything else
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('./config/db');
const { initSocket } = require('./socket');

const authRoutes     = require('./routes/authRoutes');
const facilityRoutes = require('./routes/facilityRoutes');
const patientRoutes  = require('./routes/patientRoutes');
const encounterRoutes = require('./routes/encounterRoutes');
const referralRoutes = require('./routes/referralRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Connect to MongoDB ──
connectDB();

// ── CORS ──
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all during hackathon dev; tighten for production
      callback(null, true);
    },
    credentials: true,
  })
);

// ── Body & cookie parsers ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Request logging ──
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Health-check ──
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    system: 'SetuCare API Server',
    phase: 'Phase 1 & 2 — Foundation & Continuity Spine',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    socketIO: 'active',
  });
});

// ── API routes ──
app.use('/api/auth',       authRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/patients',   patientRoutes);
app.use('/api/encounters', encounterRoutes);
app.use('/api/referrals',  referralRoutes);

// ── 404 handler ──
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.originalUrl} not found`,
  });
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('[Server Error Handler]:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ── Create http server and attach Socket.IO BEFORE listen ──
const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[SetuCare Server] Running on http://localhost:${PORT}`);
  console.log(`[SetuCare Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SetuCare Server] Socket.IO listening on same port`);
});
