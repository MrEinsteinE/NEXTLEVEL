// Dev utility: set a known password on the Sample demo account so it can be
// logged into for testing (email-based reset can't be read here). Reports nothing
// sensitive. Run: node scripts/set-sample-password.mjs [password]
import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';

const dnsServers = (process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(',').map(s => s.trim()).filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 });
  const User = (await import('../models/User.js')).default;
  const u = await User.findOne({ email: 'einsteinellandala@gmail.com' });
  if (!u) { console.log('Sample not found'); process.exit(0); }
  u.password = process.argv[2] || 'NextLevel@2026'; // pre-save hook hashes it
  u.emailVerified = true;
  await u.save();
  console.log('Sample password set; emailVerified=true');
  process.exit(0);
};
run().catch(e => { console.error(e.message); process.exit(1); });
