import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiRequest } from '../services/api';

const TOKEN_KEY = '@expenso_auth_token';
const USER_KEY = '@expenso_auth_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoaded: boolean;
  isBusy: boolean;
  error: string | null;
  loadAuth: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Wipe expenses / cloud personal data — keeps login */
  clearAllData: () => Promise<void>;
  clearError: () => void;
}

async function persistSession(token: string, user: AuthUser) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

async function clearSession() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isLoaded: false,
  isBusy: false,
  error: null,

  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const userRaw = await AsyncStorage.getItem(USER_KEY);
      if (token && userRaw) {
        set({ token, user: JSON.parse(userRaw), isLoaded: true });
        try {
          const data = await apiRequest<{ user: AuthUser }>('/api/auth/me', { token });
          set({ user: data.user });
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
        } catch {
          // token may be expired — keep cached until next login fails
        }
        return;
      }
      set({ user: null, token: null, isLoaded: true });
    } catch {
      set({ user: null, token: null, isLoaded: true });
    }
  },

  register: async (name, email, password) => {
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: { name, email, password },
      });
      await persistSession(data.token, data.user);
      set({ token: data.token, user: data.user, isBusy: false });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Registration failed' });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await persistSession(data.token, data.user);
      set({ token: data.token, user: data.user, isBusy: false });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Login failed' });
      throw err;
    }
  },

  logout: async () => {
    await clearSession();
    set({ user: null, token: null, error: null });
    // Session stores cleared by App.tsx when user becomes null
  },

  deleteAccount: async () => {
    const token = get().token;
    if (!token) throw new Error('Not logged in');
    set({ isBusy: true, error: null });
    try {
      await apiRequest('/api/auth/me', {
        method: 'DELETE',
        token,
        timeoutMs: 30000,
      });
      await clearSession();
      set({ user: null, token: null, isBusy: false, error: null });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not delete account' });
      throw err;
    }
  },

  clearAllData: async () => {
    const token = get().token;
    if (!token) throw new Error('Not logged in');
    set({ isBusy: true, error: null });
    try {
      await apiRequest('/api/auth/me/data', {
        method: 'DELETE',
        token,
        timeoutMs: 30000,
      });
      set({ isBusy: false, error: null });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not clear data' });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
