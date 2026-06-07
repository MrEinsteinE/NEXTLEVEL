import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
  try {
    // Source the mentor password from the environment — never hardcode a weak
    // credential in committed source.
    const pw = process.env.MENTOR_MASTER_PASSWORD;
    if (!pw) {
      console.error('Set MENTOR_MASTER_PASSWORD in the environment before seeding the mentor.');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    const hash = await bcrypt.hash(pw, 10);
    await User.findOneAndUpdate(
      { email: 'sankar.bhima@gmail.com' },
      { name: 'Bhima Sankar', email: 'sankar.bhima@gmail.com', password: hash, branch: 'ECE', role: 'mentor', status: 'approved' },
      { upsert: true }
    );
    console.log('Mentor seeded');
    process.exit(0);
  } catch (err) {
    console.error('Seed mentor failed:', err);
    process.exit(1);
  }
};

run();
