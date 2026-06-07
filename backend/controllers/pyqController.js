import PYQProgress from '../models/PYQProgress.js';

// POST /api/pyq/attempt
export const recordAttempt = async (req, res) => {
  try {
    const userId = req.user._id;
    const { questionId, subject, status, timeTaken = 0 } = req.body;
    if (!questionId || !status) return res.status(400).json({ error: true, message: 'questionId and status required' });
    let prog = await PYQProgress.findOne({ userId });
    if (!prog) prog = await PYQProgress.create({ userId, attempts: [] });
    prog.attempts.push({ questionId, subject, status, timeTaken, attemptedAt: new Date() });
    // also add to bookmarks if bookmarked
    if (status === 'bookmarked') {
      if (!prog.bookmarks.includes(questionId)) prog.bookmarks.push(questionId);
    }
    await prog.save();
    res.json({ success: true, attempt: prog.attempts[prog.attempts.length - 1] });
  } catch (err) {
    console.error('recordAttempt error:', err);
    res.status(500).json({ error: true, message: 'Server error recording attempt.' });
  }
};

// POST /api/pyq/set — log a practice set ("attempted N, got M correct")
export const recordSet = async (req, res) => {
  try {
    const userId = req.user._id;
    const subject = (req.body.subject || 'General').toString().trim() || 'General';
    const attempted = Math.floor(Number(req.body.attempted));
    const correct = Math.floor(Number(req.body.correct));
    if (!Number.isFinite(attempted) || attempted < 1) {
      return res.status(400).json({ error: true, message: 'Enter how many questions you attempted (at least 1).' });
    }
    if (!Number.isFinite(correct) || correct < 0) {
      return res.status(400).json({ error: true, message: 'Enter a valid number of correct answers.' });
    }
    if (correct > attempted) {
      return res.status(400).json({ error: true, message: "Correct can't exceed attempted." });
    }
    let prog = await PYQProgress.findOne({ userId });
    if (!prog) prog = await PYQProgress.create({ userId, sets: [] });
    prog.sets.push({ subject, attempted, correct, attemptedAt: new Date() });
    await prog.save();
    res.json({ success: true, set: prog.sets[prog.sets.length - 1] });
  } catch (err) {
    console.error('recordSet error:', err);
    res.status(500).json({ error: true, message: 'Server error recording practice set.' });
  }
};

// GET /api/pyq/progress
export const getProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const prog = await PYQProgress.findOne({ userId });
    if (!prog) return res.json({ success: true, analysis: [], recent: [], bookmarks: [] });

    // Per-subject accuracy = correct / attempted, aggregated across practice sets
    // AND any legacy per-question attempts (bookmarked ones excluded from accuracy).
    const grouping = {};
    const bump = (subject, correct, total) => {
      const subj = subject || 'General';
      grouping[subj] = grouping[subj] || { correct: 0, total: 0 };
      grouping[subj].correct += correct;
      grouping[subj].total += total;
    };
    for (const s of prog.sets || []) bump(s.subject, s.correct || 0, s.attempted || 0);
    for (const a of prog.attempts || []) {
      if (a.status === 'correct') bump(a.subject, 1, 1);
      else if (a.status === 'wrong') bump(a.subject, 0, 1);
    }

    const analysis = Object.keys(grouping).map(k => ({
      subject: k,
      accuracy: grouping[k].total ? Math.round((grouping[k].correct / grouping[k].total) * 100) : null,
      attempted: grouping[k].total
    }));

    // Unified recent list (sets + legacy attempts) normalised to {subject, attempted, correct, at}.
    const recent = [
      ...(prog.sets || []).map(s => ({ subject: s.subject || 'General', attempted: s.attempted, correct: s.correct, at: s.attemptedAt })),
      ...(prog.attempts || []).filter(a => a.status === 'correct' || a.status === 'wrong')
        .map(a => ({ subject: a.subject || 'General', attempted: 1, correct: a.status === 'correct' ? 1 : 0, at: a.attemptedAt })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);

    res.json({ success: true, analysis, recent, bookmarks: prog.bookmarks || [] });
  } catch (err) {
    console.error('getProgress error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/pyq/bookmark { questionId }
export const toggleBookmark = async (req, res) => {
  try {
    const userId = req.user._id;
    const { questionId } = req.body;
    if (!questionId) return res.status(400).json({ error: true, message: 'questionId required' });
    let prog = await PYQProgress.findOne({ userId });
    if (!prog) prog = await PYQProgress.create({ userId, bookmarks: [] });
    const idx = (prog.bookmarks || []).indexOf(questionId);
    if (idx === -1) {
      prog.bookmarks.push(questionId);
      await prog.save();
      return res.json({ success: true, bookmarked: true });
    }
    prog.bookmarks.splice(idx, 1);
    await prog.save();
    return res.json({ success: true, bookmarked: false });
  } catch (err) {
    console.error('toggleBookmark error:', err);
    res.status(500).json({ error: true, message: 'Server error toggling bookmark.' });
  }
};
