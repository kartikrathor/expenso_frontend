import { CATEGORY_CHART_COLORS } from './categories';

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

export type ThemePackId =
  | 'ocean'
  | 'mint'
  | 'sunset'
  | 'royal'
  | 'rose'
  | 'lavender'
  | 'mono'
  | 'forest'
  | 'midnight_gold'
  | 'paper'
  | 'neon'
  | 'red_web_spider';

export type ChartPaletteId = 'default' | 'pastel' | 'bold' | 'colorblind';

export type GradientStyleId = 'default' | 'soft' | 'bold' | 'minimal';

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface ThemePackMeta {
  id: ThemePackId;
  name: string;
  subtitle: string;
  /** Swatch for picker (primary-ish) */
  swatch: string;
  swatchAlt: string;
  pro: boolean;
}

export const THEME_PACKS: ThemePackMeta[] = [
  {
    id: 'ocean',
    name: 'Default',
    subtitle: 'Original Expenso look',
    swatch: '#6366F1',
    swatchAlt: '#06B6D4',
    pro: false,
  },
  {
    id: 'mint',
    name: 'Mint Money',
    subtitle: 'Savings green',
    swatch: '#059669',
    swatchAlt: '#14B8A6',
    pro: true,
  },
  {
    id: 'sunset',
    name: 'Sunset UPI',
    subtitle: 'Warm coral glow',
    swatch: '#EA580C',
    swatchAlt: '#F43F5E',
    pro: true,
  },
  {
    id: 'royal',
    name: 'Royal',
    subtitle: 'Deep blue & gold',
    swatch: '#1D4ED8',
    swatchAlt: '#D97706',
    pro: true,
  },
  {
    id: 'rose',
    name: 'Rose',
    subtitle: 'Soft pink accents',
    swatch: '#DB2777',
    swatchAlt: '#E879F9',
    pro: true,
  },
  {
    id: 'lavender',
    name: 'Lavender',
    subtitle: 'Soft lilac haze',
    swatch: '#B8A9D9',
    swatchAlt: '#E4DCF5',
    pro: true,
  },
  {
    id: 'mono',
    name: 'Mono',
    subtitle: 'Minimal grayscale',
    swatch: '#525252',
    swatchAlt: '#A3A3A3',
    pro: true,
  },
  {
    id: 'forest',
    name: 'Forest Calm',
    subtitle: 'Soft greens',
    swatch: '#166534',
    swatchAlt: '#4ADE80',
    pro: true,
  },
  {
    id: 'midnight_gold',
    name: 'Midnight Gold',
    subtitle: 'Dark + warm gold',
    swatch: '#B45309',
    swatchAlt: '#FBBF24',
    pro: true,
  },
  {
    id: 'paper',
    name: 'Paper Ledger',
    subtitle: 'Cream & ink',
    swatch: '#44403C',
    swatchAlt: '#B45309',
    pro: true,
  },
  {
    id: 'neon',
    name: 'Neon Spend',
    subtitle: 'Bold chart vibes',
    swatch: '#22D3EE',
    swatchAlt: '#E879F9',
    pro: true,
  },
  {
    id: 'red_web_spider',
    name: 'Red Web Spider',
    subtitle: 'Crimson silk & navy web',
    swatch: '#DC2626',
    swatchAlt: '#1E3A8A',
    pro: true,
  },
];

export const CHART_PALETTES: {
  id: ChartPaletteId;
  name: string;
  subtitle: string;
  pro: boolean;
  preview: string[];
}[] = [
  {
    id: 'default',
    name: 'Default',
    subtitle: 'Original category colors',
    pro: false,
    preview: ['#F472B6', '#10B981', '#818CF8', '#38BDF8'],
  },
  {
    id: 'pastel',
    name: 'Pastel',
    subtitle: 'Soft & easy on eyes',
    pro: true,
    preview: ['#A5B4FC', '#7DD3FC', '#6EE7B7', '#F9A8D4'],
  },
  {
    id: 'bold',
    name: 'Bold',
    subtitle: 'High-energy pops',
    pro: true,
    preview: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'],
  },
  {
    id: 'colorblind',
    name: 'Colorblind-safe',
    subtitle: 'Clear for everyone',
    pro: true,
    preview: ['#0077BB', '#EE7733', '#009988', '#CC3311'],
  },
];

