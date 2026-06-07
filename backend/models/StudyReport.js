import mongoose from 'mongoose';

const studyReportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  date: { type: Date, required: [true, 'Date is required'] },
  subject: { type: String, required: [true, 'Subject is required'], trim: true },
  topic: { type: String, required: [true, 'Topic is required'], trim: true },
  studyHours: {
    type: Number,
    required: [true, 'Study hours is required'],
    min: [0, 'Study hours cannot be negative'],
    max: [24, 'Study hours cannot exceed 24']
  },
  pyqsSolved: {
    type: Number,
    required: [true, 'PYQs solved is required'],
    min: [0, 'PYQs solved cannot be negative']
  },
  mockTestScore: {
    type: Number,
    min: [0, 'Mock test score cannot be negative'],
    max: [100, 'Mock test score cannot exceed 100'],
    default: null // null = not recorded (vs a genuine score of 0)
  },
  accuracy: {
    type: Number,
    min: [0, 'Accuracy cannot be negative'],
    max: [100, 'Accuracy cannot exceed 100'],
    default: null
  },
  difficulties: { type: String, trim: true, default: '' },
  mood: { type: String, trim: true, default: '' },
  tomorrowPlan: { type: String, trim: true, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// One report per student per day
studyReportSchema.index({ userId: 1, date: 1 }, { unique: true });
// For aggregation queries
studyReportSchema.index({ userId: 1, date: -1 });

const StudyReport = mongoose.model('StudyReport', studyReportSchema);
export default StudyReport;