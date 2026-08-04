import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { useThemeStore } from '../store/themeStore';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WaterGradientProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Remaining budget ratio (0–1). 1 = full tank left, 0 = depleted. */
  fill?: number;
  instant?: boolean;
  /** Pause wave animation when off-screen (saves UI thread). */
  active?: boolean;
}

/**
 * Glass tank filled to `fill`. First mount: fluid rises in.
 * Later changes spring from current level (drains when you spend).
 * Surface waves travel RIGHT → LEFT.
 * Red Web Spider pack: viscous silk-fluid look (pearlescent + faint strands).
 */
export function WaterGradient({
  style,
  children,
  fill = 0.58,
  instant = false,
  active = true,
}: WaterGradientProps) {
  const { colors } = useTheme();
  const packId = useThemeStore(s => s.packId);
  const silkMode = packId === 'red_web_spider';
  const uid = React.useId().replace(/:/g, '');
  const [cardSize, setCardSize] = useState({ w: 0, h: 0 });
  const didMount = useRef(false);

  // Keep a thin puddle when budget is exhausted so the wave still reads
  const targetFill = Math.max(0.06, Math.min(1, fill));
  const fillProgress = useSharedValue(0);
  const phase = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    if (instant) {
      fillProgress.value = targetFill;
      didMount.current = true;
      return;
    }

    if (!didMount.current) {
      didMount.current = true;
      fillProgress.value = 0;
      fillProgress.value = withDelay(
        80,
        withSpring(targetFill, {
          damping: silkMode ? 20 : 16,
          stiffness: silkMode ? 36 : 48,
          mass: silkMode ? 1.6 : 1.2,
        }),
      );
      return;
    }

    // Expense / budget change: animate from current level (up or down)
    fillProgress.value = withSpring(targetFill, {
      damping: silkMode ? 22 : 18,
      stiffness: silkMode ? 54 : 72,
      mass: silkMode ? 1.35 : 1,
    });
  }, [targetFill, instant, fillProgress, silkMode]);

  useEffect(() => {
    if (!active) {
      cancelAnimation(phase);
      cancelAnimation(bob);
      return;
    }
    // Silk fluid = slower / more viscous; water = lighter travel
    const waveMs = silkMode ? 14000 : 10000;
    const bobMs = silkMode ? 4800 : 3600;
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: waveMs, easing: Easing.linear }),
      -1,
      false,
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: bobMs, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: bobMs, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(phase);
      cancelAnimation(bob);
    };
  }, [active, phase, bob, silkMode]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCardSize({ w: Math.ceil(width), h: Math.ceil(height) });
    }
  };

  const waterBodyStyle = useAnimatedStyle(() => {
    const bobPx = interpolate(bob.value, [0, 1], silkMode ? [-1.5, 2.2] : [-2.5, 3.5]);
    return {
      height: `${fillProgress.value * 100}%`,
      transform: [{ translateY: bobPx }],
    };
  });

  const waterColors = useMemo(
    () => ({
      deep: colors.gradientStart,
      mid: colors.gradientMid,
      surface: colors.gradientEnd,
      glow: colors.gradientGlow,
    }),
    [colors],
  );

  // Approximate water height for SVG viewBox (updates as fill target changes)
  const waterH = Math.max(48, Math.round(cardSize.h * targetFill));

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
      onLayout={onLayout}
    >
      {/* EMPTY tank above — only fluid paints color from bottom */}
      <Animated.View style={[styles.waterTank, waterBodyStyle]} pointerEvents="none">
        {cardSize.w > 0 && (
          <WaterSvg
            uid={uid}
            width={cardSize.w}
            height={waterH}
            phase={phase}
            colors={waterColors}
            silkMode={silkMode}
          />
        )}
      </Animated.View>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

