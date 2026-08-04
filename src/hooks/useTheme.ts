import { useMemo } from 'react';
import { getColors } from '../constants/themes';
import {
  getActionGradient,
  getActionGradientPoints,
  getGradientPoints,
} from '../constants/themePacks';
import { useThemeStore } from '../store/themeStore';

/**
 * Colors + theme state. Actions are read via getState() so components
 * that only need colors don't re-subscribe to every setter identity.
 * Appearance listener lives once in themeStore.loadTheme.
 */
export function useTheme() {
  const appearance = useThemeStore(s => s.appearance);
  const mode = useThemeStore(s => s.mode);
  const packId = useThemeStore(s => s.packId);
  const chartPalette = useThemeStore(s => s.chartPalette);
  const gradientStyle = useThemeStore(s => s.gradientStyle);

  const colors = useMemo(
    () => getColors(mode, packId, gradientStyle, chartPalette),
    [mode, packId, gradientStyle, chartPalette],
  );

  const gradientPoints = useMemo(() => {
    // Spidey suit stripe is always left→right red→navy on CTAs
    if (packId === 'red_web_spider') {
      return getActionGradientPoints(packId, gradientStyle);
    }
    return getGradientPoints(gradientStyle);
  }, [packId, gradientStyle]);

  const actionGradient = useMemo(
    () => getActionGradient(colors, packId),
    [colors, packId],
  );

  return {
    colors,
    mode,
    appearance,
    packId,
    chartPalette,
    gradientStyle,
    gradientPoints,
    /** Pack-aware CTA stops (2-stop default, 3-stop spider) */
    actionGradient,
    isDark: mode === 'dark',
    toggleTheme: useThemeStore.getState().toggleTheme,
    setTheme: useThemeStore.getState().setTheme,
    setAppearance: useThemeStore.getState().setAppearance,
    setPackId: useThemeStore.getState().setPackId,
    setChartPalette: useThemeStore.getState().setChartPalette,
    setGradientStyle: useThemeStore.getState().setGradientStyle,
    resetToDefaults: useThemeStore.getState().resetToDefaults,
  };
}
