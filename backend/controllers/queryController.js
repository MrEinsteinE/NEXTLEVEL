import Query from '../models/Query.js';
import User from '../models/User.js';
import { sendQueryAnswerEmail } from '../services/emailService.js';

// POST /api/queries (student creates query - Issue #9)
export const createQuery = async (req, res) => {
  try {
    const { subject, question, images } = req.body;
    if (!question) {
      return res.status(400).json({ message: 'Question is required' });
    }

    // Validate optional image attachments: up to 3 small data:image URLs.
    const safeImages = [];
    if (Array.isArray(images)) {
      if (images.length > 3) return res.status(400).json({ message: 'You can attach up to 3 images.' });
      for (const img of images) {
        if (typeof img !== 'string' || !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(img)) {
          return res.status(400).json({ message: 'Invalid image attachment.' });
        }
        if (img.length > 720 * 1024) return res.status(400).json({ message: 'Each image must be under ~500 KB.' });
        safeImages.push(img);
      }
    }

    const query = await Query.create({
      userId: req.user._id,
      subject,
      question,
      images: safeImages,
      status: 'pending'
    });

    res.status(201).json({ message: 'Query submitted', query });
  } catch (error) {
    console.error('createQuery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/queries/student (student's own queries)
export const getStudentQueries = async (req, res) => {
  try {
    const queries = await Query.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json(queries);
  } catch (error) {
    console.error('getStudentQueries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/queries/mentor/pending (all pending queries for mentor)
export const getPendingQueries = async (req, res) => {
  try {
    const queries = await Query.find({ status: 'pending' })
      .populate('userId', 'name email branch')
      .sort({ createdAt: -1 });
    res.json(queries);
  } catch (error) {
    console.error('getPendingQueries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/queries/mentor/all (all queries for mentor)
export const getAllQueries = async (req, res) => {
  try {
    const queries = await Query.find({})
      .populate('userId', 'name email branch')
      .sort({ createdAt: -1 });
    res.json(queries);
  } catch (error) {
    console.error('getAllQueries error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/queries/:id/answer (mentor answers query)
export const answerQuery = async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer) {
      return res.status(400).json({ message: 'Answer is required' });
    }
    if (!/^[a-f\d]{24}$/i.test(String(req.params.id || ''))) {
      return res.status(400).json({ message: 'Invalid query id' });
    }

    const query = await Query.findByIdAndUpdate(
      req.params.id,
      { answer, status: 'answered', answeredAt: new Date() },
      { new: true }
    ).populate('userId', 'name email');

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    // Send email notification to student
    if (query.userId) {
      await sendQueryAnswerEmail(
        query.userId.email,
        query.userId.name,
        query.question,
        answer
      );
    }

    res.json({ message: 'Answer submitted', query });
  } catch (error) {
    console.error('answerQuery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/queries/:id/resolve (student marks resolved)
export const resolveQuery = async (req, res) => {
  try {
    const query = await Query.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'resolved' },
      { new: true }
    );

    if (!query) {
      return res.status(404).json({ message: 'Query not found' });
    }

    res.json({ message: 'Query resolved', query });
  } catch (error) {
    console.error('resolveQuery error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
