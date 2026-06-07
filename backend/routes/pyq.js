import express from 'express';
import { protect } from '../middleware/auth.js';
import { recordAttempt, recordSet, getProgress, toggleBookmark } from '../controllers/pyqController.js';

const router = express.Router();

router.post('/attempt', protect, recordAttempt);
router.post('/set', protect, recordSet);
router.get('/progress', protect, getProgress);
router.post('/bookmark', protect, toggleBookmark);

export default router;
