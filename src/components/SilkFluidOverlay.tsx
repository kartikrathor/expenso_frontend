import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Line } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  SharedValue,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useThemeStore } from '../store/themeStore';
import { useTheme } from '../hooks/useTheme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Intensity = 'subtle' | 'medium' | 'bold';

interface SilkFluidOverlayProps {
  style?: StyleProp<ViewStyle>;
  /** How high the silk sits (0–1). */
  fill?: number;
  /**
   * Force on/off. Default: only when active theme pack is Red Web Spider.
   */
  enabled?: boolean;
  /** Pause animation when off-screen. */
  active?: boolean;
  intensity?: Intensity;
}

/** High-contrast silk — crimson + navy (same Spidey brand light/dark). */
const SILK_LIGHT = {
  deep: '#7F1D1D',
  mid: '#E11D48',
  surface: '#FFE4E6',
  pearl: '#E0F2FE',
  foam: '#F0F9FF',
  navy: '#1E3A8A',
};

const SILK_DARK = {
  deep: '#9F1239',
  mid: '#DC2626',
  surface: '#1E2740',
  pearl: '#93C5FD',
  foam: '#DBEAFE',
  navy: '#2563EB',
};

/**
 * Pearlescent silk-fluid wash for Red Web Spider surfaces.
 * Absolute overlay — place inside overflow:hidden heroes / preview cards.
 */
