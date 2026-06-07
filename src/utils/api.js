import axios from 'axios';
import toast from 'react-hot-toast';
import { attachCsrf } from './csrf.js';

// Normalize base host: strip any trailing `/api` so callers can use `/api/...` paths
const rawUrl = import.meta.env.VITE_API_URL || '';
// Default to the canonical Render backend hostname if Vite envs are missing.
const baseHost = (rawUrl && String(rawUrl).trim())
  ? String(rawUrl).replace(/\/api\/?$/i, '')
  : 'https://nextlevel-5uju.onrender.com';

const api = axios.create({
  baseURL: baseHost,
  withCredentials: true // send the httpOnly auth cookie
});

// Attach the CSRF token header to state-changing requests.
api.interceptors.request.use(attachCsrf);

api.interceptors.response.use((res) => res, (err) => {
  if (!err.response) {
    toast.error('Connection error. Check your internet.');
    return Promise.reject(err);
  }
  if (err.response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  const msg = err.response?.data?.message || 'Something went wrong. Please try again.';
  toast.error(msg);
  return Promise.reject(err);
});

export default api;
