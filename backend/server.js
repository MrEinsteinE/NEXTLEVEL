import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import serverlessHttp from 'serverless-http';
import http from 'http';
import dns from 'dns';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import ChatMessage from './models/ChatMessage.js';

// Routes
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/student.js';
import mentorRoutes from './routes/mentor.js';
import leaderboardRoutes from './routes/leaderboard.js';
import plannerRoutes from './routes/planner.js';
import flashcardRoutes from './routes/flashcards.js';
import pyqRoutes from './routes/pyq.js';
import mockTestRoutes from './routes/mocktest.js';
import feedbackRoutes from './routes/feedback.js';
import reflectionsRoutes from './routes/reflections.js';
import notificationsRoutes from './routes/notifications.js';
import partnershipsRoutes from './routes/partnerships.js';
import weeklyChallengeRoutes from './routes/weeklyChallenge.js';
import notesRoutes from './routes/notes.js';
import storiesRoutes from './routes/stories.js';
import trackerRoutes from './routes/tracker.js';
import focusRoutes from './routes/focus.js';
import reportcardRoutes from './routes/reportcard.js';
import chatRoutes from './routes/chat.js';
import queriesRoutes from './routes/queries.js';
import pushRoutes from './routes/push.js';

// Services
import { initCronJobs } from './services/cronJobs.js';
import { seedDevData } from './services/devSeed.js';

// Load env
dotenv.config();

// ─── DNS resolver override ──────────────────────────────────
// Some networks' default DNS (e.g. a home router) refuse SRV-record lookups,
// which breaks `mongodb+srv://` connections with `querySrv ECONNREFUSED`.
// Setting DNS_SERVERS (e.g. "1.1.1.1,8.8.8.8") points Node's resolver at a
// public DNS that serves SRV records. Only affects dns.resolve*() (the SRV/TXT
// lookups Atlas needs); plain A-record lookups still use the OS resolver.
if (process.env.DNS_SERVERS) {
  try {
    const servers = process.env.DNS_SERVERS.split(',').map(s => s.trim()).filter(Boolean);
    if (servers.length) {
      dns.setServers(servers);
      console.log('🌐 DNS resolver overridden →', servers.join(', '));
    }
  } catch (e) {
    console.warn('⚠️  Failed to apply DNS_SERVERS:', e.message);
  }
}

