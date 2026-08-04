import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { create } from 'zustand';
import { ThemeMode } from '../constants/themePacks';
import {
  AppearanceMode,
  ChartPaletteId,
  GradientStyleId,
  ThemePackId,
  isChartPaletteFree,
  isGradientStyleFree,
  isPackFree,
} from '../constants/themePacks';

const THEME_KEY = '@expensewise_theme';
const APPEARANCE_KEY = '@expensewise_appearance';
const PACK_KEY = '@expensewise_theme_pack';
const CHART_KEY = '@expensewise_chart_palette';
const GRADIENT_KEY = '@expensewise_gradient_style';

const DEFAULT_APPEARANCE: AppearanceMode = 'dark';
const DEFAULT_PACK: ThemePackId = 'ocean';
const DEFAULT_CHART: ChartPaletteId = 'default';
const DEFAULT_GRADIENT: GradientStyleId = 'default';

function resolveMode(appearance: AppearanceMode, system: ColorSchemeName | null | undefined): ThemeMode {
  if (appearance === 'system') {
    return system === 'light' ? 'light' : 'dark';
  }
  return appearance;
}

function parseChartPalette(saved: string | null): ChartPaletteId {
  if (saved === 'pastel' || saved === 'bold' || saved === 'colorblind' || saved === 'default') {
    return saved;
  }
  // Legacy id from before Default rename
  if (saved === 'classic') return 'default';
  return DEFAULT_CHART;
}

interface ThemeStore {
  appearance: AppearanceMode;
  /** Resolved light/dark used for colors */
  mode: ThemeMode;
  packId: ThemePackId;
  chartPalette: ChartPaletteId;
  gradientStyle: GradientStyleId;
  isLoaded: boolean;
  loadTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
  setAppearance: (appearance: AppearanceMode) => Promise<void>;
  setPackId: (packId: ThemePackId, allowPro: boolean) => Promise<boolean>;
  setChartPalette: (id: ChartPaletteId, allowPro: boolean) => Promise<boolean>;
  setGradientStyle: (id: GradientStyleId, allowPro: boolean) => Promise<boolean>;
  /** Restore pack + chart + gradient (+ appearance) to original Expenso defaults */
  resetToDefaults: () => Promise<void>;
  syncSystemAppearance: (scheme: ColorSchemeName | null | undefined) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  appearance: DEFAULT_APPEARANCE,
  mode: 'dark',
  packId: DEFAULT_PACK,
  chartPalette: DEFAULT_CHART,
  gradientStyle: DEFAULT_GRADIENT,
  isLoaded: false,

  loadTheme: async () => {
    try {
      const [savedMode, savedAppearance, savedPack, savedChart, savedGradient] =
        await Promise.all([
          AsyncStorage.getItem(THEME_KEY),
          AsyncStorage.getItem(APPEARANCE_KEY),
          AsyncStorage.getItem(PACK_KEY),
          AsyncStorage.getItem(CHART_KEY),
          AsyncStorage.getItem(GRADIENT_KEY),
        ]);

      let appearance: AppearanceMode = DEFAULT_APPEARANCE;
      if (savedAppearance === 'light' || savedAppearance === 'dark' || savedAppearance === 'system') {
        appearance = savedAppearance;
      } else if (savedMode === 'light' || savedMode === 'dark') {
        appearance = savedMode;
      }

      const packId: ThemePackId =
        savedPack &&
        [
          'ocean',
          'mint',
          'sunset',
          'royal',
          'rose',
          'lavender',
          'mono',
          'forest',
          'midnight_gold',
          'paper',
          'neon',
          'red_web_spider',
        ].includes(savedPack)
          ? (savedPack as ThemePackId)
          : DEFAULT_PACK;

      const chartPalette = parseChartPalette(savedChart);

      const gradientStyle: GradientStyleId =
        savedGradient === 'soft' ||
        savedGradient === 'bold' ||
        savedGradient === 'minimal' ||
        savedGradient === 'default'
          ? savedGradient
          : DEFAULT_GRADIENT;

      const mode = resolveMode(appearance, Appearance.getColorScheme());
      set({ appearance, mode, packId, chartPalette, gradientStyle, isLoaded: true });

      // One global listener for system appearance (not per useTheme mount)
      if (!(globalThis as any).__expensoAppearanceBound) {
        (globalThis as any).__expensoAppearanceBound = true;
        Appearance.addChangeListener(({ colorScheme }) => {
          useThemeStore.getState().syncSystemAppearance(colorScheme);
        });
      }
    } catch {
      set({
        appearance: DEFAULT_APPEARANCE,
        mode: 'dark',
        packId: DEFAULT_PACK,
        chartPalette: DEFAULT_CHART,
        gradientStyle: DEFAULT_GRADIENT,
        isLoaded: true,
      });
    }
  },

  setTheme: async mode => {
    await AsyncStorage.setItem(THEME_KEY, mode);
    await AsyncStorage.setItem(APPEARANCE_KEY, mode);
    set({ appearance: mode, mode });
  },

  setAppearance: async appearance => {
    const mode = resolveMode(appearance, Appearance.getColorScheme());
    await AsyncStorage.setItem(APPEARANCE_KEY, appearance);
    await AsyncStorage.setItem(THEME_KEY, mode);
    set({ appearance, mode });
  },

  toggleTheme: async () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    await get().setTheme(next);
  },

  setPackId: async (packId, allowPro) => {
    if (!isPackFree(packId) && !allowPro) return false;
    await AsyncStorage.setItem(PACK_KEY, packId);
    set({ packId });
    return true;
  },

  setChartPalette: async (id, allowPro) => {
    if (!isChartPaletteFree(id) && !allowPro) return false;
    await AsyncStorage.setItem(CHART_KEY, id);
    set({ chartPalette: id });
    return true;
  },

  setGradientStyle: async (id, allowPro) => {
    if (!isGradientStyleFree(id) && !allowPro) return false;
    await AsyncStorage.setItem(GRADIENT_KEY, id);
    set({ gradientStyle: id });
    return true;
  },

  resetToDefaults: async () => {
    const mode = resolveMode(DEFAULT_APPEARANCE, Appearance.getColorScheme());
    await Promise.all([
      AsyncStorage.setItem(APPEARANCE_KEY, DEFAULT_APPEARANCE),
      AsyncStorage.setItem(THEME_KEY, mode),
      AsyncStorage.setItem(PACK_KEY, DEFAULT_PACK),
      AsyncStorage.setItem(CHART_KEY, DEFAULT_CHART),
      AsyncStorage.setItem(GRADIENT_KEY, DEFAULT_GRADIENT),
    ]);
    set({
      appearance: DEFAULT_APPEARANCE,
      mode,
      packId: DEFAULT_PACK,
      chartPalette: DEFAULT_CHART,
      gradientStyle: DEFAULT_GRADIENT,
    });
  },

  syncSystemAppearance: scheme => {
    const { appearance } = get();
    if (appearance !== 'system') return;
    set({ mode: resolveMode('system', scheme) });
  },
}));
