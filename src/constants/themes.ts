export type ThemeMode = 'light' | 'dark';

export interface AppColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  tabBar: string;
  tabBarBorder: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentWarm: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  /** Extra stop for animated water-gradient layers */
  gradientGlow: string;
  chartColors: string[];
  overlay: string;
}

/**
 * Dark — "Electric Twilight" (2026 top trend: indigo → sky → cyan + violet glow)
 * Used by leading fintech / AI-native apps for premium gradient-forward UI
 */
export const darkColors: AppColors = {
  background: '#070B14',
  surface: '#0F1623',
  surfaceElevated: '#151D2E',
  surfaceHighlight: '#1C2638',
  tabBar: 'rgba(15, 22, 35, 0.96)',
  tabBarBorder: 'rgba(14, 165, 233, 0.28)',
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4338CA',
  accent: '#06B6D4',
  accentWarm: '#A855F7',
  success: '#10B981',
  warning: '#FBBF24',
  danger: '#F87171',
  text: '#EEF2FF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E293B',
  gradientStart: '#4338CA',
  gradientMid: '#0EA5E9',
  gradientEnd: '#06B6D4',
  gradientGlow: '#A855F7',
  chartColors: ['#6366F1', '#0EA5E9', '#06B6D4', '#A855F7', '#10B981', '#F87171', '#38BDF8', '#F472B6'],
  overlay: 'rgba(7, 11, 20, 0.82)',
};

/** Light — soft indigo paper + vivid gradient heroes */
export const lightColors: AppColors = {
  background: '#F0F4FF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#EEF2FF',
  tabBar: 'rgba(255, 255, 255, 0.97)',
  tabBarBorder: 'rgba(99, 102, 241, 0.14)',
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primaryDark: '#4338CA',
  accent: '#0891B2',
  accentWarm: '#9333EA',
  success: '#059669',
  warning: '#D97706',
  danger: '#EF4444',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  gradientStart: '#4338CA',
  gradientMid: '#0284C7',
  gradientEnd: '#0891B2',
  gradientGlow: '#9333EA',
  chartColors: ['#4F46E5', '#0284C7', '#0891B2', '#9333EA', '#059669', '#EF4444', '#3B82F6', '#DB2777'],
  overlay: 'rgba(15, 23, 42, 0.42)',
};

export function getColors(mode: ThemeMode): AppColors {
  return mode === 'dark' ? darkColors : lightColors;
}
