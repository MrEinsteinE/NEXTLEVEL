# Deploying NEXT_LEVEL

Production setup for the GATE mentorship platform.

```
┌─────────────────────┐      cookie (httpOnly)      ┌──────────────────────┐
│  Frontend (Vercel)  │  ───────────────────────▶   │  Backend (Render)    │
│  React + Vite (SPA) │   credentialed CORS + CSRF   │  Node/Express + WS   │
└─────────────────────┘                              └──────────┬───────────┘
                                                                 │
                                                       ┌─────────▼──────────┐
                                                       │  MongoDB Atlas     │
                                                       └────────────────────┘
```

- **Frontend:** Vercel (static build from `/` → `dist/`)
- **Backend:** Render Web Service (`backend/`, `node server.js`)
- **Database:** MongoDB Atlas (free M0 tier is fine to start)
- **Auth:** JWT in an **httpOnly cookie** + **CSRF double-submit token**. Because the frontend and backend are on different domains, the cookies are **cross-site** and require `SameSite=None; Secure`, which only happens when `NODE_ENV=production`.

---

## 1. Prerequisites

1. **MongoDB Atlas** cluster — copy its `mongodb+srv://…` connection string. Under *Network Access*, allow Render's egress (or `0.0.0.0/0` to start).
2. **Gmail App Password** (for transactional email) — https://myaccount.google.com/apppasswords (requires 2FA on the Google account). Use the 16-char app password, **not** your Gmail password.
3. **Render** account (backend) and **Vercel** account (frontend).

---

## 2. Backend (Render)

**Service settings**
- Root directory: `backend`
- Build command: `npm install`
- Start command: `node server.js`
- Health check path: `/api/health`

**Environment variables**

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | ✅ | **Must be `production`.** Enables `Secure`/`SameSite=None` cookies and enforces the CORS allowlist. Without it, login won't persist in the browser and CORS is wide open. |
| `MONGODB_URI` | ✅ | Atlas `mongodb+srv://…` string. |
| `JWT_SECRET` | ✅ | 64-char random hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MENTOR_MASTER_PASSWORD` | ✅ | Strong password used for mentor login. **Do not ship `mentor123`.** |
| `FRONTEND_URL` | ✅ | Your Vercel URL, e.g. `https://your-app.vercel.app`. Added to the CORS allowlist and used in email links. Accepts a comma-separated list for multiple origins. |
| `EMAIL_USER` | ▶ | Gmail address that sends mail. Omit to disable email (app still works; logs a mock). |
| `EMAIL_PASS` | ▶ | Gmail **App Password** (16 chars). |
| `MENTOR_EMAIL` | ▶ | Where new-student-request notifications go. |
| `PORT` | — | Render sets this automatically. |
| `DNS_SERVERS` | ▶ | Only if Atlas fails with `querySrv ECONNREFUSED`. Set `1.1.1.1,8.8.8.8`. |
| `NUDGE_EMAILS` | ▶ | `false` to make the daily inactivity nudge in-app only (default: emails on). |
| `ALLOW_VERCEL_PREVIEWS` | ▶ | `true` to also allow `*.vercel.app` preview deployments through CORS. |
| `VAPID_PUBLIC_KEY` | ▶ | Web-push public key. Generate: `node -e "const e=require('crypto').createECDH('prime256v1');e.generateKeys();console.log(e.getPublicKey().toString('base64url'))"`. Omit to disable push (degrades gracefully). |
| `VAPID_PRIVATE_KEY` | ▶ | Web-push private key (paired with the public key above). |
| `VAPID_SUBJECT` | ▶ | `mailto:you@domain.com` — contact for the push service. |

> Web push uses the `web-push` dependency (already in `package.json`). Without the VAPID keys, push silently no-ops; with them, students can enable browser notifications from **Settings**.

✅ required · ▶ recommended/optional

---

## 3. Frontend (Vercel)

**Project settings**
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

**Environment variables**

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | ✅ | Your Render backend URL, e.g. `https://your-backend.onrender.com`. |
| `VITE_SOCKET_URL` | ▶ | Same Render URL (defaults to it if unset). |

> SPA routing: ensure deep links (`/dashboard`, `/mentor-login`, …) serve `index.html`. Vercel does this automatically for Vite; if you self-host, add a catch-all rewrite to `/index.html`.

---

## 4. First-deploy steps

1. Deploy the backend on Render with the env vars above. Confirm `https://your-backend.onrender.com/api/health` returns `{ "status": "ok", "mongodb": "connected" }`.
2. **Seed the mentor account** (one-time): with `MENTOR_MASTER_PASSWORD` set, run `node seedMentor.js` from `backend/` (Render Shell), or just log in once at `/mentor-login` — the mentor account is created on first successful login.
3. Deploy the frontend on Vercel with `VITE_API_URL` pointing at the backend.
4. Open the site, sign up a student, verify the email code, and log in.

---

## 5. Post-deploy smoke test

- [ ] `/api/health` → `ok` / `connected`
- [ ] Student signup → email code received → verify → login succeeds
- [ ] After login, **refresh the page** — you stay logged in (cookie persisted = `NODE_ENV=production` is correct)
- [ ] DevTools → Application → Cookies: `authToken` shows **HttpOnly ✓** and **Secure ✓**
- [ ] DevTools → Application → Local Storage: **no `token` key** (only `user`, `theme`)
- [ ] A mutation (e.g. toggle a syllabus topic) succeeds — confirms the CSRF header round-trip
- [ ] Mentor login at `/mentor-login` → dashboard loads students
- [ ] Realtime: a mentor message reaches the student without a refresh (socket auth via cookie)

---

## 6. Security checklist (do before launch)

- [ ] `JWT_SECRET` is a fresh 64-char random value (not a placeholder)
- [ ] `MENTOR_MASTER_PASSWORD` is strong (not `mentor123`)
- [ ] **Rotate** the MongoDB Atlas password and Gmail App Password if they were ever committed or shared
- [ ] `backend/.env` is gitignored (it is) and never committed
- [ ] Atlas Network Access is scoped as tightly as your hosting allows
- [ ] `NODE_ENV=production` set (also turns off verbose dev CORS + dev DB fallbacks)

---

## 7. Scheduled jobs (cron)

`node-cron` is an optional dependency. On a single always-on Render instance the jobs run automatically:
- **Midnight IST:** recalculates consistency scores + resets/preserves streaks
- **Hourly:** refreshes the leaderboard
- **5 PM IST:** nudges students inactive 1.5–4 days (in-app + email unless `NUDGE_EMAILS=false`)

> Render free tier sleeps after inactivity; a keep-alive ping runs from the frontend to mitigate this. For guaranteed cron timing, use a paid instance or an external scheduler (e.g. cron-job.org hitting a protected endpoint).

---

## 8. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| Login works but refresh logs you out | `NODE_ENV` ≠ `production` → cookie isn't `SameSite=None; Secure`, so the browser drops it cross-site. Set `NODE_ENV=production`. |
| CORS errors in console | `FRONTEND_URL` doesn't match your actual Vercel origin exactly (scheme + host, no trailing slash). |
| All mutations return 403 "Invalid CSRF token" | The `csrfToken` cookie isn't reaching the browser — usually the same cross-site cookie issue (`NODE_ENV`) or a CORS origin mismatch. |
| `querySrv ECONNREFUSED` on startup | Set `DNS_SERVERS=1.1.1.1,8.8.8.8`. |
| Emails not sending | `EMAIL_USER`/`EMAIL_PASS` missing or not a Gmail **App Password**; the app falls back to console mocks. |
