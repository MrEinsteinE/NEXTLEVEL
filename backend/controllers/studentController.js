import mongoose from 'mongoose';
import User from '../models/User.js';
import StudyReport from '../models/StudyReport.js';
import SyllabusProgress from '../models/SyllabusProgress.js';
import DailyTask from '../models/DailyTask.js';
import Timetable from '../models/Timetable.js';
import Notification from '../models/Notification.js';
import { getGATESyllabus } from '../services/gateSyllabusData.js';

// ─── Helpers ───────────────────────────────────────────────
function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(date) {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function endOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ─── GET /api/student/targets/:userId ──────────────────────
export const getTargets = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('targets name');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });
    res.json({ success: true, targets: user.targets });
  } catch (err) {
    console.error('getTargets error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/student/targets/:userId
export const updateTargets = async (req, res) => {
  try {
    const { daily, weekly, monthly } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    // Clamp to physical bounds; reject non-numeric so Mongoose doesn't 500 on NaN.
    const clampHours = (v, max) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : null; };
    if (daily !== undefined) { const v = clampHours(daily, 24); if (v === null) return res.status(400).json({ error: true, message: 'Invalid daily target.' }); user.targets.daily = v; }
    if (weekly !== undefined) { const v = clampHours(weekly, 168); if (v === null) return res.status(400).json({ error: true, message: 'Invalid weekly target.' }); user.targets.weekly = v; }
    if (monthly !== undefined) { const v = clampHours(monthly, 744); if (v === null) return res.status(400).json({ error: true, message: 'Invalid monthly target.' }); user.targets.monthly = v; }
    await user.save();

    res.json({ success: true, targets: user.targets });
  } catch (err) {
    console.error('updateTargets error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── GET /api/student/progress/:userId ─────────────────────
// Returns { today, week, month } study hours aggregated from StudyReport
export const getProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();

    const oid = new mongoose.Types.ObjectId(userId);
    const [todayAgg, weekAgg, monthAgg] = await Promise.all([
      StudyReport.aggregate([
        { $match: { userId: oid, date: { $gte: startOfDay(now), $lte: endOfDay(now) } } },
        { $group: { _id: null, total: { $sum: '$studyHours' }, pyqs: { $sum: '$pyqsSolved' }, avgAccuracy: { $avg: '$accuracy' } } }
      ]),
      StudyReport.aggregate([
        { $match: { userId: oid, date: { $gte: startOfWeek(now), $lte: endOfDay(now) } } },
        { $group: { _id: null, total: { $sum: '$studyHours' }, pyqs: { $sum: '$pyqsSolved' }, avgAccuracy: { $avg: '$accuracy' } } }
      ]),
      StudyReport.aggregate([
        { $match: { userId: oid, date: { $gte: startOfMonth(now), $lte: endOfDay(now) } } },
        { $group: { _id: null, total: { $sum: '$studyHours' }, pyqs: { $sum: '$pyqsSolved' }, avgAccuracy: { $avg: '$accuracy' } } }
      ])
    ]);

    const user = await User.findById(userId).select('targets');

    res.json({
      success: true,
      progress: {
        today: {
          studyHours: todayAgg[0]?.total || 0,
          pyqsSolved: todayAgg[0]?.pyqs || 0,
          accuracy: Math.round(todayAgg[0]?.avgAccuracy || 0)
        },
        week: {
          studyHours: weekAgg[0]?.total || 0,
          pyqsSolved: weekAgg[0]?.pyqs || 0,
          accuracy: Math.round(weekAgg[0]?.avgAccuracy || 0)
        },
        month: {
          studyHours: monthAgg[0]?.total || 0,
          pyqsSolved: monthAgg[0]?.pyqs || 0,
          accuracy: Math.round(monthAgg[0]?.avgAccuracy || 0)
        },
        targets: user?.targets || { daily: 6, weekly: 42, monthly: 180 }
      }
    });
  } catch (err) {
    console.error('getProgress error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── POST /api/student/study-report ────────────────────────
export const createStudyReport = async (req, res) => {
  try {
    // Always attribute the report to the authenticated student — never trust a
    // client-supplied userId (prevents writing reports as another user).
    const userId = req.user._id;
    const { date, subject, topic, studyHours, pyqsSolved, mockTestScore, accuracy, difficulties, mood, tomorrowPlan } = req.body;
    // Keep optional percentage fields null when blank (so history doesn't show a fake "0%").
    const clampPct = (v) => (v === undefined || v === null || v === '') ? null : Math.min(100, Math.max(0, Number(v)));

    if (!date || !subject || !topic || studyHours === undefined || pyqsSolved === undefined) {
      return res.status(400).json({ error: true, message: 'Missing required fields (date, subject, topic, studyHours, pyqsSolved).' });
    }

    const reportDate = startOfDay(new Date(date));

    // Check for duplicate
    const existing = await StudyReport.findOne({ userId, date: reportDate });
    if (existing) {
      return res.status(400).json({ error: true, message: 'A study report already exists for this date. Update it instead.' });
    }

    const report = await StudyReport.create({
      userId,
      date: reportDate,
      subject,
      topic,
      studyHours: Math.max(0, Number(studyHours)),
      pyqsSolved: Math.max(0, Number(pyqsSolved)),
      mockTestScore: clampPct(mockTestScore),
      accuracy: clampPct(accuracy),
      difficulties: difficulties || '',
      mood: mood || '',
      tomorrowPlan: tomorrowPlan || ''
    });

    // Capture prior activity to detect a "comeback" (returning after a 3+ day gap).
    const preUser = await User.findById(userId).select('lastActiveDate');
    const prevActive = preUser?.lastActiveDate ? startOfDay(new Date(preUser.lastActiveDate)) : null;
    const gapDays = prevActive ? Math.round((reportDate - prevActive) / (24 * 60 * 60 * 1000)) : null;
    const isComeback = gapDays != null && gapDays >= 3;

    // Update streak logic
    await updateStreakAfterReport(userId, reportDate);

    // Emit progress-updated to all connected clients (including mentors)
    const io = req.app.get('io');
    if (io) {
      io.emit('progress-updated', { userId, report });
    }

    // Award points for submitting a study report
    try {
      const user = await User.findById(userId);
      if (user) {
        const base = 20;
        const bonus = isComeback ? 20 : 0; // 2× welcome-back reward for returning after a break
        user.points = (user.points || 0) + base + bonus;
        await user.save();
        const msg = isComeback
          ? `Welcome back! You earned ${base + bonus} points (2× comeback bonus) for getting back on track.`
          : 'You earned 20 points for submitting a study report.';
        await Notification.create({ userId: user._id, type: isComeback ? 'comeback' : 'points', title: isComeback ? 'Welcome back! 🎉' : 'Points earned', message: msg });
        if (io) io.to(`student_${userId}`).emit('points-updated', { userId, points: user.points, comeback: isComeback });
      }
    } catch (e) {
      console.error('award points after report error:', e);
    }

    res.status(201).json({ success: true, report, comeback: isComeback });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: true, message: 'A study report already exists for this date.' });
    }
    console.error('createStudyReport error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── PATCH /api/student/study-report/:reportId ─────────────
// Edit an existing report (the create path rejects duplicate dates, so editing
// needs its own endpoint). Scoped strictly to the owner.
export const updateStudyReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(String(reportId || ''))) {
      return res.status(400).json({ error: true, message: 'Invalid report id.' });
    }
    const report = await StudyReport.findById(reportId);
    if (!report) return res.status(404).json({ error: true, message: 'Report not found.' });
    if (!report.userId.equals(req.user._id)) return res.status(403).json({ error: true, message: 'Forbidden.' });

    const { subject, topic, studyHours, pyqsSolved, mockTestScore, accuracy, difficulties, mood, tomorrowPlan } = req.body;
    const clampPct = (v) => (v === undefined || v === null || v === '') ? null : Math.min(100, Math.max(0, Number(v)));
    if (subject !== undefined) report.subject = subject;
    if (topic !== undefined) report.topic = topic;
    if (studyHours !== undefined) report.studyHours = Math.max(0, Number(studyHours));
    if (pyqsSolved !== undefined) report.pyqsSolved = Math.max(0, Number(pyqsSolved));
    if (mockTestScore !== undefined) report.mockTestScore = clampPct(mockTestScore);
    if (accuracy !== undefined) report.accuracy = clampPct(accuracy);
    if (difficulties !== undefined) report.difficulties = difficulties || '';
    if (mood !== undefined) report.mood = mood || '';
    if (tomorrowPlan !== undefined) report.tomorrowPlan = tomorrowPlan || '';
    await report.save();

    // An edit doesn't change which days were active, so streak/points are untouched.
    const io = req.app.get('io');
    if (io) io.emit('progress-updated', { userId: req.user._id, report });
    res.json({ success: true, report });
  } catch (err) {
    console.error('updateStudyReport error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── DELETE /api/student/study-report/:reportId ────────────
export const deleteStudyReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    if (!/^[a-f\d]{24}$/i.test(String(reportId || ''))) {
      return res.status(400).json({ error: true, message: 'Invalid report id.' });
    }
    const report = await StudyReport.findById(reportId);
    if (!report) return res.status(404).json({ error: true, message: 'Report not found.' });
    if (!report.userId.equals(req.user._id)) return res.status(403).json({ error: true, message: 'Forbidden.' });
    await report.deleteOne();
    // Streak self-heals on the next streak fetch (computeStreak re-reads history).
    const io = req.app.get('io');
    if (io) io.emit('progress-updated', { userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteStudyReport error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── GET /api/student/study-reports/:userId ────────────────
export const getStudyReports = async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;

    const filter = { userId };
    if (start || end) {
      filter.date = {};
      if (start) filter.date.$gte = startOfDay(new Date(start));
      if (end) filter.date.$lte = endOfDay(new Date(end));
    }

    const reports = await StudyReport.find(filter).sort({ date: -1 }).limit(100);
    res.json({ success: true, reports });
  } catch (err) {
    console.error('getStudyReports error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── Syllabus Progress ─────────────────────────────────────
export const getSyllabusProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('branch');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    let progress = await SyllabusProgress.findOne({ userId });
    if (!progress) {
      // Initialize with all subtopics uncompleted
      const syllabusItems = [];
      const branchSyllabus = getGATESyllabus(user.branch);
      if (branchSyllabus && branchSyllabus.subjects) {
        branchSyllabus.subjects.forEach((subject, si) => {
          (subject.topics || []).forEach((topic, ti) => {
            (topic.subtopics || []).forEach((_, sti) => {
              syllabusItems.push({ subjectIndex: si, topicIndex: ti, subtopicIndex: sti, completed: false });
            });
          });
        });
      }

      progress = await SyllabusProgress.create({
        userId,
        branch: user.branch,
        progress: syllabusItems
      });
    }

    const totalSubtopics = progress.progress.length;
    const completedSubtopics = progress.progress.filter(p => p.completed).length;

    res.json({
      success: true,
      branch: progress.branch,
      totalSubtopics,
      completedSubtopics,
      percentage: totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0,
      progress: progress.progress,
      syllabusData: getGATESyllabus(progress.branch)
    });
  } catch (err) {
    console.error('getSyllabusProgress error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

export const updateSyllabusProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const { subjectIndex, topicIndex, subtopicIndex, completed } = req.body;

    if (subjectIndex === undefined || topicIndex === undefined || subtopicIndex === undefined) {
      return res.status(400).json({ error: true, message: 'subjectIndex, topicIndex, subtopicIndex are required.' });
    }

    let progress = await SyllabusProgress.findOne({ userId });
    if (!progress) {
      return res.status(404).json({ error: true, message: 'No syllabus progress found. Access GET first to initialize.' });
    }

    // Find the matching entry
    const entry = progress.progress.find(
      p => p.subjectIndex === subjectIndex && p.topicIndex === topicIndex && p.subtopicIndex === subtopicIndex
    );

    if (entry) {
      entry.completed = !!completed;
      entry.completedDate = completed ? new Date() : null;
    } else {
      progress.progress.push({
        subjectIndex, topicIndex, subtopicIndex,
        completed: !!completed,
        completedDate: completed ? new Date() : null
      });
    }

    progress.lastUpdated = new Date();
    await progress.save();

    const totalSubtopics = progress.progress.length;
    const completedSubtopics = progress.progress.filter(p => p.completed).length;

    // Emit syllabus-updated
    const io = req.app.get('io');
    if (io) {
      io.emit('syllabus-updated', { userId, totalSubtopics, completedSubtopics });
    }

    res.json({
      success: true,
      totalSubtopics,
      completedSubtopics,
      percentage: totalSubtopics > 0 ? Math.round((completedSubtopics / totalSubtopics) * 100) : 0
    });
  } catch (err) {
    console.error('updateSyllabusProgress error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── Daily Tasks ───────────────────────────────────────────
export const getDailyTasks = async (req, res) => {
  try {
    const { userId } = req.params;
    const dateStr = req.query.date || new Date().toISOString();
    const taskDate = startOfDay(new Date(dateStr));

    let dailyTask = await DailyTask.findOne({ userId, date: taskDate });
    if (!dailyTask) {
      // Auto-create default tasks
      dailyTask = await DailyTask.create({
        userId,
        date: taskDate,
        tasks: DailyTask.DEFAULT_TASKS.map(name => ({ name, completed: false }))
      });
    }

    const allCompleted = dailyTask.tasks.every(t => t.completed);

    // Include current points & streak for convenience
    const user = await User.findById(userId).select('points streak');

    res.json({
      success: true,
      date: taskDate,
      tasks: dailyTask.tasks,
      allCompleted,
      completedCount: dailyTask.tasks.filter(t => t.completed).length,
      totalCount: dailyTask.tasks.length,
      points: user?.points || 0,
      streak: user?.streak || 0
    });
  } catch (err) {
    console.error('getDailyTasks error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

export const updateDailyTasks = async (req, res) => {
  try {
    const { userId } = req.params;
    const { date, tasks } = req.body;
    const taskDate = startOfDay(new Date(date || new Date()));

    let dailyTask = await DailyTask.findOne({ userId, date: taskDate });
    if (!dailyTask) {
      dailyTask = await DailyTask.create({
        userId,
        date: taskDate,
        tasks: DailyTask.DEFAULT_TASKS.map(name => ({ name, completed: false }))
      });
    }

    // Compute previous completion stats
    const previousCompletedCount = dailyTask.tasks.filter(t => t.completed).length;
    const previousAllCompleted = dailyTask.tasks.every(t => t.completed);

    // Update task completion status
    if (Array.isArray(tasks)) {
      tasks.forEach(update => {
        const task = dailyTask.tasks.find(t => t.name === update.name || t._id.toString() === update._id);
        if (task) task.completed = !!update.completed;
      });
    }

    await dailyTask.save();

    // Check if this triggers streak
    const allCompleted = dailyTask.tasks.every(t => t.completed);
    if (allCompleted && !previousAllCompleted) {
      await updateStreakAfterReport(userId, taskDate);
    }

    // Award points for newly completed tasks
    try {
      const newCompletedCount = dailyTask.tasks.filter(t => t.completed).length;
      const delta = Math.max(0, newCompletedCount - previousCompletedCount);
      const io = req.app.get('io');
      if (delta > 0) {
        const user = await User.findById(userId);
        if (user) {
          const earned = delta * 10;
          user.points = (user.points || 0) + earned;
          await user.save();
          await Notification.create({ userId: user._id, type: 'points', title: 'Points earned', message: `You earned ${earned} points for completing tasks.` });
          if (io) io.to(`student_${userId}`).emit('points-updated', { userId, points: user.points });
        }
      }

      // Bonus for completing all tasks
      if (allCompleted && !previousAllCompleted) {
        const user = await User.findById(userId);
        if (user) {
          const bonus = 50;
          user.points = (user.points || 0) + bonus;
          await user.save();
          await Notification.create({ userId: user._id, type: 'points', title: 'Daily bonus', message: `You earned ${bonus} bonus points for completing all tasks.` });
          if (io) io.to(`student_${userId}`).emit('points-updated', { userId, points: user.points });
        }
      }
    } catch (e) {
      console.error('Error awarding points for tasks:', e);
    }

    res.json({
      success: true,
      tasks: dailyTask.tasks,
      allCompleted,
      completedCount: dailyTask.tasks.filter(t => t.completed).length
    });
  } catch (err) {
    console.error('updateDailyTasks error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// ─── Streak Logic ──────────────────────────────────────────

// Count consecutive days (ending today, or yesterday if today has no report yet)
// that have a study report. Computed straight from report history, so it is
// always correct regardless of when the incremental counter last ran or whether
// the report was created under older logic.
async function computeStreak(userId) {
  const reports = await StudyReport.find({ userId }).select('date').lean();
  if (!reports.length) return 0;

  const DAY = 24 * 60 * 60 * 1000;
  const daySet = new Set(reports.map(r => startOfDay(r.date).getTime()));
  const today = startOfDay(new Date()).getTime();

  let cursor;
  if (daySet.has(today)) cursor = today;
  else if (daySet.has(today - DAY)) cursor = today - DAY; // grace: keep streak alive until end of today
  else return 0;

  let streak = 0;
  while (daySet.has(cursor)) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

function awardStreakBadges(user) {
  const streakMilestones = [
    { threshold: 7, name: '7-Day Warrior' },
    { threshold: 14, name: '14-Day Champion' },
    { threshold: 30, name: '30-Day Legend' },
    { threshold: 60, name: '60-Day Diamond' },
    { threshold: 100, name: '100-Day Master' }
  ];
  for (const m of streakMilestones) {
    if (user.streak >= m.threshold && !user.badges.some(b => b.name === m.name)) {
      user.badges.push({ name: m.name, earnedDate: new Date() });
    }
  }
}

async function updateStreakAfterReport(userId, date) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    user.streak = await computeStreak(userId);
    user.lastActiveDate = startOfDay(date);
    awardStreakBadges(user);
    await user.save();
  } catch (err) {
    console.error('updateStreakAfterReport error:', err);
  }
}

// GET /api/student/streak/:userId
export const getStreak = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('streak badges lastActiveDate');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    // Recompute from report history so a stale/missed counter self-heals.
    const computed = await computeStreak(req.params.userId);
    if (computed !== user.streak) {
      user.streak = computed;
      awardStreakBadges(user);
      await user.save();
    }

    res.json({
      success: true,
      streak: computed,
      badges: user.badges,
      lastActiveDate: user.lastActiveDate
    });
  } catch (err) {
    console.error('getStreak error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/student/rewards/:userId
export const getRewards = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('streak badges consistencyScore points streakFreezeTokens');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    // Keep the rewards view in sync with the self-healing streak computation.
    const computed = await computeStreak(req.params.userId);
    if (computed !== user.streak) {
      user.streak = computed;
      awardStreakBadges(user);
      await user.save();
    }

    const milestones = [7, 14, 30, 60, 100];
    const nextMilestone = milestones.find(m => m > computed) || null;
    const daysToNext = nextMilestone ? nextMilestone - computed : 0;

    res.json({
      success: true,
      streak: computed,
      badges: user.badges,
      consistencyScore: user.consistencyScore,
      points: user.points || 0,
      streakFreezeTokens: user.streakFreezeTokens || 0,
      nextMilestone,
      daysToNextMilestone: daysToNext
    });
  } catch (err) {
    console.error('getRewards error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/student/timetable/:userId
export const getTimetable = async (req, res) => {
  try {
    // Fetch the latest timetable from the Timetable collection
    const timetable = await Timetable.findOne({ studentId: req.params.userId })
      .sort({ weekStart: -1 });

    if (!timetable) {
      return res.json({ success: true, timetable: null });
    }

    res.json({ success: true, timetable });
  } catch (err) {
    console.error('getTimetable error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/student/timetable-complete/:userId
export const markTimetableComplete = async (req, res) => {
  try {
    const { timetableId, day, completed } = req.body;
    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return res.status(404).json({ error: true, message: 'Timetable not found.' });
    }

    const dayEntry = timetable.days.find(d => d.day === day);
    if (!dayEntry) {
      return res.status(400).json({ error: true, message: `Day '${day}' not found in timetable.` });
    }

    dayEntry.studentCompleted = completed;
    dayEntry.studentCompletedAt = completed ? new Date() : null;
    await timetable.save();

    res.json({ success: true, timetable });
  } catch (err) {
    console.error('markTimetableComplete error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/student/journey/:userId
export const getJourney = async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId).select('journeySteps status');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });

    // ── Auto-track the journey from real activity ──
    // A step completes when its milestone is met OR the mentor marked it manually
    // (mentor completions are preserved). Persisted so the mentor sees it too.
    const reports = await StudyReport.find({ userId }).select('pyqsSolved mockTestScore').lean();
    const reportCount = reports.length;
    const totalPyqs = reports.reduce((s, r) => s + (r.pyqsSolved || 0), 0);
    const anyMock = reports.some(r => (r.mockTestScore || 0) > 0);
    const sp = await SyllabusProgress.findOne({ userId }).select('progress').lean();
    const completedTopics = sp ? (sp.progress || []).filter(p => p.completed).length : 0;

    const milestone = {
      'Consultation': user.status === 'approved',
      'Goal Setting': reportCount >= 1,
      'Concept Building': completedTopics >= 1,
      'PYQ Practice': totalPyqs >= 50,
      'Mock Tests': anyMock,
      'Weakness Analysis': reportCount >= 10,
      'Revision': completedTopics >= 30,
      // 'GATE Success' stays manual — only the mentor marks it.
    };

    let changed = false;
    user.journeySteps.forEach(step => {
      if (!step.completed && milestone[step.name]) {
        step.completed = true;
        step.completedDate = step.completedDate || new Date();
        changed = true;
      }
    });
    if (changed) await user.save();

    const completedCount = user.journeySteps.filter(s => s.completed).length;

    res.json({
      success: true,
      journeySteps: user.journeySteps,
      completedCount,
      totalSteps: user.journeySteps.length,
      percentage: user.journeySteps.length > 0 ? Math.round((completedCount / user.journeySteps.length) * 100) : 0
    });
  } catch (err) {
    console.error('getJourney error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/student/tokens/buy/:userId
export const buyFreezeToken = async (req, res) => {
  try {
    const { userId } = req.params;
    const price = 100; // points per token
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });
    if ((user.points || 0) < price) return res.status(400).json({ error: true, message: 'Not enough points to buy a token.' });

    user.points = (user.points || 0) - price;
    user.streakFreezeTokens = (user.streakFreezeTokens || 0) + 1;
    await user.save();

    // Notify student
    try { await Notification.create({ userId: user._id, type: 'token_purchase', title: 'Streak Freeze Token', message: `Purchased 1 Streak Freeze Token for ${price} points.` }); } catch (e) { console.error(e); }

    const io = req.app.get('io');
    if (io) io.to(`student_${userId}`).emit('tokens-updated', { userId, tokens: user.streakFreezeTokens, points: user.points });

    res.json({ success: true, tokens: user.streakFreezeTokens, points: user.points });
  } catch (err) {
    console.error('buyFreezeToken error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/student/tokens/:userId
export const getTokens = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('streakFreezeTokens points');
    if (!user) return res.status(404).json({ error: true, message: 'Student not found.' });
    res.json({ success: true, tokens: user.streakFreezeTokens || 0, points: user.points || 0 });
  } catch (err) {
    console.error('getTokens error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
