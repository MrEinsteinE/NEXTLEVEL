import StudyPlan from '../models/StudyPlan.js';
import SyllabusProgress from '../models/SyllabusProgress.js';
import { getGATESyllabus } from '../services/gateSyllabusData.js';

const toDateOnly = (d) => {
  const dt = new Date(d);
  dt.setHours(0,0,0,0);
  return dt;
};

// POST /api/planner/generate
export const generatePlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetDate, dailyHours = 4, weakSubjects = [], strongSubjects = [] } = req.body || {};

    const sp = await SyllabusProgress.findOne({ userId });
    if (!sp) return res.status(400).json({ error: true, message: 'Syllabus progress not found for user.' });

    const branch = sp.branch;
    const syllabus = getGATESyllabus(branch);

    // Build remaining topic labels from progress entries
    const remaining = [];
    for (const p of sp.progress || []) {
      if (p.completed) continue;
      const sIdx = p.subjectIndex ?? 0;
      const tIdx = p.topicIndex ?? 0;
      const stIdx = p.subtopicIndex ?? 0;
      let subjectName = syllabus.subjects?.[sIdx]?.name || `Subject ${sIdx}`;
      let topicObj = syllabus.subjects?.[sIdx]?.topics?.[tIdx];
      let topicName = topicObj?.name || `Topic ${tIdx}`;
      let subtopicName = topicObj?.subtopics?.[stIdx] || `Subtopic ${stIdx}`;
      remaining.push({ subject: subjectName, topic: topicName, subtopic: subtopicName, key: `${sIdx}-${tIdx}-${stIdx}` });
    }

    const totalTopics = remaining.length;
    if (totalTopics === 0) {
      return res.json({ success: true, message: 'No remaining topics. Syllabus complete.' });
    }

    const start = toDateOnly(new Date());
    const target = toDateOnly(targetDate ? new Date(targetDate) : new Date('2027-02-15'));
    let days = Math.max(1, Math.ceil((target - start) / (24*60*60*1000)) + 1);

    // Sort remaining so weak subjects appear earlier
    remaining.sort((a,b) => {
      const aW = weakSubjects.includes(a.subject) ? -1 : 0;
      const bW = weakSubjects.includes(b.subject) ? -1 : 0;
      return aW - bW;
    });

    // ── Difficulty-weighted scheduling ──
    // Without per-topic difficulty data we infer it from the subject name, then
    // estimate hours per topic. Each day is packed up to the student's daily-hours
    // budget with a sane 2–8 topics/day cap, so a far-off target doesn't trickle
    // one topic a day and a near target doesn't cram fifty into one.
    const difficultyFor = (subject) => {
      const s = (subject || '').toLowerCase();
      if (/math|aptitude|reasoning|verbal|english|general/.test(s)) return 'easy';
      if (/theory|design|algorithm|architecture|electromagnetic|signal|control|thermodynam|quantum|electrodynam|machine|network/.test(s)) return 'hard';
      return 'medium';
    };
    const HOURS = { easy: 0.75, medium: 1, hard: 1.5 };
    const enriched = remaining.map(t => {
      const difficulty = difficultyFor(t.subject);
      return { ...t, difficulty, hours: HOURS[difficulty] };
    });

    const MIN_TOPICS = 2, MAX_TOPICS = 8;
    const perDayTopicCap = Math.min(MAX_TOPICS, Math.max(MIN_TOPICS, Math.ceil(enriched.length / days)));

    const dailyPlans = [];
    let idx = 0;
    let dayOffset = 0;
    while (idx < enriched.length) {
      const date = new Date(start);
      date.setDate(start.getDate() + dayOffset);
      const slice = [];
      let dayHours = 0;
      while (
        idx < enriched.length &&
        slice.length < perDayTopicCap &&
        (slice.length === 0 || dayHours + enriched[idx].hours <= dailyHours)
      ) {
        slice.push(enriched[idx]);
        dayHours += enriched[idx].hours;
        idx++;
      }
      dailyPlans.push({
        date,
        subject: slice[0]?.subject || 'General',
        topics: slice.map(t => `${t.subject} — ${t.topic} — ${t.subtopic}`),
        estimatedHours: Math.round(dayHours * 10) / 10,
        actualHours: 0,
        completed: false
      });
      dayOffset++;
    }
    const overrunsTarget = dayOffset > days;

    const plan = await StudyPlan.findOneAndUpdate(
      { userId },
      { userId, generatedAt: new Date(), targetDate: target, dailyPlans, settings: { dailyHours, weakSubjects, strongSubjects } },
      { upsert: true, new: true }
    );

    // Emit to student's socket room if available
    try {
      const io = req.app.get('io');
      if (io) io.to(`student_${userId}`).emit('plan-updated', { planId: plan._id });
    } catch (e) {}

    res.json({
      success: true,
      plan,
      note: overrunsTarget
        ? `This plan needs ${dayOffset} study days, but your target is only ${days} day${days === 1 ? '' : 's'} away. Increase your daily hours or pick a later target to fit everything comfortably.`
        : null
    });
  } catch (err) {
    console.error('generatePlan error:', err);
    res.status(500).json({ error: true, message: 'Server error generating plan.' });
  }
};

// GET /api/planner (get user's plan)
export const getPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const plan = await StudyPlan.findOne({ userId });
    if (!plan) return res.json({ success: true, plan: null });
    res.json({ success: true, plan });
  } catch (err) {
    console.error('getPlan error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// PATCH /api/planner/mark-day (mark specific date complete)
export const markDayComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { date, actualHours = 0 } = req.body;
    if (!date) return res.status(400).json({ error: true, message: 'date is required' });
    const plan = await StudyPlan.findOne({ userId });
    if (!plan) return res.status(404).json({ error: true, message: 'Plan not found' });
    const d = new Date(date);
    d.setHours(0,0,0,0);
    const slot = plan.dailyPlans.find(p => new Date(p.date).toDateString() === d.toDateString());
    if (!slot) return res.status(404).json({ error: true, message: 'Day not found in plan' });
    slot.completed = true;
    slot.actualHours = actualHours;
    await plan.save();
    res.json({ success: true, plan });
  } catch (err) {
    console.error('markDayComplete error:', err);
    res.status(500).json({ error: true, message: 'Server error marking day complete.' });
  }
};
