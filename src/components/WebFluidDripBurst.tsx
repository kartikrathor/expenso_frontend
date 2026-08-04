import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useThemeStore } from '../store/themeStore';

type DropSpec = {
  id: string;
  x: number;
  startY: number;
  fall: number;
  delay: number;
  width: number;
  height: number;
  stretch: number;
  tint: string;
};

const TINTS = ['#DC2626', '#E11D48', '#1E3A8A', '#E0F2FE', '#9F1239', '#FFFFFF'];

function buildDrops(seed: number): DropSpec[] {
  // Deterministic-ish fan around the FAB so each burst feels organic
  const base = seed % 7;
  return Array.from({ length: 10 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const ring = Math.floor(i / 2);
    return {
      id: `d${seed}-${i}`,
      x: side * (18 + ring * 14 + ((base + i) % 5) * 3),
      startY: -8 - ring * 6 - (i % 3) * 4,
      fall: 70 + ring * 28 + (i % 4) * 12,
      delay: i * 35 + (i % 3) * 20,
      width: 5 + (i % 3) * 2,
      height: 10 + (i % 4) * 4,
      stretch: 1.6 + (i % 3) * 0.35,
      tint: TINTS[i % TINTS.length],
    };
  });
}

interface WebFluidDripBurstProps {
  /** Increment to fire a new burst */
  trigger: number;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}

/**
 * Viscous silk drips that fall around the + FAB when pressed.
 * Only for Red Web Spider (unless enabled is forced).
 */
export function WebFluidDripBurst({ trigger, style, enabled }: WebFluidDripBurstProps) {
  const packId = useThemeStore(s => s.packId);
  const show = enabled ?? packId === 'red_web_spider';
  const drops = useMemo(() => (trigger > 0 ? buildDrops(trigger) : []), [trigger]);

  if (!show || trigger <= 0) return null;

  return (
    <View style={[styles.root, style]} pointerEvents="none">
      {drops.map(d => (
        <DripDrop key={d.id} spec={d} burstId={trigger} />
      ))}
    </View>
  );
}

function DripDrop({ spec, burstId }: { spec: DropSpec; burstId: number }) {
  const progress = useSharedValue(0);
  const [alive, setAlive] = React.useState(true);

  useEffect(() => {
    setAlive(true);
    progress.value = 0;
    progress.value = withDelay(
      spec.delay,
      withSequence(
        withTiming(1, { duration: 780, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }),
        withTiming(1, { duration: 40 }),
      ),
    );
    const t = setTimeout(() => setAlive(false), spec.delay + 900);
    return () => clearTimeout(t);
  }, [burstId, spec.delay, progress]);

  const anim = useAnimatedStyle(() => {
    const t = progress.value;
    const y = spec.startY + spec.fall * t;
    // Stretch like viscous fluid mid-fall, then round near land
    const scaleY = 1 + (spec.stretch - 1) * Math.sin(Math.min(1, t) * Math.PI);
    const scaleX = 1 - 0.25 * Math.sin(Math.min(1, t) * Math.PI);
    const opacity = t < 0.12 ? t / 0.12 : t > 0.7 ? (1 - t) / 0.3 : 1;
    return {
      opacity,
      transform: [
        { translateX: spec.x },
        { translateY: y },
        { scaleX },
        { scaleY },
      ],
    };
  });

  if (!alive) return null;

  return (
    <Animated.View
      style={[
        styles.drop,
        {
          width: spec.width,
          height: spec.height,
          borderRadius: spec.width,
          backgroundColor: spec.tint,
        },
        anim,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 8,
  },
  drop: {
    position: 'absolute',
    shadowColor: '#BE123C',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
