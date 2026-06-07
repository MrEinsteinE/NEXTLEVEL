// Auth smoke tests — black-box, run against a live backend.
// Uses Node's built-in test runner + global fetch (Node 18+). No extra deps.
//
//   Start the backend (in-memory Mongo is fine), then:  npm test
//   Override target with BASE_URL=https://your-api  npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const MENTOR_PW = process.env.MENTOR_MASTER_PASSWORD || 'mentor123';

const uniq = Date.now() + '-' + Math.floor(Math.random() * 1e4);
const student = {
  name: 'Test Student',
  email: `smoke_${uniq}@example.com`,
  password: 'secret123',
  branch: 'ECE'
};

let token = null;

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

before(async () => {
  // Wait for the server to be reachable & DB-ready (in-memory mongo can lag on boot).
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      const j = await r.json();
      if (r.status === 200 && j.mongodb === 'connected') return;
    } catch (_) {}
    await new Promise(res => setTimeout(res, 1000));
  }
  throw new Error(`Backend not reachable / DB not connected at ${BASE}`);
});

test('health endpoint reports ok', async () => {
  const { status, data } = await api('/api/health');
  assert.equal(status, 200);
  assert.equal(data.status, 'ok');
});

test('signup rejects missing fields (400)', async () => {
  const { status, data } = await api('/api/auth/signup', { method: 'POST', body: { email: student.email } });
  assert.equal(status, 400);
  assert.equal(data.error, true);
});

test('signup rejects short password (400)', async () => {
  const { status } = await api('/api/auth/signup', {
    method: 'POST',
    body: { ...student, password: '123' }
  });
  assert.equal(status, 400);
});

test('signup rejects invalid branch (400)', async () => {
  const { status } = await api('/api/auth/signup', {
    method: 'POST',
    body: { ...student, branch: 'XYZ' }
  });
  assert.equal(status, 400);
});

test('signup succeeds (201) — no token, returns email + dev code', async () => {
  const { status, data } = await api('/api/auth/signup', { method: 'POST', body: student });
  assert.equal(status, 201);
  assert.equal(data.success, true);
  assert.equal(data.token, undefined, 'no auth token is issued before email verification');
  assert.equal(data.email, student.email.toLowerCase());
  assert.ok(data.devCode, 'dev verification code returned in non-prod');
  student.devCode = data.devCode; // stash for the verification tests below
});

test('duplicate signup is rejected (400)', async () => {
  const { status, data } = await api('/api/auth/signup', { method: 'POST', body: student });
  assert.equal(status, 400);
  assert.match(data.message, /already exists/i);
});

test('login with wrong password is rejected (401)', async () => {
  const { status } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: student.email, password: 'wrongpass' }
  });
  assert.equal(status, 401);
});

test('login with unknown email is rejected (401)', async () => {
  const { status } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'nobody_' + uniq + '@example.com', password: 'secret123' }
  });
  assert.equal(status, 401);
});

test('login before email verification is rejected (403 EMAIL_NOT_VERIFIED)', async () => {
  const { status, data } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: student.email, password: student.password }
  });
  assert.equal(status, 403);
  assert.equal(data.code, 'EMAIL_NOT_VERIFIED');
});

test('verify-email with wrong code is rejected (400)', async () => {
  const { status } = await api('/api/auth/verify-email', {
    method: 'POST',
    body: { email: student.email, code: '000000' }
  });
  assert.equal(status, 400);
});

test('verify-email with correct code succeeds (200)', async () => {
  const { status, data } = await api('/api/auth/verify-email', {
    method: 'POST',
    body: { email: student.email, code: student.devCode }
  });
  assert.equal(status, 200);
  assert.equal(data.success, true);
});

test('resend-verification returns generic success (200)', async () => {
  const { status, data } = await api('/api/auth/resend-verification', {
    method: 'POST',
    body: { email: `nobody_resend_${uniq}@example.com` }
  });
  assert.equal(status, 200);
  assert.equal(data.success, true);
});

test('login succeeds after verification (200)', async () => {
  const { status, data } = await api('/api/auth/login', {
    method: 'POST',
    body: { email: student.email, password: student.password }
  });
  assert.equal(status, 200);
  assert.ok(data.token, 'token returned');
  token = data.token;
});

test('GET /me without token is rejected (401)', async () => {
  const { status } = await api('/api/auth/me');
  assert.equal(status, 401);
});

test('GET /me with malformed token is rejected (401)', async () => {
  const { status } = await api('/api/auth/me', { token: 'not.a.real.jwt' });
  assert.equal(status, 401);
});

test('GET /me with valid token returns the user (200)', async () => {
  assert.ok(token, 'precondition: login produced a token');
  const { status, data } = await api('/api/auth/me', { token });
  assert.equal(status, 200);
  assert.equal(data.user.email, student.email.toLowerCase());
  assert.equal(data.user.password, undefined, 'password must not be exposed');
});

test('mentor-login with wrong master password is rejected (401)', async () => {
  const { status } = await api('/api/auth/mentor-login', {
    method: 'POST',
    body: { email: 'mentor@example.com', password: 'definitely-wrong' }
  });
  assert.equal(status, 401);
});

test('mentor-login with master password returns a mentor (200)', async () => {
  const { status, data } = await api('/api/auth/mentor-login', {
    method: 'POST',
    body: { email: `mentor_${uniq}@example.com`, password: MENTOR_PW }
  });
  assert.equal(status, 200);
  assert.ok(data.token);
  assert.equal(data.user.role, 'mentor');
});
