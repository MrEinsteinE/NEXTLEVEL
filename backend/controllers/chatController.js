import ChatMessage from '../models/ChatMessage.js';

// GET /api/chat/room/:roomId?limit=100
export const getRoomMessages = async (req, res) => {
  try {
    const room = req.params.roomId;
    const limit = parseInt(req.query.limit || '100', 10);
    if (!room) return res.status(400).json({ error: true, message: 'Room is required.' });

    // Students may only read their own conversation; mentors may read any.
    if (req.user.role === 'student' && room !== `student_${req.user._id}`) {
      return res.status(403).json({ error: true, message: 'Not authorized to view this conversation.' });
    }

    const msgs = await ChatMessage.find({ room })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'name role');

    // Return chronological order
    res.json({ success: true, messages: msgs.reverse() });
  } catch (err) {
    console.error('getRoomMessages error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
