// Protected-endpoint smoke tests — verifies auth + role enforcement on
// representative student and mentor routes. Black-box; no extra deps.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const MENTOR_PW = process.env.MENTOR_MASTER_PASSWORD || 'mentor123';
const uniq = Date.now() + '-' + Math.floor(Math.random() * 1e4);

let studentToken = null;
let studentId = null;
let mentorToken = null;

async function api(path, { method = 'GET', body, token } = {}) {
  // CSRF double-submit for non-GET routes (see writes.test.js for rationale).
  const isMutation = method !== 'GET' && method !== 'HEAD';
  const CSRF = 'test-csrf-token';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isMutation ? { 'X-CSRF-Token': CSRF, Cookie: `csrfToken=${CSRF}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

before(async () => {
  // Wait for server + DB.
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      const j = await r.json();
      if (r.status === 200 && j.mongodb === 'connected') { ready = true; break; }
    } catch (_) {}
    await new Promise(res => setTimeout(res, 1000));
  }
  if (!ready) throw new Error(`Backend not reachable / DB not connected at ${BASE}`);

  // Create a student: signup → verify email (dev code) → login to get a token + id.
  const email = `prot_${uniq}@example.com`;
  const s = await api('/api/auth/signup', {
    method: 'POST',
    body: { name: 'Protected Tester', email, password: 'secret123', branch: 'CSE' }
  });
  assert.equal(s.status, 201, 'student signup');
  const v = await api('/api/auth/verify-email', { method: 'POST', body: { email, code: s.data.devCode } });
  assert.equal(v.status, 200, 'email verification');
  const l = await api('/api/auth/login', { method: 'POST', body: { email, password: 'secret123' } });
  assert.equal(l.status, 200, 'student login');
  studentToken = l.data.token;
  studentId = l.data.user._id;

  const m = await api('/api/auth/mentor-login', {
    method: 'POST',
    body: { email: `protmentor_${uniq}@example.com`, password: MENTOR_PW }
  });
  assert.equal(m.status, 200, 'mentor login');
  mentorToken = m.data.token;

  // Student routes require an approved account; approve the student so the
  // "read own progress (200)" test isn't blocked by the pending-approval guard.
  const appr = await api(`/api/mentor/students/${studentId}/approve`, { method: 'PUT', token: mentorToken });
  assert.equal(appr.status, 200, 'student approved');
});

// ── Student route: GET /api/student/progress/:userId ──
test('student route rejects unauthenticated requests (401)', async () => {
  const { status } = await api(`/api/student/progress/${studentId}`);
  assert.equal(status, 401);
});

test('student can read their own progress (200)', async () => {
  const { status, data } = await api(`/api/student/progress/${studentId}`, { token: studentToken });
  assert.equal(status, 200);
  assert.ok(data.progress, 'progress payload present');
  assert.ok(data.progress.today && data.progress.week && data.progress.month, 'aggregated buckets present');
});

test('student route rejects a mentor token with 403 (role enforcement)', async () => {
  const { status, data } = await api(`/api/student/progress/${studentId}`, { token: mentorToken });
  assert.equal(status, 403);
  assert.equal(data.error, true);
});

// ── Mentor route: GET /api/mentor/students ──
test('mentor route rejects unauthenticated requests (401)', async () => {
  const { status } = await api('/api/mentor/students');
  assert.equal(status, 401);
});

test('mentor can list students (200, array)', async () => {
  const { status, data } = await api('/api/mentor/students', { token: mentorToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(data), 'returns an array of students');
});

test('mentor route rejects a student token with 403 (role enforcement)', async () => {
  const { status, data } = await api('/api/mentor/students', { token: studentToken });
  assert.equal(status, 403);
  assert.equal(data.error, true);
});
