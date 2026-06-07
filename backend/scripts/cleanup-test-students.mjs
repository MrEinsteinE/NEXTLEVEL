// One-off cleanup: remove leftover TEST student accounts (and their data) created
// during automated verification runs. Conservative matching — never touches the
// real student (Sample) or the mentor. Run with `node scripts/cleanup-test-students.mjs`
// for a DRY RUN, or add `--delete` to actually remove.
import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';

// Same DNS override the app uses — the default resolver here refuses SRV lookups
// (querySrv ECONNREFUSED), which breaks mongodb+srv:// without this.
const dnsServers = (process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(',').map(s => s.trim()).filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

const DELETE = process.argv.includes('--delete');

// Keep these no matter what.
const PROTECT_EMAILS = ['einsteinellandala@gmail.com', 'sankar.bhima@gmail.com'];

// A student is considered a test fixture if its email matches any of these.
const TEST_EMAIL = /(smoke|reporter|partner\+|\+17\d{8,}|@example\.|@ex\.|^test|test@|zztest|uitest|smoketest)/i;
// ...or its name matches a clear test pattern.
const TEST_NAME = /^(smoke student|ui smoke student|zz .*test|w reporter|partner student|test student|reporter)/i;

async function main() {
  // Mirror server.js connection options — family:4 forces IPv4 so the SRV lookup
  // resolves in this environment (plain connect fails with querySrv ECONNREFUSED).
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 });
  const User = (await import('../models/User.js')).default;

  const students = await User.find({ role: 'student' }).select('name email status createdAt');
  const candidates = students.filter(s => {
    const email = (s.email || '').toLowerCase();
    if (PROTECT_EMAILS.includes(email)) return false;
    return TEST_EMAIL.test(email) || TEST_NAME.test((s.name || '').toLowerCase());
  });

  console.log(`\nTotal students: ${students.length}`);
  console.log(`Matched as TEST accounts: ${candidates.length}`);
  candidates.forEach(c => console.log(`  - ${c.name}  <${c.email}>  [${c.status}]`));

  const keepers = students.filter(s => !candidates.includes(s));
  console.log(`\nWill KEEP ${keepers.length}:`);
  keepers.forEach(k => console.log(`  ✓ ${k.name}  <${k.email}>  [${k.status}]`));

  if (!DELETE) {
    console.log(`\n(DRY RUN — nothing deleted. Re-run with --delete to remove the matched accounts.)`);
    await mongoose.disconnect();
    return;
  }

  const ids = candidates.map(c => c._id);
  // Remove the accounts + their owned data across the main collections.
  const collections = ['StudyReport', 'SyllabusProgress', 'DailyTask', 'Notification', 'MentorFeedback', 'StudyPlan'];
  let childDeleted = 0;
  for (const name of collections) {
    try {
      const Model = (await import(`../models/${name}.js`)).default;
      const field = name === 'MentorFeedback' ? 'studentId' : 'userId';
      const r = await Model.deleteMany({ [field]: { $in: ids } });
      childDeleted += r.deletedCount || 0;
    } catch (e) { /* model may not exist — skip */ }
  }
  const r = await User.deleteMany({ _id: { $in: ids } });
  console.log(`\n✅ Deleted ${r.deletedCount} test students + ${childDeleted} related records.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
