import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendMentorNotification } from '../services/emailService.js';

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// POST /api/auth/signup
export const signup = async (req, res) => {
  try {
    const { name, email, password, branch } = req.body;

    // Validation
    if (!name || !email || !password || !branch) {
      return res.status(400).json({ error: true, message: 'All fields are required (name, email, password, branch).' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: true, message: 'Password must be at least 6 characters.' });
    }
    if (!['ECE', 'EE', 'CSE'].includes(branch)) {
      return res.status(400).json({ error: true, message: 'Branch must be ECE, EE, or CSE.' });
    }

    // Check duplicate
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: true, message: 'An account with this email already exists.' });
    }

    // Create user — password hashed by pre-save hook
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      branch,
      role: 'student',
      status: 'pending'
    });

    // Send email to mentor (non-blocking)
    sendMentorNotification({ name, email, branch }).catch(err =>
      console.error('Email notification failed:', err.message)
    );

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Awaiting mentor approval.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        branch: user.branch,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: true, message: 'An account with this email already exists.' });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: true, message: 'Server error during registration.' });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: true, message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: true, message: 'Invalid email or password.' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        branch: user.branch,
        role: user.role,
        status: user.status,
        streak: user.streak,
        badges: user.badges,
        targets: user.targets,
        consistencyScore: user.consistencyScore,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: true, message: 'Server error during login.', details: err.message || JSON.stringify(err) });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ error: true, message: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/auth/mentor-login (special mentor login with master password)
export const mentorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: true, message: 'Email and password are required.' });
    }

    // Check master password first
    const masterPassword = process.env.MENTOR_MASTER_PASSWORD;
    if (!masterPassword) {
      return res.status(500).json({ error: true, message: 'Mentor login is not configured on this server.' });
    }
    if (password !== masterPassword) {
      return res.status(401).json({ error: true, message: 'Invalid credentials.' });
    }

    // Find or create mentor
    let mentor = await User.findOne({ email: email.toLowerCase(), role: 'mentor' });
    if (!mentor) {
      mentor = await User.create({
        name: 'Bhima Sankar Sir',
        email: email.toLowerCase(),
        password: masterPassword,
        branch: 'ECE',
        role: 'mentor',
        status: 'approved'
      });
    }

    const token = generateToken(mentor);

    res.json({
      success: true,
      token,
      user: {
        _id: mentor._id,
        name: mentor.name,
        email: mentor.email,
        role: mentor.role,
        status: mentor.status
      }
    });
  } catch (err) {
    console.error('Mentor login error:', err);
    res.status(500).json({ error: true, message: 'Server error during login.' });
  }
};
