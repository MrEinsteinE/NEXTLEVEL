# NEXTLEVEL — GATE 2027 Prep Platform

A full-stack study platform for GATE aspirants (ECE, EE, CSE). Features include syllabus tracking, flashcards, PYQ practice, mock tests, focus sessions, daily reports, leaderboard, and mentor interaction.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, React Router v6, Recharts, Axios |
| Backend | Node.js 20, Express 4, Socket.IO 4 |
| Database | MongoDB Atlas (Mongoose 8) |
| Auth | JWT (7-day tokens) |
| Deploy | Vercel (frontend) + Render (backend) |

## Local Setup

### Prerequisites

- Node.js 20+
- A MongoDB Atlas account (free M0 cluster) — or use the built-in dev fallback (mongodb-memory-server)

### 1. Clone and install

```bash
git clone https://github.com/neerajanagarjuna4-png/NEXTLEVEL.git
cd NEXTLEVEL
npm install          # frontend deps
cd backend && npm install && cd ..
```

### 2. Configure backend environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — fill in MONGODB_URI, JWT_SECRET, email fields
```

> **Dev shortcut:** If you leave `MONGODB_URI` blank, the backend auto-starts `mongodb-memory-server` (in-memory DB). Data resets on restart, but the app is fully functional for testing.

### 3. Run backend

```bash
cd backend
npm run dev   # starts on http://localhost:5000
```

Health check: open `http://localhost:5000/api/health` — you should see `"status": "ok"`.

### 4. Run frontend

```bash
# In a separate terminal, from repo root:
npm run dev   # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `localhost:5000` automatically.

### 5. Create an account

1. Open `http://localhost:5173`
2. Click **Sign Up** — register as a student
3. Log in as mentor at `/mentor-login` using the password from `backend/.env` → `MENTOR_MASTER_PASSWORD`
4. In the mentor dashboard, approve the student account
5. Log back in as the student

## Deployment

### Backend → Render

1. Push this repo to GitHub
2. Create a new **Web Service** on [render.com](https://render.com), connect your GitHub repo
3. Render auto-reads `render.yaml` — no manual config needed
4. In Render dashboard → Environment, add each `sync: false` variable from `render.yaml` with real values

### Frontend → Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Framework: **Vite** (auto-detected)
3. Add environment variable: `VITE_API_URL` = your Render service URL (e.g. `https://nextlevel-backend.onrender.com`)
4. Deploy

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Random 64-char hex string |
| `MENTOR_MASTER_PASSWORD` | Password for mentor login |
| `EMAIL_USER` | Gmail address for notifications |
| `EMAIL_PASS` | Gmail App Password (16 chars) |
| `MENTOR_EMAIL` | Email address to notify on new signups |
| `FRONTEND_URL` | Your Vercel URL (for CORS) |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Your Render backend URL |

## Project Structure

```
NEXTLEVEL/
├── src/
│   ├── pages/           # One file per route
│   ├── components/      # Shared UI components
│   │   ├── dashboard/   # Dashboard widgets
│   │   ├── mentor/      # Mentor-specific UI
│   │   ├── tracker/     # Progress tracker components
│   │   └── stories/     # Success stories feed
│   ├── context/         # AuthContext (JWT + axios defaults + socket)
│   ├── data/            # Static data (syllabus, flashcards, PYQs)
│   ├── hooks/           # useSocket
│   └── utils/           # api.js, socket.js, keepAlive.js
├── backend/
│   ├── controllers/     # Route handlers
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routers
│   ├── services/        # Email, cron, drive, syllabus data
│   └── server.js        # App entry point
├── render.yaml          # Render auto-deploy config
└── vercel.json          # Vercel routing config
```

## Testing

Smoke tests cover the auth flow (signup, login, `/me`, bad credentials, mentor
login), protected student/mentor endpoints (auth + role enforcement), and
state-changing write paths (study-report creation with persistence checks,
mentor approve/reject). 29 tests in total.

CI runs automatically on every push/PR via GitHub Actions:
`test.yml` boots the backend and runs the suite; `frontend-build.yml` runs `vite build`. They run black-box against a live backend using
Node's built-in test runner (no extra dependencies).

```bash
cd backend
npm run dev        # in one terminal (in-memory Mongo is fine)
npm test           # in another terminal
```

Point the tests at any environment with `BASE_URL`:

```bash
BASE_URL=https://your-api.onrender.com npm test
```
