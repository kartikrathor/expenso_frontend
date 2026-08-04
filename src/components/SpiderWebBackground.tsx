import React, { useMemo } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../store/themeStore';

interface SpiderWebBackgroundProps {
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
  opacity?: number;
}

/**
 * Corner-only geometric webs. Avoids a full-screen SVG over FlatList
 * (Android often paints that overlay above chat bubbles).
 */
export function SpiderWebBackground({
  style,
  enabled,
  opacity = 0.3,
}: SpiderWebBackgroundProps) {
  const packId = useThemeStore(s => s.packId);
  const { colors, isDark } = useTheme();
  const show = enabled ?? packId === 'red_web_spider';
  const { width } = useWindowDimensions();
  const size = Math.round(Math.min(168, width * 0.42));

  const stroke = isDark ? 'rgba(254, 202, 202, 0.95)' : 'rgba(159, 18, 57, 0.85)';
  const accent = isDark ? 'rgba(252, 165, 165, 0.95)' : colors.primary;

  if (!show) return null;

  return (
    <View style={[styles.root, style]} pointerEvents="none">
      <View style={[styles.corner, styles.tl, { width: size, height: size }]}>
        <CornerWeb size={size} stroke={stroke} accent={accent} opacity={opacity} origin="tl" />
      </View>
      <View style={[styles.corner, styles.tr, { width: size, height: size }]}>
        <CornerWeb size={size} stroke={stroke} accent={accent} opacity={opacity} origin="tr" />
      </View>
      <View style={[styles.corner, styles.bl, { width: size * 0.85, height: size * 0.85 }]}>
        <CornerWeb
          size={Math.round(size * 0.85)}
          stroke={stroke}
          accent={accent}
          opacity={opacity * 0.85}
          origin="bl"
        />
      </View>
      <View style={[styles.corner, styles.br, { width: size * 0.9, height: size * 0.9 }]}>
        <CornerWeb
          size={Math.round(size * 0.9)}
          stroke={stroke}
          accent={accent}
          opacity={opacity * 0.9}
          origin="br"
        />
      </View>
    </View>
  );
}

function CornerWeb({
  size,
  stroke,
  accent,
  opacity,
  origin,
}: {
  size: number;
  stroke: string;
  accent: string;
  opacity: number;
  origin: 'tl' | 'tr' | 'bl' | 'br';
}) {
  const cx = origin === 'tl' || origin === 'bl' ? 0 : size;
  const cy = origin === 'tl' || origin === 'tr' ? 0 : size;
  const rays = 9;
  const rings = 4;

  const lines = useMemo(() => {
    const out: { x2: number; y2: number }[] = [];
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2;
      out.push({
        x2: cx + Math.cos(a) * size,
        y2: cy + Math.sin(a) * size,
      });
    }
    return out;
  }, [cx, cy, size, rays]);

  const ringPaths = useMemo(() => {
    const paths: string[] = [];
    for (let r = 1; r <= rings; r++) {
      const rad = (size * r) / rings;
      const pts: string[] = [];
      for (let i = 0; i <= rays; i++) {
        const a = (i / rays) * Math.PI * 2;
        const wobble = 1 + Math.sin(i * 1.7 + r) * 0.03;
        pts.push(
          `${i === 0 ? 'M' : 'L'} ${cx + Math.cos(a) * rad * wobble} ${
            cy + Math.sin(a) * rad * wobble
          }`,
        );
      }
      paths.push(`${pts.join(' ')} Z`);
    }
    return paths;
  }, [cx, cy, size, rings, rays]);

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
          strokeWidth={1.4}
        />
      ))}
      {ringPaths.map((d, i) => (
        <Path
          key={`ring-${i}`}
          d={d}
          stroke={i === rings - 1 ? accent : stroke}
          strokeOpacity={opacity * (0.7 + i * 0.05)}
          strokeWidth={1.2}
          fill="none"
        />
      ))}
      <Circle cx={cx} cy={cy} r={3} fill={accent} fillOpacity={Math.min(1, opacity + 0.15)} />
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
