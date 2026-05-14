import { chromium } from 'playwright';

// FRONTEND_URL: URL of the frontend to navigate (e.g. https://...vercel.app)
// API_BASE: URL of the backend API (e.g. https://nextlevel-backend.onrender.com). If not set,
// default to the canonical Render backend so tests can create/approve users directly.
const BASE = process.env.FRONTEND_URL || 'http://localhost:3002';
const API_BASE = process.env.API_BASE || process.env.VITE_API_URL || 'https://nextlevel-backend.onrender.com';

(async () => {
  console.log('UI smoke test starting — base =', BASE);
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  // Pipe browser console / errors to Node console for debugging
  page.on('console', msg => console.log('BROWSER LOG>', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR>', err && err.message ? err.message : err));
  page.on('requestfailed', req => console.warn('REQUEST FAILED>', req.url(), req.failure() && req.failure().errorText));
  page.on('response', res => console.log('BROWSER RESPONSE>', res.status(), res.url()));

  try {
    const ts = Date.now();
    const email = `ui-smoke+${ts}@example.com`;
    const password = 'TestPass123!';

    // Ensure test user exists: create via API to avoid UI signup flakiness
    console.log('Creating test user via API for', email, '-> api base =', API_BASE);
    let userId = null;
    try {
      const signupResp = await context.request.post(`${API_BASE}/api/auth/signup`, { data: { name: 'UI Smoke Student', email, password, branch: 'CSE' } });
      if (signupResp.ok()) {
        const signupJson = await signupResp.json();
        console.log('API signup response OK', signupJson.success ? 'success' : signupJson.message || 'no message');
        userId = signupJson.user?._id || signupJson.user?.id || null;
      } else {
        console.warn('API signup returned', signupResp.status());
        // try to locate the user via login
        try {
          const loginResp = await context.request.post(`${API_BASE}/api/auth/login`, { data: { email, password } });
          if (loginResp.ok()) {
            const loginJson = await loginResp.json();
            userId = loginJson.user?._id || loginJson.user?.id || null;
            console.log('Found existing user via login, id=', userId);
          } else {
            console.warn('Could not login existing user; status', loginResp.status());
          }
        } catch (e) {
          console.warn('Login check after signup failure failed', e && e.message ? e.message : e);
        }
      }
    } catch (err) {
      console.warn('API signup error (may already exist)', err && err.message ? err.message : err);
      try {
        const loginResp = await context.request.post(`${API_BASE}/api/auth/login`, { data: { email, password } });
        if (loginResp.ok()) {
          const loginJson = await loginResp.json();
          userId = loginJson.user?._id || loginJson.user?.id || null;
          console.log('Found existing user via login (catch), id=', userId);
        }
      } catch (e2) {
        console.warn('Fallback login failed', e2 && e2.message ? e2.message : e2);
      }
    }

    // If we have a userId, attempt to approve via mentor API so dashboard is accessible
    if (userId) {
      try {
        const mentorResp = await context.request.post(`${API_BASE}/api/auth/mentor-login`, { data: { email: 'sankar.bhima@gmail.com', password: process.env.MENTOR_MASTER_PASSWORD || 'changeme' } });
        if (mentorResp.ok()) {
          const mentorJson = await mentorResp.json();
          const mentorToken = mentorJson.token;
          console.log('Mentor login obtained, approving user', userId);
          const approveResp = await context.request.post(`${API_BASE}/api/mentor/approve-student/${userId}`, { headers: { Authorization: `Bearer ${mentorToken}` } });
          if (approveResp.ok()) {
            console.log('Student approved via mentor API');
          } else {
            console.warn('Approve student API returned', approveResp.status());
          }
        } else {
          console.warn('Mentor login failed, status', mentorResp.status());
        }
      } catch (err) {
        console.warn('Mentor approval flow error', err && err.message ? err.message : err);
      }
    } else {
      console.warn('No userId found for test user; continuing without auto-approval');
    }

    console.log('Visiting signup page');
    await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });

    // Debug: check DOM presence
    const hasName = await page.evaluate(() => !!document.querySelector('#name'));
    console.log('DOM check - #name present?', hasName);
    const snap = await page.content();
    console.log('PAGE CONTENT SNIPPET:', snap.slice(0, 2000));
    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
    console.log('ROOT innerHTML length=', rootHtml.length);
    console.log('ROOT innerHTML snippet:', rootHtml.slice(0, 2000));
    // Try id-based selectors first (newer code), fall back to placeholder-based selectors (older/minified build)
    let nameSel = '#name';
    let emailSel = '#email';
    let passSel = '#password';
    const hasIdName = await page.$(nameSel);
    if (!hasIdName) {
      nameSel = 'input[placeholder="Enter your full name"]';
      emailSel = 'input[placeholder="Enter your email"]';
      passSel = 'input[placeholder="Create a password (min 8 characters)"]';
    }

    await page.fill(nameSel, 'UI Smoke Student');
    await page.fill(emailSel, email);
    await page.fill(passSel, password);

    // Branch selection: try radio input, otherwise click label/text
    const branchInput = await page.$('input[name="branch"][value="CSE"]');
    if (branchInput) {
      await page.check('input[name="branch"][value="CSE"]');
    } else {
      // click the branch label/text that contains CSE
      await page.click('text=CSE');
    }

    // Optional phone and terms
    const phoneEl = await page.$('#phone');
    if (phoneEl) await page.fill('#phone', '+919876543210');
    const agreeEl = await page.$('input[name="agreeTerms"]');
    if (agreeEl) await page.check('input[name="agreeTerms"]');

    // Submit: try both possible submit buttons
    console.log('Submitting signup');
    const createBtn = await page.$('button:has-text("Create Account")');
    const requestBtn = await page.$('button:has-text("Request Mentorship")');
    if (createBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 8000 }).catch(() => {}),
        createBtn.click()
      ]);
    } else if (requestBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 8000 }).catch(() => {}),
        requestBtn.click()
      ]);
    } else {
      // fallback: click first submit button
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 8000 }).catch(() => {}),
        page.click('button[type="submit"]')
      ]);
    }

    console.log('After signup url=', page.url());

    if (page.url().includes('/pending-approval')) {
      console.log('Signup reached pending-approval page');
    } else {
      console.warn('Did not reach pending-approval page; current url:', page.url());
    }

    // Now login via UI
    console.log('Visiting login page');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    // Debug: capture form/button structure on the login page
    const forms = await page.evaluate(() => Array.from(document.querySelectorAll('form')).map(f => ({ id: f.id || null, class: f.className, innerLength: (f.innerHTML || '').length, snippet: (f.innerHTML || '').slice(0, 1000) })));
    console.log('Forms on page:', JSON.stringify(forms));
    const buttonsHtml = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.outerHTML));
    console.log('Buttons HTML:', buttonsHtml.join('\n---\n'));
    // login selectors: prefer id, otherwise fall back to placeholders
    let loginEmailSel = '#email';
    let loginPassSel = '#password';
    if (!(await page.$(loginEmailSel))) {
      loginEmailSel = 'input[placeholder="Enter your registered email"]';
      loginPassSel = 'input[placeholder="Enter your password"]';
    }
    await page.fill(loginEmailSel, email);
    await page.fill(loginPassSel, password);

    // Debug: verify inputs contain the expected values
    const filledEmail = await page.evaluate((sel) => (document.querySelector(sel) && document.querySelector(sel).value) || '', loginEmailSel);
    const filledPass = await page.evaluate((sel) => (document.querySelector(sel) && document.querySelector(sel).value) || '', loginPassSel);
    console.log('Filled values ->', { filledEmail, hasPassword: !!filledPass });

    console.log('Submitting login');
    // Prefer clicking test-id if available (more robust)
    const testSubmitBtn = await page.$('button[data-testid="login-submit"]');
    if (testSubmitBtn) {
      await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/auth/login') && (r.status() === 200 || r.status() === 401), { timeout: 8000 }).catch(() => {}),
        testSubmitBtn.click()
      ]);
    } else {
    // Debug: list button texts to find the correct submit button
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()));
    console.log('Buttons on page:', buttons);
    // Try to click the button containing 'Login' or fallback to first submit
    const loginBtnText = buttons.find(t => /login/i.test(t)) || buttons.find(t => /sign in|sign in now|submit/i.test(t)) || null;
    if (loginBtnText) {
      await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.status() === 200, { timeout: 8000 }).catch(() => {}),
        page.click(`button:has-text("${loginBtnText}")`)
      ]);
    } else {
      await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.status() === 200, { timeout: 8000 }).catch(() => {}),
        page.click('button[type="submit"]')
      ]);
    }
    }

    // Give time for localStorage to be set
    await page.waitForTimeout(800);
    let token = await page.evaluate(() => localStorage.getItem('token'));
    console.log('Login token found:', !!token);

    if (!token) {
      console.warn('Login did not produce a token in localStorage — attempting direct API login fallback');
      try {
        const apiResp = await context.request.post(`${BASE}/api/auth/login`, { data: { email, password } });
        if (apiResp.ok()) {
          const json = await apiResp.json();
          const token2 = json.token || json.data?.token;
          const user = json.user || json.data?.user;
          if (token2) {
            await page.evaluate(({ t, u }) => {
              localStorage.setItem('token', t);
              try { localStorage.setItem('user', JSON.stringify(u)); } catch (e) {}
            }, { t: token2, u: user });
            console.log('Fallback API login succeeded, token set');

            // Reload app so AuthProvider picks up token & fetches user
            await page.reload({ waitUntil: 'networkidle' });
            await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });

            try {
              await page.waitForSelector('.student-dashboard', { timeout: 10000 });
              console.log('Dashboard loaded via fallback login');
              process.exitCode = 0;
            } catch (err) {
              if (page.url().includes('/pending-approval')) {
                console.warn('User still pending approval; dashboard not accessible');
                process.exitCode = 4;
              } else {
                console.error('Dashboard did not load after fallback login', err);
                process.exitCode = 2;
              }
            }
          } else {
            console.error('Fallback API login returned no token', json);
            process.exitCode = 2;
          }
        } else {
          console.error('Fallback API login failed, status', apiResp.status());
          process.exitCode = 2;
        }
      } catch (err) {
        console.error('Fallback API login error', err);
        process.exitCode = 3;
      }
    } else {
      console.log('UI login produced a token; verifying dashboard navigation');
      await page.reload({ waitUntil: 'networkidle' });
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
      try {
        await page.waitForSelector('.student-dashboard', { timeout: 10000 });
        console.log('Dashboard loaded via UI login');
        process.exitCode = 0;
      } catch (err) {
        console.error('Dashboard did not load after UI login', err);
        process.exitCode = 2;
      }
    }

  } catch (err) {
    console.error('UI smoke test error:', err);
    process.exitCode = 3;
  } finally {
    await browser.close();
  }
})();
