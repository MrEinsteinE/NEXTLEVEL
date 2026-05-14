import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import serverlessHttp from 'serverless-http';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
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

// Services
import { initCronJobs } from './services/cronJobs.js';

// Load env
dotenv.config();

// ─── Validate Required Environment Variables ─────────────────
const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
for (const v of requiredVars) {
  if (!process.env[v]) {
    console.error(`❌ Missing required environment variable: ${v}`);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

const app = express();

// ─── CORS ───────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://next-level-by-bhima-sankar-sir-mentoring.vercel.app',
  'https://nextlevel-snowy.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o) || origin.includes('vercel.app'))) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked: ${origin}`);
      callback(null, true); // Allow all in dev; tighten in production if needed
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
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

  // Join a student-specific room: client should send their userId
  socket.on('join-student-room', (userId) => {
    if (!userId) return;
    const room = `student_${userId}`;
    socket.join(room);
    console.log(`Socket ${socket.id} joined student room ${room}`);
  });

  // Join mentors room
  socket.on('join-mentor-room', () => {
    socket.join('mentors');
    console.log(`Socket ${socket.id} joined mentors room`);
  });

  // Chat messages (real-time)
  socket.on('chat-message', async (payload) => {
    try {
      const senderId = socket.userId || payload.sender;
      const text = (payload && payload.message) ? String(payload.message).trim() : '';
      const toUserId = payload && payload.toUserId ? payload.toUserId : null;
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
    const token = socket.handshake.auth && socket.handshake.auth.token;
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

const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  const mongooseOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 5000,
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

  // Try localhost fallback (development only)
  if (process.env.NODE_ENV !== 'production') {
    const localUri = 'mongodb://127.0.0.1:27017/nextlevel';
    const localConn = await tryConnect(localUri);
    if (localConn) return localConn;

    // Finally, try in-memory MongoDB for development convenience
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
    uptime: process.uptime()
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
    return res.status(500).json({ error: true, message: "Database connection failed.", details: lastDbError });
  }
  
  next();
});

// (Health check was moved above DB middleware)

// ─── API Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/pyq', pyqRoutes);
app.use('/api/tracker', trackerRoutes);
app.use('/api/mock-test', mockTestRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/reflections', reflectionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/partnerships', partnershipsRoutes);
app.use('/api/weekly-challenge', weeklyChallengeRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/reportcard', reportcardRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/queries', queriesRoutes);

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

