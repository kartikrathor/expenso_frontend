import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import type { ThemePackId } from '../constants/themePacks';
import {
  AppIconKey,
  getNativeAppIcon,
  iconKeyToPackId,
  isAppIconSupported,
  packIdToIconKey,
  setNativeAppIcon,
} from '../native/appIcon';

const ICON_KEY = '@expensewise_app_icon';
const FOLLOW_KEY = '@expensewise_app_icon_follow_theme';

interface AppIconStore {
  iconPackId: ThemePackId;
  /** When true, choosing a color pack also updates the home-screen icon. */
  followTheme: boolean;
  loaded: boolean;
  supported: boolean;
  load: () => Promise<void>;
  setFollowTheme: (follow: boolean) => Promise<void>;
  /** Apply launcher icon for a theme pack (respects Pro gate via caller). */
  setIconForPack: (packId: ThemePackId) => Promise<boolean>;
  /** Sync icon when theme pack changes, if followTheme is on. */
  syncFromThemePack: (packId: ThemePackId) => Promise<void>;
}

export const useAppIconStore = create<AppIconStore>((set, get) => ({
  iconPackId: 'ocean',
  followTheme: true,
  loaded: false,
  supported: isAppIconSupported(),

  load: async () => {
    const supported = isAppIconSupported();
    try {
      const [savedIcon, savedFollow, nativeKey] = await Promise.all([
        AsyncStorage.getItem(ICON_KEY),
        AsyncStorage.getItem(FOLLOW_KEY),
        supported ? getNativeAppIcon() : Promise.resolve('Default' as AppIconKey),
      ]);
      const followTheme = savedFollow !== '0';
      let iconPackId: ThemePackId = 'ocean';
      if (savedIcon) {
        iconPackId = savedIcon as ThemePackId;
      } else if (nativeKey) {
        iconPackId = iconKeyToPackId(nativeKey);
      }
      set({ iconPackId, followTheme, loaded: true, supported });
    } catch {
      set({ loaded: true, supported });
    }
  },

  setFollowTheme: async follow => {
    await AsyncStorage.setItem(FOLLOW_KEY, follow ? '1' : '0');
    set({ followTheme: follow });
  },

  setIconForPack: async packId => {
    await AsyncStorage.setItem(ICON_KEY, packId);
    set({ iconPackId: packId, supported: isAppIconSupported() });
    // Always attempt native at call-time (don't trust stale supported flag)
    if (Platform.OS !== 'android') return false;
    return setNativeAppIcon(packIdToIconKey(packId));
  },

  syncFromThemePack: async packId => {
    if (!get().followTheme) return;
    await get().setIconForPack(packId);
  },
}));
