import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema({
  questionId: { type: String, required: true },
  subject: { type: String },
  status: { type: String, enum: ['correct', 'wrong', 'skipped', 'bookmarked'], required: true },
  attemptedAt: { type: Date, default: Date.now },
  timeTaken: { type: Number, default: 0 }
});

// A practice set: "attempted N questions in <subject>, got M correct" — matches how
// students actually practice (in batches), instead of one all-or-nothing question.
const setSchema = new mongoose.Schema({
  subject: { type: String, default: 'General' },
  attempted: { type: Number, required: true, min: 1 },
  correct: { type: Number, required: true, min: 0 },
  attemptedAt: { type: Date, default: Date.now }
});

const pyqProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sets: [setSchema],
  attempts: [attemptSchema], // legacy per-question attempts (still counted in accuracy)
  bookmarks: [{ type: String }]
});

const PYQProgress = mongoose.model('PYQProgress', pyqProgressSchema);
export default PYQProgress;
