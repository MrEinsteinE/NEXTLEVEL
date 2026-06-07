// One-off: send a single nudge email so you can preview what the auto-nudge looks
// like. Sends to one address only (NOT a broadcast). Run: node scripts/send-test-nudge.mjs
import 'dotenv/config';
import { sendNudgeEmail } from '../services/emailService.js';

const to = process.argv[2] || 'einsteinellandala@gmail.com';
const msg = "Hey Sample, you've been away a little while — log a quick session today to keep your 1-day streak alive! 🔥";

const run = async () => {
  console.log('Sender (EMAIL_USER):', process.env.EMAIL_USER || '(email not configured → console mock)');
  console.log('Recipient:', to);
  await sendNudgeEmail(to, 'Sample', msg);
  console.log('✅ Test nudge email attempted.');
  process.exit(0);
};
run().catch(e => { console.error('Test nudge failed:', e.message); process.exit(1); });
