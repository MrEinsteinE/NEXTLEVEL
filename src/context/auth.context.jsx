import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { connectSocket, disconnectSocket } from '../utils/socket.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(false);

  useEffect(() => {
    // Auth now lives in an httpOnly cookie, which JS can't read — so we just ask
    // the server who we are (the cookie rides along via withCredentials). Purge
    // any legacy token left in localStorage by the pre-cookie version.
    try { localStorage.removeItem('token'); } catch (e) {}
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me'); // cookie auth
      setUser(response.data.user);
      // Cache only the non-secret profile (id/name/role/branch) for components and
      // the socket hook. The credential itself never leaves the httpOnly cookie.
      try { localStorage.setItem('user', JSON.stringify(response.data.user)); } catch (e) {}
      try { connectSocket(response.data.user); } catch (e) { console.warn('Socket connect failed', e); }
      setPendingApproval(response.data.user.status === 'pending');
    } catch (error) {
      try { localStorage.removeItem('user'); } catch (e) {}
      // A 401 here just means "not logged in" — nothing to surface.
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      // Server set an httpOnly auth cookie; we keep only the non-secret profile.
      try { localStorage.setItem('user', JSON.stringify(response.data.user)); } catch (e) {}
      setUser(response.data.user);
      try { connectSocket(response.data.user); } catch (e) { console.warn('Socket connect failed', e); }
      setPendingApproval(response.data.user.status === 'pending');
      return { success: true, user: response.data.user };
    } catch (error) {
      console.warn('AuthContext.login: login failed', error && error.response?.data?.message ? error.response.data.message : error && error.message ? error.message : error);
      return { success: false, error: error.response?.data?.message || 'Login failed', code: error.response?.data?.code };
    }
  };

  // Mentor login uses a dedicated endpoint but otherwise mirrors `login`: it must
  // set the in-memory `user` so the route guards let the mentor through without a reload.
  const mentorLogin = async (email, password) => {
    try {
      const response = await axios.post('/api/auth/mentor-login', { email, password });
      try { localStorage.setItem('user', JSON.stringify(response.data.user)); } catch (e) {}
      setUser(response.data.user);
      try { connectSocket(response.data.user); } catch (e) { console.warn('Socket connect failed', e); }
      setPendingApproval(false);
      return { success: true, user: response.data.user };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Invalid mentor credentials.' };
    }
  };

  const signup = async (userData) => {
    try {
      const response = await axios.post('/api/auth/signup', userData);
      // No auto-login: the user must verify their email and then log in. This is
      // why Login/Back stay reachable after creating an account.
      return { success: true, email: response.data.email, devCode: response.data.devCode };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Signup failed' };
    }
  };

  const logout = async () => {
    try { await axios.post('/api/auth/logout'); } catch (e) { /* ignore */ }
    try { disconnectSocket(); } catch (e) { /* ignore */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPendingApproval(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      pendingApproval,
      login,
      mentorLogin,
      signup,
      logout,
      fetchUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};