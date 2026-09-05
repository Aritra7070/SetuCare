import { create } from 'zustand';
import api from '../api/axios';
import { applyLanguageFromUser } from '../i18n';

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: false,
  authChecking: true,
  error: null,

  clearError: () => set({ error: null }),

  /**
   * Check authenticated user session on app start
   */
  fetchMe: async () => {
    try {
      set({ authChecking: true, error: null });
      const res = await api.get('/auth/me');
      if (res.data.success && res.data.user) {
        set({ user: res.data.user, authChecking: false });
        applyLanguageFromUser(res.data.user); // Step 18 — snap language on session restore
      } else {
        set({ user: null, authChecking: false });
      }
    } catch (err) {
      // 401 on initial load simply means user is not logged in
      set({ user: null, authChecking: false });
    }
  },

  /**
   * User login
   */
  login: async (email, password) => {
    try {
      set({ loading: true, error: null });
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success && res.data.user) {
        set({ user: res.data.user, loading: false, error: null });
        applyLanguageFromUser(res.data.user); // Step 18
        return { success: true, user: res.data.user };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      set({ error: err.message, loading: false });
      return { success: false, message: err.message };
    }
  },

  /**
   * User registration
   */
  register: async (userData) => {
    try {
      set({ loading: true, error: null });
      const res = await api.post('/auth/register', userData);
      if (res.data.success && res.data.user) {
        set({ user: res.data.user, loading: false, error: null });
        applyLanguageFromUser(res.data.user); // Step 18
        return { success: true, user: res.data.user };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      set({ error: err.message, loading: false });
      return { success: false, message: err.message };
    }
  },

  /**
   * User logout
   */
  logout: async () => {
    try {
      set({ loading: true });
      await api.post('/auth/logout');
      set({ user: null, loading: false, error: null });
    } catch (err) {
      set({ user: null, loading: false });
    }
  },
}));
