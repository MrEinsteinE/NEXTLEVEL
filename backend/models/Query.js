import mongoose from 'mongoose';

const querySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  subject: String,
  images: [{ type: String }], // compressed data: URLs of attached images
  question: {
    type: String,
    required: true
  },
  answer: String,
  status: {
    type: String,
    enum: ['pending', 'answered', 'resolved'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  answeredAt: Date
});

const Query = mongoose.model('Query', querySchema);
export default Query;
