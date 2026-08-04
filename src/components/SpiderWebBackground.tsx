import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../store/themeStore';

export type SpiderWebVariant =
  | 'full'
  | 'hero'
  | 'category'
  | 'trend'
  | 'merchants'
  | 'insight'
  | 'profile'
  | 'logSoft'
  | 'logSoftAlt';

type Corner = 'tl' | 'tr' | 'bl' | 'br';

type VariantConfig = {
  corners: Corner[];
  rays: number;
  rings: number;
  sizeScale: number;
  seed: number;
  /** Per-corner relative size multipliers */
  cornerScale?: Partial<Record<Corner, number>>;
  /** Uneven rays + silk wobble for a more natural web */
  organic?: boolean;
};

const VARIANTS: Record<SpiderWebVariant, VariantConfig> = {
  full: {
    corners: ['tl', 'tr', 'bl', 'br'],
    rays: 9,
    rings: 4,
    sizeScale: 1,
    seed: 0,
  },
  hero: {
    corners: ['tl', 'tr', 'br'],
    rays: 11,
    rings: 5,
    sizeScale: 1.08,
    seed: 1.4,
    cornerScale: { tl: 1.05, tr: 0.88, br: 1.15 },
  },
  category: {
    corners: ['tr', 'bl'],
    rays: 7,
    rings: 3,
    sizeScale: 0.92,
    seed: 2.7,
    cornerScale: { tr: 1.2, bl: 1.05 },
  },
  trend: {
    corners: ['tl', 'br'],
    rays: 8,
    rings: 4,
    sizeScale: 1.2,
    seed: 3.1,
    cornerScale: { tl: 0.85, br: 1.35 },
  },
  merchants: {
    corners: ['tl', 'tr'],
    rays: 6,
    rings: 3,
    sizeScale: 0.78,
    seed: 4.6,
    cornerScale: { tl: 1.1, tr: 0.95 },
  },
  insight: {
    corners: ['br', 'tl'],
    rays: 10,
    rings: 5,
    sizeScale: 1.25,
    seed: 5.2,
    cornerScale: { br: 1.4, tl: 0.7 },
  },
  profile: {
    // Larger clean left web — organic wobble via seed
    corners: ['tl', 'bl'],
    rays: 8,
    rings: 4,
    sizeScale: 1.12,
    seed: 8.3,
    cornerScale: { tl: 1.28, bl: 1.08 },
    organic: true,
  },
  /** Sparse single-corner accents for Log expense/activity cards */
  logSoft: {
    corners: ['tr'],
    rays: 7,
    rings: 3,
    sizeScale: 0.82,
    seed: 9.1,
    cornerScale: { tr: 1.1 },
    organic: true,
  },
  logSoftAlt: {
    corners: ['bl'],
    rays: 6,
    rings: 3,
    sizeScale: 0.78,
    seed: 9.9,
    cornerScale: { bl: 1.12 },
    organic: true,
  },
};

interface SpiderWebBackgroundProps {
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
  opacity?: number;
  /** Different corner layouts / density so cards don’t look identical */
  variant?: SpiderWebVariant;
}

/**
 * Corner geometric webs. Variants change which corners, ray/ring density,
 * and scale — so stacked cards don’t share the same pattern.
 */
export function SpiderWebBackground({
  style,
  enabled,
  opacity = 0.3,
  variant = 'full',
}: SpiderWebBackgroundProps) {
  const packId = useThemeStore(s => s.packId);
  const { colors, isDark } = useTheme();
  const show = enabled ?? packId === 'red_web_spider';
  const { width } = useWindowDimensions();
  const cfg = VARIANTS[variant] ?? VARIANTS.full;
  const baseSize = Math.round(Math.min(168, width * 0.42) * cfg.sizeScale);

  const stroke = isDark ? 'rgba(254, 202, 202, 0.98)' : 'rgba(159, 18, 57, 0.85)';
  // Hub dots — brighter blue on dark navy surfaces
  const accent = isDark ? 'rgba(147, 197, 253, 0.98)' : colors.accent;
  // Dark surfaces need stronger opacity or webs disappear
  const effectiveOpacity = isDark ? Math.min(0.95, opacity * 1.85 + 0.08) : opacity;
  const strokeWidthBoost = isDark ? 1.35 : 1;

  if (!show) return null;

  return (
    <View style={[styles.root, style]} pointerEvents="none">
      {cfg.corners.map(origin => {
        const mult = cfg.cornerScale?.[origin] ?? 1;
        const size = Math.round(baseSize * mult);
        const op =
          origin === 'bl' || origin === 'br'
            ? effectiveOpacity * 0.92
            : effectiveOpacity;
        return (
          <View
            key={`${variant}-${origin}`}
            style={[styles.corner, styles[origin], { width: size, height: size }]}
          >
            <CornerWeb
              size={size}
              stroke={stroke}
              accent={accent}
              opacity={op}
              origin={origin}
              rays={cfg.rays}
              rings={cfg.rings}
              seed={cfg.seed + origin.charCodeAt(0) * 0.13}
              strokeWidthBoost={strokeWidthBoost}
              organic={!!cfg.organic}
            />
          </View>
        );
      })}
    </View>
  );
}

