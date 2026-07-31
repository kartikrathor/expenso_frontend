import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface QuickAddBarProps {
  onPress: () => void;
}

const SUGGESTIONS = ['Blinkit 200', 'Swiggy 350', 'Uber 120'];

export function QuickAddBar({ onPress }: QuickAddBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.wrap}>
      <Pressable onPress={onPress}>
        <LinearGradient
          colors={[colors.surfaceElevated, colors.surfaceHighlight]}
          style={styles.bar}
        >
          <Text style={styles.icon}>⚡</Text>
          <Text style={styles.placeholder}>Quick add — type "Blinkit 200"...</Text>
        </LinearGradient>
      </Pressable>
      <View style={styles.chips}>
        {SUGGESTIONS.map(s => (
          <Pressable key={s} style={styles.chip} onPress={onPress}>
            <Text style={styles.chipText}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: { marginBottom: Spacing.lg },
    bar: {
      flexDirection: 'row', alignItems: 'center', padding: Spacing.md,
      borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.primary + '44', gap: Spacing.sm,
    },
    icon: { fontSize: 18 },
    placeholder: { ...Typography.body, color: colors.textMuted, flex: 1 },
    chips: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    chip: {
      paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full,
      backgroundColor: colors.primary + '18', borderWidth: 1, borderColor: colors.primary + '33',
    },
    chipText: { ...Typography.small, color: colors.primaryLight },
  });
}