export const GRADIENT_STYLES: {
  id: GradientStyleId;
  name: string;
  subtitle: string;
  pro: boolean;
}[] = [
  { id: 'default', name: 'Default', subtitle: 'Exact original look', pro: false },
  { id: 'soft', name: 'Soft wash', subtitle: 'Gentle hero glow', pro: true },
  { id: 'bold', name: 'Bold diagonal', subtitle: 'Strong presence', pro: true },
  { id: 'minimal', name: 'Minimal', subtitle: 'Almost flat', pro: true },
];

const FREE_PACK: ThemePackId = 'ocean';

function packPair(light: AppColors, dark: AppColors): Record<ThemeMode, AppColors> {
  return { light, dark };
}

/** Ocean — current Electric Twilight (free) */
const ocean = packPair(
  {
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
  },
  {
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
  },
);

const mint = packPair(
  {
    background: '#F0FDFA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#CCFBF1',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(13, 148, 136, 0.18)',
    primary: '#0D9488',
    primaryLight: '#14B8A6',
    primaryDark: '#0F766E',
    accent: '#059669',
    accentWarm: '#10B981',
    success: '#059669',
    warning: '#D97706',
    danger: '#EF4444',
    text: '#134E4A',
    textSecondary: '#3F6863',
    textMuted: '#94A3B8',
    border: '#CCFBF1',
    gradientStart: '#0F766E',
    gradientMid: '#0D9488',
    gradientEnd: '#14B8A6',
    gradientGlow: '#34D399',
    chartColors: ['#0D9488', '#059669', '#14B8A6', '#34D399', '#2DD4BF', '#F59E0B', '#EF4444', '#6366F1'],
    overlay: 'rgba(19, 78, 74, 0.42)',
  },
  {
    background: '#042F2E',
    surface: '#0B3D3A',
    surfaceElevated: '#115E59',
    surfaceHighlight: '#134E4A',
    tabBar: 'rgba(11, 61, 58, 0.96)',
    tabBarBorder: 'rgba(45, 212, 191, 0.28)',
    primary: '#2DD4BF',
    primaryLight: '#5EEAD4',
    primaryDark: '#14B8A6',
    accent: '#34D399',
    accentWarm: '#6EE7B7',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    text: '#ECFDF5',
    textSecondary: '#99F6E4',
    textMuted: '#5EEAD4',
    border: '#115E59',
    gradientStart: '#0F766E',
    gradientMid: '#14B8A6',
    gradientEnd: '#2DD4BF',
    gradientGlow: '#6EE7B7',
    chartColors: ['#2DD4BF', '#34D399', '#14B8A6', '#5EEAD4', '#FBBF24', '#F87171', '#67E8F9', '#A78BFA'],
    overlay: 'rgba(4, 47, 46, 0.82)',
  },
);

