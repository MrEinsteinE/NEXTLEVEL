// Test helper: push Sample's lastActiveDate back N days to exercise the comeback bonus.
import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'dns';
const dnsServers = (process.env.DNS_SERVERS || '1.1.1.1,8.8.8.8').split(',').map(s => s.trim()).filter(Boolean);
if (dnsServers.length) dns.setServers(dnsServers);
const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, family: 4 });
  const User = (await import('../models/User.js')).default;
  const days = Number(process.argv[2] || 8);
  const d = new Date(); d.setDate(d.getDate() - days); d.setHours(0, 0, 0, 0);
  const u = await User.findOneAndUpdate({ email: 'einsteinellandala@gmail.com' }, { lastActiveDate: d }, { new: true }).select('points lastActiveDate');
  console.log('lastActiveDate set to', u.lastActiveDate.toISOString().split('T')[0], '| points:', u.points || 0);
  process.exit(0);
};
run().catch(e => { console.error(e.message); process.exit(1); });
