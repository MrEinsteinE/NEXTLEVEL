import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import {
  getTargets, updateTargets,
  getProgress,
  createStudyReport, updateStudyReport, deleteStudyReport, getStudyReports,
  getSyllabusProgress, updateSyllabusProgress,
  getDailyTasks, updateDailyTasks,
  getStreak, getRewards,
  getTimetable, markTimetableComplete, getJourney
  , buyFreezeToken, getTokens
} from '../controllers/studentController.js';

const router = Router();

// All student routes require auth + student role
router.use(requireAuth);
router.use(requireRole(['student']));

// Block students whose account isn't approved yet from reading/writing student data.
router.use((req, res, next) => {
  if (req.user.status && req.user.status !== 'approved') {
    return res.status(403).json({ error: true, message: 'Your account is awaiting mentor approval.' });
  }
  next();
});

// Every student route operates on the *authenticated* student's own data. The id
// previously came from the URL (`:userId`), which was both an IDOR (a student
// could read/write another student's data by changing the id) and a crash risk
// (a non-ObjectId string like "student_example_com" threw a 500 on cast).
// This pins `:userId` to the token's user, so the client-supplied value is never trusted.
router.param('userId', (req, res, next) => {
  req.params.userId = req.user._id.toString();
  next();
});

// Targets
router.get('/targets/:userId', getTargets);
router.post('/targets/:userId', updateTargets);

// Progress (aggregated study hours)
router.get('/progress/:userId', getProgress);

// Study Reports
router.post('/study-report', createStudyReport);
router.patch('/study-report/:reportId', updateStudyReport);
router.delete('/study-report/:reportId', deleteStudyReport);
router.get('/study-reports/:userId', getStudyReports);

// Syllabus Progress
router.get('/syllabus-progress/:userId', getSyllabusProgress);
router.post('/syllabus-progress/:userId', updateSyllabusProgress);

// Daily Tasks
router.get('/daily-tasks/:userId', getDailyTasks);
router.post('/daily-tasks/:userId', updateDailyTasks);

// Streak & Rewards
router.get('/streak/:userId', getStreak);
router.get('/rewards/:userId', getRewards);
router.post('/tokens/buy/:userId', buyFreezeToken);
router.get('/tokens/:userId', getTokens);

// Timetable & Journey (read-only for students)
router.get('/timetable/:userId', getTimetable);
router.post('/timetable-complete/:userId', markTimetableComplete);
router.get('/journey/:userId', getJourney);

export default router;
