// Write-path smoke tests — verifies state-changing endpoints actually persist
// data and enforce roles: student study-report creation + mentor approve/reject.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const MENTOR_PW = process.env.MENTOR_MASTER_PASSWORD || 'mentor123';
const uniq = Date.now() + '-' + Math.floor(Math.random() * 1e4);
const today = new Date().toISOString();

let mentorToken = null;
const reporter = {};   // student that submits a study report
const toApprove = {};  // pending student the mentor will approve
const toReject = {};   // pending student the mentor will reject

async function api(path, { method = 'GET', body, token } = {}) {
  // CSRF double-submit: non-GET routes require a csrfToken cookie that matches the
  // X-CSRF-Token header. These black-box tests use Bearer auth (no cookie jar), so
  // send a self-consistent pair on mutations — otherwise the CSRF middleware 403s
  // every POST/PUT/DELETE before it ever reaches the auth/role checks under test.
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

// Signup no longer returns a token and login is gated on email verification, so
// obtaining a usable student token now means: signup → verify (dev code) → login.
async function registerAndLogin(suffix, branch) {
  const email = `w_${suffix}_${uniq}@example.com`;
  const s = await api('/api/auth/signup', { method: 'POST', body: { name: `W ${suffix}`, email, password: 'secret123', branch } });
  assert.equal(s.status, 201);
  const v = await api('/api/auth/verify-email', { method: 'POST', body: { email, code: s.data.devCode } });
  assert.equal(v.status, 200);
  const l = await api('/api/auth/login', { method: 'POST', body: { email, password: 'secret123' } });
  assert.equal(l.status, 200);
  return { token: l.data.token, id: l.data.user._id, email };
}

before(async () => {
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

  const a = await registerAndLogin('reporter', 'EE'); reporter.token = a.token; reporter.id = a.id;
  const b = await registerAndLogin('approve', 'ECE'); toApprove.token = b.token; toApprove.id = b.id;
  const c = await registerAndLogin('reject', 'CSE'); toReject.token = c.token; toReject.id = c.id;
  const m = await api('/api/auth/mentor-login', { method: 'POST', body: { email: `wmentor_${uniq}@example.com`, password: MENTOR_PW } });
  assert.equal(m.status, 200); mentorToken = m.data.token;

  // Student routes require an APPROVED account, so the mentor must approve the
  // reporter before it can write study data. (toApprove/toReject stay pending —
  // the approve/reject tests act on them directly.)
  const appr = await api(`/api/mentor/students/${reporter.id}/approve`, { method: 'PUT', token: mentorToken });
  assert.equal(appr.status, 200, 'reporter approved for write tests');
});

const reportBody = () => ({
  userId: reporter.id, date: today, subject: 'Mathematics', topic: 'Linear Algebra',
  studyHours: 5, pyqsSolved: 20, accuracy: 80
});

// ── Student study-report (POST /api/student/study-report) ──
test('study-report requires auth (401)', async () => {
  const { status } = await api('/api/student/study-report', { method: 'POST', body: reportBody() });
  assert.equal(status, 401);
});

test('study-report validates required fields (400)', async () => {
  const { status } = await api('/api/student/study-report', {
    method: 'POST', token: reporter.token, body: { userId: reporter.id, date: today }
  });
  assert.equal(status, 400);
});

test('study-report rejects a mentor token (403 role enforcement)', async () => {
  const { status } = await api('/api/student/study-report', { method: 'POST', token: mentorToken, body: reportBody() });
  assert.equal(status, 403);
});

test('student creates a study report (201) and it aggregates into progress', async () => {
  const { status, data } = await api('/api/student/study-report', { method: 'POST', token: reporter.token, body: reportBody() });
  assert.equal(status, 201);
  assert.ok(data.report, 'report returned');
  assert.equal(data.report.studyHours, 5);
  // Persistence check: the progress aggregation should now reflect the report.
  const prog = await api(`/api/student/progress/${reporter.id}`, { token: reporter.token });
  assert.equal(prog.status, 200);
  assert.equal(prog.data.progress.today.studyHours, 5, "today's hours reflect the new report");
});

test('duplicate study report for the same date is rejected (400)', async () => {
  const { status } = await api('/api/student/study-report', { method: 'POST', token: reporter.token, body: reportBody() });
  assert.equal(status, 400);
});

// ── Mentor approve / reject (PUT /api/mentor/students/:id/{approve,reject}) ──
test('approve requires auth (401)', async () => {
  const { status } = await api(`/api/mentor/students/${toApprove.id}/approve`, { method: 'PUT' });
  assert.equal(status, 401);
});

test('approve rejects a student token (403 role enforcement)', async () => {
  const { status } = await api(`/api/mentor/students/${toApprove.id}/approve`, { method: 'PUT', token: toApprove.token });
  assert.equal(status, 403);
});

test('mentor approves a pending student (200) and the status persists', async () => {
  const { status, data } = await api(`/api/mentor/students/${toApprove.id}/approve`, { method: 'PUT', token: mentorToken });
  assert.equal(status, 200);
  assert.equal(data.user.status, 'approved');
  // Persistence check: approving again is rejected because it's already approved.
  const again = await api(`/api/mentor/students/${toApprove.id}/approve`, { method: 'PUT', token: mentorToken });
  assert.equal(again.status, 400);
});

test('mentor rejects a student (200) and the status persists', async () => {
  const { status } = await api(`/api/mentor/students/${toReject.id}/reject`, { method: 'PUT', token: mentorToken });
  assert.equal(status, 200);
  // Persistence check: the rejected student's own /me now reports 'rejected'.
  const me = await api('/api/auth/me', { token: toReject.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.status, 'rejected');
});
