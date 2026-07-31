export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Typography = {
  hero: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyBold: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  small: { fontSize: 11, fontWeight: '500' as const },
};

/** @deprecated Use useTheme().colors instead */
export const Colors = {
  background: '#070B14',
  surface: '#0F1623',
  surfaceElevated: '#151D2E',
  surfaceHighlight: '#1C2638',
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
  chartColors: ['#6366F1', '#0EA5E9', '#06B6D4', '#A855F7', '#10B981', '#F87171', '#38BDF8', '#F472B6'],
};