const sunset = packPair(
  {
    background: '#FFF7ED',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#FFEDD5',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(234, 88, 12, 0.16)',
    primary: '#EA580C',
    primaryLight: '#F97316',
    primaryDark: '#C2410C',
    accent: '#F43F5E',
    accentWarm: '#FB7185',
    success: '#059669',
    warning: '#D97706',
    danger: '#E11D48',
    text: '#431407',
    textSecondary: '#9A3412',
    textMuted: '#A8A29E',
    border: '#FED7AA',
    gradientStart: '#C2410C',
    gradientMid: '#EA580C',
    gradientEnd: '#F43F5E',
    gradientGlow: '#FB923C',
    chartColors: ['#EA580C', '#F43F5E', '#F97316', '#FB7185', '#FBBF24', '#059669', '#6366F1', '#0EA5E9'],
    overlay: 'rgba(67, 20, 7, 0.42)',
  },
  {
    background: '#1C0A05',
    surface: '#2A1008',
    surfaceElevated: '#3B160C',
    surfaceHighlight: '#4C1D0F',
    tabBar: 'rgba(42, 16, 8, 0.96)',
    tabBarBorder: 'rgba(251, 146, 60, 0.3)',
    primary: '#FB923C',
    primaryLight: '#FDBA74',
    primaryDark: '#F97316',
    accent: '#FB7185',
    accentWarm: '#FDA4AF',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#FB7185',
    text: '#FFF7ED',
    textSecondary: '#FDBA74',
    textMuted: '#A8A29E',
    border: '#431407',
    gradientStart: '#C2410C',
    gradientMid: '#F97316',
    gradientEnd: '#FB7185',
    gradientGlow: '#FBBF24',
    chartColors: ['#FB923C', '#FB7185', '#FDBA74', '#FBBF24', '#34D399', '#38BDF8', '#C084FC', '#F472B6'],
    overlay: 'rgba(28, 10, 5, 0.82)',
  },
);

const royal = packPair(
  {
    background: '#EFF6FF',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#DBEAFE',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(29, 78, 216, 0.14)',
    primary: '#1D4ED8',
    primaryLight: '#3B82F6',
    primaryDark: '#1E40AF',
    accent: '#D97706',
    accentWarm: '#F59E0B',
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
    text: '#1E3A8A',
    textSecondary: '#1E40AF',
    textMuted: '#94A3B8',
    border: '#BFDBFE',
    gradientStart: '#1E3A8A',
    gradientMid: '#1D4ED8',
    gradientEnd: '#D97706',
    gradientGlow: '#FBBF24',
    chartColors: ['#1D4ED8', '#D97706', '#3B82F6', '#F59E0B', '#059669', '#DC2626', '#6366F1', '#0EA5E9'],
    overlay: 'rgba(30, 58, 138, 0.42)',
  },
  {
    background: '#070F24',
    surface: '#0C1836',
    surfaceElevated: '#132447',
    surfaceHighlight: '#1A2F55',
    tabBar: 'rgba(12, 24, 54, 0.96)',
    tabBarBorder: 'rgba(251, 191, 36, 0.28)',
    primary: '#60A5FA',
    primaryLight: '#93C5FD',
    primaryDark: '#3B82F6',
    accent: '#FBBF24',
    accentWarm: '#F59E0B',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    text: '#EFF6FF',
    textSecondary: '#93C5FD',
    textMuted: '#64748B',
    border: '#1E3A5F',
    gradientStart: '#1E40AF',
    gradientMid: '#3B82F6',
    gradientEnd: '#F59E0B',
    gradientGlow: '#FBBF24',
    chartColors: ['#60A5FA', '#FBBF24', '#93C5FD', '#F59E0B', '#34D399', '#F87171', '#A78BFA', '#38BDF8'],
    overlay: 'rgba(7, 15, 36, 0.82)',
  },
);

const rose = packPair(
  {
    background: '#FDF2F8',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#FCE7F3',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(219, 39, 119, 0.14)',
    primary: '#DB2777',
    primaryLight: '#EC4899',
    primaryDark: '#BE185D',
    accent: '#A855F7',
    accentWarm: '#E879F9',
    success: '#059669',
    warning: '#D97706',
    danger: '#E11D48',
    text: '#831843',
    textSecondary: '#9D174D',
    textMuted: '#A8A29E',
    border: '#FBCFE8',
    gradientStart: '#BE185D',
    gradientMid: '#DB2777',
    gradientEnd: '#A855F7',
    gradientGlow: '#E879F9',
    chartColors: ['#DB2777', '#A855F7', '#EC4899', '#E879F9', '#F472B6', '#059669', '#0EA5E9', '#F59E0B'],
    overlay: 'rgba(131, 24, 67, 0.42)',
  },
  {
    background: '#1A0612',
    surface: '#2A0B1C',
    surfaceElevated: '#3B1028',
    surfaceHighlight: '#4C1534',
    tabBar: 'rgba(42, 11, 28, 0.96)',
    tabBarBorder: 'rgba(244, 114, 182, 0.3)',
    primary: '#F472B6',
    primaryLight: '#F9A8D4',
    primaryDark: '#EC4899',
    accent: '#E879F9',
    accentWarm: '#D8B4FE',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#FB7185',
    text: '#FDF2F8',
    textSecondary: '#F9A8D4',
    textMuted: '#9F7A8E',
    border: '#4C1534',
    gradientStart: '#BE185D',
    gradientMid: '#EC4899',
    gradientEnd: '#C084FC',
    gradientGlow: '#F9A8D4',
    chartColors: ['#F472B6', '#E879F9', '#F9A8D4', '#C084FC', '#34D399', '#38BDF8', '#FBBF24', '#FB7185'],
    overlay: 'rgba(26, 6, 18, 0.82)',
  },
);

