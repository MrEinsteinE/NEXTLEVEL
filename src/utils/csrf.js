// CSRF double-submit helper. The backend issues a readable `csrfToken` cookie;
// we echo it in the X-CSRF-Token header on every state-changing request so the
// server can confirm the request came from our own origin (not a forged
// cross-site request riding the auth cookie).
export function getCsrfToken() {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
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
