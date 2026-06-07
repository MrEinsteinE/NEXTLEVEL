import nodemailer from 'nodemailer';

// Escape user-controlled values before interpolating them into email HTML, to
// prevent HTML/content injection (and broken rendering) in delivered emails.
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Create reusable transporter
let transporter = null;

// Parse EMAIL_FROM ("Name <email>" or "email") into { name, email }.
function parseFrom(raw, fallbackEmail) {
  const s = (raw || '').trim();
  const m = s.match(/^(.*?)\s*<([^>]+)>$/);
  if (m) return { name: (m[1] || 'NEXT_LEVEL').trim(), email: m[2].trim() };
  return { name: 'NEXT_LEVEL', email: s || fallbackEmail };
}

// Send via Brevo's HTTPS transactional API. Works on hosts (Render) that block
// outbound SMTP. With no authenticated domain, Brevo delivers from your verified
// single sender via its own DKIM-signed brevosend.com identity.
async function sendViaBrevo({ subject, html, to }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  const sender = parseFrom(process.env.EMAIL_FROM, 'no-reply@example.com');
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json'
      },
      body: JSON.stringify({
        sender,
        to: (Array.isArray(to) ? to : [to]).map(e => ({ email: e })),
        subject,
        htmlContent: html
      }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(`Brevo ${r.status}: ${detail.slice(0, 300)}`);
    }
    return r.json().catch(() => ({}));
  } finally {
    clearTimeout(timer);
  }
}

// Send via Resend's HTTPS API. Required on hosts (e.g. Render) that block
// outbound SMTP — those connections hang ~90s until timeout. HTTPS is never blocked.
async function sendViaResend({ subject, html, to }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Resend requires a verified sender. Set EMAIL_FROM to your verified
        // domain address; onboarding@resend.dev only delivers to your own email.
        from: process.env.EMAIL_FROM || 'NEXT_LEVEL <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html
      }),
      signal: ctrl.signal
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(`Resend ${r.status}: ${detail.slice(0, 300)}`);
    }
    return r.json().catch(() => ({}));
  } finally {
    clearTimeout(timer);
  }
}

function getTransporter() {
  if (transporter) return transporter;

  // Prefer an HTTPS email API when configured — works where SMTP is blocked
  // (Render). Returns a transporter-shaped object so all senders work unchanged.
  if (process.env.BREVO_API_KEY) {
    transporter = { sendMail: (opts) => sendViaBrevo(opts) };
    return transporter;
  }
  if (process.env.RESEND_API_KEY) {
    transporter = { sendMail: (opts) => sendViaResend(opts) };
    return transporter;
  }

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass || emailUser === 'your_email@gmail.com') {
    console.warn('⚠️  Email not configured. Set BREVO_API_KEY (or RESEND_API_KEY) + EMAIL_FROM, or EMAIL_USER/EMAIL_PASS, to enable email.');
    return null;
  }

  // SMTP fallback (local dev or hosts that allow SMTP). Timeouts stop a blocked
  // SMTP port from hanging the request for ~90 seconds.
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  return transporter;
}

/**
 * Send a password-reset email with a one-time reset link.
 */
export async function sendPasswordResetEmail(email, name, resetUrl) {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [MOCK] Password reset link for ${email}: ${resetUrl}`);
    return;
  }
  await t.sendMail({
    from: `"NEXT_LEVEL Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset your NEXT_LEVEL password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px; border-radius: 12px; color: white; text-align: center;">
          <h1 style="margin: 0;">NEXT_LEVEL</h1>
          <p style="margin: 5px 0 0;">Password Reset</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hi ${name || 'there'},</p>
          <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 30 minutes.</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="${resetUrl}" style="background:#6C63FF; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; display:inline-block; font-weight:bold;">Reset Password</a>
          </p>
          <p style="color:#64748b; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>
    `
  });
}

/**
 * Send a gentle study nudge to a student who's gone quiet. Best-effort: falls
 * back to a console mock when email isn't configured.
 */
export async function sendNudgeEmail(email, name, message) {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [MOCK] Nudge email to ${email}: ${message}`);
    return;
  }
  const loginUrl = `${process.env.FRONTEND_URL || 'https://next-level-by-bhima-sankar-sir-mentoring.vercel.app'}/login`;
  await t.sendMail({
    from: `"NEXT_LEVEL Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'A quick nudge from NEXT_LEVEL 👋',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6C63FF, #FF6B35); padding: 20px; border-radius: 12px; color: white; text-align: center;">
          <h1 style="margin: 0;">NEXT_LEVEL</h1>
          <p style="margin: 5px 0 0;">Keep your momentum going</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>${escapeHtml(message)}</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="${loginUrl}" style="background:#6C63FF; color:#fff; padding:12px 24px; border-radius:8px; text-decoration:none; display:inline-block; font-weight:bold;">Log a session</a>
          </p>
          <p style="color:#64748b; font-size:13px;">You're getting this because you're enrolled in mentorship with Bhima Sankar Sir. It only sends when you've been away a couple of days.</p>
        </div>
      </div>
    `
  });
}

/**
 * Send email to mentor when a new student signs up
 */