const lavender = packPair(
  {
    background: '#F8F5FC',
    surface: '#FFFCFF',
    surfaceElevated: '#FFFCFF',
    surfaceHighlight: '#EEE8F7',
    tabBar: 'rgba(255, 252, 255, 0.97)',
    tabBarBorder: 'rgba(184, 169, 217, 0.28)',
    primary: '#9B8EC4',
    primaryLight: '#B8A9D9',
    primaryDark: '#7E6FA8',
    accent: '#C9B8E8',
    accentWarm: '#D9CCEF',
    success: '#059669',
    warning: '#D97706',
    danger: '#EF4444',
    text: '#3D3554',
    textSecondary: '#6B5F86',
    textMuted: '#A89EB8',
    border: '#E4DCF5',
    gradientStart: '#A89BCF',
    gradientMid: '#C4B5E0',
    gradientEnd: '#D9CCEF',
    gradientGlow: '#EDE6F8',
    chartColors: ['#9B8EC4', '#B8A9D9', '#C9B8E8', '#D9CCEF', '#059669', '#EF4444', '#7DD3FC', '#F9A8D4'],
    overlay: 'rgba(61, 53, 84, 0.38)',
  },
  {
    background: '#12101A',
    surface: '#1C1826',
    surfaceElevated: '#262032',
    surfaceHighlight: '#302A3E',
    tabBar: 'rgba(28, 24, 38, 0.96)',
    tabBarBorder: 'rgba(201, 184, 232, 0.24)',
    primary: '#C9B8E8',
    primaryLight: '#D9CCEF',
    primaryDark: '#B8A9D9',
    accent: '#D9CCEF',
    accentWarm: '#EDE6F8',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    text: '#F5F2FA',
    textSecondary: '#C9B8E8',
    textMuted: '#8A7F9E',
    border: '#3A3348',
    gradientStart: '#7E6FA8',
    gradientMid: '#A89BCF',
    gradientEnd: '#C9B8E8',
    gradientGlow: '#EDE6F8',
    chartColors: ['#C9B8E8', '#D9CCEF', '#B8A9D9', '#EDE6F8', '#34D399', '#F87171', '#7DD3FC', '#F9A8D4'],
    overlay: 'rgba(18, 16, 26, 0.82)',
  },
);