// ─── Validate Required Environment Variables ─────────────────
const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
for (const v of requiredVars) {
  if (!process.env[v]) {
    console.error(`❌ Missing required environment variable: ${v}`);
    // JWT_SECRET is fatal in ANY environment — jwt.sign/verify throw on an
    // undefined secret, so auth would 500 on every request. MONGODB_URI is only
    // fatal in production; in dev the in-memory MongoDB fallback covers a missing URI.
    if (v === 'JWT_SECRET' || process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

const app = express();

// Trust the first proxy (Render/Vercel) so req.ip and rate limiting work correctly.
app.set('trust proxy', 1);

// ─── Security headers ───────────────────────────────────────
// CSP is disabled (this is a JSON API, not an HTML host) and CORP is set to
// cross-origin so the separately-deployed frontend can read responses.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ─── CORS ───────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';
// Allow Vercel preview deployments (*.vercel.app) only when explicitly enabled,
// since otherwise ANY vercel-hosted site could call this API.
const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

// Explicit allowlist. FRONTEND_URL may be a comma-separated list of origins.
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : []),
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://next-level-tau-dusky.vercel.app'
].filter(Boolean);

function isAllowedOrigin(origin) {
  // No Origin header (curl, mobile apps, same-origin, server-to-server) → allow.
  if (!origin) return true;
  // Exact match against the allowlist. (A prefix/startsWith match would let
  // `https://app.vercel.app.attacker.com` slip through — origins have no path,
  // so equality is the only correct comparison.)
  if (allowedOrigins.some(o => origin === o)) return true;
  // Opt-in Vercel preview support.
  if (allowVercelPreviews && /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  // Development convenience: permissive when not in production.
  if (!isProd) return true;
  return false;
}

app.use(cors({
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Expose socket.io to routes
app.set('io', io);

io.on('connection', (socket) => {
  console.log('🔗 Client connected via Socket.io:', socket.id);

  // Try to decode JWT from handshake auth for sender identification
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
    }
  } catch (e) {
    // ignore token errors for socket connection
  }

  // Join a student-specific room — ONLY the student themselves or a mentor may
  // join, authorized against the verified JWT on the socket (mirrors the REST
  // guard in chatController). Prevents eavesdropping on another user's private
  // chat/notifications/feedback stream (IDOR).
  socket.on('join-student-room', (userId) => {
    if (!userId) return;
    const uid = String(userId);
    const isOwner = socket.userRole === 'student' && String(socket.userId) === uid;
    const isMentor = socket.userRole === 'mentor';
    if (!isOwner && !isMentor) return;
    socket.join(`student_${uid}`);
  });

  // Join the mentors room — mentors only (this room receives all private
  // student↔mentor chat broadcasts, so it must be gated on role).
  socket.on('join-mentor-room', () => {
    if (socket.userRole !== 'mentor') return;
    socket.join('mentors');
  });

  // Chat messages (real-time)
  socket.on('chat-message', async (payload) => {
    try {
      // Sender identity comes from the verified JWT on the socket — never from
      // the client payload, which could otherwise spoof any sender/recipient.
      const senderId = socket.userId;
      if (!senderId) return;
      const text = (payload && payload.message) ? String(payload.message).trim() : '';
      // Only a mentor may direct a message at an arbitrary student's room.
      const rawTo = (socket.userRole === 'mentor' && payload && payload.toUserId) ? String(payload.toUserId) : null;
      // Only accept a well-formed ObjectId as the recipient (prevents spoofing / garbage rooms).
      const toUserId = (rawTo && /^[a-f\d]{24}$/i.test(rawTo)) ? rawTo : null;
      if (!text) return;

      // Determine room: if a recipient specified, send to that student's room, else use sender's student room
      const room = toUserId ? `student_${toUserId}` : (senderId ? `student_${senderId}` : 'mentors');

      const chat = await ChatMessage.create({
        room,
        sender: senderId,
        receiver: toUserId || null,
        message: text,
        attachments: payload.attachments || []
      });

      const populated = await ChatMessage.findById(chat._id).populate('sender', 'name role');

      if (toUserId) {
        // Message from mentor -> student
        io.to(`student_${toUserId}`).emit('chat-message', populated);
        // Also emit to mentors (so sender sees it in mentor list)
        io.to('mentors').emit('chat-message', populated);
      } else {
        // Message from student -> broadcast to mentors and student's own room
        io.to('mentors').emit('chat-message', populated);
        if (senderId) io.to(`student_${senderId}`).emit('chat-message', populated);
      }
    } catch (e) {
      console.error('chat-message handler error:', e);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔗 Client disconnected:', socket.id);
  });
});

// Socket authentication middleware: attach user info when token present
io.use((socket, next) => {
  try {
    // Token comes from the httpOnly cookie (sent on the handshake when the client
    // uses withCredentials); fall back to handshake.auth.token for legacy clients.
    let token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      const raw = socket.handshake.headers && socket.handshake.headers.cookie;
      if (raw) { const m = raw.match(/(?:^|;\s*)authToken=([^;]+)/); if (m) token = decodeURIComponent(m[1]); }
    }
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id || decoded.userId || decoded._id || null;
    socket.userRole = decoded.role || null;
    return next();
  } catch (err) {
    // don't fail connection for invalid token; allow anonymous sockets if needed
    return next();
  }
});

// ─── Body Parsing ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  }
  next();
});

// ─── MongoDB Connection (Cached for Serverless) ─────────────
const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;
let cachedDb = null;
let lastDbError = null;

// A failed connection makes Mongoose emit an 'error' event on the connection.
// Without a listener, Node treats it as an unhandled 'error' event and crashes
// the process — before the in-memory fallback below can run. This listener
// swallows it so the fallback can take over (and logs for visibility).
mongoose.connection.on('error', (err) => {
  lastDbError = err?.message || String(err);
  console.warn('⚠️  MongoDB connection error event:', lastDbError);
});

const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  const mongooseOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000, // 5s was too low for Atlas — cron aggregations/writes could be killed mid-op
    family: 4
  };

  const tryConnect = async (uri) => {
    try {
      console.log('Attempting MongoDB connection to', uri);
      const conn = await mongoose.connect(uri, mongooseOptions);
      cachedDb = conn;
      lastDbError = null;
      console.log('✅ Connected to MongoDB');
      return conn;
    } catch (err) {
      lastDbError = err.message || JSON.stringify(err);
      console.error('❌ MongoDB connection failed:', lastDbError);
      return null;
    }
  };

  // Try environment URI first
  if (MONGODB_URI) {
    const conn = await tryConnect(MONGODB_URI);
    if (conn) return conn;
  }

  // Development fallbacks (only when no working MONGODB_URI was provided).
  // Fail-CLOSED: only an explicit development/test env may fall back to a local or
  // in-memory DB. An unset or misspelled NODE_ENV must NEVER silently serve an
  // ephemeral in-memory database in what is actually production.
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    // Probe a locally-installed MongoDB only if explicitly requested, to avoid a
    // slow timeout / connection churn for the common case of no local mongod.
    if (process.env.USE_LOCAL_MONGO === 'true') {
      const localUri = 'mongodb://127.0.0.1:27017/nextlevel';
      const localConn = await tryConnect(localUri);
      if (localConn) return localConn;
    }

    // In-memory MongoDB — zero-setup dev database (data resets on restart)
    try {
      console.log('Starting in-memory MongoDB for development (mongodb-memory-server)');
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      const memConn = await tryConnect(memUri);
      if (memConn) {
        app.set('mongod', mongod);
        console.log('✅ In-memory MongoDB started');
        return memConn;
      }
    } catch (e) {
      console.error('In-memory MongoDB startup failed:', e);
    }
  }

  // If we reach here, nothing worked
  await mongoose.disconnect().catch(() => {});
  return null;
};

