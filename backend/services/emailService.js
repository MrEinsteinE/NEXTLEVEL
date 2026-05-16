import nodemailer from 'nodemailer';

// Create reusable transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass || emailUser === 'your_email@gmail.com') {
    console.warn('⚠️  Email not configured. Set EMAIL_USER and EMAIL_PASS in .env to enable notifications.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass }
  });

  return transporter;
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
            <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${name}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Branch:</td><td style="padding: 8px;">${branch}</td></tr>
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
          <h1 style="margin: 0;">🎉 Congratulations, ${name}!</h1>
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
          <h3>Hi ${name},</h3>
          <p>Your question has been answered by your mentor:</p>
          <div style="background: #e9ecef; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <strong>Your Question:</strong>
            <p style="margin: 6px 0 0;">${question}</p>
          </div>
          <div style="background: #d4edda; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <strong>Mentor's Answer:</strong>
            <p style="margin: 6px 0 0;">${answer}</p>
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