const mono = packPair(
  {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#F5F5F5',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(82, 82, 82, 0.14)',
    primary: '#404040',
    primaryLight: '#525252',
    primaryDark: '#262626',
    accent: '#737373',
    accentWarm: '#A3A3A3',
    success: '#16A34A',
    warning: '#CA8A04',
    danger: '#DC2626',
    text: '#171717',
    textSecondary: '#525252',
    textMuted: '#A3A3A3',
    border: '#E5E5E5',
    gradientStart: '#262626',
    gradientMid: '#525252',
    gradientEnd: '#A3A3A3',
    gradientGlow: '#D4D4D4',
    chartColors: ['#404040', '#737373', '#A3A3A3', '#525252', '#16A34A', '#DC2626', '#2563EB', '#CA8A04'],
    overlay: 'rgba(23, 23, 23, 0.42)',
  },
  {
    background: '#0A0A0A',
    surface: '#171717',
    surfaceElevated: '#262626',
    surfaceHighlight: '#303030',
    tabBar: 'rgba(23, 23, 23, 0.96)',
    tabBarBorder: 'rgba(163, 163, 163, 0.22)',
    primary: '#E5E5E5',
    primaryLight: '#F5F5F5',
    primaryDark: '#A3A3A3',
    accent: '#A3A3A3',
    accentWarm: '#D4D4D4',
    success: '#4ADE80',
    warning: '#FACC15',
    danger: '#F87171',
    text: '#FAFAFA',
    textSecondary: '#A3A3A3',
    textMuted: '#737373',
    border: '#404040',
    gradientStart: '#404040',
    gradientMid: '#737373',
    gradientEnd: '#A3A3A3',
    gradientGlow: '#D4D4D4',
    chartColors: ['#E5E5E5', '#A3A3A3', '#737373', '#D4D4D4', '#4ADE80', '#F87171', '#60A5FA', '#FACC15'],
    overlay: 'rgba(10, 10, 10, 0.82)',
  },
);

const forest = packPair(
  {
    background: '#F3F7F2',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#E8F0E6',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(22, 101, 52, 0.14)',
    primary: '#166534',
    primaryLight: '#22C55E',
    primaryDark: '#14532D',
    accent: '#4ADE80',
    accentWarm: '#86EFAC',
    success: '#16A34A',
    warning: '#CA8A04',
    danger: '#DC2626',
    text: '#14532D',
    textSecondary: '#166534',
    textMuted: '#94A3B8',
    border: '#D1E7D0',
    gradientStart: '#14532D',
    gradientMid: '#166534',
    gradientEnd: '#4ADE80',
    gradientGlow: '#86EFAC',
    chartColors: ['#166534', '#22C55E', '#4ADE80', '#86EFAC', '#CA8A04', '#DC2626', '#0EA5E9', '#A855F7'],
    overlay: 'rgba(20, 83, 45, 0.42)',
  },
  {
    background: '#071A0F',
    surface: '#0C2416',
    surfaceElevated: '#12321E',
    surfaceHighlight: '#183F27',
    tabBar: 'rgba(12, 36, 22, 0.96)',
    tabBarBorder: 'rgba(74, 222, 128, 0.28)',
    primary: '#4ADE80',
    primaryLight: '#86EFAC',
    primaryDark: '#22C55E',
    accent: '#86EFAC',
    accentWarm: '#BBF7D0',
    success: '#4ADE80',
    warning: '#FACC15',
    danger: '#F87171',
    text: '#ECFDF5',
    textSecondary: '#86EFAC',
    textMuted: '#4D7C5C',
    border: '#1A3D28',
    gradientStart: '#14532D',
    gradientMid: '#22C55E',
    gradientEnd: '#4ADE80',
    gradientGlow: '#86EFAC',
    chartColors: ['#4ADE80', '#86EFAC', '#22C55E', '#BBF7D0', '#FACC15', '#F87171', '#38BDF8', '#C084FC'],
    overlay: 'rgba(7, 26, 15, 0.82)',
  },
);

