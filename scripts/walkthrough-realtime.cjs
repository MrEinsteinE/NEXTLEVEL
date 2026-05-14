const http = require('http');
const https = require('https');
const { URL } = require('url');
const ioClient = require('socket.io-client');

const BASE = process.env.API_URL || 'http://localhost:5000/api';
const SOCKET_BASE = BASE.replace(/\/api\/?$/, '');

function buildUrl(path) {
  const cleanBase = BASE.endsWith('/') ? BASE : BASE + '/';
  const cleanPath = path.replace(/^\//, '');
  return new URL(cleanPath, cleanBase);
}

function request(method, path, data, token) {
  const url = buildUrl(path);
  const lib = url.protocol === 'https:' ? https : http;

  const options = {
    method,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + (url.search || ''),
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) options.headers['Authorization'] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        let parsed = body;
        try { parsed = JSON.parse(body) } catch (e) {}
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.on('error', (err) => reject(err));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('Realtime walkthrough starting — base =', BASE, 'socket =', SOCKET_BASE);
  const ts = Date.now();
  const studentEmail = `rt-student+${ts}@example.com`;
  const mentorEmail = `rt-mentor+${ts}@example.com`;
  const password = 'TestPass123!';
  const mentorPassword = process.env.MENTOR_MASTER_PASSWORD || 'changeme';

  try {
    // signup/login student
    let res = await request('POST', '/auth/signup', { name: 'RT Student', email: studentEmail, password, branch: 'CSE' });
    console.log('student signup res:', res.statusCode, JSON.stringify(res.body).slice(0,200));
    res = await request('POST', '/auth/login', { email: studentEmail, password });
    console.log('student login res:', res.statusCode, JSON.stringify(res.body).slice(0,200));
    const studentToken = res.body && (res.body.token || res.body.data && res.body.data.token);
    const studentUser = res.body && (res.body.user || res.body.data && res.body.data.user);

    // signup/login mentor
    // Mentor-login uses a master password (creates mentor if missing)
    res = await request('POST', '/auth/mentor-login', { email: mentorEmail, password: mentorPassword });
    console.log('mentor login res:', res.statusCode, JSON.stringify(res.body).slice(0,200));
    const mentorToken = res.body && (res.body.token || res.body.data && res.body.data.token);
    const mentorUser = res.body && (res.body.user || res.body.data && res.body.data.user);

    if (!studentToken || !mentorToken) {
      console.error('Missing tokens, cannot proceed with realtime test');
      process.exit(1);
    }

    console.log('Connecting sockets...');
    const studentSocket = ioClient(SOCKET_BASE, { auth: { token: studentToken }, reconnection: false });
    const mentorSocket = ioClient(SOCKET_BASE, { auth: { token: mentorToken }, reconnection: false });

    mentorSocket.on('connect', () => {
      console.log('Mentor connected', mentorSocket.id);
      mentorSocket.emit('join-mentor-room');
    });
    studentSocket.on('connect', () => {
      console.log('Student connected', studentSocket.id);
      studentSocket.emit('join-student-room', studentUser._id || studentUser.id);
    });

    mentorSocket.on('chat-message', (p) => {
      console.log('Mentor received chat-message:', p.message || p);
    });
    studentSocket.on('chat-message', (p) => {
      console.log('Student received chat-message:', p.message || p);
    });

    mentorSocket.on('progress-updated', (p) => {
      console.log('Mentor received progress-updated:', JSON.stringify(p).slice(0,200));
    });

    // Wait for connections
    await new Promise(r => setTimeout(r, 1200));

    // Student sends chat -> mentors
    console.log('Student sends chat -> mentors');
    studentSocket.emit('chat-message', { message: 'Hello mentors, message from student (realtime test)' });

    // Wait a bit
    await new Promise(r => setTimeout(r, 1200));

    // Mentor sends direct message to student
    console.log('Mentor sends chat -> student');
    mentorSocket.emit('chat-message', { toUserId: studentUser._id || studentUser.id, message: 'Hello student, this is mentor.' });

    // Wait a bit
    await new Promise(r => setTimeout(r, 1200));

    // Student posts a tracker log via API — mentor should get progress-updated
    console.log('Student posts tracker log via API (should notify mentor)');
    res = await request('POST', '/tracker/logs', { date: new Date().toISOString(), entries: [{ subject: 'Realtime', activity: 'Practice', targetHours: 1, actualHours: 1 }] }, studentToken);
    console.log('post tracker ->', res.statusCode, JSON.stringify(res.body).slice(0,400));

    // Wait to receive socket event
    await new Promise(r => setTimeout(r, 1500));

    studentSocket.close();
    mentorSocket.close();

    console.log('Realtime walkthrough finished');
    process.exit(0);
  } catch (err) {
    console.error('Realtime walkthrough error:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
