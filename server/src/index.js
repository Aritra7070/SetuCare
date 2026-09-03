const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cron = require('node-cron');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB    = require('./config/db');
const { initSocket } = require('./socket');
const { runFollowUpCheck } = require('./jobs/missedFollowUpJob');

const authRoutes      = require('./routes/authRoutes');
const facilityRoutes  = require('./routes/facilityRoutes');
const patientRoutes   = require('./routes/patientRoutes');
const encounterRoutes = require('./routes/encounterRoutes');
const referralRoutes  = require('./routes/referralRoutes');
const followUpRoutes  = require('./routes/followUpRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes'); // Step 14

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
app.use('/api/followups',  followUpRoutes);
app.use('/api/dashboard',  dashboardRoutes); // Step 14

// ── Step 13: manual trigger for demo + testing ──
app.post('/api/admin/run-followup-check',
  require('./middleware/auth').protect,
  require('./middleware/roleGuard').roleGuard('admin', 'program_manager'),
  async (req, res) => {
    try {
      const summary = await runFollowUpCheck();
      res.status(200).json({ success: true, message: 'Follow-up check complete', summary });
    } catch (err) {
      console.error('[Admin] run-followup-check error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

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

// ── Step 13: daily missed-follow-up detection cron ──
// Runs at 06:00 server time every day
cron.schedule('0 6 * * *', () => {
  console.log('[Cron] Running daily follow-up check...');
  runFollowUpCheck().catch((err) => {
    console.error('[Cron] Follow-up check failed:', err.message);
  });
}, { timezone: 'Asia/Kolkata' });

httpServer.listen(PORT, () => {
  console.log(`[SetuCare Server] Running on http://localhost:${PORT}`);
  console.log(`[SetuCare Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[SetuCare Server] Socket.IO listening on same port`);
});