const midnightGold = packPair(
  {
    background: '#FFFBEB',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#FEF3C7',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(180, 83, 9, 0.16)',
    primary: '#B45309',
    primaryLight: '#D97706',
    primaryDark: '#92400E',
    accent: '#F59E0B',
    accentWarm: '#FBBF24',
    success: '#059669',
    warning: '#D97706',
    danger: '#DC2626',
    text: '#451A03',
    textSecondary: '#92400E',
    textMuted: '#A8A29E',
    border: '#FDE68A',
    gradientStart: '#92400E',
    gradientMid: '#B45309',
    gradientEnd: '#F59E0B',
    gradientGlow: '#FBBF24',
    chartColors: ['#B45309', '#F59E0B', '#D97706', '#FBBF24', '#059669', '#DC2626', '#1D4ED8', '#7C3AED'],
    overlay: 'rgba(69, 26, 3, 0.42)',
  },
  {
    background: '#0C0A06',
    surface: '#1A1408',
    surfaceElevated: '#261C0C',
    surfaceHighlight: '#322510',
    tabBar: 'rgba(26, 20, 8, 0.96)',
    tabBarBorder: 'rgba(251, 191, 36, 0.3)',
    primary: '#FBBF24',
    primaryLight: '#FDE68A',
    primaryDark: '#F59E0B',
    accent: '#F59E0B',
    accentWarm: '#FCD34D',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    text: '#FFFBEB',
    textSecondary: '#FDE68A',
    textMuted: '#A8A29E',
    border: '#3D2E12',
    gradientStart: '#92400E',
    gradientMid: '#D97706',
    gradientEnd: '#FBBF24',
    gradientGlow: '#FDE68A',
    chartColors: ['#FBBF24', '#F59E0B', '#FDE68A', '#FCD34D', '#34D399', '#F87171', '#60A5FA', '#C084FC'],
    overlay: 'rgba(12, 10, 6, 0.82)',
  },
);

const paper = packPair(
  {
    background: '#F7F3EB',
    surface: '#FFFCF7',
    surfaceElevated: '#FFFCF7',
    surfaceHighlight: '#EFE8DC',
    tabBar: 'rgba(255, 252, 247, 0.97)',
    tabBarBorder: 'rgba(68, 64, 60, 0.12)',
    primary: '#44403C',
    primaryLight: '#57534E',
    primaryDark: '#292524',
    accent: '#B45309',
    accentWarm: '#D97706',
    success: '#166534',
    warning: '#B45309',
    danger: '#B91C1C',
    text: '#1C1917',
    textSecondary: '#57534E',
    textMuted: '#A8A29E',
    border: '#E7E0D4',
    gradientStart: '#292524',
    gradientMid: '#57534E',
    gradientEnd: '#B45309',
    gradientGlow: '#D6D3D1',
    chartColors: ['#44403C', '#B45309', '#57534E', '#D97706', '#166534', '#B91C1C', '#1D4ED8', '#7C3AED'],
    overlay: 'rgba(28, 25, 23, 0.42)',
  },
  {
    background: '#1C1917',
    surface: '#292524',
    surfaceElevated: '#35302C',
    surfaceHighlight: '#44403C',
    tabBar: 'rgba(41, 37, 36, 0.96)',
    tabBarBorder: 'rgba(214, 211, 209, 0.18)',
    primary: '#D6D3D1',
    primaryLight: '#E7E5E4',
    primaryDark: '#A8A29E',
    accent: '#F59E0B',
    accentWarm: '#FBBF24',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    text: '#FAFAF9',
    textSecondary: '#D6D3D1',
    textMuted: '#A8A29E',
    border: '#44403C',
    gradientStart: '#44403C',
    gradientMid: '#78716C',
    gradientEnd: '#D97706',
    gradientGlow: '#A8A29E',
    chartColors: ['#D6D3D1', '#F59E0B', '#A8A29E', '#FBBF24', '#4ADE80', '#F87171', '#60A5FA', '#C084FC'],
    overlay: 'rgba(28, 25, 23, 0.82)',
  },
);

