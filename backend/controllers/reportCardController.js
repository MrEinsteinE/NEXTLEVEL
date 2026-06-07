import StudyReport from '../models/StudyReport.js';
import MentorFeedback from '../models/MentorFeedback.js';
import User from '../models/User.js';
import SyllabusProgress from '../models/SyllabusProgress.js';

const toDateOnly = (d) => { const dt = new Date(d); dt.setHours(0,0,0,0); return dt; };

// GET /api/reportcard/:userId?month=YYYY-MM
export const getMonthlyReport = async (req, res) => {
  try {
    const requester = req.user;
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: true, message: 'userId required' });
    if (!/^[a-f\d]{24}$/i.test(String(userId))) return res.status(400).json({ error: true, message: 'Invalid user id' });

    // Only allow if requester is the same user or a mentor/admin
    if (requester.role !== 'mentor' && requester.role !== 'admin' && requester._id.toString() !== userId.toString()) {
      return res.status(403).json({ error: true, message: 'Forbidden' });
    }

    const month = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const [yStr, mStr] = month.split('-');
    const year = parseInt(yStr, 10);
    const monthIndex = parseInt(mStr, 10) - 1;
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 1);

    const reports = await StudyReport.find({ userId, date: { $gte: start, $lt: end } });
    const totalStudyHours = (reports || []).reduce((s, r) => s + (r.studyHours || 0), 0);
    const totalPYQs = (reports || []).reduce((s, r) => s + (r.pyqsSolved || 0), 0);
    const accuracyVals = (reports || []).map(r => r.accuracy || 0).filter(n => n >= 0);
    const averageAccuracy = accuracyVals.length ? Math.round((accuracyVals.reduce((a,b) => a+b,0)/accuracyVals.length) * 10)/10 : null;

    const user = await User.findById(userId).select('name email branch streak badges');

    const feedbacks = await MentorFeedback.find({ studentId: userId, createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 }).limit(50);

    // Syllabus completion percent
    let syllabusPercent = null;
    const sp = await SyllabusProgress.findOne({ userId });
    if (sp && Array.isArray(sp.progress)) {
      const total = sp.progress.length || 0;
      const done = (sp.progress || []).filter(p => p.completed).length;
      syllabusPercent = total ? Math.round((done / total) * 100) : null;
    }

    const payload = {
      user: { id: userId, name: user?.name || 'Unknown', branch: user?.branch || 'N/A' },
      period: { start, end },
      totalStudyHours: Math.round(totalStudyHours * 100)/100,
      totalPYQs,
      averageAccuracy,
      streak: user?.streak || 0,
      badges: user?.badges || [],
      mentorFeedbacks: feedbacks,
      syllabusPercent
    };

    res.json({ success: true, report: payload });
  } catch (err) {
    console.error('getMonthlyReport error:', err);
    res.status(500).json({ error: true, message: 'Server error generating report.' });
  }
};
