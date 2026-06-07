import User from '../models/User.js';
import StudyReport from '../models/StudyReport.js';
import Leaderboard from '../models/Leaderboard.js';

// In-memory throttle: standings are also refreshed hourly by cron, so we only
// recompute on read when the cached board is older than this TTL. This avoids a
// full N-student recompute on every page load while still reflecting a freshly
// submitted report within a few seconds.
let lastRefreshAt = 0;
const REFRESH_TTL_MS = 30 * 1000;

// GET /api/leaderboard
export const getLeaderboard = async (req, res) => {
  try {
    // Best-effort refresh, throttled so concurrent viewers don't each recompute.
    if (Date.now() - lastRefreshAt > REFRESH_TTL_MS) {
      lastRefreshAt = Date.now();
      try { await refreshLeaderboard(); } catch (e) { console.warn('Leaderboard refresh skipped:', e.message); }
    }

    // Emails are only exposed to mentors; peers shouldn't see each other's email.
    const isMentor = req.user?.role === 'mentor';
    const userFields = `name branch streak badges points${isMentor ? ' email' : ''}`;

    const entries = await Leaderboard.find()
      .sort({ totalMockScore: -1, totalStudyHours: -1 })
      .populate('userId', userFields)
      .limit(50);

    const ranked = entries
      .filter(entry => entry.userId)
      .map((entry, index) => ({
        rank: index + 1,
        id: entry.userId._id,
        name: entry.userId.name || 'Unknown',
        ...(isMentor ? { email: entry.userId.email || '' } : {}),
        branch: entry.userId.branch || 'N/A',
        streak: entry.userId.streak || 0,
        points: entry.userId.points || 0,
        badgeCount: entry.userId.badges?.length || 0,
        totalMockScore: entry.totalMockScore || 0,
        latestMockScore: entry.latestMockScore || 0,
        totalHours: entry.totalStudyHours || 0,
        totalStudyHours: entry.totalStudyHours || 0
      }));

    res.json({ success: true, leaderboard: ranked });
  } catch (err) {
    console.error('getLeaderboard error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
};

// Called by cron job to refresh leaderboard
export const refreshLeaderboard = async () => {
  try {
    const students = await User.find({ role: 'student', status: 'approved' }).select('_id');

    for (const student of students) {
      // Get latest mock test score
      const latestReport = await StudyReport.findOne({
        userId: student._id,
        mockTestScore: { $gt: 0 }
      }).sort({ date: -1 });

      // Get total study hours
      const totalAgg = await StudyReport.aggregate([
        { $match: { userId: student._id } },
        { $group: { _id: null, totalHours: { $sum: '$studyHours' }, totalMock: { $sum: '$mockTestScore' } } }
      ]);

      await Leaderboard.findOneAndUpdate(
        { userId: student._id },
        {
          totalMockScore: totalAgg[0]?.totalMock || 0,
          latestMockScore: latestReport?.mockTestScore || 0,
          totalStudyHours: Math.round((totalAgg[0]?.totalHours || 0) * 10) / 10,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
    }

    // Update ranks
    const all = await Leaderboard.find().sort({ totalMockScore: -1 });
    for (let i = 0; i < all.length; i++) {
      all[i].rank = i + 1;
      await all[i].save();
    }

    console.log(`Leaderboard refreshed: ${all.length} entries`);
  } catch (err) {
    console.error('refreshLeaderboard error:', err);
  }
};