const neon = packPair(
  {
    background: '#F5F3FF',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#EDE9FE',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(6, 182, 212, 0.2)',
    primary: '#0891B2',
    primaryLight: '#06B6D4',
    primaryDark: '#0E7490',
    accent: '#D946EF',
    accentWarm: '#E879F9',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    text: '#1E1B4B',
    textSecondary: '#4C1D95',
    textMuted: '#94A3B8',
    border: '#DDD6FE',
    gradientStart: '#7C3AED',
    gradientMid: '#06B6D4',
    gradientEnd: '#E879F9',
    gradientGlow: '#22D3EE',
    chartColors: ['#06B6D4', '#E879F9', '#22D3EE', '#A855F7', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'],
    overlay: 'rgba(30, 27, 75, 0.42)',
  },
  {
    background: '#050510',
    surface: '#0C0C1C',
    surfaceElevated: '#141428',
    surfaceHighlight: '#1C1C36',
    tabBar: 'rgba(12, 12, 28, 0.96)',
    tabBarBorder: 'rgba(34, 211, 238, 0.35)',
    primary: '#22D3EE',
    primaryLight: '#67E8F9',
    primaryDark: '#06B6D4',
    accent: '#E879F9',
    accentWarm: '#F0ABFC',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#FB7185',
    text: '#F5F3FF',
    textSecondary: '#A5B4FC',
    textMuted: '#64748B',
    border: '#2E2E4A',
    gradientStart: '#7C3AED',
    gradientMid: '#22D3EE',
    gradientEnd: '#E879F9',
    gradientGlow: '#67E8F9',
    chartColors: ['#22D3EE', '#E879F9', '#67E8F9', '#C084FC', '#34D399', '#FBBF24', '#FB7185', '#60A5FA'],
    overlay: 'rgba(5, 5, 16, 0.82)',
  },
);

/** Red Web Spider — crimson + navy (Spidey suit), same brand in light & dark */
const redWebSpider = packPair(
  {
    background: '#FFF5F5',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#FEE2E2',
    tabBar: 'rgba(255, 255, 255, 0.97)',
    tabBarBorder: 'rgba(220, 38, 38, 0.16)',
    primary: '#DC2626',
    primaryLight: '#EF4444',
    primaryDark: '#B91C1C',
    accent: '#1E3A8A',
    accentWarm: '#F87171',
    success: '#15803D',
    warning: '#D97706',
    danger: '#991B1B',
    text: '#1C1917',
    textSecondary: '#7F1D1D',
    textMuted: '#A8A29E',
    border: '#FECACA',
    // Suit stripe: bright red → deep crimson → navy (buttons read Spidey)
    gradientStart: '#E11D48',
    gradientMid: '#9F1239',
    gradientEnd: '#1E3A8A',
    gradientGlow: '#E0F2FE',
    chartColors: ['#DC2626', '#1E3A8A', '#EF4444', '#3B82F6', '#BE123C', '#64748B', '#F59E0B', '#0F766E'],
    overlay: 'rgba(28, 25, 23, 0.42)',
  },
  {
    // Dark = same Spidey palette on a navy-black suit, not pink-washed
    background: '#070B14',
    surface: '#0F1524',
    surfaceElevated: '#151C2E',
    surfaceHighlight: '#1E2740',
    tabBar: 'rgba(15, 21, 36, 0.97)',
    tabBarBorder: 'rgba(220, 38, 38, 0.32)',
    primary: '#DC2626',
    primaryLight: '#EF4444',
    primaryDark: '#B91C1C',
    accent: '#2563EB',
    accentWarm: '#F87171',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    text: '#F8FAFC',
    textSecondary: '#FECACA',
    textMuted: '#94A3B8',
    border: '#2A3350',
    // Same red → crimson → navy button stripe
    gradientStart: '#E11D48',
    gradientMid: '#9F1239',
    gradientEnd: '#1E3A8A',
    gradientGlow: '#93C5FD',
    chartColors: ['#DC2626', '#2563EB', '#EF4444', '#3B82F6', '#BE123C', '#94A3B8', '#F59E0B', '#14B8A6'],
    overlay: 'rgba(7, 11, 20, 0.84)',
  },
);

const PACK_COLORS: Record<ThemePackId, Record<ThemeMode, AppColors>> = {
  ocean,
  mint,
  sunset,
  royal,
  rose,
  lavender,
  mono,
  forest,
  midnight_gold: midnightGold,
  paper,
  neon,
  red_web_spider: redWebSpider,
};

const PASTEL_CHART = ['#A5B4FC', '#7DD3FC', '#6EE7B7', '#F9A8D4', '#FCD34D', '#FDA4AF', '#C4B5FD', '#99F6E4'];
const BOLD_CHART = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const COLORBLIND_CHART = ['#0077BB', '#EE7733', '#009988', '#CC3311', '#33BBEE', '#EE3377', '#BBBBBB', '#000000'];

function applyGradientStyle(colors: AppColors, style: GradientStyleId): AppColors {
  if (style === 'default' || style === 'bold') {
    return colors;
  }
  if (style === 'minimal') {
    return {
      ...colors,
      gradientStart: colors.primary,
      gradientMid: colors.primaryLight,
      gradientEnd: colors.primaryLight,
      gradientGlow: colors.border,
    };
  }
  // soft — pull mid toward end, mute glow
  return {
    ...colors,
    gradientStart: colors.gradientMid,
    gradientMid: colors.gradientEnd,
    gradientEnd: colors.accent,
    gradientGlow: colors.primaryLight,
  };
}

export function isPackFree(id: ThemePackId): boolean {
  return id === FREE_PACK;
}

export function isChartPaletteFree(id: ChartPaletteId): boolean {
  return id === 'default';
}

export function isGradientStyleFree(id: GradientStyleId): boolean {
  return id === 'default';
}

export function getPackColors(packId: ThemePackId, mode: ThemeMode): AppColors {
  const pack = PACK_COLORS[packId] ?? PACK_COLORS.ocean;
  return pack[mode];
}

export function getChartPaletteColors(
  paletteId: ChartPaletteId,
  packChartColors: string[],
): string[] {
  switch (paletteId) {
    case 'pastel':
      return PASTEL_CHART;
    case 'bold':
      return BOLD_CHART;
    case 'colorblind':
      return COLORBLIND_CHART;
    case 'default':
    default:
      // Original Insights pie colors (category palette) — not theme-pack accents
      return CATEGORY_CHART_COLORS;
  }
}

export function resolveAppColors(
  packId: ThemePackId,
  mode: ThemeMode,
  gradientStyle: GradientStyleId,
  chartPalette: ChartPaletteId,
): AppColors {
  const pack = getPackColors(packId, mode);
  // Spidey suit stripe must stay red → navy (don't let soft/minimal restyle wash it)
  const base =
    packId === 'red_web_spider' ? pack : applyGradientStyle(pack, gradientStyle);
  return {
    ...base,
    chartColors: getChartPaletteColors(chartPalette, base.chartColors),
  };
}

export function getGradientPoints(style: GradientStyleId): {
  start: { x: number; y: number };
  end: { x: number; y: number };
} | null {
  // `default` → null so each screen keeps its original LinearGradient axes
  if (style === 'default') {
    return null;
  }
  if (style === 'bold') {
    return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
  }
  if (style === 'minimal') {
    return { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  }
  // soft
  return { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
}

/** CTA gradient stops — spider: red→crimson→navy; others: original 2-stop */
export function getActionGradient(
  colors: AppColors,
  packId?: ThemePackId,
): readonly [string, string, string] | readonly [string, string] {
  if (packId === 'red_web_spider') {
    return [colors.gradientStart, colors.gradientMid, colors.gradientEnd];
  }
  // Exact original Default / pack CTA look (start → end, no mid wash)
  return [colors.gradientStart, colors.gradientEnd];
}

/** Tab pill / CTA axis — spider horizontal suit stripe; else pack style or original diagonal */
export function getActionGradientPoints(
  packId: ThemePackId,
  style: GradientStyleId,
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  if (packId === 'red_web_spider') {
    return { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  }
  return getGradientPoints(style) ?? { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
}

/** Original floating-tab active pill (start→mid diagonal); spider uses full suit stripe */
export function getTabPillGradient(
  colors: AppColors,
  packId: ThemePackId,
): readonly [string, string, string] | readonly [string, string] {
  if (packId === 'red_web_spider') {
    return [colors.gradientStart, colors.gradientMid, colors.gradientEnd];
  }
  return [colors.gradientStart, colors.gradientMid];
}

export function getThemePackMeta(id: ThemePackId): ThemePackMeta {
  return THEME_PACKS.find(p => p.id === id) ?? THEME_PACKS[0];
}
