import PushSubscription from '../models/PushSubscription.js';

// web-push is loaded lazily + guarded so the server still boots if it isn't
// installed or VAPID keys aren't configured (push simply becomes a no-op).
let webpush = null;
let vapidReady = false;

async function getWebPush() {
  if (webpush) return webpush;
  try {
    const mod = await import('web-push');
    webpush = mod.default || mod;
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@nextlevel.app', pub, priv);
      vapidReady = true;
    }
    return webpush;
  } catch (e) {
    console.warn('⚠️  web-push not available — push notifications disabled.');
    return null;
  }
}

export function isPushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/**
 * Send a push notification to every subscription a user has registered.
 * Best-effort: failures never throw, and dead subscriptions (404/410) are pruned.
 * payload: { title, body, url?, tag? }
 */
export async function sendPushToUser(userId, payload) {
  if (!isPushConfigured()) return 0;
  const wp = await getWebPush();
  if (!wp || !vapidReady) return 0;

  const subs = await PushSubscription.find({ userId });
  if (!subs.length) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body);
      sent++;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await PushSubscription.deleteOne({ _id: s._id }).catch(() => {});
      }
    }
  }));
  return sent;
}
