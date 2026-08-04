import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { userFacingError } from '../utils/userFacingError';

const TOKEN_KEY = '@expenso_auth_token';
const USER_KEY = '@expenso_auth_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  role?: string;
  /** Notify partner when I add a joint expense (default true) */
  notifyPartnerOnMyJointAdd?: boolean;
  /** Notify me when partner adds a joint expense (default true) */
  notifyMeOnPartnerJointAdd?: boolean;
  /** After support temp password — force change */
  mustChangePassword?: boolean;
}

export type PasswordResetRequestView = {
  id: string;
  code: string;
  email: string;
  sameDevice: boolean;
  status: string;
  platform: string;
  messages: Array<{ role: string; message: string; createdAt: string }>;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string | null;
  tempPasswordSentAt?: string | null;
};

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
  updateNotificationPrefs: (prefs: {
    notifyPartnerOnMyJointAdd?: boolean;
    notifyMeOnPartnerJointAdd?: boolean;
  }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  requestPasswordReset: (
    email: string,
    note?: string,
  ) => Promise<{
    created: boolean;
    message: string;
    request?: PasswordResetRequestView;
  }>;
  fetchPasswordReset: (id: string) => Promise<PasswordResetRequestView>;
  verifyPasswordReset: (
    id: string,
    payload: { otp?: string; token?: string },
  ) => Promise<{ request: PasswordResetRequestView; message: string }>;
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
      const { getDeviceId, getDevicePlatform } = await import('../utils/deviceId');
      const deviceId = await getDeviceId();
      const data = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/register', {
        method: 'POST',
        body: { name, email, password, deviceId, platform: getDevicePlatform() },
      });
      await persistSession(data.token, data.user);
      set({ token: data.token, user: data.user, isBusy: false });
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t create your account. Please try again.'),
      });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isBusy: true, error: null });
    try {
      const { getDeviceId, getDevicePlatform } = await import('../utils/deviceId');
      const deviceId = await getDeviceId();
      const data = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: { email, password, deviceId, platform: getDevicePlatform() },
      });
      await persistSession(data.token, data.user);
      set({ token: data.token, user: data.user, isBusy: false });
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t sign you in. Please try again.'),
      });
      throw err;
    }
  },

  logout: async () => {
    const token = get().token;
    try {
      const { unregisterFcmTokenFromServer } = await import('../utils/pushNotifications');
      await unregisterFcmTokenFromServer(token);
    } catch {
      /* ignore */
    }
    try {
      const { clearWidgetSession } = await import('../utils/expenseWidget');
      clearWidgetSession();
    } catch {
      /* ignore */
    }
    await clearSession();
    set({ user: null, token: null, error: null });
    // Session stores cleared by App.tsx when user becomes null
  },

  deleteAccount: async () => {
    const token = get().token;
    if (!token) throw new Error('Please sign in again to continue.');
    set({ isBusy: true, error: null });
    try {
      await apiRequest('/api/auth/me', {
        method: 'DELETE',
        token,
        timeoutMs: 30000,
      });
      try {
        const { clearWidgetSession } = await import('../utils/expenseWidget');
        clearWidgetSession();
      } catch {
        /* ignore */
      }
      await clearSession();
      set({ user: null, token: null, isBusy: false, error: null });
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t delete your account. Please try again.'),
      });
      throw err;
    }
  },

  clearAllData: async () => {
    const token = get().token;
    if (!token) throw new Error('Please sign in again to continue.');
    set({ isBusy: true, error: null });
    try {
      await apiRequest('/api/auth/me/data', {
        method: 'DELETE',
        token,
        timeoutMs: 30000,
      });
      set({ isBusy: false, error: null });
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t clear your data. Please try again.'),
      });
      throw err;
    }
  },

  updateNotificationPrefs: async prefs => {
    const token = get().token;
    const prev = get().user;
    if (!token || !prev) throw new Error('Please sign in again to continue.');
    const optimistic: AuthUser = {
      ...prev,
      ...prefs,
    };
    set({ user: optimistic });
    try {
      const data = await apiRequest<{ user: AuthUser }>('/api/auth/me', {
        method: 'PATCH',
        token,
        body: prefs,
      });
      set({ user: data.user });
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch (err) {
      set({ user: prev });
      throw err;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const token = get().token;
    if (!token) throw new Error('Please sign in again to continue.');
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ user: AuthUser }>('/api/auth/change-password', {
        method: 'POST',
        token,
        body: { currentPassword, newPassword },
      });
      set({ user: data.user, isBusy: false });
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t update password. Please try again.'),
      });
      throw err;
    }
  },

  requestPasswordReset: async (email, note) => {
    set({ isBusy: true, error: null });
    try {
      const { getDeviceId, getDevicePlatform } = await import('../utils/deviceId');
      const deviceId = await getDeviceId();
      const data = await apiRequest<{
        ok: boolean;
        created: boolean;
        message: string;
        request?: PasswordResetRequestView;
      }>('/api/auth/password-reset/request', {
        method: 'POST',
        body: { email, deviceId, platform: getDevicePlatform(), note },
      });
      set({ isBusy: false });
      return { created: data.created, message: data.message, request: data.request };
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t submit reset request.'),
      });
      throw err;
    }
  },

  fetchPasswordReset: async id => {
    const { getDeviceId } = await import('../utils/deviceId');
    const deviceId = await getDeviceId();
    const data = await apiRequest<{ request: PasswordResetRequestView }>(
      `/api/auth/password-reset/${id}?deviceId=${encodeURIComponent(deviceId)}`,
    );
    return data.request;
  },

  verifyPasswordReset: async (id, payload) => {
    set({ isBusy: true, error: null });
    try {
      const { getDeviceId } = await import('../utils/deviceId');
      const deviceId = await getDeviceId();
      const data = await apiRequest<{ request: PasswordResetRequestView; message: string }>(
        `/api/auth/password-reset/${id}/verify`,
        {
          method: 'POST',
          body: { deviceId, ...payload },
        },
      );
      set({ isBusy: false });
      return data;
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Verification failed.'),
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
