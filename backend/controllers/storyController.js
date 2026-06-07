import SuccessStory from '../models/SuccessStory.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

// Allowlist for story media: https only, and only YouTube links or direct images.
// Blocks data:/javascript:/blob:/arbitrary origins that would otherwise be framed
// in the story modal (stored-XSS / frame-injection).
const isAllowedMediaUrl = (url) => {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.replace(/^www\./, '');
    const ytHosts = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'm.youtube.com'];
    if (ytHosts.includes(host)) return true;
    return /\.(png|jpe?g|gif|webp)$/i.test(u.pathname);
  } catch { return false; }
};

// Create a new story (student)
export const createStory = async (req, res) => {
  try {
    const { title, content, mediaUrl } = req.body;
    if (!title || !content) return res.status(400).json({ error: true, message: 'Title and content are required.' });
    if (mediaUrl && !isAllowedMediaUrl(mediaUrl)) {
      return res.status(400).json({ error: true, message: 'Media URL must be an https YouTube link or image URL.' });
    }

    const story = await SuccessStory.create({
      userId: req.user._id,
      title,
      content,
      mediaUrl,
      isApproved: false,
      status: 'pending'
    });

    // Notify mentors via socket
    const io = req.app.get('io');
    if (io) io.to('mentors').emit('new-story-pending', { storyId: story._id, title: story.title, userId: req.user._id });

    res.status(201).json({ success: true, story });
  } catch (err) {
    console.error('createStory error:', err);
    res.status(500).json({ error: true, message: 'Server error creating story.' });
  }
};

// GET /api/stories - Mentor: all stories; Student: own + approved
export const getStories = async (req, res) => {
  try {
    let stories;
    if (req.user && req.user.role === 'mentor') {
      stories = await SuccessStory.find().sort({ createdAt: -1 }).populate('userId', 'name branch');
    } else {
      stories = await SuccessStory.find({ $or: [{ isApproved: true }, { userId: req.user._id }] })
        .sort({ createdAt: -1 }).populate('userId', 'name');
    }
    res.json({ success: true, stories });
  } catch (err) {
    console.error('getStories error:', err);
    res.status(500).json({ error: true, message: 'Server error fetching stories.' });
  }
};

// GET single story
export const getStory = async (req, res) => {
  try {
    const story = await SuccessStory.findById(req.params.storyId)
      .populate('userId', 'name email')
      .populate('comments.userId', 'name');
    if (!story) return res.status(404).json({ error: true, message: 'Story not found.' });
    res.json({ success: true, story });
  } catch (err) {
    console.error('getStory error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Toggle like
export const toggleLike = async (req, res) => {
  try {
    const story = await SuccessStory.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: true, message: 'Story not found.' });

    const userId = req.user._id.toString();
    const existing = story.likes.find(id => id.toString() === userId);
    if (existing) {
      story.likes = story.likes.filter(id => id.toString() !== userId);
      await story.save();
      const io = req.app.get('io');
      if (io) io.to(`student_${story.userId.toString()}`).emit('story-liked', { storyId: story._id, likes: story.likes.length });
      return res.json({ success: true, liked: false, likes: story.likes.length });
    }

    story.likes.push(req.user._id);
    await story.save();
    const io = req.app.get('io');
    if (io) io.to(`student_${story.userId.toString()}`).emit('story-liked', { storyId: story._id, likes: story.likes.length });
    res.json({ success: true, liked: true, likes: story.likes.length });
  } catch (err) {
    console.error('toggleLike error:', err);
    res.status(500).json({ error: true, message: 'Server error toggling like.' });
  }
};

// Add comment
export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: true, message: 'Comment text is required.' });

    const story = await SuccessStory.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: true, message: 'Story not found.' });

    const comment = { userId: req.user._id, text };
    story.comments.push(comment);
    await story.save();
    const saved = story.comments[story.comments.length - 1];
    // Return the author embedded so the UI can show the name immediately.
    const responseComment = {
      _id: saved._id,
      text: saved.text,
      createdAt: saved.createdAt,
      userId: { _id: req.user._id, name: req.user.name }
    };
    const io = req.app.get('io');
    if (io) io.to(`student_${story.userId.toString()}`).emit('new-comment', { storyId: story._id, comment: responseComment });
    res.status(201).json({ success: true, comment: responseComment });
  } catch (err) {
    console.error('addComment error:', err);
    res.status(500).json({ error: true, message: 'Server error adding comment.' });
  }
};

// Delete comment (own user)
export const deleteComment = async (req, res) => {
  try {
    const { storyId, commentId } = req.params;
    const story = await SuccessStory.findById(storyId);
    if (!story) return res.status(404).json({ error: true, message: 'Story not found.' });

    const comment = story.comments.id(commentId);
    if (!comment) return res.status(404).json({ error: true, message: 'Comment not found.' });
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: true, message: 'You can only delete your own comments.' });
    }

    comment.remove();
    await story.save();
    res.json({ success: true, message: 'Comment deleted.' });
  } catch (err) {
    console.error('deleteComment error:', err);
    res.status(500).json({ error: true, message: 'Server error deleting comment.' });
  }
};

// Approve story (mentor)
export const approveStory = async (req, res) => {
  try {
    const story = await SuccessStory.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: true, message: 'Story not found.' });

    story.isApproved = true;
    story.status = 'approved';
    story.approvedAt = new Date();
    await story.save();

    const io = req.app.get('io');
    if (io) io.to(`student_${story.userId.toString()}`).emit('story-approved', { storyId: story._id });

    res.json({ success: true, message: 'Story approved.', story });
  } catch (err) {
    console.error('approveStory error:', err);
    res.status(500).json({ error: true, message: 'Server error approving story.' });
  }
};

// Delete story (owner or mentor)
export const deleteStory = async (req, res) => {
  try {
    const story = await SuccessStory.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: true, message: 'Story not found.' });
    if (story.userId.toString() !== req.user._id.toString() && req.user.role !== 'mentor') {
      return res.status(403).json({ error: true, message: 'Not authorized to delete this story.' });
    }
    await story.remove();
    res.json({ success: true, message: 'Story deleted.' });
  } catch (err) {
    console.error('deleteStory error:', err);
    res.status(500).json({ error: true, message: 'Server error deleting story.' });
  }
};
