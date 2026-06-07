import api from './api';

// VAPID public keys are base64url; the PushManager wants a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

// 'unsupported' | 'unavailable' (no SW yet) | 'denied' | 'subscribed' | 'default'
export async function getPushStatus() {
  if (!isPushSupported()) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unavailable';
  const sub = await reg.pushManager.getSubscription();
  if (sub) return 'subscribed';
  if (Notification.permission === 'denied') return 'denied';
  return 'default';
}

export async function enablePush() {
  if (!isPushSupported()) throw new Error('Push notifications aren’t supported on this browser.');
  const reg = await navigator.serviceWorker.ready;
  const { data } = await api.get('/api/push/public-key');
  if (!data.publicKey) throw new Error('Push isn’t configured on the server yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was denied.');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  });
  await api.post('/api/push/subscribe', sub.toJSON());
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
}