export function SilkFluidOverlay({
  style,
  fill = 0.78,
  enabled,
  active = true,
  intensity = 'medium',
}: SilkFluidOverlayProps) {
  const packId = useThemeStore(s => s.packId);
  const { isDark } = useTheme();
  const show = enabled ?? packId === 'red_web_spider';
  const silk = isDark ? SILK_DARK : SILK_LIGHT;
  const uid = React.useId().replace(/:/g, '');
  const [size, setSize] = useState({ w: 0, h: 0 });

  const targetFill = Math.max(0.35, Math.min(1, fill));
  const phase = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (!show || !active) {
      cancelAnimation(phase);
      cancelAnimation(bob);
      return;
    }
    // Faster cycle so motion is obvious on first glance
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 7000, easing: Easing.linear }),
      -1,
      false,
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(phase);
      cancelAnimation(bob);
    };
  }, [show, active, phase, bob]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize({ w: Math.ceil(width), h: Math.ceil(height) });
    }
  };

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bob.value, [0, 1], [-2, 3]) }],
  }));

  const opacities = INTENSITY[intensity];

  if (!show) return null;

  const tankH = Math.max(48, Math.round(size.h * targetFill));

  return (
    <View style={[styles.root, style]} pointerEvents="none" onLayout={onLayout} collapsable={false}>
      <Animated.View
        style={[styles.tank, size.h > 0 ? { height: tankH } : { height: '80%' }, bobStyle]}
        collapsable={false}
      >
        {size.w > 0 && size.h > 0 ? (
          <SilkSvg
            uid={uid}
            width={size.w}
            height={tankH}
            phase={phase}
            opacities={opacities}
            silk={silk}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const INTENSITY: Record<
  Intensity,
  { bodyTop: number; bodyMid: number; bodyDeep: number; backTop: number; strand: number; foam: number; pearl: number }
> = {
  subtle: {
    bodyTop: 0.55,
    bodyMid: 0.5,
    bodyDeep: 0.65,
    backTop: 0.4,
    strand: 0.35,
    foam: 0.7,
    pearl: 0.35,
  },
  medium: {
    bodyTop: 0.72,
    bodyMid: 0.68,
    bodyDeep: 0.82,
    backTop: 0.55,
    strand: 0.45,
    foam: 0.85,
    pearl: 0.45,
  },
  bold: {
    bodyTop: 0.88,
    bodyMid: 0.82,
    bodyDeep: 0.92,
    backTop: 0.65,
    strand: 0.55,
    foam: 0.95,
    pearl: 0.55,
  },
};

function SilkSvg({
  uid,
  width,
  height,
  phase,
  opacities,
  silk,
}: {
  uid: string;
  width: number;
  height: number;
  phase: SharedValue<number>;
  opacities: (typeof INTENSITY)[Intensity];
  silk: typeof SILK_LIGHT;
}) {
  const W = width;
  const H = Math.max(height, 48);

  const frontProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(12, H * 0.1);
    const baseY = amp + 8;
    const p = phase.value;
    const seg = W / 4;
    const y0 = baseY + Math.sin(p) * amp;
    const y1 = baseY + Math.sin(p + Math.PI * 0.5) * amp;
    const y2 = baseY + Math.sin(p + Math.PI) * amp;
    const y3 = baseY + Math.sin(p + Math.PI * 1.5) * amp;
    const y4 = baseY + Math.sin(p + Math.PI * 2) * amp;
    const cx = seg * 0.45;
    const d =
      `M 0 ${y0}` +
      ` C ${cx} ${y0} ${seg - cx} ${y1} ${seg} ${y1}` +
      ` C ${seg + cx} ${y1} ${seg * 2 - cx} ${y2} ${seg * 2} ${y2}` +
      ` C ${seg * 2 + cx} ${y2} ${seg * 3 - cx} ${y3} ${seg * 3} ${y3}` +
      ` C ${seg * 3 + cx} ${y3} ${W - cx} ${y4} ${W} ${y4}` +
      ` L ${W} ${H} L 0 ${H} Z`;
    return { d };
  });

  const backProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(16, H * 0.12);
    const baseY = amp + 12;
    const p = phase.value * 0.7 + 1.5;
    const seg = W / 3;
    const y0 = baseY + Math.sin(p) * amp;
    const y1 = baseY + Math.sin(p + Math.PI * 0.67) * amp;
    const y2 = baseY + Math.sin(p + Math.PI * 1.33) * amp;
    const y3 = baseY + Math.sin(p + Math.PI * 2) * amp;
    const cx = seg * 0.45;
    const d =
      `M 0 ${y0}` +
      ` C ${cx} ${y0} ${seg - cx} ${y1} ${seg} ${y1}` +
      ` C ${seg + cx} ${y1} ${seg * 2 - cx} ${y2} ${seg * 2} ${y2}` +
      ` C ${seg * 2 + cx} ${y2} ${W - cx} ${y3} ${W} ${y3}` +
      ` L ${W} ${H} L 0 ${H} Z`;
    return { d };
  });

  const foamProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(12, H * 0.1);
    const baseY = amp + 5;
    const p = phase.value;
    const seg = W / 4;
    const y0 = baseY + Math.sin(p) * amp;
    const y1 = baseY + Math.sin(p + Math.PI * 0.5) * amp;
    const y2 = baseY + Math.sin(p + Math.PI) * amp;
    const y3 = baseY + Math.sin(p + Math.PI * 1.5) * amp;
    const y4 = baseY + Math.sin(p + Math.PI * 2) * amp;
    const cx = seg * 0.45;
    const d =
      `M 0 ${y0}` +
      ` C ${cx} ${y0} ${seg - cx} ${y1} ${seg} ${y1}` +
      ` C ${seg + cx} ${y1} ${seg * 2 - cx} ${y2} ${seg * 2} ${y2}` +
      ` C ${seg * 2 + cx} ${y2} ${seg * 3 - cx} ${y3} ${seg * 3} ${y3}` +
      ` C ${seg * 3 + cx} ${y3} ${W - cx} ${y4} ${W} ${y4}`;
    return { d };
  });

  const strandProps = useAnimatedProps(() => {
    'worklet';
    const drift = Math.sin(phase.value) * 4;
    const y1 = H * 0.25 + drift;
    const y2 = H * 0.5 - drift * 0.7;
    const y3 = H * 0.72 + drift * 0.5;
    const d =
      `M ${W * 0.08} ${y1} Q ${W * 0.32} ${y1 - 14} ${W * 0.58} ${y1 + 6}` +
      ` M ${W * 0.22} ${y2} Q ${W * 0.48} ${y2 + 14} ${W * 0.82} ${y2 - 4}` +
      ` M ${W * 0.12} ${y3} Q ${W * 0.42} ${y3 - 10} ${W * 0.75} ${y3 + 5}`;
    return { d };
  });

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={styles.svg} pointerEvents="none">
      <Defs>
        <SvgGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={silk.surface} stopOpacity={String(opacities.bodyTop)} />
          <Stop offset="0.35" stopColor={silk.mid} stopOpacity={String(opacities.bodyMid)} />
          <Stop offset="0.75" stopColor={silk.deep} stopOpacity={String(opacities.bodyDeep)} />
          <Stop offset="1" stopColor={silk.navy} stopOpacity={String(opacities.bodyDeep)} />
        </SvgGradient>
        <SvgGradient id={`${uid}-back`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={silk.pearl} stopOpacity={String(opacities.backTop)} />
          <Stop offset="1" stopColor={silk.navy} stopOpacity="0.55" />
        </SvgGradient>
        <SvgGradient id={`${uid}-pearl`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={silk.pearl} stopOpacity="0" />
          <Stop offset="0.5" stopColor={silk.pearl} stopOpacity={String(opacities.pearl)} />
          <Stop offset="1" stopColor={silk.foam} stopOpacity="0" />
        </SvgGradient>
      </Defs>

      <AnimatedPath animatedProps={backProps} fill={`url(#${uid}-back)`} />
      <AnimatedPath animatedProps={frontProps} fill={`url(#${uid}-body)`} />
      <Path
        d={`M 0 ${H * 0.15} L ${W} ${H * 0.08} L ${W} ${H * 0.4} L 0 ${H * 0.48} Z`}
        fill={`url(#${uid}-pearl)`}
      />
      <AnimatedPath
        animatedProps={strandProps}
        stroke={`rgba(255,255,255,${opacities.strand})`}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
      />
      <Line
        x1={W * 0.5}
        y1={H * 0.12}
        x2={W * 0.12}
        y2={H * 0.92}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1.2}
      />
      <Line
        x1={W * 0.5}
        y1={H * 0.12}
        x2={W * 0.88}
        y2={H * 0.92}
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1.2}
      />
      <Line
        x1={W * 0.18}
        y1={H * 0.42}
        x2={W * 0.82}
        y2={H * 0.42}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1.2}
      />
      <Line
        x1={W * 0.22}
        y1={H * 0.62}
        x2={W * 0.78}
        y2={H * 0.62}
        stroke="rgba(255,255,255,0.14)"
        strokeWidth={1}
      />
      <AnimatedPath
        animatedProps={foamProps}
        stroke={silk.foam}
        strokeOpacity={opacities.foam}
        strokeWidth={3.2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1,
  },
  tank: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
