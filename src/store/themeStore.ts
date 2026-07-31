import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { ThemeMode } from '../constants/themes';

const THEME_KEY = '@expensewise_theme';

interface ThemeStore {
  mode: ThemeMode;
  isLoaded: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: 'dark',
  isLoaded: false,

  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      const mode: ThemeMode = saved === 'light' || saved === 'dark' ? saved : 'dark';
      set({ mode, isLoaded: true });
    } catch {
      set({ mode: 'dark', isLoaded: true });
    }
  },

  setTheme: async (mode) => {
    await AsyncStorage.setItem(THEME_KEY, mode);
    set({ mode });
  },

  toggleTheme: async () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    await get().setTheme(next);
  },
}));
