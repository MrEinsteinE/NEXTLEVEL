const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = process.env.API_URL || 'http://localhost:5000/api';

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
        try {
          parsed = JSON.parse(body);
        } catch (e) {}
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    });
    req.on('error', (err) => reject(err));
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  console.log('API smoke tests starting — base =', BASE);
  const ts = Date.now();
  const email = `smoketest+${ts}@example.com`;
  const password = 'TestPass123!';

  try {
    let res;

    console.log('\n1) Signup');
    res = await request('POST', '/auth/signup', { name: 'Smoke Student', email, password, branch: 'CSE' });
    console.log('signup ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    console.log('\n2) Login');
    res = await request('POST', '/auth/login', { email, password });
    console.log('login ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    const token = res.body && (res.body.token || (res.body.data && res.body.data.token) || res.body.accessToken);
    const user = res.body && (res.body.user || (res.body.data && res.body.data.user));

    if (!token) {
      console.warn('No token returned — authenticated tests will be skipped');
    } else {
      console.log('Token received length=', token.length);
    }

    if (user && user._id) {
      console.log('\n3) Syllabus progress (GET)');
      res = await request('GET', `/student/syllabus-progress/${user._id}`, null, token);
      console.log('syllabus ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    } else {
      console.log('Skipping syllabus progress (no user id)');
    }

    console.log('\n4) Planner generate (POST)');
    res = await request('POST', '/planner/generate', { userId: user?._id }, token);
    console.log('planner generate ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    console.log('\n5) Add custom flashcard (POST)');
    res = await request('POST', '/flashcards/custom', { front: 'Smoke Q: 2+2?', back: '4' }, token);
    console.log('flashcards custom ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    console.log('\n6) Flashcards due (GET)');
    res = await request('GET', '/flashcards/due', null, token);
    console.log('flashcards due ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    console.log('\n7) PYQ attempt (POST)');
    res = await request('POST', '/pyq/attempt', { questionId: '000000000000000000000001', subject: 'General', status: 'correct' }, token);
    console.log('pyq attempt ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    console.log('\n8) PYQ progress (GET)');
    res = await request('GET', '/pyq/progress', null, token);
    console.log('pyq progress ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    // ------------------ Additional endpoints ------------------
    console.log('\n9) Create story (POST)');
    res = await request('POST', '/stories', { title: 'Smoke Story', content: 'This is a smoke test story.' }, token);
    console.log('create story ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    const storyId = res.body && res.body.story && res.body.story._id;

    console.log('\n10) Get stories (GET)');
    res = await request('GET', '/stories', null, token);
    console.log('get stories ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    if (storyId) {
      console.log('\n11) Add comment to story (POST)');
      res = await request('POST', `/stories/${storyId}/comment`, { text: 'Nice story!' }, token);
      console.log('add comment ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

      console.log('\n12) Toggle like on story (PUT)');
      res = await request('PUT', `/stories/${storyId}/like`, null, token);
      console.log('toggle like ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    }

    // Mentor actions: mentor-login to approve story and create notifications
    console.log('\n13) Mentor login (POST)');
    const mentorEmail = `mentor+${ts}@example.com`;
    res = await request('POST', '/auth/mentor-login', { email: mentorEmail, password: process.env.MENTOR_MASTER_PASSWORD || 'changeme' });
    console.log('mentor login ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    const mentorToken = res.body && res.body.token;

    if (mentorToken && storyId) {
      console.log('\n14) Approve story (PUT)');
      res = await request('PUT', `/stories/${storyId}/approve`, null, mentorToken);
      console.log('approve story ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    }

    // Notes
    console.log('\n15) Save note (POST)');
    res = await request('POST', '/notes', { subject: 'Digital Logic', topic: 'Boolean Algebra', content: '<p>Test note</p>' }, token);
    console.log('save note ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    console.log('\n16) List notes (GET)');
    res = await request('GET', '/notes', null, token);
    console.log('list notes ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    // Leaderboard
    console.log('\n17) Leaderboard (GET)');
    res = await request('GET', '/leaderboard', null, token);
    console.log('leaderboard ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    // Mock tests
    console.log('\n18) Mock test start (POST)');
    res = await request('POST', '/mock-test/start', { testType: 'quick', subject: 'General', questions: [{ questionId: 'q1' }, { questionId: 'q2' }] }, token);
    console.log('mock start ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    const attemptId = res.body && res.body.attemptId;

    if (attemptId) {
      console.log('\n19) Mock test submit (POST)');
      res = await request('POST', '/mock-test/submit', { attemptId, answers: [{ questionId: 'q1', selectedAnswer: 'a', isCorrect: true }, { questionId: 'q2', selectedAnswer: 'b', isCorrect: false }] }, token);
      console.log('mock submit ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    }

    // Notifications (mentor creates, student reads)
    if (mentorToken) {
      console.log('\n20) Mentor creates notification (POST)');
      res = await request('POST', '/notifications/create', { userId: user && user._id, title: 'Test Notification', message: 'Hello student' }, mentorToken);
      console.log('create notification ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
      const notifId = res.body && res.body.notification && res.body.notification._id;

      console.log('\n21) Student fetches notifications (GET)');
      res = await request('GET', '/notifications', null, token);
      console.log('get notifications ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

      if (res.body && res.body.notifications && res.body.notifications.length > 0) {
        const nid = res.body.notifications[0]._id;
        console.log('\n22) Student marks notification read (PUT)');
        res = await request('PUT', `/notifications/read/${nid}`, null, token);
        console.log('mark read ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
      }
    }

    // Partnerships: create a second student and test partnership flow
    console.log('\n23) Create partner student (signup)');
    const partnerEmail = `partner+${ts}@example.com`;
    res = await request('POST', '/auth/signup', { name: 'Partner Student', email: partnerEmail, password: 'Partner123!', branch: 'CSE' });
    console.log('partner signup ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    // login partner
    res = await request('POST', '/auth/login', { email: partnerEmail, password: 'Partner123!' });
    console.log('partner login ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
    const partnerToken = res.body && res.body.token;
    const partnerUser = res.body && res.body.user;

    if (partnerUser && partnerUser._id) {
      console.log('\n24) Request partnership (POST)');
      res = await request('POST', '/partnerships/request', { toUserId: partnerUser._id }, token);
      console.log('request partnership ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
      const partnershipId = res.body && res.body.partnership && res.body.partnership._id;

      if (partnerToken && partnershipId) {
        console.log('\n25) Partner responds to partnership (POST)');
        res = await request('POST', '/partnerships/respond', { partnershipId, accept: true }, partnerToken);
        console.log('respond partnership ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

        console.log('\n26) Send partnership check-in (POST)');
        res = await request('POST', '/partnerships/checkin', { partnershipId, message: 'Checking in!' }, token);
        console.log('partnership checkin ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));
      }
    }

    // Study report (create)
    console.log('\n27) Create study report (POST)');
    res = await request('POST', '/student/study-report', { userId: user && user._id, date: new Date().toISOString(), subject: 'Practice', topic: 'Mock Test', studyHours: 2, pyqsSolved: 5, mockTestScore: 80, accuracy: 80 }, token);
    console.log('create study report ->', res.statusCode, JSON.stringify(res.body).slice(0, 800));

    console.log('\nSmoke tests completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Smoke tests encountered an error:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

main();
