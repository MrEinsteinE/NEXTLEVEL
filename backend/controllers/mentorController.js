import User from '../models/User.js';
import StudyReport from '../models/StudyReport.js';
import SyllabusProgress from '../models/SyllabusProgress.js';
import DailyTask from '../models/DailyTask.js';
import DailyTrackerLog from '../models/DailyTrackerLog.js';
import Timetable from '../models/Timetable.js';
import { sendApprovalEmail } from '../services/emailService.js';

// ─── GET /api/mentor/pending-students ──────────────────────
export const getPendingStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student', status: 'pending' })
      .select('name email branch createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: students.length, students });
  } catch (err) {
    console.error('getPendingStudents error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── POST /api/mentor/approve-student/:userId ──────────────
export const approveStudent = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });
    if (user.role !== 'student') return res.status(400).json({ error: true, message: 'Can only approve students.' });
    if (user.status === 'approved') return res.status(400).json({ error: true, message: 'Student already approved.' });

    user.status = 'approved';
    await user.save();

    // Emit approval event
    const io = req.app.get('io');
    if (io) {
      io.emit('student-approved', { userId: user._id, name: user.name });
    }

    // Send approval email (non-blocking)
    sendApprovalEmail({ name: user.name, email: user.email }).catch(err =>
      console.error('Approval email failed:', err.message)
    );

    res.json({ success: true, message: `${user.name} has been approved.`, user: { _id: user._id, name: user.name, status: user.status } });
  } catch (err) {
    console.error('approveStudent error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── POST /api/mentor/reject-student/:userId ───────────────
export const rejectStudent = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    user.status = 'rejected';
    await user.save();

    res.json({ success: true, message: `${user.name} has been rejected.` });
  } catch (err) {
    console.error('rejectStudent error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Shared at-risk reasoning so the dashboard's "Needs Attention" queue and the
// approved-students stats agree. Returns explained reasons + an overall level.
export const computeRiskReasons = ({ reportCount, daysSinceLastReport, consistencyScore, streak }) => {
  const reasons = [];
  if (reportCount === 0) {
    reasons.push({ code: 'never_active', label: 'Never submitted a report', level: 'high' });
  } else if (daysSinceLastReport >= 3) {
    reasons.push({
      code: 'inactive',
      label: `No report in ${daysSinceLastReport} day${daysSinceLastReport === 1 ? '' : 's'}`,
      level: daysSinceLastReport >= 5 ? 'high' : 'medium'
    });
  }
  if (typeof consistencyScore === 'number' && consistencyScore < 40 && reportCount > 0) {
    reasons.push({ code: 'low_consistency', label: `Low consistency (${consistencyScore}%)`, level: 'medium' });
  }
  if (streak === 0 && reportCount > 3 && daysSinceLastReport < 3) {
    reasons.push({ code: 'lost_streak', label: 'Streak broken', level: 'low' });
  }
  const riskLevel = reasons.some(r => r.level === 'high') ? 'high'
    : reasons.some(r => r.level === 'medium') ? 'medium'
    : reasons.length ? 'low' : null;
  return { riskReasons: reasons, riskLevel };
};

// ─── GET /api/mentor/approved-students ─────────────────────
// Returns list with computed stats per student
export const getApprovedStudents = async (req, res) => {
  try {
    const students = await User.find({ role: 'student', status: 'approved' })
      .select('name email branch streak consistencyScore badges lastActiveDate createdAt')
      .sort({ name: 1 });

    // Compute additional live stats per student
    const enriched = await Promise.all(students.map(async (student) => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setUTCHours(0, 0, 0, 0);

      // Count total reports
      const reportCount = await StudyReport.countDocuments({ userId: student._id });

      // Total study hours (all time)
      const totalAgg = await StudyReport.aggregate([
        { $match: { userId: student._id } },
        { $group: { _id: null, total: { $sum: '$studyHours' } } }
      ]);

      // Today's report
      const todayReport = await StudyReport.findOne({
        userId: student._id,
        date: { $gte: startOfToday }
      });

      // At-risk check with explained reasons (so the mentor knows WHY, not just a dot).
      const lastReport = await StudyReport.findOne({ userId: student._id }).sort({ date: -1 });
      const daysSinceLastReport = lastReport
        ? Math.round((now - lastReport.date) / (1000 * 60 * 60 * 24))
        : reportCount === 0 ? 999 : 0;

      const { riskReasons, riskLevel } = computeRiskReasons({
        reportCount, daysSinceLastReport,
        consistencyScore: student.consistencyScore, streak: student.streak
      });

      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        branch: student.branch,
        streak: student.streak,
        consistencyScore: student.consistencyScore,
        badges: student.badges,
        lastActiveDate: student.lastActiveDate,
        createdAt: student.createdAt,
        totalStudyHours: totalAgg[0]?.total || 0,
        reportCount,
        hasReportedToday: !!todayReport,
        daysSinceLastReport,
        atRisk: riskReasons.length > 0,
        riskReasons,
        riskLevel
      };
    }));

    // Stats summary
    const totalApproved = enriched.length;
    const eceBranch = enriched.filter(s => s.branch === 'ECE').length;
    const eeBranch = enriched.filter(s => s.branch === 'EE').length;
    const cseBranch = enriched.filter(s => s.branch === 'CSE').length;
    const atRiskCount = enriched.filter(s => s.atRisk).length;

    res.json({
      success: true,
      stats: { totalApproved, eceBranch, eeBranch, cseBranch, atRiskCount },
      students: enriched
    });
  } catch (err) {
    console.error('getApprovedStudents error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── GET /api/mentor/student-detail/:userId ────────────────
// Full student data with all aggregated stats
export const getStudentDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfWeekDate = getStartOfWeek(now);
    const startOfMonthDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

    // Aggregate study data
    const [todayAgg, weekAgg, monthAgg, allTimeAgg] = await Promise.all([
      StudyReport.aggregate([
        { $match: { userId: user._id, date: { $gte: startOfToday } } },
        { $group: { _id: null, hours: { $sum: '$studyHours' }, pyqs: { $sum: '$pyqsSolved' }, acc: { $avg: '$accuracy' } } }
      ]),
      StudyReport.aggregate([
        { $match: { userId: user._id, date: { $gte: startOfWeekDate } } },
        { $group: { _id: null, hours: { $sum: '$studyHours' }, pyqs: { $sum: '$pyqsSolved' }, acc: { $avg: '$accuracy' } } }
      ]),
      StudyReport.aggregate([
        { $match: { userId: user._id, date: { $gte: startOfMonthDate } } },
        { $group: { _id: null, hours: { $sum: '$studyHours' }, pyqs: { $sum: '$pyqsSolved' }, acc: { $avg: '$accuracy' } } }
      ]),
      StudyReport.aggregate([
        { $match: { userId: user._id } },
        { $group: { _id: null, hours: { $sum: '$studyHours' }, pyqs: { $sum: '$pyqsSolved' }, acc: { $avg: '$accuracy' }, reports: { $sum: 1 } } }
      ])
    ]);

    // Recent reports
    const recentReports = await StudyReport.find({ userId: user._id }).sort({ date: -1 }).limit(14);

    // Syllabus progress
    const syllabusProgress = await SyllabusProgress.findOne({ userId: user._id });
    let syllabusPercentage = 0;
    if (syllabusProgress) {
      const total = syllabusProgress.progress.length;
      const done = syllabusProgress.progress.filter(p => p.completed).length;
      syllabusPercentage = total > 0 ? Math.round((done / total) * 100) : 0;
    }

    // Today's tasks
    const todayTasks = await DailyTask.findOne({ userId: user._id, date: { $gte: startOfToday } });

    // Latest timetable from the Timetable collection (same source the student reads).
    const timetableDoc = await Timetable.findOne({ studentId: user._id }).sort({ weekStart: -1 });

    res.json({
      success: true,
      student: {
        _id: user._id,
        name: user.name,
        email: user.email,
        branch: user.branch,
        streak: user.streak,
        consistencyScore: user.consistencyScore,
        badges: user.badges,
        targets: user.targets,
        timetable: user.timetable,
        journeySteps: user.journeySteps,
        createdAt: user.createdAt
      },
      aggregated: {
        today: { hours: todayAgg[0]?.hours || 0, pyqs: todayAgg[0]?.pyqs || 0, accuracy: Math.round(todayAgg[0]?.acc || 0) },
        week: { hours: weekAgg[0]?.hours || 0, pyqs: weekAgg[0]?.pyqs || 0, accuracy: Math.round(weekAgg[0]?.acc || 0) },
        month: { hours: monthAgg[0]?.hours || 0, pyqs: monthAgg[0]?.pyqs || 0, accuracy: Math.round(monthAgg[0]?.acc || 0) },
        allTime: { hours: allTimeAgg[0]?.hours || 0, pyqs: allTimeAgg[0]?.pyqs || 0, accuracy: Math.round(allTimeAgg[0]?.acc || 0), reports: allTimeAgg[0]?.reports || 0 }
      },
      recentReports,
      syllabusPercentage,
      timetable: timetableDoc,
      todayTasks: todayTasks?.tasks || []
    });
  } catch (err) {
    console.error('getStudentDetail error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── GET /api/mentor/student/:userId/tracker ───────────────
export const getStudentTracker = async (req, res) => {
  try {
    const logs = await DailyTrackerLog.find({ userId: req.params.userId }).sort({ date: -1 });
    res.json({ success: true, logs });
  } catch (err) {
    console.error('getStudentTracker error:', err);
    res.status(500).json({ error: true, message: 'Server error fetching tracker logs.' });
  }
};

// ─── POST /api/mentor/timetable/:userId ────────────────────
// Saves to the Timetable collection (what the student's dashboard reads), so a
// timetable the mentor saves actually shows up for the student.
export const setTimetable = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    // The editor posts { weekStart, days: [{ day, subject, topic, targetHours, description }] }.
    const { weekStart, days } = req.body;
    if (!Array.isArray(days)) {
      return res.status(400).json({ error: true, message: 'days must be an array of { day, subject, topic, targetHours }.' });
    }

    const timetable = await Timetable.findOneAndUpdate(
      { studentId: user._id },
      {
        studentId: user._id,
        weekStart: weekStart ? new Date(weekStart) : new Date(),
        days,
        updatedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Notify the student in real time.
    const io = req.app.get('io');
    if (io) io.to(`student_${user._id}`).emit('timetable-updated', { timetable });

    res.json({ success: true, message: 'Timetable saved.', timetable });
  } catch (err) {
    console.error('setTimetable error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── POST /api/mentor/journey/:userId ──────────────────────
export const updateJourneyStep = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    const { stepName, completed } = req.body;
    if (!stepName) return res.status(400).json({ error: true, message: 'stepName is required.' });

    const step = user.journeySteps.find(s => s.name === stepName);
    if (!step) return res.status(400).json({ error: true, message: `Step "${stepName}" not found.` });

    step.completed = !!completed;
    step.completedDate = completed ? new Date() : null;
    await user.save();

    res.json({ success: true, journeySteps: user.journeySteps });
  } catch (err) {
    console.error('updateJourneyStep error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Helper
function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── GET /api/mentor/student/:userId/feedback-suggestions ──
// Generates ready-to-edit feedback drafts from the student's last 7 days, so the
// mentor never starts from a blank box. Returns drafts tailored to the situation.
export const getFeedbackSuggestions = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name streak consistencyScore targets journeySteps');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const reports = await StudyReport.find({ userId: user._id, date: { $gte: weekAgo } }).lean();
    const hours = reports.reduce((s, r) => s + (r.studyHours || 0), 0);
    const pyqs = reports.reduce((s, r) => s + (r.pyqsSolved || 0), 0);
    const accVals = reports.map(r => r.accuracy).filter(a => typeof a === 'number' && a >= 0);
    const avgAcc = accVals.length ? Math.round(accVals.reduce((a, b) => a + b, 0) / accVals.length) : null;
    const lastReport = await StudyReport.findOne({ userId: user._id }).sort({ date: -1 });
    const daysSince = lastReport ? Math.round((now - lastReport.date) / 86400000) : 999;
    const targetWeek = (user.targets?.daily || 6) * 7;
    const consistency = user.consistencyScore;
    const fname = (user.name || 'there').split(' ')[0];
    const journeyDone = (user.journeySteps || []).filter(s => s.completed).length;

    const suggestions = [];
    if (daysSince >= 3) {
      suggestions.push({ type: 'reconnect', label: 'Re-engage', text: `Hi ${fname}, I noticed you haven't logged any study time in ${daysSince} days. Is everything okay? Let's restart gently — even one focused hour today gets the momentum back. I'm here if you're stuck on anything.` });
    }
    if (typeof consistency === 'number' && consistency < 40 && reports.length > 0) {
      suggestions.push({ type: 'consistency', label: 'Consistency', text: `${fname}, your consistency was ${consistency}% this week. Let's set a smaller daily target you can hit every single day — steady beats intense. Consistency is what cracks GATE.` });
    }
    if (hours >= targetWeek * 0.7 && hours > 0) {
      suggestions.push({ type: 'praise', label: 'Praise', text: `Excellent work this week, ${fname} — ${(Math.round(hours * 10) / 10)} hours logged! Your discipline is showing. Keep this rhythm and the results will follow.` });
    }
    if (avgAcc !== null && avgAcc < 55) {
      suggestions.push({ type: 'accuracy', label: 'Accuracy', text: `${fname}, your PYQ accuracy is around ${avgAcc}% this week. Before moving to new topics, revisit the questions you got wrong and note the concept gap — accuracy will climb fast.` });
    }
    if (user.streak >= 7) {
      suggestions.push({ type: 'streak', label: 'Streak', text: `${user.streak}-day streak, ${fname}! That consistency is exactly what separates rankers from the rest. Proud of you — don't break the chain.` });
    }
    if (pyqs >= 50) {
      suggestions.push({ type: 'pyq', label: 'PYQ effort', text: `Great PYQ effort, ${fname} — ${pyqs} solved this week. Now focus on quality: for every 10 you solve, deeply analyse the 2-3 you found hardest.` });
    }
    if (suggestions.length === 0) {
      suggestions.push({ type: 'encourage', label: 'Encourage', text: `Keep going, ${fname}! You've completed ${journeyDone}/8 journey steps. Stay consistent with your daily logs and reach out whenever you need direction.` });
    }

    res.json({
      success: true,
      stats: { hours: Math.round(hours * 10) / 10, pyqs, avgAcc, daysSince, consistency, streak: user.streak },
      suggestions
    });
  } catch (err) {
    console.error('getFeedbackSuggestions error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── GET /api/mentor/weekly-digest ─────────────────────────
// One row per approved student summarising the current week, so the mentor sees
// everyone's progress at a glance without opening each profile.
export const getWeeklyDigest = async (req, res) => {
  try {
    const weekStart = getStartOfWeek(new Date());
    const students = await User.find({ role: 'student', status: 'approved' })
      .select('name branch streak consistencyScore targets').sort({ name: 1 });
    const digest = await Promise.all(students.map(async (s) => {
      const reports = await StudyReport.find({ userId: s._id, date: { $gte: weekStart } }).lean();
      const hours = reports.reduce((a, r) => a + (r.studyHours || 0), 0);
      const pyqs = reports.reduce((a, r) => a + (r.pyqsSolved || 0), 0);
      const accVals = reports.map(r => r.accuracy).filter(a => typeof a === 'number' && a >= 0);
      const avgAcc = accVals.length ? Math.round(accVals.reduce((a, b) => a + b, 0) / accVals.length) : null;
      const targetWeek = (s.targets?.daily || 6) * 7;
      return {
        _id: s._id, name: s.name, branch: s.branch, streak: s.streak,
        consistencyScore: s.consistencyScore,
        studyHours: Math.round(hours * 10) / 10, targetHours: targetWeek,
        pyqs, avgAcc, reportsThisWeek: reports.length,
        onTrack: targetWeek > 0 && hours >= targetWeek * 0.7
      };
    }));
    res.json({ success: true, weekStart, digest });
  } catch (err) {
    console.error('getWeeklyDigest error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
