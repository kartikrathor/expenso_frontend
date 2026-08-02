import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EmptyState } from '../components/EmptyState';
import { ThemeToggle } from '../components/ThemeToggle';
import { getCategoryConfig } from '../constants/categories';
import { formatCurrency, formatCompactCurrency } from '../utils/expenseParser';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { TimeFilter } from '../types/expense';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart, BarChart, LineChart } from 'react-native-gifted-charts';

const FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomPad = getTabBarBottomInset(insets.bottom);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState<TimeFilter>('month');

  const {
    isJoint,
    expenses,
    monthlyBudget,
    onRefresh,
    refreshing,
    getTotal,
    getCategoryBreakdown,
    getMerchantBreakdown,
    getDailySpending,
    getFiltered,
  } = useHouseholdExpenses();

  const total = useMemo(() => getTotal(filter), [getTotal, filter, expenses]);
  const categories = useMemo(() => getCategoryBreakdown(filter), [getCategoryBreakdown, filter, expenses]);
  const merchants = useMemo(() => getMerchantBreakdown(filter), [getMerchantBreakdown, filter, expenses]);
  const daily = useMemo(() => getDailySpending(filter), [getDailySpending, filter, expenses]);
  const expenseCount = useMemo(() => getFiltered(filter).length, [getFiltered, filter, expenses]);
  const hasData = expenseCount > 0;

  const pieData = categories.map(c => ({
    value: c.amount,
    color: c.color,
    text: getCategoryConfig(c.category as any).emoji,
  }));

  const lineData = daily.map(d => ({
    value: d.value,
    label: d.label,
    dataPointColor: colors.primary,
    dataPointRadius: 5,
  }));

  const merchantBarData = merchants.slice(0, 6).map((m, i) => ({
    value: m.amount,
    label: m.merchant.slice(0, 5),
    frontColor: colors.chartColors[i % colors.chartColors.length],
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(220)} style={styles.titleRow}>
          <View>
            <Text style={styles.title}>Insights 📊</Text>
            <Text style={styles.subtitle}>
              {isJoint ? 'Shared joint spending' : 'Smart breakdown of your spending'}
            </Text>
          </View>
          <ThemeToggle />
        </Animated.View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {FILTERS.map(f => (
            <Pressable
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {!hasData ? (
          <EmptyState emoji="📈" title="No data yet" subtitle="Add some expenses and your charts will appear here" />
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(60).duration(200)} style={styles.totalCard}>
              <Text style={styles.totalLabel}>{isJoint ? 'Joint Total' : 'Total Spent'}</Text>
              <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
              <Text style={styles.totalSub}>{expenseCount} transactions</Text>
              {monthlyBudget > 0 && filter === 'month' && (
                <View style={styles.budgetHint}>
                  <Text style={styles.budgetHintText}>
                    Budget: {Math.round((total / monthlyBudget) * 100)}% used
                  </Text>
                </View>
              )}
            </Animated.View>

            {pieData.length > 0 && (
              <Animated.View entering={FadeInDown.delay(120).duration(200)} style={styles.chartCard}>
                <Text style={styles.chartTitle}>By Category</Text>
                <View style={styles.pieRow}>
                  <PieChart
                    data={pieData}
                    donut
                    radius={78}
                    innerRadius={50}
                    innerCircleColor={colors.surface}
                    centerLabelComponent={() => (
                      <Text style={styles.pieCenter}>{formatCompactCurrency(total)}</Text>
                    )}
                  />
                  <View style={styles.legend}>
                    {categories.slice(0, 5).map(c => (
                      <View key={c.category} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: c.color }]} />
                        <Text style={styles.legendLabel}>{getCategoryConfig(c.category as any).label}</Text>
                        <Text style={styles.legendAmount}>{formatCompactCurrency(c.amount)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}

            {lineData.length > 1 && (
              <Animated.View entering={FadeInDown.delay(180).duration(200)} style={styles.chartCard}>
                <Text style={styles.chartTitle}>Spending Trend</Text>
                <LineChart
                  data={lineData}
                  width={SCREEN_WIDTH - 72}
                  height={160}
                  spacing={40}
                  color={colors.primary}
                  thickness={3}
                  startFillColor={colors.primary + '44'}
                  endFillColor={colors.primary + '05'}
                  areaChart
                  curved
                  hideRules
                  yAxisTextStyle={styles.axisText}
                  xAxisLabelTextStyle={styles.axisText}
                  isAnimated
                  animationDuration={900}
                />
              </Animated.View>
            )}

            {merchantBarData.length > 0 && (
              <Animated.View entering={FadeInDown.delay(240).duration(200)} style={styles.chartCard}>
                <Text style={styles.chartTitle}>Top Merchants</Text>
                <BarChart
                  data={merchantBarData}
                  barWidth={24}
                  spacing={18}
                  roundedTop
                  hideRules
                  xAxisThickness={0}
                  yAxisThickness={0}
                  noOfSections={3}
                  maxValue={Math.max(...merchants.map(m => m.amount)) * 1.15 || 100}
                  width={SCREEN_WIDTH - 72}
                  height={160}
                  isAnimated
                  barBorderRadius={6}
                />
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(300).duration(200)} style={styles.insightCard}>
              <Text style={styles.insightTitle}>💡 Insight</Text>
              {categories[0] && (
                <Text style={styles.insightText}>
                  {getCategoryConfig(categories[0].category as any).emoji}{' '}
                  {getCategoryConfig(categories[0].category as any).label} — sabse zyada (
                  {Math.round((categories[0].amount / total) * 100)}%)
                </Text>
              )}
              {merchants[0] && (
                <Text style={[styles.insightText, { marginTop: 6 }]}>
                  🏪 {merchants[0].merchant}: {formatCurrency(merchants[0].amount)}
                </Text>
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: Spacing.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  title: { ...Typography.h1, color: colors.text },
  subtitle: { ...Typography.caption, color: colors.textSecondary },
  filterRow: { marginBottom: Spacing.lg },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: Spacing.sm,
  },
  filterChipActive: { backgroundColor: colors.primary + '33', borderColor: colors.primary },
  filterText: { ...Typography.caption, color: colors.textSecondary },
  filterTextActive: { color: colors.primaryLight, fontWeight: '700' },
  totalCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  totalLabel: { ...Typography.caption, color: colors.textSecondary, letterSpacing: 1 },
  totalAmount: { fontSize: 36, fontWeight: '800', color: colors.text, marginVertical: 4 },
  totalSub: { ...Typography.caption, color: colors.textMuted },
  budgetHint: {
    marginTop: Spacing.sm,
    backgroundColor: colors.warning + '22',
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  budgetHintText: { ...Typography.small, color: colors.warning },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: { ...Typography.h2, color: colors.text, marginBottom: Spacing.md, fontSize: 18 },
  pieRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pieCenter: { ...Typography.bodyBold, color: colors.text },
  legend: { flex: 1, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { ...Typography.small, color: colors.text, flex: 1 },
  legendAmount: { ...Typography.small, color: colors.textSecondary },
  axisText: { color: colors.textMuted, fontSize: 9 },
  insightCard: {
    backgroundColor: colors.primary + '15',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  insightTitle: { ...Typography.bodyBold, color: colors.primaryLight, marginBottom: Spacing.sm },
  insightText: { ...Typography.body, color: colors.textSecondary, lineHeight: 22 },
  });
}
