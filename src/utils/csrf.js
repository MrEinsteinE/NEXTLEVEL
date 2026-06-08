// CSRF double-submit helper. The backend issues a `csrfToken` cookie; every
// state-changing request must echo that value in the X-CSRF-Token header so the
// server can confirm the request came from our own app (not a forged cross-site
// request riding the auth cookie).
//
// IMPORTANT (cross-site deploys): when the frontend (e.g. *.vercel.app) and the
// backend (e.g. *.onrender.com) are on DIFFERENT domains, the browser's JS
// CANNOT read the backend-domain `csrfToken` cookie via document.cookie. So we
// fetch the token once from GET /api/csrf and cache it in memory. Same-origin /
// local dev still works via the readable cookie (the fallback below).
let _csrfToken = null;

export function setCsrfToken(t) { _csrfToken = t || null; }

export function getCsrfToken() {
  if (_csrfToken) return _csrfToken;
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

// Fetch + cache the token from the backend. Cross-site, this is the only way the
// frontend can learn the cookie's value. Non-fatal on failure.
export async function ensureCsrfToken(axiosInstance) {
  try {
    const res = await axiosInstance.get('/api/csrf');
    if (res && res.data && res.data.csrfToken) setCsrfToken(res.data.csrfToken);
  } catch (e) { /* mutations will surface a clear CSRF error if this never set */ }
  return _csrfToken;
}

export function attachCsrf(config) {
  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = getCsrfToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = token;
    }
  }
  return config;
}
