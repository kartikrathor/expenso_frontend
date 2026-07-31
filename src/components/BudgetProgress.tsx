import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { formatCurrency, formatCompactCurrency } from '../utils/expenseParser';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface BudgetProgressProps {
  spent: number;
  budget: number;
  onSetBudget?: () => void;
}

export function BudgetProgress({ spent, budget, onSetBudget }: BudgetProgressProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const width = useSharedValue(0);

  React.useEffect(() => {
    width.value = withSpring(pct, { damping: 16, stiffness: 90 });
  }, [pct, width]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  const remaining = Math.max(budget - spent, 0);
  const isOver = budget > 0 && spent > budget;
  const barColors = isOver
    ? [colors.danger, colors.warning]
    : pct > 0.8
      ? [colors.warning, colors.accentWarm]
      : [colors.primary, colors.accent];

  return (
    <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Monthly Budget</Text>
          <Text style={styles.budgetAmount}>{budget > 0 ? formatCurrency(budget) : 'Set budget'}</Text>
        </View>
        <Pressable onPress={onSetBudget} style={styles.editBtn}>
          <Text style={styles.editText}>{budget > 0 ? 'Edit' : '+ Set'}</Text>
        </Pressable>
      </View>

      {budget > 0 && (
        <>
          <View style={styles.track}>
            <Animated.View style={[styles.fillWrap, barStyle]}>
              <LinearGradient colors={barColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
            </Animated.View>
          </View>
          <View style={styles.footer}>
            <Text style={[styles.footerText, isOver && { color: colors.danger }]}>
              {isOver ? 'Over by ' : 'Left '}{formatCompactCurrency(isOver ? spent - budget : remaining)}
            </Text>
            <Text style={styles.footerText}>{Math.round(pct * 100)}% used</Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
      marginBottom: Spacing.md, borderWidth: 1, borderColor: colors.border,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    label: { ...Typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
    budgetAmount: { ...Typography.h2, color: colors.text, marginTop: 2 },
    editBtn: {
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
      backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary + '44',
    },
    editText: { ...Typography.caption, color: colors.primaryLight, fontWeight: '700' },
    track: { height: 10, backgroundColor: colors.surfaceHighlight, borderRadius: Radius.full, overflow: 'hidden' },
    fillWrap: { height: '100%', minWidth: 4 },
    fill: { flex: 1, borderRadius: Radius.full },
    footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    footerText: { ...Typography.caption, color: colors.textMuted },
  });
}
