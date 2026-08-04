import {
  resolveAppColors,
  ThemePackId,
  GradientStyleId,
  ChartPaletteId,
  AppColors,
  ThemeMode,
} from './themePacks';

export type { AppColors, ThemeMode };

/** Exact original dark palette (Default pack, no gradient mutation) */
export const darkColors: AppColors = resolveAppColors('ocean', 'dark', 'default', 'default');

/** Exact original light palette (Default pack, no gradient mutation) */
export const lightColors: AppColors = resolveAppColors('ocean', 'light', 'default', 'default');

export function getColors(
  mode: ThemeMode,
  packId: ThemePackId = 'ocean',
  gradientStyle: GradientStyleId = 'default',
  chartPalette: ChartPaletteId = 'default',
): AppColors {
  return resolveAppColors(packId, mode, gradientStyle, chartPalette);
}
