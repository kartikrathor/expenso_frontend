import React, { useMemo, type ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface EmptyStateProps {
  title: string;
  subtitle: string;
  /** Legacy emoji glyph — ignored when `icon` is provided */
  emoji?: string;
  /** Preferred custom illustration (SVG, etc.) */
  icon?: ReactNode;
}

export function EmptyState({ emoji, icon, title, subtitle }: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View entering={FadeIn.delay(200)} style={styles.container}>
      {icon ? (
        <View style={styles.iconWrap}>{icon}</View>
      ) : emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
    iconWrap: { marginBottom: Spacing.md, alignItems: 'center', justifyContent: 'center' },
    emoji: { fontSize: 56, marginBottom: Spacing.md },
    title: { ...Typography.h3, color: colors.text, textAlign: 'center', marginBottom: Spacing.sm },
    subtitle: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });
}
