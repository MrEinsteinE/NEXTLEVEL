# Email Verification + Signup Flow — Design Spec

**Date:** 2026-06-02
**Status:** Approved (pending spec review)

## Problem

Three issues with the current signup/auth flow:

1. **Back button is broken after signup.** Signup auto-logs the user in (a side
   effect of an earlier redirect fix), so pressing Back lands on `/login`, which
   `<PublicRoute>` immediately redirects away from. Login is effectively
   unreachable after creating an account.
2. **No password confirmation** on the signup form — typos create accounts with
   an unintended password.
3. **No email verification** — accounts are created for unverified addresses.

## Goals

- After signup, the user is **not** auto-logged-in; they land on a public
  "Verify your email" screen, and Login/Back work normally.
- Signup form has a **Confirm Password** field (must match, min 8 chars).
- Email ownership is verified via a **6-digit code** before login is allowed.
- Real email sending via Gmail in production; **testable in dev without email**
  (code surfaced in the server console and API response).

## Non-Goals

- Building a forgot-password/reset flow (the `resetPasswordToken` fields on the
  `User` model are a pre-existing unused stub; out of scope here).
- Changing the mentor master-password login (mentors are auto-verified).
- Phone/SMS verification.

## End-to-End Flow

```
Signup form (name, email, password, confirm password, branch)
  → POST /api/auth/signup
      • creates user { emailVerified:false }, generates+hashes a 6-digit code
      • sends verification email (or mocks to console in dev)
      • returns { success, email }  (+ devCode when email not configured / non-prod)
      • NO auth token (user is not logged in)
  → redirect to /verify-email?email=...   (public page)
      → user enters code → POST /api/auth/verify-email { email, code }
          • validates code hash + expiry + attempt cap
          • sets emailVerified:true, clears code fields
          • sends the mentor "new student" notification NOW
          • returns { success }
      → redirect to /login  (toast: "Email verified — please log in")
  → login succeeds → /pending-approval → (mentor approves) → /dashboard
```

Login of an unverified student returns `403 { code: 'EMAIL_NOT_VERIFIED' }`; the
Login page surfaces a link to resend/verify.

## Data Model — additions to `User` (backend/models/User.js)

```js
emailVerified:      { type: Boolean, default: false },
emailVerifyCodeHash: String,        // bcrypt/sha256 hash of the 6-digit code (never plaintext)
emailVerifyExpire:   Date,          // now + 15 min
emailVerifyAttempts: { type: Number, default: 0 },  // cap at 5, then force resend
```

- Code: 6 numeric digits, hashed before storage, **15-minute** expiry, **5**
  verify attempts before a resend is required.
- **Mentor** accounts (created in `mentorLogin`) are created with
  `emailVerified: true`.
- **Dev seed** student (`services/devSeed.js`) is created with
  `emailVerified: true` so the local quick-login still works.
- **Backward compatibility:** the login gate checks `emailVerified === false`
  (explicit). Legacy users created before this feature have the field
  `undefined` and are therefore **not** locked out.

## Backend

All routes live under `/api/auth`, which is already wrapped by `authLimiter`
(30 requests / 15 min). New behavior in `controllers/authController.js` and one
new route file section in `routes/auth.js`.

### `signup` (modified)
- Validate fields + password length (≥ 8, unchanged).
- Create user with `emailVerified: false`.
- Generate a 6-digit code, store its hash + `emailVerifyExpire` + reset attempts.
- Send verification email (`emailService.sendVerificationEmail`); falls back to
  console `[MOCK]` log when no transporter.
- Response: `201 { success:true, email }`. Additionally include
  `devCode: '<code>'` **only when** the transporter is null OR
  `NODE_ENV !== 'production'` (dev/test convenience; never in configured prod).
- **No auth token** is returned.
- The mentor notification is **moved out** of signup (now sent on verify).

### `POST /verify-email` (new)
- Body `{ email, code }`.
- Look up user by email. If already verified → `200 { success:true, alreadyVerified:true }`.
- If `emailVerifyExpire` passed or attempts ≥ 5 → `400` ("code expired / too many attempts, please resend").
- Compare `code` against stored hash; on mismatch increment attempts → `400`.
- On match: set `emailVerified:true`, clear `emailVerifyCodeHash` / `emailVerifyExpire` / attempts, then call `sendMentorNotification(...)`.
- Response `200 { success:true }`.

