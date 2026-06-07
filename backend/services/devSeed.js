import User from '../models/User.js';

// Dev-only convenience: guarantees a ready, pre-approved student so you can log
// in immediately without the signup+approve dance. The in-memory dev DB resets
// on every restart, which is why a freshly-created account "disappears".
// Never runs in production or against a real MONGODB_URI.
export async function seedDevData() {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.MONGODB_URI) return; // only seed the in-memory dev DB
  try {
    const email = 'student@example.com';
    if (!(await User.findOne({ email }))) {
      await User.create({
        name: 'Demo Student', email, password: 'password123',
        branch: 'CSE', role: 'student', status: 'approved',
        emailVerified: true
      });
      console.log('🌱 Dev login ready → student@example.com / password123 (approved)');
    }
  } catch (e) {
    console.warn('Dev seed skipped:', e.message);
  }
}
