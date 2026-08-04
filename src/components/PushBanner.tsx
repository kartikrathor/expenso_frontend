import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export type PushBannerPayload = {
  title: string;
  body: string;
  type?: string;
};

type Props = {
  payload: PushBannerPayload | null;
  onHide: () => void;
  onPress?: () => void;
};

export function PushBanner({ payload, onHide, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!payload) return;
    translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
    opacity.value = withTiming(1, { duration: 180 });
    translateY.value = withDelay(
      4200,
      withTiming(-140, { duration: 320 }, finished => {
        if (finished) runOnJS(onHide)();
      }),
    );
    opacity.value = withDelay(4200, withTiming(0, { duration: 320 }));
  }, [payload, translateY, opacity, onHide]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!payload) return null;

  return (
    <Animated.View style={[styles.wrap, { top: insets.top + 8 }, style]}>
      <Pressable
        style={styles.card}
        onPress={() => {
          onPress?.();
          onHide();
        }}
      >
        <View style={styles.icon}>
          <Text style={styles.iconText}>🔔</Text>
        </View>
        <View style={styles.copy}>
          <Text style={styles.app}>Expenso</Text>
          <Text style={styles.title} numberOfLines={1}>
            {payload.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {payload.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: Spacing.lg,
      right: Spacing.lg,
      zIndex: 2000,
      elevation: 20,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 18,
      elevation: 14,
    },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '22',
    },
    iconText: { fontSize: 20 },
    copy: { flex: 1 },
    app: {
      ...Typography.caption,
      color: colors.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    title: { ...Typography.bodyBold, color: colors.text },
    body: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  });
}
