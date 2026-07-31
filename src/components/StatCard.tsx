import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { formatCurrency, formatCompactCurrency } from '../utils/expenseParser';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface StatCardProps {
  label: string;
  amount: number;
  subtitle?: string;
  index?: number;
  variant?: 'primary' | 'default';
}

export function StatCard({ label, amount, subtitle, index = 0, variant = 'default' }: StatCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (variant === 'primary') {
    return (
      <Animated.View entering={FadeInDown.delay(index * 100).springify()} style={styles.primaryWrapper}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primaryCard}
        >
          <Text style={styles.primaryLabel}>{label}</Text>
          <Text style={styles.primaryAmount}>{formatCurrency(amount)}</Text>
          {subtitle && <Text style={styles.primarySubtitle}>{subtitle}</Text>}
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>{formatCompactCurrency(amount)}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    primaryWrapper: {
      marginBottom: Spacing.md,
    },
    primaryCard: {
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      minHeight: 120,
      justifyContent: 'center',
    },
    primaryLabel: {
      ...Typography.caption,
      color: 'rgba(238, 242, 255, 0.85)',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    primaryAmount: {
      fontSize: 40,
      fontWeight: '800',
      color: '#EEF2FF',
      letterSpacing: -1,
      marginVertical: 4,
    },
    primarySubtitle: {
      ...Typography.caption,
      color: 'rgba(238, 242, 255, 0.72)',
    },
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      ...Typography.caption,
      color: colors.textSecondary,
    },
    amount: {
      ...Typography.h2,
      color: colors.text,
      marginTop: 4,
    },
    subtitle: {
      ...Typography.small,
      color: colors.textMuted,
      marginTop: 2,
    },
  });
}
