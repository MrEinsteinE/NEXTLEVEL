import express from 'express';
import { protect } from '../middleware/auth.js';
import { requestPartnership, respondPartnership, sendCheckIn, getMyPartnerships, getPartnerCandidates } from '../controllers/partnershipController.js';

const router = express.Router();

router.get('/mine', protect, getMyPartnerships);
router.get('/candidates', protect, getPartnerCandidates);
router.post('/request', protect, requestPartnership);
router.post('/respond', protect, respondPartnership);
router.post('/checkin', protect, sendCheckIn);

export default router;
