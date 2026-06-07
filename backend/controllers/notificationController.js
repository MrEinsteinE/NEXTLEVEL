import Notification from '../models/Notification.js';

// POST /api/notifications/create
export const createNotification = async (req, res) => {
  try {
    const { userId, type, title, message, link } = req.body;
    if (!userId || !title) return res.status(400).json({ error: true, message: 'userId and title required' });
    const note = await Notification.create({ userId, type, title, message, link });
    const io = req.app.get('io');
    try { if (io) io.to(`student_${userId}`).emit('notification', { notification: note }); } catch (e) {}
    res.json({ success: true, notification: note });
  } catch (err) {
    console.error('createNotification error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// GET /api/notifications (for current user)
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notes = await Notification.find({ userId }).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, notifications: notes });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// PUT /api/notifications/read/:id
export const markRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(String(id || ''))) return res.status(400).json({ error: true, message: 'Invalid notification id' });
    const note = await Notification.findOne({ _id: id, userId });
    if (!note) return res.status(404).json({ error: true, message: 'Notification not found' });
    note.isRead = true;
    await note.save();
    res.json({ success: true });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};
