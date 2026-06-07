import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import {
  getPendingStudents, approveStudent, rejectStudent,
  getApprovedStudents, getStudentDetail, getStudentTracker,
  setTimetable, updateJourneyStep, computeRiskReasons,
  getFeedbackSuggestions, getWeeklyDigest
} from '../controllers/mentorController.js';

const router = Router();

// All mentor routes require auth + mentor role
router.use(requireAuth);
router.use(requireRole(['mentor']));

// ─── Combined students list (pending + approved) ────────────
// Frontend calls GET /api/mentor/students
router.get('/students', async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const StudyReport = (await import('../models/StudyReport.js')).default;
    const students = await User.find({ role: 'student' })
      .select('name email branch status streak consistencyScore badges lastActiveDate createdAt')
      .sort({ createdAt: -1 });
    const now = Date.now();
    // Enrich approved students with explained at-risk reasons for the
    // dashboard's auto-prioritised "Needs Attention" queue.
    const enriched = await Promise.all(students.map(async (s) => {
      const obj = s.toObject();
      if (s.status === 'approved') {
        const reportCount = await StudyReport.countDocuments({ userId: s._id });
        const lastReport = await StudyReport.findOne({ userId: s._id }).sort({ date: -1 });
        const daysSinceLastReport = lastReport
          ? Math.round((now - new Date(lastReport.date).getTime()) / 86400000)
          : 999;
        const { riskReasons, riskLevel } = computeRiskReasons({
          reportCount, daysSinceLastReport, consistencyScore: s.consistencyScore, streak: s.streak
        });
        obj.reportCount = reportCount;
        obj.daysSinceLastReport = daysSinceLastReport;
        obj.riskReasons = riskReasons;
        obj.riskLevel = riskLevel;
      } else {
        obj.riskReasons = [];
        obj.riskLevel = null;
      }
      return obj;
    }));
    res.json(enriched);
  } catch (err) {
    console.error('GET /mentor/students error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
});

// ─── Approve / Reject (frontend uses PUT /students/:id/approve) ─
router.put('/students/:userId/approve', approveStudent);
router.put('/students/:userId/reject', rejectStudent);

// ─── Also support the original POST routes ──────────────────
router.post('/approve-student/:userId', approveStudent);
router.post('/reject-student/:userId', rejectStudent);

// ─── Weekly digest (all approved students, current week) ────
router.get('/weekly-digest', getWeeklyDigest);

// ─── Auto-suggested feedback drafts for one student ─────────
router.get('/student/:userId/feedback-suggestions', getFeedbackSuggestions);

// ─── Student detail ─────────────────────────────────────────
// Frontend calls GET /api/mentor/student/:id/detail
router.get('/student/:userId/detail', getStudentDetail);
router.get('/student-detail/:userId', getStudentDetail); // alias

// ─── Student tracker logs (mentor view) ─────────────────────
router.get('/student/:userId/tracker', getStudentTracker);

// ─── Student reports (used as fallback in frontend) ─────────
router.get('/student/:userId/reports', async (req, res) => {
  try {
    const StudyReport = (await import('../models/StudyReport.js')).default;
    const reports = await StudyReport.find({ userId: req.params.userId })
      .sort({ date: -1 })
      .limit(30);
    res.json(reports);
  } catch (err) {
    console.error('GET /mentor/student/:id/reports error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
});

// ─── Mentorship steps (journey) ─────────────────────────────
// Frontend calls POST /api/mentor/step/:id with { steps: [{ title, completed }] }.
// Writes to User.journeySteps — the SAME source the mentor modal loads from and
// the student's journey reads — so saves persist and reach the student. (Previously
// this wrote to an orphaned MentorshipStep collection, so mentor saves were lost.)
router.post('/step/:userId', async (req, res) => {
  try {
    const User = (await import('../models/User.js')).default;
    const { steps } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    if (Array.isArray(steps)) {
      for (const update of steps) {
        const name = update.title || update.name;
        const step = (user.journeySteps || []).find(s => s.name === name);
        if (step) {
          step.completed = !!update.completed;
          step.completedDate = update.completed ? (step.completedDate || new Date()) : null;
        }
      }
      await user.save();
    }

    const io = req.app.get('io');
    if (io) io.to(`student_${req.params.userId}`).emit('journey-updated', { userId: req.params.userId, journeySteps: user.journeySteps });

    // Return in the shape the modal loads (stepNumber/title/completed/completedAt).
    const out = (user.journeySteps || []).map((j, i) => ({
      stepNumber: i + 1, title: j.name, completed: j.completed, completedAt: j.completedDate
    }));
    res.json({ success: true, steps: out });
  } catch (err) {
    console.error('POST /mentor/step/:id error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
});

// ─── Pending/Approved (original routes) ─────────────────────
router.get('/pending-students', getPendingStudents);
router.get('/approved-students', getApprovedStudents);

// ─── Timetable & Journey management ────────────────────────
router.post('/timetable/:userId', setTimetable);
router.post('/journey/:userId', updateJourneyStep);

export default router;
