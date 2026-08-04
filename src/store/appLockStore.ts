import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useAuthStore } from './authStore';

const lockEnabledKey = (userId: string) => `@expenso_app_lock_enabled_${userId}`;
const lockPinKey = (userId: string) => `@expenso_app_lock_pin_${userId}`;
const lockBioKey = (userId: string) => `@expenso_app_lock_bio_${userId}`;

interface AppLockStore {
  isLoaded: boolean;
  enabled: boolean;
  unlocked: boolean;
  hasPin: boolean;
  biometricEnabled: boolean;
  /** Ignore lockNow until this timestamp (biometric sheet can flicker AppState) */
  suppressLockUntil: number;
  load: (userId: string | null) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => void;
  beginBiometricPrompt: () => void;
  lockNow: () => void;
  clearForUser: (userId: string) => Promise<void>;
}

export const useAppLockStore = create<AppLockStore>((set, get) => ({
  isLoaded: false,
  enabled: false,
  unlocked: true,
  hasPin: false,
  biometricEnabled: false,
  suppressLockUntil: 0,

  load: async userId => {
    if (!userId) {
      set({
        isLoaded: true,
        enabled: false,
        unlocked: true,
        hasPin: false,
        biometricEnabled: false,
      });
      return;
    }
    try {
      const [en, pin, bio] = await Promise.all([
        AsyncStorage.getItem(lockEnabledKey(userId)),
        AsyncStorage.getItem(lockPinKey(userId)),
        AsyncStorage.getItem(lockBioKey(userId)),
      ]);
      const enabled = en === '1' && !!pin;
      const biometricEnabled = bio === '1' && enabled;
      set({
        isLoaded: true,
        enabled,
        hasPin: !!pin,
        biometricEnabled,
        unlocked: !enabled,
      });
    } catch {
      set({
        isLoaded: true,
        enabled: false,
        unlocked: true,
        hasPin: false,
        biometricEnabled: false,
      });
    }
  },

  setEnabled: async enabled => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    if (enabled && !get().hasPin) {
      throw new Error('Set a 4–8 digit PIN first.');
    }
    await AsyncStorage.setItem(lockEnabledKey(userId), enabled ? '1' : '0');
    if (!enabled) {
      await AsyncStorage.setItem(lockBioKey(userId), '0');
      set({ enabled: false, biometricEnabled: false, unlocked: true });
      return;
    }
    set({ enabled: true, unlocked: get().unlocked });
  },

  setPin: async pin => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const cleaned = pin.replace(/\D/g, '');
    if (cleaned.length < 4 || cleaned.length > 8) {
      throw new Error('PIN must be 4–8 digits.');
    }
    await AsyncStorage.setItem(lockPinKey(userId), cleaned);
    await AsyncStorage.setItem(lockEnabledKey(userId), '1');
    set({ hasPin: true, enabled: true, unlocked: true });
  },

  setBiometricEnabled: async enabled => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    if (enabled && !get().enabled) {
      throw new Error('Turn on App lock first, then try again.');
    }
    if (enabled && !get().hasPin) {
      throw new Error('Set a PIN first — it’s also used if fingerprint or Face ID fails.');
    }
    await AsyncStorage.setItem(lockBioKey(userId), enabled ? '1' : '0');
    set({ biometricEnabled: enabled });
  },

  unlock: async pin => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return false;
    const stored = await AsyncStorage.getItem(lockPinKey(userId));
    if (stored && stored === pin.replace(/\D/g, '')) {
      set({ unlocked: true });
      return true;
    }
    return false;
  },

  unlockWithBiometric: () => {
    if (get().enabled) {
      set({ unlocked: true, suppressLockUntil: Date.now() + 2500 });
    }
  },

  beginBiometricPrompt: () => {
    // Biometric sheet often pushes AppState to background on Android — suppress long enough.
    set({ suppressLockUntil: Date.now() + 45000 });
  },

  lockNow: () => {
    if (Date.now() < get().suppressLockUntil) return;
    if (get().enabled) set({ unlocked: false });
  },

  clearForUser: async userId => {
    await AsyncStorage.removeMany([
      lockEnabledKey(userId),
      lockPinKey(userId),
      lockBioKey(userId),
    ]);
    set({
      enabled: false,
      hasPin: false,
      biometricEnabled: false,
      unlocked: true,
    });
  },
}));
