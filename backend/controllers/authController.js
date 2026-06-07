import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendMentorNotification, sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ─── Email-verification helpers ─────────────────────────────
const VERIFY_TTL_MS = 15 * 60 * 1000;      // code lifetime
const RESEND_COOLDOWN_MS = 60 * 1000;      // min gap between sends
const MAX_VERIFY_ATTEMPTS = 5;

const generateCode = () => String(crypto.randomInt(100000, 1000000)); // 6 digits
const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

// True when real email IS being sent (configured Gmail creds).
const emailConfigured = () => {
  const u = process.env.EMAIL_USER, p = process.env.EMAIL_PASS;
  return !!(u && p && u !== 'your_email@gmail.com');
};
// Reveal the code to the client ONLY when it can't be emailed (no Gmail creds)
// AND we're not in production. So: configure EMAIL_USER/EMAIL_PASS and the code
// stops being exposed — real email becomes the only channel ("actual Gmail mode").
const canRevealCode = () => process.env.NODE_ENV !== 'production' && !emailConfigured();

// POST /api/auth/signup
export const signup = async (req, res) => {
  try {
    const { name, email, password, branch } = req.body;

    // Validation
    if (!name || !email || !password || !branch) {
      return res.status(400).json({ error: true, message: 'All fields are required (name, email, password, branch).' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: true, message: 'Password must be at least 8 characters.' });
    }
    if (!['ECE', 'EE', 'CSE'].includes(branch)) {
      return res.status(400).json({ error: true, message: 'Branch must be ECE, EE, or CSE.' });
    }

    // Check duplicate
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: true, message: 'An account with this email already exists.' });
    }

    // Create unverified user with a hashed 6-digit verification code.
    const code = generateCode();
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      branch,
      role: 'student',
      status: 'pending',
      emailVerified: false,
      emailVerifyCodeHash: hashCode(code),
      emailVerifyExpire: new Date(Date.now() + VERIFY_TTL_MS),
      emailVerifyAttempts: 0
    });

    // Send the verification code (mocks to console when email isn't configured).
    // The mentor notification is deferred until the email is actually verified.
    sendVerificationEmail({ name, email: user.email, code }).catch(err =>
      console.error('Verification email failed:', err.message)
    );

    // No auth token: the user must verify their email, then log in.
    const response = {
      success: true,
      message: 'Account created. Enter the 6-digit code we emailed you to verify your address.',
      email: user.email
    };
    if (canRevealCode()) response.devCode = code;
    res.status(201).json(response);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: true, message: 'An account with this email already exists.' });
    }
    console.error('Signup error:', err);
    res.status(500).json({ error: true, message: 'Server error during registration.' });
  }
};

// POST /api/auth/login
// Auth cookie: httpOnly so JS (and any XSS) cannot read the token. In production
// the Vercel↔Render setup is cross-site, so the cookie needs SameSite=None+Secure;
// in dev (localhost) Lax over http works. 7-day lifetime to match the JWT.
const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

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

    // Students must verify their email before logging in. (Legacy accounts with
    // no `emailVerified` field are `undefined`, not `false`, so they're not blocked.)
    if (user.role === 'student' && user.emailVerified === false) {
      return res.status(403).json({
        error: true,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in.'
      });
    }

    const token = generateToken(user);
    res.cookie('authToken', token, authCookieOptions());

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
    res.status(500).json({ error: true, message: 'Server error during login.' });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerifyCodeHash -emailVerifyExpire -emailVerifyAttempts');
    if (!user) {
      return res.status(404).json({ error: true, message: 'User not found.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/auth/logout — clear the auth cookie
export const logout = (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  res.json({ success: true });
};

// PUT /api/auth/profile — update own display name
export const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: true, message: 'User not found.' });
    if (typeof name === 'string' && name.trim()) user.name = name.trim();
    await user.save();
    const safe = await User.findById(user._id)
      .select('-password -resetPasswordToken -resetPasswordExpire -emailVerifyCodeHash -emailVerifyExpire -emailVerifyAttempts');
    res.json({ success: true, user: safe });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/auth/change-password — verify current, set new (re-hashed by pre-save hook)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: true, message: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: true, message: 'New password must be at least 8 characters.' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: true, message: 'User not found.' });
    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(400).json({ error: true, message: 'Current password is incorrect.' });
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/auth/forgot-password — generate a reset token + email a reset link
export const forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: true, message: 'Email is required.' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: true, message: 'No account found with this email.' });

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save();

    // Use the first configured frontend origin for the emailed link. Only fall back
    // to localhost outside production — a prod deploy without FRONTEND_URL would
    // otherwise email dead localhost links (CORS would already be broken too).
    const frontendOrigin = (process.env.FRONTEND_URL || '').split(',')[0].trim()
      || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000');
    const base = frontendOrigin.replace(/\/$/, '');
    const resetUrl = `${base}/forgot-password?token=${rawToken}`;
    try { await sendPasswordResetEmail(user.email, user.name, resetUrl); }
    catch (e) { console.error('reset email error:', e); }

    const payload = { success: true, message: 'Password reset link sent to your email.' };
    // In local dev without email, expose the token so the flow is testable end-to-end.
    if (canRevealCode()) payload.resetToken = rawToken;
    res.json(payload);
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/auth/reset-password — verify token, set a new password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: true, message: 'Token and new password are required.' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: true, message: 'Password must be at least 8 characters.' });

    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ resetPasswordToken: hashed, resetPasswordExpire: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: true, message: 'Reset link is invalid or has expired.' });

    user.password = newPassword; // re-hashed by the pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.json({ success: true, message: 'Password reset successful.' });
  } catch (err) {
    console.error('resetPassword error:', err);
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
    // Constant-time comparison to avoid a timing side-channel on the master password.
    const pwBuf = Buffer.from(String(password));
    const mpBuf = Buffer.from(String(masterPassword));
    if (pwBuf.length !== mpBuf.length || !crypto.timingSafeEqual(pwBuf, mpBuf)) {
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
        status: 'approved',
        emailVerified: true
      });
    }

    const token = generateToken(mentor);
    res.cookie('authToken', token, authCookieOptions());

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

