import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing, Typography } from '../constants/theme';

export function ThemeToggle() {
  const { isDark, toggleTheme, colors } = useTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        style={[styles.btn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        onPress={toggleTheme}
        onPressIn={() => { scale.value = withSpring(0.92); }}
        onPressOut={() => { scale.value = withSpring(1); }}
      >
        <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {isDark ? 'Light' : 'Dark'}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  icon: { fontSize: 16 },
  label: { ...Typography.small, fontWeight: '600' },
});
