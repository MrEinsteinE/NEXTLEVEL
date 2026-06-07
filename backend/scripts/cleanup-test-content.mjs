// Clears leftover TEST content (gibberish doubts + custom flashcards) from the
// Sample demo account, while KEEPING study reports / points / streak / syllabus
// so the demos still look alive. Dry-run by default; add --delete to apply.
import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';

const dnsServers = (process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(',').map(s => s.trim()).filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

const DELETE = process.argv.includes('--delete');
const SAMPLE_EMAIL = 'einsteinellandala@gmail.com';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 });
  const User = (await import('../models/User.js')).default;
  const Query = (await import('../models/Query.js')).default;
  const FlashcardProgress = (await import('../models/FlashcardProgress.js')).default;

  const sample = await User.findOne({ email: SAMPLE_EMAIL }).select('_id name');
  if (!sample) { console.log('Sample account not found'); process.exit(0); }

  const queries = await Query.find({ userId: sample._id }).select('subject question');
  const fp = await FlashcardProgress.findOne({ userId: sample._id }).select('customCards');
  const customCount = fp ? (fp.customCards || []).length : 0;

  console.log(`Sample (${sample.name}) test content:`);
  console.log(`  Doubts/queries: ${queries.length}`);
  queries.forEach(q => console.log(`    - [${q.subject || ''}] ${q.question}`));
  console.log(`  Custom flashcards: ${customCount}`);

  if (!DELETE) { console.log('\n(DRY RUN — re-run with --delete to remove.)'); process.exit(0); }

  const qr = await Query.deleteMany({ userId: sample._id });
  let cleared = 0;
  if (fp && customCount) { fp.customCards = []; await fp.save(); cleared = customCount; }
  console.log(`\n✅ Removed ${qr.deletedCount} doubts + ${cleared} custom flashcards for Sample. (Study metrics/points/streak kept.)`);
  process.exit(0);
};
run().catch(e => { console.error(e); process.exit(1); });
