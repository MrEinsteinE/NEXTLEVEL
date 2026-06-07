import User from '../models/User.js';
import StudyReport from '../models/StudyReport.js';
import Notification from '../models/Notification.js';
import { refreshLeaderboard } from '../controllers/leaderboardController.js';
import { sendNudgeEmail } from './emailService.js';
import { sendPushToUser } from './pushService.js';

/**
 * Recalculate consistency scores for all approved students.
 * Consistency = average of (actual_hours / target_daily) over last 7 days.
 * Days with no report count as 0.
 */
export async function recalculateConsistencyScores() {
  try {
    const students = await User.find({ role: 'student', status: 'approved' });
    const now = new Date();
    let updated = 0;

    for (const student of students) {
      const targetDaily = student.targets?.daily || 6;
      let totalRatio = 0;

      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(now);
        checkDate.setUTCDate(checkDate.getUTCDate() - i);
        const dayStart = new Date(checkDate);
        dayStart.setUTCHours(0, 0, 0, 0);
        const dayEnd = new Date(checkDate);
        dayEnd.setUTCHours(23, 59, 59, 999);

        const agg = await StudyReport.aggregate([
          { $match: { userId: student._id, date: { $gte: dayStart, $lte: dayEnd } } },
          { $group: { _id: null, total: { $sum: '$studyHours' } } }
        ]);

        const actualHours = agg[0]?.total || 0;
        const ratio = targetDaily > 0 ? Math.min(actualHours / targetDaily, 1) : 0;
        totalRatio += ratio;
      }

      const score = Math.round((totalRatio / 7) * 100);
      student.consistencyScore = score;
      await student.save();
      updated++;
    }

    console.log(`✅ Consistency scores updated for ${updated} students`);
  } catch (err) {
    console.error('Consistency score recalculation error:', err);
  }
}

/**
 * Check and reset streaks for students who missed a day.
 * A missed day = no study report for yesterday.
 */
export async function checkAndResetStreaks(io) {
  try {
    const students = await User.find({ role: 'student', status: 'approved', streak: { $gt: 0 } });
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setUTCHours(23, 59, 59, 999);

    let reset = 0;

    for (const student of students) {
      if (student.lastActiveDate) {
        const lastActive = new Date(student.lastActiveDate);
        lastActive.setUTCHours(0, 0, 0, 0);
        const diffDays = Math.round((yesterday - lastActive) / (1000 * 60 * 60 * 24));

        if (diffDays >= 1) {
          // Check if they submitted a report yesterday
          const yesterdayReport = await StudyReport.findOne({
            userId: student._id,
            date: { $gte: yesterday, $lte: yesterdayEnd }
          });

            if (!yesterdayReport) {
              // If student has a streak-freeze token, consume it and preserve streak
              if (student.streakFreezeTokens && student.streakFreezeTokens > 0) {
                student.streakFreezeTokens = Math.max(0, student.streakFreezeTokens - 1);
                // Advance their lastActiveDate to yesterday to preserve continuity
                student.lastActiveDate = yesterday;
                await student.save();

                // Create notification and emit socket event
                try {
                  await Notification.create({ userId: student._id, type: 'streak_token_used', title: 'Streak preserved', message: 'A Streak Freeze Token was automatically used to preserve your streak.' });
                  if (io) {
                    io.to(`student_${student._id}`).emit('streak-token-used', { userId: student._id, tokens: student.streakFreezeTokens });
                  }
                } catch (e) {
                  console.error('Error creating streak token notification:', e);
                }
              } else {
                student.streak = 0;
                await student.save();
                reset++;
              }
            }
        }
      }
    }

    console.log(`✅ Streak check complete: ${reset} streaks reset`);
  } catch (err) {
    console.error('Streak reset error:', err);
  }
}

/**
 * Nudge students who have gone quiet (inactive ~1.5–14 days) so the mentor doesn't
 * have to chase them. Escalates to a warmer "we miss you" + 2× comeback offer once
 * they've been gone 4+ days. Sends in-app + (unless NUDGE_EMAILS=false) email + push.
 */
export async function nudgeInactiveStudents(io) {
  try {
    const now = new Date();
    const students = await User.find({ role: 'student', status: 'approved' })
      .select('name email streak lastActiveDate');
    const emailsOn = process.env.NUDGE_EMAILS !== 'false'; // emails default ON; set NUDGE_EMAILS=false to disable
    let nudged = 0;

    for (const s of students) {
      if (!s.lastActiveDate) continue;
      const hoursSince = (now - new Date(s.lastActiveDate)) / 3600000;
      if (hoursSince < 36 || hoursSince > 14 * 24) continue; // 1.5–14 day window

      // Don't nudge twice in a day.
      const recent = await Notification.findOne({
        userId: s._id, type: 'nudge',
        createdAt: { $gte: new Date(now.getTime() - 20 * 3600000) }
      });
      if (recent) continue;

      const fname = (s.name || 'there').split(' ')[0];
      const daysAway = Math.floor(hoursSince / 24);
      // Escalating win-back: gentle for a short break, warmer "we miss you" (with the
      // 2× comeback bonus) once they've been gone 4+ days.
      const message = daysAway >= 4
        ? `We miss you, ${fname}! It's been ${daysAway} days — come back today and your first report earns 2× comeback points. Let's restart strong. 💪`
        : s.streak > 0
          ? `Hey ${fname}, you've been away a little while — log a quick session today to keep your ${s.streak}-day streak alive! 🔥`
          : `Hey ${fname}, ready to get back to it? Even one focused hour today rebuilds your momentum. You've got this! 💪`;

      await Notification.create({ userId: s._id, type: 'nudge', title: 'Time to study?', message });
      if (io) io.to(`student_${s._id}`).emit('notification', { type: 'nudge', title: 'Time to study?', message });
      // Also email the student (best-effort — never let a mail failure break the loop).
      if (emailsOn && s.email) {
        try { await sendNudgeEmail(s.email, s.name, message); } catch (e) { console.error('Nudge email failed for', s.email, e.message); }
      }
      await sendPushToUser(s._id, { title: 'Time to study?', body: message, url: '/dashboard' }).catch(() => {});
      nudged++;
    }

    console.log(`✅ Auto-nudge complete: ${nudged} student(s) nudged`);
    return nudged;
  } catch (err) {
    console.error('Auto-nudge error:', err);
    return 0;
  }
}

/**
 * Initialize cron jobs.
 * Uses dynamic import for node-cron (optional dependency).
 */
export async function initCronJobs(io) {
  try {
    const cron = await import('node-cron');

    // Midnight daily: recalculate consistency + check streaks
    cron.default.schedule('0 0 * * *', async () => {
      console.log('⏰ Running midnight cron: consistency + streaks');
      await recalculateConsistencyScores();
      await checkAndResetStreaks(io);
    }, { timezone: 'Asia/Kolkata' });

    // Every hour: refresh leaderboard
    cron.default.schedule('0 * * * *', async () => {
      console.log('⏰ Running hourly cron: leaderboard refresh');
      await refreshLeaderboard();
    }, { timezone: 'Asia/Kolkata' });

    // 5 PM IST daily: nudge students who've gone quiet
    cron.default.schedule('0 17 * * *', async () => {
      console.log('⏰ Running daily cron: nudge inactive students');
      await nudgeInactiveStudents(io);
    }, { timezone: 'Asia/Kolkata' });

    console.log('✅ Cron jobs initialized (midnight consistency/streaks, hourly leaderboard, 5pm nudges)');
  } catch (err) {
    console.warn('⚠️  node-cron not available. Cron jobs disabled. Install with: npm install node-cron');
  }
}
