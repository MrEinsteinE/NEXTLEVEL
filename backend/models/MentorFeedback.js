import mongoose from 'mongoose';

const mentorFeedbackSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mentorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['weekly', 'topic', 'encouragement', 'flag', 'mentor', 'remark', 'general'], default: 'weekly' },
  text: { type: String, required: true, maxlength: 1000 },
  ratings: {
    consistency: { type: Number, min: 0, max: 5 },
    accuracy: { type: Number, min: 0, max: 5 },
    coverage: { type: Number, min: 0, max: 5 }
  },
  topic: { type: String },
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const MentorFeedback = mongoose.model('MentorFeedback', mentorFeedbackSchema);
export default MentorFeedback;