export async function sendMentorNotification({ name, email, branch }) {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [MOCK] New student notification: ${name} (${email}) – ${branch}`);
    return;
  }

  const mentorEmail = process.env.MENTOR_EMAIL || 'sankar.bhima@gmail.com';

  const mailOptions = {
    from: `"NEXT_LEVEL Platform" <${process.env.EMAIL_USER}>`,
    to: mentorEmail,
    subject: '🆕 New Student Mentorship Request – NEXT_LEVEL',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px; border-radius: 12px; color: white; text-align: center;">
          <h1 style="margin: 0;">🚀 NEXT_LEVEL</h1>
          <p style="margin: 5px 0 0;">New Mentorship Request</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <h3>A new student has requested mentorship:</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${escapeHtml(name)}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${escapeHtml(email)}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Branch:</td><td style="padding: 8px;">${escapeHtml(branch)}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Date:</td><td style="padding: 8px;">${new Date().toLocaleDateString()}</td></tr>
          </table>
          <p style="margin-top: 20px;">Log in to your <a href="${process.env.FRONTEND_URL || 'https://next-level-by-bhima-sankar-sir-mentoring.vercel.app'}/mentor-login">Mentor Dashboard</a> to approve or reject this request.</p>
        </div>
      </div>
    `
  };

  await t.sendMail(mailOptions);
  console.log(`📧 Mentor notification sent for student: ${name}`);
}

/**
 * Send a 6-digit email-verification code to a newly registered student.
 * Falls back to a console log (with the code) when email isn't configured.
 */
export async function sendVerificationEmail({ name, email, code }) {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [MOCK] Verification code for ${name} (${email}): ${code}`);
    return;
  }

  const mailOptions = {
    from: `"NEXT_LEVEL Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '🔐 Verify your email – NEXT_LEVEL',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6C63FF, #A855F7); padding: 20px; border-radius: 12px; color: white; text-align: center;">
          <h1 style="margin: 0;">🚀 NEXT_LEVEL</h1>
          <p style="margin: 5px 0 0;">Verify your email address</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <h3>Hi ${escapeHtml(name)},</h3>
          <p>Use this code to verify your email and finish creating your account:</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; text-align: center; background: #EAE9FF; color: #1E1B4B; padding: 16px; border-radius: 8px; margin: 16px 0;">
            ${code}
          </div>
          <p style="color: #6b7280; font-size: 14px;">This code expires in 15 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      </div>
    `
  };

  await t.sendMail(mailOptions);
  console.log(`📧 Verification email sent to: ${name} (${email})`);
}

/**
 * Send approval email to student
 */
export async function sendApprovalEmail({ name, email }) {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [MOCK] Approval email to: ${name} (${email})`);
    return;
  }

  const mailOptions = {
    from: `"NEXT_LEVEL Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '✅ You\'re Approved! Welcome to NEXT_LEVEL Mentorship',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f9b0f, #0d7d0d); padding: 20px; border-radius: 12px; color: white; text-align: center;">
          <h1 style="margin: 0;">🎉 Congratulations, ${escapeHtml(name)}!</h1>
          <p style="margin: 5px 0 0;">You've been approved for NEXT_LEVEL Mentorship</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <h3>Welcome to your personalised GATE preparation journey!</h3>
          <p>Bhima Sankar Sir has approved your mentorship request. You now have full access to:</p>
          <ul>
            <li>📊 Daily study progress tracking</li>
            <li>📅 Personalised timetable from your mentor</li>
            <li>🗺️ 8-step mentorship journey</li>
            <li>🏆 Gamified streaks and badges</li>
            <li>📈 GATE syllabus completion tracker</li>
          </ul>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL || 'https://next-level-by-bhima-sankar-sir-mentoring.vercel.app'}/login"
               style="background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
              🚀 Go to Dashboard
            </a>
          </p>
        </div>
      </div>
    `
  };

  await t.sendMail(mailOptions);
  console.log(`📧 Approval email sent to: ${name} (${email})`);
}

/**
 * Send email to student when mentor answers their query
 */
export async function sendQueryAnswerEmail(email, name, question, answer) {
  const t = getTransporter();
  if (!t) {
    console.log(`📧 [MOCK] Query answer email to: ${name} (${email})`);
    return;
  }

  const mailOptions = {
    from: `"NEXT_LEVEL Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: '✅ Your Query Has Been Answered – NEXT_LEVEL',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px; border-radius: 12px; color: white; text-align: center;">
          <h1 style="margin: 0;">📬 NEXT_LEVEL</h1>
          <p style="margin: 5px 0 0;">Bhima Sankar Sir has answered your query</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <h3>Hi ${escapeHtml(name)},</h3>
          <p>Your question has been answered by your mentor:</p>
          <div style="background: #e9ecef; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <strong>Your Question:</strong>
            <p style="margin: 6px 0 0;">${escapeHtml(question)}</p>
          </div>
          <div style="background: #d4edda; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <strong>Mentor's Answer:</strong>
            <p style="margin: 6px 0 0;">${escapeHtml(answer)}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL || 'https://nextlevel-snowy.vercel.app'}/feedback"
               style="background: #1a1a2e; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
              🚀 View in Dashboard
            </a>
          </p>
        </div>
      </div>
    `
  };

  await t.sendMail(mailOptions);
  console.log(`📧 Query answer email sent to: ${name} (${email})`);
}