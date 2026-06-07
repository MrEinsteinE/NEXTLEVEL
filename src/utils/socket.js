import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

export let socket = null;

// Prefer an explicitly configured socket URL. In local dev, talk to the local
// backend so realtime updates (streak, points, progress) work without a reload.
// Otherwise fall back to the canonical Render backend hostname.
function resolveSocketUrl() {
  const configured = import.meta.env.VITE_SOCKET_URL && String(import.meta.env.VITE_SOCKET_URL).trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    return 'http://localhost:5000';
  }
  return 'https://nextlevel-backend.onrender.com';
}
const SOCKET_URL = resolveSocketUrl();

function createSocket() {
  return io(SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    withCredentials: true // auth via the httpOnly cookie sent on the handshake
  });
}

export function connectSocket(user) {
  try {
    if (!socket) socket = createSocket();

    socket.off();
    socket.connect();

    socket.on('connect', () => { if (import.meta.env.DEV) console.log('Socket connected', socket.id); });
    socket.on('disconnect', (reason) => { if (import.meta.env.DEV) console.log('Socket disconnected', reason); });

    socket.on('connect_error', (err) => {
      console.warn('Socket connect_error', err && err.message);
      // show a friendly toast for auth errors
      if (err && /auth/i.test(err.message || '')) {
        toast.error('Realtime connection failed: authentication error');
      }
    });

    // Join appropriate room once connected
    socket.once('connect', () => {
      if (user) {
        if (user.role === 'mentor') socket.emit('join-mentor-room');
        if (user.role === 'student' && user._id) socket.emit('join-student-room', user._id);
      }
    });

    // Common realtime toasts
    socket.on('points-updated', (p) => { try { if (p && typeof p.points !== 'undefined') toast.success(`+${p.points} points`); } catch (e) {} });
    socket.on('tokens-updated', (p) => { try { if (p && typeof p.tokens !== 'undefined') toast.success(`Streak tokens: ${p.tokens}`); } catch (e) {} });
    socket.on('streak-token-used', () => { try { toast.success('Streak Freeze used!'); } catch (e) {} });
    socket.on('badge-earned', (payload) => { try { if (payload && payload.name) toast.success(`${payload.name} unlocked!`); } catch (e) {} });
    socket.on('challenge-correct', () => { try { toast.success('+2 challenge points!'); } catch (e) {} });

    return socket;
  } catch (e) {
    console.error('connectSocket error', e);
    return null;
  }
}

export function getSocket() { return socket; }

export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }

export function refreshSocketAuth(token) {
  if (!socket) return;
  socket.auth = { token };
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}
