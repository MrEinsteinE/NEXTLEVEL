import DailyReflection from '../models/DailyReflection.js';

// POST /api/reflections
export const saveReflection = async (req, res) => {
  try {
    const userId = req.user._id;
    const { date, morningMood, morningGoal, estimatedHours, eveningActualHours, metGoal, learning, difficultyLevel } = req.body;
    if (!date) return res.status(400).json({ error: true, message: 'date is required' });
    const d = new Date(date);
    d.setHours(0,0,0,0);
    // upsert by userId + date
    const existing = await DailyReflection.findOne({ userId, date: d });
    if (existing) {
      existing.morningMood = morningMood ?? existing.morningMood;
      existing.morningGoal = morningGoal ?? existing.morningGoal;
      existing.estimatedHours = estimatedHours ?? existing.estimatedHours;
      existing.eveningActualHours = eveningActualHours ?? existing.eveningActualHours;
      existing.metGoal = metGoal ?? existing.metGoal;
      existing.learning = learning ?? existing.learning;
      existing.difficultyLevel = difficultyLevel ?? existing.difficultyLevel;
      await existing.save();
      return res.json({ success: true, reflection: existing });
    }
    const created = await DailyReflection.create({ userId, date: d, morningMood, morningGoal, estimatedHours, eveningActualHours, metGoal, learning, difficultyLevel });
    res.json({ success: true, reflection: created });
  } catch (err) {
    console.error('saveReflection error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/reflections/:userId
export const getReflections = async (req, res) => {
  try {
    // Students may only read their own reflections (never trust the URL id).
    const userId = req.user.role === 'student' ? req.user._id.toString() : req.params.userId;
    const list = await DailyReflection.find({ userId }).sort({ date: -1 }).limit(90);
    res.json({ success: true, reflections: list });
  } catch (err) {
    console.error('getReflections error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
