# NEXTLEVEL — Working Project Improvement Design

**Date:** 2026-05-14  
**Approach:** B — Fix everything + clean structure  
**Goal:** Turn the existing codebase into a fully functional, locally runnable, and Render+Vercel deployable project without a rewrite.

---

## Architecture

```
User Browser
  React + Vite  →  Vercel (free, global CDN)
  VITE_API_URL=https://nextlevel-backend.onrender.com

Backend: Node.js + Express + Socket.IO
  Render Web Service (free, always-on via keepAlive utility)
  PORT=5000

Database: MongoDB Atlas M0 (free forever, 512MB)
```

No changes to deployment platforms. The code is fixed so the existing deployment stack works end-to-end.

---

## Problem Areas and Fixes

### 1. Routing — Critical

**Problem:**
- `App.jsx` wraps in `<BrowserRouter>` even though `main.jsx` already does — causes nested router bug
- Only 8 routes defined; 15+ page components exist but are unreachable
- No protected routes — anyone can navigate to `/dashboard` without being logged in

**Fix:**
- Remove `<BrowserRouter>` from `App.jsx` (keep only in `main.jsx`)
- Add `<PrivateRoute>` component: reads from `AuthContext`, redirects to `/login` if unauthenticated
- Add `<MentorRoute>` component: redirects non-mentor users to `/dashboard`
- Register all missing routes:
  - `/flashcards` → `Flashcards.jsx`
  - `/notes` → `Notes.jsx`
  - `/pyq` → `PYQTracker.jsx`
  - `/mock-test` → `MockTest.jsx`
  - `/mock-test/full` → `MockTestFull.jsx`
  - `/focus` → `Focus.jsx`
  - `/planner` → `Planner.jsx`
  - `/report` → `Report.jsx`
  - `/report-card` → `ReportCard.jsx`
  - `/syllabus` → `Syllabus.jsx`
  - `/tasks` → `Tasks.jsx`
  - `/leaderboard` → `Leaderboard.jsx`
  - `/partnership` → `Partnership.jsx`
  - `/stories` → `StoriesPage.jsx`
  - `/journey` → `MyJourney.jsx`
  - `/feedback` → `Feedback.jsx`

---

### 2. Backend Route Wiring — Critical

**Problem:**
`server.js` only mounts 4 of the 20+ existing route files:
- Mounted: `auth`, `student`, `mentor`, `leaderboard`
- Missing: `flashcards`, `notes`, `focus`, `planner`, `pyq`, `mocktest`, `tracker`, `reports`, `stories`, `feedback`, `queries`, `reflections`, `notifications`, `weeklyChallenge`, `partnerships`, `reportcard`, `chat`

All API calls to unmounted routes return 404, making features non-functional.

**Fix:**
Import and mount all 16 missing route files in `server.js` under their respective `/api/*` prefixes.

---

### 3. Auth Cleanup — Important

**Problem:**
- `StudentDashboard.jsx` reads `localStorage.getItem('user')` and `localStorage.getItem('token')` directly instead of using `useAuth()`
- `AuthContext.jsx` is just a re-export of `auth.context.jsx` — fine, but the actual context must correctly store and clear both `user` and `token`
- Route protection uses inline localStorage checks in `App.jsx` instead of a reusable component

**Fix:**
- Verify `auth.context.jsx` sets `axios.defaults.headers.common['Authorization']` on login and clears it on logout
- Replace direct localStorage reads in `StudentDashboard.jsx` with `const { user, token } = useAuth()`
- Replace inline PublicRoute lambda in App.jsx with named `<PublicRoute>` component
- All protected routes use `<PrivateRoute>`, all mentor routes use `<MentorRoute>`

---

### 4. Duplicate File Removal — Important

**Problem:**
- `src/context/dashboard/` — contains duplicates of `src/components/dashboard/` (AdvancedSyllabusTracker, PreparationTracker, SyllabusChecklist). Wrong location, causes import confusion.
- `src/components/progresstracker/` — parallel duplicate of `src/components/tracker/` (ActivityBadge, EfficiencyBadge, ReportsTab, SubjectsTab, TrackerRowEditor)
- `backend.zip`, `backend (2).zip` — binary blobs committed to git, no purpose
- `tmp_*` files in repo root — leftover from smoke tests, should never be committed

**Fix:**
- Delete `src/context/dashboard/` entirely
- Delete `src/components/progresstracker/` entirely (keep `src/components/tracker/`)
- Delete `backend.zip`, `backend (2).zip`
- Delete all `tmp_*` files from repo root
- Verify no imports reference deleted paths; fix any that do

---

### 5. Security — Important

**Problem:**
- `.env.example` contains real credentials: MongoDB URI with password, JWT secret, email app password, mentor master password
- `.env.local` and `.env.vercel` are committed to the repo

**Fix:**
- Replace all real values in `backend/.env.example` with safe placeholders:
  ```
  MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/nextlevel
  JWT_SECRET=<generate-a-32-char-random-string>
  EMAIL_PASS=<gmail-app-password>
  MENTOR_MASTER_PASSWORD=<choose-a-strong-password>
  ```
- Add to `.gitignore`: `.env.local`, `.env.vercel`, `*.zip`, `tmp_*`, `build_log*.txt`, `.audit-*.json`, `.outdated-*.txt`
- Create root `.env.example` for frontend:
  ```
  VITE_API_URL=https://your-backend.onrender.com
  ```

---

### 6. Deployment Config — Polish

**Problem:**
- No `render.yaml` — backend must be manually configured in Render dashboard
- README setup instructions reference wrong env var names

**Fix:**
- Add `render.yaml` at repo root:
  ```yaml
  services:
    - type: web
      name: nextlevel-backend
      env: node
      rootDir: backend
      buildCommand: npm install
      startCommand: node server.js
      envVars:
        - key: NODE_ENV
          value: production
        - key: MONGODB_URI
          sync: false
        - key: JWT_SECRET
          sync: false
        - key: EMAIL_USER
          sync: false
        - key: EMAIL_PASS
          sync: false
        - key: MENTOR_EMAIL
          sync: false
        - key: MENTOR_MASTER_PASSWORD
          sync: false
        - key: FRONTEND_URL
          sync: false
  ```
- Update `README.md` with correct env vars, local setup steps for both frontend and backend, and a note that `.env.local` must never be committed

---

## Files Changed

| Action | Path |
|--------|------|
| Modify | `src/App.jsx` |
| Modify | `backend/server.js` |
| Modify | `src/context/auth.context.jsx` |
| Modify | `src/pages/StudentDashboard.jsx` |
| Modify | `backend/.env.example` |
| Modify | `.gitignore` |
| Modify | `README.md` |
| Create | `render.yaml` |
| Create | `.env.example` (root, frontend) |
| Delete | `src/context/dashboard/` |
| Delete | `src/components/progresstracker/` |
| Delete | `backend.zip`, `backend (2).zip` |
| Delete | all `tmp_*` files in repo root |
| Delete | `build_log.txt`, `build_log_utf8.txt` |
| Delete | `.audit-*.json`, `.outdated-*.txt` |

---

## Success Criteria

- `npm run dev` (frontend) and `cd backend && npm run dev` (backend) both start without errors
- All 20+ page routes are accessible and render without crashing
- All API endpoints respond (flashcards, notes, focus, pyq, planner, etc.)
- Login → dashboard → feature pages flow works end-to-end
- Unauthenticated users are redirected to `/login`
- No real credentials in any committed file
- Render + Vercel deploy from main branch without manual configuration steps
