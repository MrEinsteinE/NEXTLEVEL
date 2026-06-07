import DailyTrackerLog from '../models/DailyTrackerLog.js';
import SubjectProgress from '../models/SubjectProgress.js';
import StudyReport from '../models/StudyReport.js';
import { validationResult } from 'express-validator';

// Get all tracker logs for a user (optionally by date range)
export const getTrackerLogs = async (req, res) => {
  try {
    const { start, end } = req.query;
    const query = { userId: req.user._id };
    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = new Date(start);
      if (end) query.date.$lte = new Date(end);
    }
    const logs = await DailyTrackerLog.find(query).sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    console.error('Tracker error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Add or update a tracker log for a day
export const upsertTrackerLog = async (req, res) => {
  try {
    const { date, entries, mentorRemarks, studentAnswers } = req.body;
    if (!date || !entries) return res.status(400).json({ error: true, message: 'Date and entries required.' });
    // Normalize date to start of day (UTC) to ensure unique per-day logs
    const logDate = new Date(date);
    logDate.setUTCHours(0,0,0,0);

    // Prevent students from editing past dates (mentors may)
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    if (logDate < today && req.user?.role !== 'mentor') {
      return res.status(403).json({ error: true, message: 'Past tracker logs are read-only.' });
    }

    const log = await DailyTrackerLog.findOneAndUpdate(
      { userId: req.user._id, date: logDate },
      { $set: { entries, mentorRemarks, studentAnswers } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Emit a progress-updated event so mentors receive live updates
    try {
      const io = req.app.get('io');
      if (io) io.emit('progress-updated', { userId: req.user._id, tracker: log });
    } catch (e) {
      console.error('emit progress-updated error:', e);
    }

    res.json({ success: true, log });
  } catch (err) {
    console.error('Tracker error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Get subject progress for a user
export const getSubjectProgress = async (req, res) => {
  try {
    const progress = await SubjectProgress.find({ userId: req.user._id });
    res.json(progress);
  } catch (err) {
    console.error('Tracker error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Update subject progress for a user
export const updateSubjectProgress = async (req, res) => {
  try {
    const { subject, videoDone, practiceDone, revisionDone } = req.body;
    if (!subject) return res.status(400).json({ error: true, message: 'Subject required.' });
    const progress = await SubjectProgress.findOneAndUpdate(
      { userId: req.user._id, subject },
      { $set: { videoDone, practiceDone, revisionDone } },
      { new: true }
    );
    res.json(progress);
  } catch (err) {
    console.error('Tracker error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Get weekly and overall reports
export const getReports = async (req, res) => {
  try {
    // This can be expanded for more analytics
    const { weekStart, weekEnd } = req.query;
    const filter = { userId: req.user._id };
    if (weekStart || weekEnd) {
      filter.date = {};
      if (weekStart) {
        const s = new Date(weekStart);
        if (isNaN(s.getTime())) return res.status(400).json({ error: true, message: 'Invalid weekStart date.' });
        filter.date.$gte = s;
      }
      if (weekEnd) {
        const e = new Date(weekEnd);
        if (isNaN(e.getTime())) return res.status(400).json({ error: true, message: 'Invalid weekEnd date.' });
        filter.date.$lte = e;
      }
    }
    const logs = await DailyTrackerLog.find(filter);
    // Compute weekly stats here if needed
    res.json({ logs });
  } catch (err) {
    console.error('Tracker error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
