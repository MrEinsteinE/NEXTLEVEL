import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Name is required'], trim: true },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: [true, 'Password is required'], minlength: 6 },
  branch: {
    type: String,
    enum: { values: ['ECE', 'EE', 'CSE'], message: 'Branch must be ECE, EE, or CSE' },
    required: [true, 'Branch is required']
  },
  role: {
    type: String,
    enum: ['student', 'mentor'],
    default: 'student'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  streak: { type: Number, default: 0 },
  lastActiveDate: { type: Date, default: null },
  badges: [{
    name: { type: String, required: true },
    earnedDate: { type: Date, default: Date.now }
  }],
  targets: {
    daily: { type: Number, default: 6, min: 0 },
    weekly: { type: Number, default: 42, min: 0 },
    monthly: { type: Number, default: 180, min: 0 }
  },
  consistencyScore: { type: Number, default: 0, min: 0, max: 100 },
  // Gamification: points and tokens
  points: { type: Number, default: 0, min: 0 },
  streakFreezeTokens: { type: Number, default: 0, min: 0 },
  timetable: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    subjects: [String],
    targetHours: { type: Number, default: 6 }
  }],
  journeySteps: [{
    name: {
      type: String,
      enum: ['Consultation', 'Goal Setting', 'Concept Building', 'PYQ Practice', 'Mock Tests', 'Weakness Analysis', 'Revision', 'GATE Success']
    },
    completed: { type: Boolean, default: false },
    completedDate: { type: Date, default: null }
  }],
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  // Email verification (6-digit code, hashed at rest)
  emailVerified: { type: Boolean, default: false },
  emailVerifyCodeHash: String,
  emailVerifyExpire: Date,
  emailVerifyAttempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Initialize default journey steps for new students
userSchema.pre('save', function (next) {
  if (this.isNew && this.role === 'student' && this.journeySteps.length === 0) {
    this.journeySteps = [
      'Consultation', 'Goal Setting', 'Concept Building', 'PYQ Practice',
      'Mock Tests', 'Weakness Analysis', 'Revision', 'GATE Success'
    ].map(name => ({ name, completed: false, completedDate: null }));
  }
  next();
});

// Index for fast lookups
// `unique: true` on the `email` field already creates an index, avoid duplicate index declaration
userSchema.index({ role: 1, status: 1 });

const User = mongoose.model('User', userSchema);
export default User;