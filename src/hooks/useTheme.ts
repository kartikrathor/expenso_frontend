import { useMemo } from 'react';
import { getColors } from '../constants/themes';
import { useThemeStore } from '../store/themeStore';

export function useTheme() {
  const mode = useThemeStore(s => s.mode);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const setTheme = useThemeStore(s => s.setTheme);

  const colors = useMemo(() => getColors(mode), [mode]);

  return {
    colors,
    mode,
    isDark: mode === 'dark',
    toggleTheme,
    setTheme,
  };
}
