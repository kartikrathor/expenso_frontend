import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
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

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WaterGradientProps {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** Remaining budget ratio (0–1). 1 = full tank left, 0 = depleted. */
  fill?: number;
  instant?: boolean;
}

/**
 * Glass tank filled to `fill`. First mount: water rises in.
 * Later changes spring from current level (drains when you spend).
 * Surface waves travel RIGHT → LEFT.
 */
export function WaterGradient({
  style,
  children,
  fill = 0.58,
  instant = false,
}: WaterGradientProps) {
  const { colors } = useTheme();
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
        withSpring(targetFill, { damping: 16, stiffness: 48, mass: 1.2 }),
      );
      return;
    }

    // Expense / budget change: animate from current level (up or down)
    fillProgress.value = withSpring(targetFill, {
      damping: 18,
      stiffness: 72,
      mass: 1,
    });
  }, [targetFill, instant, fillProgress]);

  useEffect(() => {
    // Continuous R→L: increasing phase shifts crests leftward
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [phase, bob]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setCardSize({ w: Math.ceil(width), h: Math.ceil(height) });
    }
  };

  const waterBodyStyle = useAnimatedStyle(() => {
    const bobPx = interpolate(bob.value, [0, 1], [-2.5, 3.5]);
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
      {/* EMPTY tank above — only water paints color from bottom */}
      <Animated.View style={[styles.waterTank, waterBodyStyle]} pointerEvents="none">
        {cardSize.w > 0 && (
          <WaterSvg
            uid={uid}
            width={cardSize.w}
            height={waterH}
            phase={phase}
            colors={waterColors}
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
}: {
  uid: string;
  width: number;
  height: number;
  phase: SharedValue<number>;
  colors: { deep: string; mid: string; surface: string; glow: string };
}) {
  const W = width;
  const H = Math.max(height, 60);

  // Wave path using cubic bezier segments — only ~6 anchor points instead of 200 L-commands.
  // This runs on the UI thread (worklet) but does ~98% less math per frame.
  const frontProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(10, H * 0.08);
    const baseY = amp + 6;
    const p = phase.value;
    // 4 evenly spaced anchors across width; bezier handles create the sinusoidal curve
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
    const amp = Math.min(13, H * 0.1);
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

  // Foam: same bezier as front wave shifted up 2px — reuse anchors, no extra loop
  const foamProps = useAnimatedProps(() => {
    'worklet';
    const amp = Math.min(10, H * 0.08);
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
          <Stop offset="0" stopColor={colors.surface} stopOpacity="0.95" />
          <Stop offset="0.4" stopColor={colors.mid} stopOpacity="0.9" />
          <Stop offset="1" stopColor={colors.deep} stopOpacity="0.98" />
        </SvgGradient>
        <SvgGradient id={`${uid}-back`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.glow} stopOpacity="0.5" />
          <Stop offset="1" stopColor={colors.deep} stopOpacity="0.75" />
        </SvgGradient>
      </Defs>

      <AnimatedPath animatedProps={backProps} fill={`url(#${uid}-back)`} />
      <AnimatedPath animatedProps={frontProps} fill={`url(#${uid}-body)`} />
      <AnimatedPath
        animatedProps={foamProps}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={2.2}
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
