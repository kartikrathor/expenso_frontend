import React from 'react';
import { StyleProp, ViewStyle, View, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** 0–1 */
  opacity?: number;
};

/**
 * Tiny spider silhouette for Red Web Spider accents.
 * Uses contrast outline so it stays visible on dark navy cards.
 */
export function BlackSpiderMark({ size = 26, style, opacity }: Props) {
  const { isDark } = useTheme();
  const body = isDark ? '#0A0A0A' : '#111111';
  const outline = isDark ? 'rgba(254, 202, 202, 0.95)' : 'rgba(127, 29, 29, 0.55)';
  const leg = isDark ? '#FECACA' : '#1C1917';
  const eye = isDark ? '#EF4444' : '#DC2626';
  const op = opacity ?? (isDark ? 0.95 : 0.82);

  return (
    <View style={[styles.wrap, { opacity: op }, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 32 32">
        {/* Soft halo so silhouette pops on dark surfaces */}
        <Circle cx={16} cy={16} r={13} fill={isDark ? 'rgba(220,38,38,0.14)' : 'rgba(220,38,38,0.08)'} />

        {/* Legs — light on dark, dark on light */}
        <Path
          d="M10 14 C4 10 2 6 3 4 M10 15 C3 14 1 12 2 10 M10 17 C3 18 1 20 2 22 M10 18 C4 22 2 26 3 28"
          stroke={leg}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M22 14 C28 10 30 6 29 4 M22 15 C29 14 31 12 30 10 M22 17 C29 18 31 20 30 22 M22 18 C28 22 30 26 29 28"
          stroke={leg}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />

        {/* Body with outline */}
        <Ellipse
          cx={16}
          cy={19.5}
          rx={5.4}
          ry={6.4}
          fill={body}
          stroke={outline}
          strokeWidth={1.2}
        />
        <Ellipse
          cx={16}
          cy={12.2}
          rx={4.2}
          ry={3.7}
          fill={body}
          stroke={outline}
          strokeWidth={1.1}
        />
        {/* Eyes */}
        <Circle cx={14.2} cy={11.6} r={1.15} fill={eye} />
        <Circle cx={17.8} cy={11.6} r={1.15} fill={eye} />
      </Svg>
    </View>
  );
}

/** Stable pick from id (~1 in `every`). */
export function pickSpiderMark(id: string, every = 4): boolean {
  if (!id) return false;
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % every === 0;
}

/** Index-based pick — guaranteed on list items (doesn't depend on id hash). */
export function pickSpiderByIndex(index: number, every = 4): boolean {
  return index >= 0 && index % every === 0;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 4,
    elevation: 4,
  },
});