// POST /api/auth/verify-email
export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: true, message: 'Email and code are required.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    // Generic message — don't reveal whether the email is registered.
    if (!user) {
      return res.status(400).json({ error: true, message: 'Invalid or expired verification code.' });
    }
    if (user.emailVerified) {
      return res.json({ success: true, alreadyVerified: true, message: 'Email already verified. You can log in.' });
    }

    if (!user.emailVerifyExpire || user.emailVerifyExpire.getTime() < Date.now()) {
      return res.status(400).json({ error: true, code: 'CODE_EXPIRED', message: 'Code expired. Please request a new one.' });
    }
    if ((user.emailVerifyAttempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      return res.status(400).json({ error: true, code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Please request a new code.' });
    }

    if (hashCode(code) !== user.emailVerifyCodeHash) {
      user.emailVerifyAttempts = (user.emailVerifyAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ error: true, message: 'Invalid verification code.' });
    }

    // Verified — clear the code and notify the mentor about the new student.
    user.emailVerified = true;
    user.emailVerifyCodeHash = undefined;
    user.emailVerifyExpire = undefined;
    user.emailVerifyAttempts = 0;
    await user.save();

    sendMentorNotification({ name: user.name, email: user.email, branch: user.branch }).catch(err =>
      console.error('Email notification failed:', err.message)
    );

    res.json({ success: true, message: 'Email verified! You can now log in.' });
  } catch (err) {
    console.error('verifyEmail error:', err);
    res.status(500).json({ error: true, message: 'Server error during verification.' });
  }
};

// POST /api/auth/resend-verification
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: true, message: 'Email is required.' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    // Generic success to avoid leaking which emails are registered / verified.
    if (!user || user.emailVerified) {
      return res.json({ success: true, message: 'If your account needs verification, a new code has been sent.' });
    }

    // 60-second cooldown, inferred from when the current code was issued.
    if (user.emailVerifyExpire) {
      const issuedAt = user.emailVerifyExpire.getTime() - VERIFY_TTL_MS;
      if (Date.now() - issuedAt < RESEND_COOLDOWN_MS) {
        return res.status(429).json({ error: true, message: 'Please wait a minute before requesting another code.' });
      }
    }

    const code = generateCode();
    user.emailVerifyCodeHash = hashCode(code);
    user.emailVerifyExpire = new Date(Date.now() + VERIFY_TTL_MS);
    user.emailVerifyAttempts = 0;
    await user.save();

    sendVerificationEmail({ name: user.name, email: user.email, code }).catch(err =>
      console.error('Verification email failed:', err.message)
    );

    const response = { success: true, message: 'A new verification code has been sent.' };
    if (canRevealCode()) response.devCode = code;
    res.json(response);
  } catch (err) {
    console.error('resendVerification error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
