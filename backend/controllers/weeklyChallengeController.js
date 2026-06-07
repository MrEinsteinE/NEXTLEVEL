import WeeklyChallenge from '../models/WeeklyChallenge.js';
import Notification from '../models/Notification.js';

// POST /api/weekly-challenge (mentor creates)
export const createChallenge = async (req, res) => {
  try {
    const { week, title, target, reward } = req.body;
    if (!week || !title) return res.status(400).json({ error: true, message: 'week and title required' });
    const wc = await WeeklyChallenge.create({ week, title, target, reward, participants: [] });
    res.json({ success: true, challenge: wc });
  } catch (err) {
    console.error('createChallenge error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/weekly-challenge/current
export const getCurrentChallenge = async (req, res) => {
  try {
    const wc = await WeeklyChallenge.find().sort({ createdAt: -1 }).limit(1);
    res.json({ success: true, challenge: wc[0] || null });
  } catch (err) {
    console.error('getCurrentChallenge error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/weekly-challenge/join
export const updateParticipant = async (req, res) => {
  try {
    const userId = req.user._id;
    const { challengeId, progress } = req.body;
    if (!/^[a-f\d]{24}$/i.test(String(challengeId || ''))) return res.status(400).json({ error: true, message: 'Invalid challenge id' });
    const wc = await WeeklyChallenge.findById(challengeId);
    if (!wc) return res.status(404).json({ error: true, message: 'Challenge not found' });
    let part = wc.participants.find(p => p.userId.toString() === userId.toString());
    if (!part) {
      part = { userId, progress: progress || 0, completed: false };
      wc.participants.push(part);
    } else {
      part.progress = progress ?? part.progress;
      if (part.progress >= ((wc.target && wc.target.count) || 0)) {
        part.completed = true; part.completedAt = new Date();
      }
    }
    await wc.save();
    // notify mentors or user
    const io = req.app.get('io'); if (io) io.to(`student_${userId}`).emit('challenge_update', { challengeId: wc._id, progress: part.progress });
    res.json({ success: true, challenge: wc });
  } catch (err) {
    console.error('updateParticipant error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