function WaterSvg({
  uid,
  width,
  height,
  phase,
  colors,
  silkMode,
}: {
  uid: string;
  width: number;
  height: number;
  phase: SharedValue<number>;
  colors: { deep: string; mid: string; surface: string; glow: string };
  silkMode: boolean;
}) {
  const W = width;
  const H = Math.max(height, 60);

  // Wave path using cubic bezier segments — only ~6 anchor points instead of 200 L-commands.
  // This runs on the UI thread (worklet) but does ~98% less math per frame.
  const frontProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(silkMode ? 7 : 10, H * (silkMode ? 0.055 : 0.08));
    const baseY = amp + 6;
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

  // Back swell — offset phase, slightly more amplitude
  const backProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(silkMode ? 9 : 13, H * (silkMode ? 0.07 : 0.1));
    const baseY = amp + 10;
    const p = phase.value * 0.65 + 1.8;
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

  // Foam / silk meniscus: same bezier as front wave shifted up
  const foamProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(silkMode ? 7 : 10, H * (silkMode ? 0.055 : 0.08));
    const baseY = amp + 4;
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

  // Faint drifting silk filaments (only in silk mode) — cheap static lines + opacity pulse via phase
  const strandProps = useAnimatedProps(() => {
    'worklet';
    // Soft shimmer: keep path fixed, animate stroke opacity via unused attribute isn't possible;
    // instead nudge a tiny vertical offset so strands feel suspended in fluid.
    const drift = Math.sin(phase.value) * 2.5;
    const y1 = H * 0.28 + drift;
    const y2 = H * 0.55 - drift * 0.6;
    const y3 = H * 0.78 + drift * 0.4;
    const d =
      `M ${W * 0.12} ${y1} Q ${W * 0.35} ${y1 - 8} ${W * 0.55} ${y1 + 4}` +
      ` M ${W * 0.28} ${y2} Q ${W * 0.5} ${y2 + 10} ${W * 0.78} ${y2 - 2}` +
      ` M ${W * 0.18} ${y3} Q ${W * 0.45} ${y3 - 6} ${W * 0.72} ${y3 + 3}`;
    return { d };
  });

  const foamStroke = silkMode ? 'rgba(224, 242, 254, 0.72)' : 'rgba(255,255,255,0.55)';
  const foamWidth = silkMode ? 2.8 : 2.2;

  return (
    <Svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={styles.svg}
      pointerEvents="none"
    >
      <Defs>
        <SvgGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surface} stopOpacity={silkMode ? '0.88' : '0.95'} />
          <Stop offset={silkMode ? '0.35' : '0.4'} stopColor={colors.mid} stopOpacity={silkMode ? '0.82' : '0.9'} />
          <Stop offset="1" stopColor={colors.deep} stopOpacity={silkMode ? '0.96' : '0.98'} />
        </SvgGradient>
        <SvgGradient id={`${uid}-back`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.glow} stopOpacity={silkMode ? '0.62' : '0.5'} />
          <Stop offset="1" stopColor={colors.deep} stopOpacity={silkMode ? '0.7' : '0.75'} />
        </SvgGradient>
        {silkMode && (
          <SvgGradient id={`${uid}-pearl`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.glow} stopOpacity="0" />
            <Stop offset="0.45" stopColor={colors.glow} stopOpacity="0.28" />
            <Stop offset="1" stopColor={colors.glow} stopOpacity="0" />
          </SvgGradient>
        )}
      </Defs>

      <AnimatedPath animatedProps={backProps} fill={`url(#${uid}-back)`} />
      <AnimatedPath animatedProps={frontProps} fill={`url(#${uid}-body)`} />

      {silkMode && (
        <>
          {/* Pearlescent sheen band across the silk body */}
          <Path
            d={`M 0 ${H * 0.2} L ${W} ${H * 0.12} L ${W} ${H * 0.42} L 0 ${H * 0.5} Z`}
            fill={`url(#${uid}-pearl)`}
          />
          {/* Suspended silk filaments */}
          <AnimatedPath
            animatedProps={strandProps}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1.1}
            fill="none"
            strokeLinecap="round"
          />
          {/* Soft radial web hint — geometric, not character IP */}
          <Line
            x1={W * 0.5}
            y1={H * 0.15}
            x2={W * 0.18}
            y2={H * 0.9}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <Line
            x1={W * 0.5}
            y1={H * 0.15}
            x2={W * 0.82}
            y2={H * 0.9}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <Line
            x1={W * 0.22}
            y1={H * 0.45}
            x2={W * 0.78}
            y2={H * 0.45}
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
          />
        </>
      )}

      <AnimatedPath
        animatedProps={foamProps}
        stroke={foamStroke}
        strokeWidth={foamWidth}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
  },
  waterTank: {
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
  content: {
    position: 'relative',
    zIndex: 3,
  },
});
