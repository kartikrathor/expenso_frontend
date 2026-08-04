import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  FadeIn,
  interpolate,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Radius, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Soft pulse bone — theme-aware placeholder. */
export function Skeleton({
  width = '100%',
  height = 14,
  radius = Radius.sm,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.45);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.surfaceHighlight,
        },
        animStyle,
        style,
      ]}
    />
  );
}

/**
 * Cold-start splash — branded mark + soft motion instead of a fake Home skeleton.
 * Feels intentional while auth / session / expenses hydrate.
 */
export function AppBootSkeleton() {
  const { colors, gradientPoints, actionGradient, isDark } = useTheme();
  const styles = useMemo(() => splashStyles(colors), [colors]);

  const markScale = useSharedValue(0.86);
  const markGlow = useSharedValue(0.35);
  const bar = useSharedValue(0);

  useEffect(() => {
    markScale.value = withSpring(1, { damping: 14, stiffness: 120 });
    markGlow.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    bar.value = withDelay(
      280,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
        -1,
        false,
      ),
    );
  }, [markScale, markGlow, bar]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: markScale.value }],
    shadowOpacity: interpolate(markGlow.value, [0.35, 1], [0.25, 0.55]),
  }));

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(bar.value, [0, 1], [-120, 220]) }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[
          colors.gradientStart + (isDark ? '33' : '22'),
          colors.background,
          colors.gradientEnd + (isDark ? '18' : '14'),
        ]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        <Animated.View style={[styles.markWrap, markStyle]}>
          <LinearGradient
            colors={[...actionGradient]}
            {...(gradientPoints
              ? { start: gradientPoints.start, end: gradientPoints.end }
              : { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } })}
            style={styles.mark}
          >
            <Text style={styles.markLetter}>E</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(120).duration(500)}>
          <Text style={styles.brand}>Expenso</Text>
          <Text style={styles.tagline}>Getting things ready…</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.track, { backgroundColor: colors.surfaceHighlight }]}>
          <Animated.View style={[styles.barHost, barStyle]}>
            <LinearGradient
              colors={['transparent', colors.primaryLight, colors.accent, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.bar}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

/** Ask tab — chat history hydrate. */
export function ChatHistorySkeleton() {
  const styles = chatStyles;

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Skeleton width="78%" height={56} radius={Radius.lg} />
      </View>
      <View style={styles.right}>
        <Skeleton width="62%" height={40} radius={Radius.lg} />
      </View>
      <View style={styles.left}>
        <Skeleton width="88%" height={72} radius={Radius.lg} />
      </View>
      <View style={styles.right}>
        <Skeleton width="48%" height={40} radius={Radius.lg} />
      </View>
      <View style={styles.left}>
        <Skeleton width="70%" height={48} radius={Radius.lg} />
      </View>
    </View>
  );
}

/** Support tickets list — first network fetch. */
export function TicketListSkeleton({ count = 4 }: { count?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => ticketStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.row}>
            <Skeleton width="55%" height={14} />
            <Skeleton width={52} height={12} radius={Radius.full} />
          </View>
          <Skeleton width="90%" height={12} style={{ marginTop: Spacing.sm }} />
          <Skeleton width="40%" height={11} style={{ marginTop: Spacing.sm }} />
        </View>
      ))}
    </View>
  );
}

function splashStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'center',
    },
    center: {
      alignItems: 'center',
      paddingHorizontal: Spacing.xl,
      marginBottom: Spacing.xxl,
    },
    markWrap: {
      marginBottom: Spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowRadius: 24,
      elevation: 10,
    },
    mark: {
      width: 88,
      height: 88,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    markLetter: {
      fontSize: 42,
      fontWeight: '800',
      color: '#FFF',
      letterSpacing: -1,
    },
    brand: {
      ...Typography.h1,
      color: colors.text,
      textAlign: 'center',
      letterSpacing: -0.8,
    },
    tagline: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    footer: {
      position: 'absolute',
      left: Spacing.xl,
      right: Spacing.xl,
      bottom: Spacing.xxl + 12,
    },
    track: {
      height: 3,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
    barHost: {
      width: 120,
      height: '100%',
    },
    bar: {
      flex: 1,
      borderRadius: Radius.full,
    },
  });
}

const chatStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  left: { alignSelf: 'flex-start', width: '100%' },
  right: { alignSelf: 'flex-end', width: '100%', alignItems: 'flex-end' },
});

function ticketStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: { marginTop: Spacing.md, gap: Spacing.sm },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.md,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  });
}