// ─── Health Check ───────────────────────────────────────────
// Placed BEFORE DB middleware so it never hangs and proves Vercel is routing correctly
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    hasMongodbUri: !!process.env.MONGODB_URI,
    lastDbError: lastDbError,
    uptime: process.uptime(),
    // Which email channel the deployed code will use (names only, no secrets) —
    // diagnostic for "why aren't emails sending". 'none' = no provider configured.
    email: process.env.BREVO_API_KEY ? 'brevo'
      : process.env.RESEND_API_KEY ? 'resend'
      : (process.env.EMAIL_USER && process.env.EMAIL_PASS) ? 'smtp' : 'none',
    emailFromSet: !!process.env.EMAIL_FROM
  });
});

// Ensure DB is connected before any real API route
app.use('/api', async (req, res, next) => {
  // Promise.race to guarantee middleware never hangs the process
  let isTimeout = false;
  const timeoutPromise = new Promise(resolve => setTimeout(() => {
    isTimeout = true;
    resolve();
  }, 4000));
  
  await Promise.race([connectDB(), timeoutPromise]);
  
  if (isTimeout) {
    lastDbError = "Connection timeout (4s) - MongoDB Atlas likely rejecting Vercel IP. Check your MongoDB Atlas Network Access whitelist (Needs 0.0.0.0/0).";
    // Don't forcibly disconnect here to avoid racing with in-flight connection attempts.
    return res.status(504).json({ error: true, message: "Database connection timeout. Please whitelist IPs on MongoDB Atlas." });
  }

  if (!cachedDb) {
    return res.status(500).json({
      error: true,
      message: "Database connection failed.",
      ...(isProd ? {} : { details: lastDbError })
    });
  }
  
  next();
});

// (Health check was moved above DB middleware)

// ─── Rate limiting ──────────────────────────────────────────
// Auth endpoints get a tight limit (brute-force protection); the rest of the
// API gets a generous one. Both are skipped in the test env so the smoke-test
// suite isn't throttled.
const skipRateLimit = () => process.env.NODE_ENV === 'test';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: true, message: 'Too many attempts. Please try again in a few minutes.' }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: true, message: 'Too many requests. Please slow down.' }
});
// Tighter limit for write-heavy / abusable feature endpoints.
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit,
  message: { error: true, message: 'Too many requests to this feature. Please slow down.' }
});
app.use('/api', apiLimiter);

// ─── API Routes ─────────────────────────────────────────────
// ─── CSRF protection (double-submit cookie) ─────────────────
// Every client gets a readable `csrfToken` cookie; state-changing requests must
// echo it in the X-CSRF-Token header. A cross-site attacker can ride the auth
// cookie but cannot read this cookie (it's on our origin) to forge the header,
// so forged mutations are rejected. Safe methods and the auth-bootstrap routes
// (no session yet) are exempt.
const CSRF_EXEMPT = new Set([
  '/api/auth/login', '/api/auth/mentor-login', '/api/auth/signup',
  '/api/auth/verify-email', '/api/auth/resend-verification',
  '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/logout'
]);
const csrfCookieOptions = () => ({
  httpOnly: false, // readable so the client can echo it back (double-submit)
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
});
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const raw = req.headers.cookie || '';
  const match = raw.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  let cookieToken = match ? decodeURIComponent(match[1]) : null;
  if (!cookieToken) {
    cookieToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrfToken', cookieToken, csrfCookieOptions());
  }
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  if (CSRF_EXEMPT.has(req.path)) return next();
  const headerToken = req.headers['x-csrf-token'];
  if (!headerToken || headerToken !== cookieToken) {
    return res.status(403).json({ error: true, message: 'Invalid or missing CSRF token.' });
  }
  next();
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/pyq', pyqRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/mock-test', mockTestRoutes);
app.use('/api/feedback', writeLimiter, feedbackRoutes);
app.use('/api/reflections', reflectionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/partnerships', writeLimiter, partnershipsRoutes);
app.use('/api/weekly-challenge', weeklyChallengeRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/stories', writeLimiter, storiesRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/reportcard', reportcardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/queries', writeLimiter, queriesRoutes);
app.use('/api/push', pushRoutes);

// Note: temporary admin/dev routes removed after seeding for security.

// ─── 404 Handler for API ────────────────────────────────────
app.use('/api', (req, res) => {
  if (!res.headersSent) {
    res.status(404).json({ error: true, message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  }
});

// ─── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: true, message: messages.join(', ') });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(400).json({ error: true, message: `Duplicate value for ${field}.` });
  }

  // MongoDB cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ error: true, message: 'Invalid ID format.' });
  }

  res.status(err.status || 500).json({
    error: true,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

// ─── Standalone Server Start ────────────────────────────────
// Start the HTTP server for non-serverless environments (e.g. Render).
// Vercel sets `VERCEL` in the environment; when present we run as serverless.
if (!process.env.VERCEL) {
  connectDB().then(() => {
    initCronJobs(io);
    seedDevData();
    httpServer.listen(PORT, () => {
      console.log(`🚀 NEXT_LEVEL Backend running on port ${PORT}`);
      console.log(`📡 API: http://localhost:${PORT}/api/health`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;

