import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import PushSubscription from '../models/PushSubscription.js';
import { isPushConfigured } from '../services/pushService.js';

const router = Router();

// Public: the frontend needs the VAPID public key to create a subscription.
router.get('/public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, enabled: isPushConfigured() });
});

router.use(requireAuth);

// Save (or refresh) this device's push subscription for the logged-in user.
router.post('/subscribe', async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: true, message: 'Invalid subscription.' });
    }
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user._id, endpoint, keys },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('push subscribe error:', err);
    res.status(500).json({ error: true, message: 'Server error.' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) await PushSubscription.deleteOne({ endpoint, userId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Server error.' });
  }
});

export default router;