### `POST /resend-verification` (new)
- Body `{ email }`.
- If user not found or already verified → respond `200` generically (don't leak which emails are registered/verified).
- Enforce a **60-second cooldown** (derived from when the current code was issued — store issue time or infer from `emailVerifyExpire − 15min`).
- Regenerate code, reset expiry + attempts, resend email.
- Response `200 { success:true }` (+ `devCode` under the same dev/test condition as signup).

### `login` (modified)
- After the password check, if `user.role === 'student' && user.emailVerified === false`:
  return `403 { error:true, code:'EMAIL_NOT_VERIFIED', message:'Please verify your email before logging in.' }`.

### Email service (backend/services/emailService.js)
- Add `sendVerificationEmail({ name, email, code })` mirroring the existing
  templated emails; mocks to console when no transporter (logs the code in dev).

## Frontend

- **AuthContext (`context/auth.context.jsx`):** revert `signup` to **not**
  set `user`/token/socket. It POSTs and returns `{ success, email, devCode }`.
  This is the actual back-button fix. (`login`/`mentorLogin` unchanged.)
- **Signup.jsx:** add a **Confirm Password** field; validate `password === confirm`
  and length ≥ 8 client-side; on success `navigate('/verify-email', { state:{ email, devCode } })`.
- **VerifyEmail.jsx (new, public):** reads email from router state/query, shows a
  6-digit code input, **Verify** button → `POST /verify-email`; **Resend** link
  with a 60s cooldown; in dev shows the `devCode` to ease testing. On success →
  `navigate('/login')` with a success toast.
- **Login.jsx:** on `403 EMAIL_NOT_VERIFIED`, show the message plus a link to
  `/verify-email?email=<entered email>` (and offer resend).
- **App.jsx:** add a plain public route `path="/verify-email"` (not wrapped in
  `PrivateRoute`/`PublicRoute`, since the user is not authenticated at this point).
- Reuse the existing `Auth.css` styling (label/input + card) for the verify page.

## Email Configuration (Gmail) — setup guide for the user

1. Enable 2-Step Verification on the Google account.
2. Google Account → Security → **App passwords** → generate one for "Mail".
3. In `backend/.env` set `EMAIL_USER=<the gmail address>` and
   `EMAIL_PASS=<16-char app password>`. Set the same in the Render dashboard for
   production.
4. Until configured, dev shows the code in the server console and the API
   response, so the flow is fully testable without a mailbox.

## Security Notes

- Verification codes are **hashed at rest**, expire in 15 min, and are
  attempt-capped (brute-force defense alongside the existing rate limiter).
- `devCode` is exposed **only** when email isn't configured or `NODE_ENV !==
  'production'` — never in a configured production environment.
- `resend-verification` returns a generic success to avoid user-enumeration.

## Testing Impact

This changes the auth contract, so the black-box smoke tests must be updated:

- **Shared helper:** signing up no longer yields a usable token. The test helper
  becomes **signup → read `devCode` → POST /verify-email → login** to obtain a
  token. `writes.test.js` and `protected.test.js` use this helper.
- **auth.test.js updates:**
  - "signup succeeds" → assert `201`, `success:true`, `email` present, **no token**, and `devCode` present (test env).
  - "login succeeds" → must verify first; add a "login before verify is rejected (403 EMAIL_NOT_VERIFIED)" case.
- **New tests (~5):** verify with wrong code (400), verify with correct code
  (200), login blocked before verify (403), login allowed after verify (200),
  resend returns success.

Target: all existing assertions adjusted + new cases green via
`cd backend && npm test` against a running in-memory backend, and the GitHub
Actions `test.yml` workflow.

## Rollout / Ordering

1. Backend: model fields → emailService → authController (signup/verify/resend/login) → routes.
2. Frontend: AuthContext.signup → VerifyEmail page + route → Signup confirm-password → Login 403 handling.
3. Update + extend smoke tests; run suite.
4. Verify end-to-end in the browser (signup → verify via devCode → login → pending).
5. Document Gmail setup; user configures creds for prod.
