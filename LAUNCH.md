# Launching NEXTLEVEL locally

Everything is pre-configured for local dev (in-memory database — no MongoDB setup needed).

## One-click

- **Windows:** double-click `start.bat`
- **macOS / Linux:** run `./start.sh`

The first run installs dependencies (~1 min), then opens the app at
**http://localhost:3000**. Two terminal windows stay open (backend + frontend);
close them to stop.

## Manual (two terminals)

```bash
# Terminal 1 — backend (http://localhost:5000)
cd backend
npm install
npm run dev

# Terminal 2 — frontend (http://localhost:3000)
npm install
npm run dev
```

## Try it

1. Open http://localhost:3000 → **Sign up** as a student (any email; pick a branch).
2. You'll land on a "pending approval" screen.
3. Open http://localhost:3000/mentor-login → log in with password **`mentor123`**
   (set in `backend/.env` as `MENTOR_MASTER_PASSWORD`).
4. In the mentor dashboard, **approve** your student.
5. Log back in as the student to see the full dashboard.

> The in-memory database resets on every backend restart. To keep data, paste a
> MongoDB Atlas connection string into `MONGODB_URI` in `backend/.env`.

## Run the tests

```bash
cd backend
npm run dev      # one terminal
npm test         # another terminal — 29 tests
```
