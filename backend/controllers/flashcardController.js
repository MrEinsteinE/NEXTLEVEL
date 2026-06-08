import FlashcardProgress from '../models/FlashcardProgress.js';
import flashcardsData from '../data/flashcardsData.js';

const today = () => {
  const d = new Date(); d.setHours(0,0,0,0); return d;
};

// GET /api/flashcards/due
export const getDueFlashcards = async (req, res) => {
  try {
    const userId = req.user._id;
    const prog = await FlashcardProgress.findOne({ userId });
    if (!prog) return res.json({ success: true, due: [], custom: [] });
    const now = new Date();
    const customById = new Map((prog.customCards || []).map(cc => [String(cc._id), cc]));
    // Scheduled cards that are due. If a scheduled card is one of the user's custom
    // cards, attach its front/back/subject so it renders in the review deck.
    const scheduledDue = (prog.cards || [])
      .filter(c => new Date(c.nextReviewDate) <= now)
      .map(c => {
        const cc = customById.get(String(c.cardId));
        return cc
          ? { cardId: String(c.cardId), front: cc.front, back: cc.back, subject: cc.subject, isCustom: true }
          : c;
      });
    // Brand-new custom cards (no SM-2 schedule yet) are always due so they show up
    // in the "Due for review" deck immediately, not just the manage list below.
    const scheduledIds = new Set((prog.cards || []).map(c => String(c.cardId)));
    const newCustom = (prog.customCards || [])
      .filter(cc => !scheduledIds.has(String(cc._id)))
      .map(cc => ({ cardId: String(cc._id), front: cc.front, back: cc.back, subject: cc.subject, isCustom: true }));
    const due = [...scheduledDue, ...newCustom];
    res.json({ success: true, due, custom: prog.customCards || [] });
  } catch (err) {
    console.error('getDueFlashcards error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/flashcards/list?branch=ECE&subject=&difficulty=&limit=20
export const getCardsList = async (req, res) => {
  try {
    const { branch = 'ECE', subject, difficulty, limit = 50 } = req.query;
    const pool = (flashcardsData[branch] || []).slice();
    let filtered = pool;
    if (subject) filtered = filtered.filter(c => c.subject === subject);
    if (difficulty) filtered = filtered.filter(c => c.difficulty === difficulty);
    // return up to limit
    filtered = filtered.slice(0, Number(limit));
    res.json({ success: true, cards: filtered });
  } catch (err) {
    console.error('getCardsList error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// POST /api/flashcards/review
// { cardId, rating }
export const reviewCard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cardId } = req.body;
    if (!cardId || req.body.rating === undefined) return res.status(400).json({ error: true, message: 'cardId and rating required' });
    const rating = Number(req.body.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      return res.status(400).json({ error: true, message: 'rating must be a number between 0 and 5' });
    }

    let prog = await FlashcardProgress.findOne({ userId });
    if (!prog) {
      prog = await FlashcardProgress.create({ userId, cards: [] });
    }

    let card = prog.cards.find(c => c.cardId === cardId);
    const now = new Date();
    if (!card) {
      card = { cardId, nextReviewDate: now, interval: 1, easeFactor: 2.5, repetitions: 0 };
      prog.cards.push(card);
    }

    // SM-2 inspired
    if (rating <= 0) {
      card.repetitions = 0;
      card.interval = 1;
      card.nextReviewDate = new Date(now.getTime() + 24*60*60*1000);
    } else {
      card.repetitions = (card.repetitions || 0) + 1;
      if (card.repetitions === 1) card.interval = 1;
      else if (card.repetitions === 2) card.interval = 6;
      else card.interval = Math.round((card.interval || 1) * (card.easeFactor || 2.5));
      // adjust ease factor mildly
      card.easeFactor = Math.max(1.3, (card.easeFactor || 2.5) + (0.1 - (3 - rating) * 0.08));
      card.nextReviewDate = new Date(now.getTime() + card.interval * 24*60*60*1000);
    }
    card.lastRating = rating;
    card.lastReviewedAt = now;

    await prog.save();
    res.json({ success: true, card });
  } catch (err) {
    console.error('reviewCard error:', err);
    res.status(500).json({ error: true, message: 'Server error reviewing card.' });
  }
};

// POST /api/flashcards/custom
export const addCustomCard = async (req, res) => {
  try {
    const userId = req.user._id;
    const { front, back, subject, formula } = req.body;
    if (!front || !back) return res.status(400).json({ error: true, message: 'front and back required' });
    let prog = await FlashcardProgress.findOne({ userId });
    if (!prog) prog = await FlashcardProgress.create({ userId, customCards: [] });
    prog.customCards.push({ front, back, subject, formula });
    await prog.save();
    res.json({ success: true, custom: prog.customCards[prog.customCards.length - 1] });
  } catch (err) {
    console.error('addCustomCard error:', err);
    res.status(500).json({ error: true, message: 'Server error adding custom card.' });
  }
};

// DELETE /api/flashcards/custom/:cardId — remove one of the user's own custom cards
export const removeCustomCard = async (req, res) => {
  try {
    const userId = req.user._id;
    const prog = await FlashcardProgress.findOne({ userId });
    if (!prog) return res.status(404).json({ error: true, message: 'No cards found.' });
    const card = prog.customCards.id(req.params.cardId);
    if (!card) return res.status(404).json({ error: true, message: 'Card not found.' });
    card.deleteOne();
    await prog.save();
    res.json({ success: true, custom: prog.customCards });
  } catch (err) {
    console.error('removeCustomCard error:', err);
    res.status(500).json({ error: true, message: 'Server error removing card.' });
  }
};

// GET /api/flashcards/progress
export const getFlashcardProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const prog = await FlashcardProgress.findOne({ userId });
    res.json({ success: true, progress: prog || null });
  } catch (err) {
    console.error('getFlashcardProgress error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