function CornerWeb({
  size,
  stroke,
  accent,
  opacity,
  origin,
  rays,
  rings,
  seed,
  strokeWidthBoost = 1,
  organic = false,
}: {
  size: number;
  stroke: string;
  accent: string;
  opacity: number;
  origin: Corner;
  rays: number;
  rings: number;
  seed: number;
  strokeWidthBoost?: number;
  organic?: boolean;
}) {
  const cx = origin === 'tl' || origin === 'bl' ? 0 : size;
  const cy = origin === 'tl' || origin === 'tr' ? 0 : size;
  const angleOffset = seed * 0.37;

  const lines = useMemo(() => {
    const out: { x2: number; y2: number; len: number }[] = [];
    for (let i = 0; i < rays; i++) {
      // Slightly uneven spacing + length like real silk
      const jitter = organic ? Math.sin(i * 2.1 + seed) * 0.09 : 0;
      const a = (i / rays) * Math.PI * 2 + angleOffset + jitter;
      const len = organic ? 0.82 + ((Math.sin(i * 1.3 + seed * 2) + 1) / 2) * 0.22 : 1;
      out.push({
        x2: cx + Math.cos(a) * size * len,
        y2: cy + Math.sin(a) * size * len,
        len,
      });
    }
    return out;
  }, [cx, cy, size, rays, angleOffset, organic, seed]);

  const ringPaths = useMemo(() => {
    const paths: string[] = [];
    for (let r = 1; r <= rings; r++) {
      const rad = (size * r) / rings;
      const pts: string[] = [];
      for (let i = 0; i <= rays; i++) {
        const jitter = organic ? Math.sin(i * 2.1 + seed) * 0.09 : 0;
        const a = (i / rays) * Math.PI * 2 + angleOffset + jitter;
        const wobbleAmp = organic ? 0.055 + (seed % 1) * 0.03 : 0.025 + (seed % 1) * 0.02;
        const wobble = 1 + Math.sin(i * 1.7 + r * 1.3 + seed) * wobbleAmp;
        // Pull ring toward shorter rays for organic look
        const rayLen = organic ? 0.82 + ((Math.sin(i * 1.3 + seed * 2) + 1) / 2) * 0.22 : 1;
        const rr = rad * wobble * (organic ? 0.88 + rayLen * 0.12 : 1);
        pts.push(
          `${i === 0 ? 'M' : 'L'} ${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr}`,
        );
      }
      paths.push(`${pts.join(' ')} Z`);
    }
    return paths;
  }, [cx, cy, size, rings, rays, seed, angleOffset, organic]);

  const hubR = (2.4 + (seed % 1.5)) * (strokeWidthBoost > 1 ? 1.25 : 1);

  return (
    <Svg width={size} height={size}>
      {lines.map((l, i) => (
        <Line
          key={`ray-${i}`}
          x1={cx}
          y1={cy}
          x2={l.x2}
          y2={l.y2}
          stroke={stroke}
          strokeOpacity={opacity}
          strokeWidth={(1.15 + (i % 3 === 0 ? 0.4 : 0)) * strokeWidthBoost}
        />
      ))}
      {ringPaths.map((d, i) => (
        <Path
          key={`ring-${i}`}
          d={d}
          stroke={i === rings - 1 ? accent : stroke}
          strokeOpacity={opacity * (0.72 + i * 0.06)}
          strokeWidth={1.2 * strokeWidthBoost}
          fill="none"
        />
      ))}
      <Circle cx={cx} cy={cy} r={hubR} fill={accent} fillOpacity={Math.min(1, opacity + 0.22)} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  corner: {
    position: 'absolute',
    overflow: 'hidden',
  },
  tl: { top: 0, left: 0 },
  tr: { top: 0, right: 0 },
  bl: { bottom: 0, left: 0 },
  br: { bottom: 0, right: 0 },
});
