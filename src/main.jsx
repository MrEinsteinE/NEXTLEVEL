import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import { Toaster } from 'react-hot-toast'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'
import './index.css'
import './dark-theme.css'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { startKeepAlive } from './utils/keepAlive'
import { attachCsrf, ensureCsrfToken, getCsrfToken } from './utils/csrf.js'

// Register the service worker (PWA install + offline shell + web push). The fetch
// handler is network-first and only touches navigations, so it doesn't interfere
// with Vite HMR; registering in dev too lets push be tested locally.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Set globally so all relative `/api` calls route to the backend in production.
// If `VITE_API_URL` is missing or empty (frontend deployed without envs),
// fall back to the Render backend URL so the site remains functional.
{
  const rawUrl = import.meta.env.VITE_API_URL || '';
  const baseHost = (rawUrl && String(rawUrl).trim())
    ? String(rawUrl).replace(/\/api\/?$/i, '')
    : 'https://nextlevel-backend.onrender.com';
  axios.defaults.baseURL = baseHost;
  // Send the httpOnly auth cookie on every cross-origin request.
  axios.defaults.withCredentials = true;
  // Attach the CSRF token header to state-changing requests made via raw axios.
  axios.interceptors.request.use(attachCsrf);
  // Cross-site, the CSRF cookie lives on the backend domain and JS can't read it,
  // so fetch + cache the token now (shared with the `api` axios instance too).
  ensureCsrfToken(axios);
  // Self-heal: if a mutation is rejected for a missing/stale CSRF token, refresh
  // the token and retry the request once (covers cold-start / race conditions).
  axios.interceptors.response.use(
    (r) => r,
    async (error) => {
      const cfg = error.config;
      const status = error.response && error.response.status;
      const msg = (error.response && error.response.data && error.response.data.message) || '';
      if (status === 403 && /csrf/i.test(msg) && cfg && !cfg._csrfRetried) {
        cfg._csrfRetried = true;
        await ensureCsrfToken(axios);
        const t = getCsrfToken();
        if (t) { cfg.headers = cfg.headers || {}; cfg.headers['X-CSRF-Token'] = t; }
        return axios(cfg);
      }
      return Promise.reject(error);
    }
  );
}

// Initialize theme from localStorage so UI matches user's preference on load
try {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
} catch (e) {
  // ignore (e.g., during server-side rendering or restricted environments)
}

// Disable the browser right-click context menu site-wide (product requirement).
// Note: this is a deterrent, not real protection — content is still accessible
// via devtools/view-source. Real security lives on the backend.
try {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
} catch (e) { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
    {/* Start periodic keep-alive pings to prevent Render free-tier from sleeping */}
    {typeof window !== 'undefined' && startKeepAlive()}
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-bg-card)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          fontSize: '0.875rem',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
        }
      }}
    />
  </React.StrictMode>
)
