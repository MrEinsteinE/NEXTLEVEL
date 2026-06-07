/**
 * Database Seed Script for NEXT_LEVEL Platform
 * 
 * Run this script to create the initial mentor account and a test student:
 *   node backend/seed.js
 * 
 * Requires MONGODB_URI environment variable or defaults to localhost.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const mongooseOptions = { serverSelectionTimeoutMS: 10000, socketTimeoutMS: 45000, family: 4 };

async function createConnection() {
  const tryConnect = async (uri) => {
    try {
      await mongoose.connect(uri, mongooseOptions);
      console.log('Connected to MongoDB at', uri);
      return { ok: true };
    } catch (err) {
      console.warn('Connection failed to', uri, err?.message || err);
      return { ok: false, error: err };
    }
  };

  // 1) Try environment URI
  if (process.env.MONGODB_URI) {
    const r = await tryConnect(process.env.MONGODB_URI);
    if (r.ok) return null;
  }

  // 2) Try local MongoDB
  const localUri = 'mongodb://127.0.0.1:27017/nextlevel';
  const lr = await tryConnect(localUri);
  if (lr.ok) return null;

  // 3) Fallback to in-memory server (dev only)
  try {
    console.log('Starting in-memory MongoDB for seeding (mongodb-memory-server)');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const memUri = mongod.getUri();
    const mr = await tryConnect(memUri);
    if (mr.ok) return mongod;
    throw new Error('In-memory MongoDB failed to start');
  } catch (err) {
    console.error('All MongoDB connection attempts failed:', err);
    throw err;
  }
}

async function seed() {
  let mongod = null;
  try {
    mongod = await createConnection();

    // Create Mentor account (Bhima Sankar Sir)
    const mentorEmail = 'sankar.bhima@gmail.com';
    const existingMentor = await User.findOne({ email: mentorEmail });
    if (!existingMentor) {
      const salt = await bcrypt.genSalt(10);
      const mentorPassword = process.env.MENTOR_SEED_PASSWORD;
      if (!mentorPassword) {
        console.error('❌ MENTOR_SEED_PASSWORD env var not set — skipping mentor creation');
        process.exit(1);
      }
      const hashedPassword = await bcrypt.hash(mentorPassword, salt);
      await User.create({
        name: 'Bhima Sankar Sir',
        email: mentorEmail,
        password: hashedPassword,
        branch: 'ECE',
        role: 'mentor',
        status: 'approved'
      });
      console.log('✅ Mentor account created: sankar.bhima@gmail.com');
    } else {
      console.log('ℹ️  Mentor account already exists');
    }

    // Create Test Student
    const studentEmail = 'nagarjunaneeraja4@gmail.com';
    const existingStudent = await User.findOne({ email: studentEmail });
    if (process.env.NODE_ENV === 'production') {
      console.log('ℹ️  Skipping test-student seed in production');
    } else if (!existingStudent) {
      const seedPw = process.env.SEED_STUDENT_PASSWORD || 'password123';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(seedPw, salt);
      await User.create({
        name: 'Nagarjuna User',
        email: studentEmail,
        password: hashedPassword,
        branch: 'ECE',
        role: 'student',
        status: 'approved',
        targets: { daily: 8, weekly: 50, monthly: 200 }
      });
      console.log('✅ Test student created: nagarjunaneeraja4@gmail.com (password set)');
    } else {
      console.log('ℹ️  Test student already exists');
    }

    console.log('\n🎉 Seed complete!');
    if (mongod) {
      // If using in-memory DB, keep process running briefly to allow inspection if needed, then exit
      await mongoose.disconnect().catch(() => {});
      try { await mongod.stop(); } catch(e) {}
    }
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
