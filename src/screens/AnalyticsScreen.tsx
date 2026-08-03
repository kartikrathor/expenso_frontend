import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { EmptyState } from '../components/EmptyState';
import { ThemeToggle } from '../components/ThemeToggle';
import { StatsChartIcon } from '../components/icons/StatsChartIcon';
import { getCategoryConfig } from '../constants/categories';
import { formatCurrency, formatCompactCurrency } from '../utils/expenseParser';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { TimeFilter } from '../types/expense';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart, LineChart } from 'react-native-gifted-charts';

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
  const categories = useMemo(
    () => getCategoryBreakdown(filter),
    [getCategoryBreakdown, filter, expenses],
  );
  const merchants = useMemo(
    () => getMerchantBreakdown(filter),
    [getMerchantBreakdown, filter, expenses],
  );
  const daily = useMemo(() => getDailySpending(filter), [getDailySpending, filter, expenses]);
  const expenseCount = useMemo(() => getFiltered(filter).length, [getFiltered, filter, expenses]);
  const hasData = expenseCount > 0;
  const budgetPct =
    monthlyBudget > 0 && filter === 'month'
      ? Math.min(999, Math.round((total / monthlyBudget) * 100))
      : null;

  const pieData = categories.map(c => ({
    value: c.amount,
    color: c.color,
  }));

  const lineData = daily.map((d, i) => ({
    value: d.value,
    label: i % Math.max(1, Math.ceil(daily.length / 5)) === 0 ? d.label : '',
    dataPointColor: colors.primaryLight,
    dataPointRadius: 3.5,
    hideDataPoint: d.value <= 0,
  }));

  const maxMerchant = Math.max(...merchants.map(m => m.amount), 1);
  const maxCategory = Math.max(...categories.map(c => c.amount), 1);

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
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.subtitle}>
              {isJoint ? 'Shared joint spending' : 'Where your money went'}
            </Text>
          </View>
          <ThemeToggle />
        </Animated.View>

        <View style={styles.filterRow}>
          {FILTERS.map(f => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                {active ? (
                  <LinearGradient
                    colors={[colors.gradientStart, colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.filterGrad}
                  >
                    <Text style={styles.filterTextOn}>{f.label}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={styles.filterText}>{f.label}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {!hasData ? (
          <EmptyState
            icon={
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                <StatsChartIcon size={36} color={colors.primaryLight} />
              </View>
            }
            title="No insights yet"
            subtitle="Add a few expenses and your spending charts will show up here"
          />
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(40).duration(220)} style={styles.heroCard}>
              <LinearGradient
                colors={[colors.gradientStart + '33', colors.surfaceElevated]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGrad}
              >
                <Text style={styles.totalLabel}>
                  {isJoint ? 'JOINT TOTAL' : 'TOTAL SPENT'}
                </Text>
                <Text style={styles.totalAmount}>{formatCurrency(total)}</Text>
                <View style={styles.heroMeta}>
                  <Text style={styles.totalSub}>{expenseCount} transactions</Text>
                  {budgetPct != null && (
                    <View
                      style={[
                        styles.budgetPill,
                        {
                          backgroundColor:
                            budgetPct > 100 ? colors.danger + '22' : colors.primary + '22',
                          borderColor:
                            budgetPct > 100 ? colors.danger + '55' : colors.primary + '44',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.budgetPillText,
                          { color: budgetPct > 100 ? colors.danger : colors.primaryLight },
                        ]}
                      >
                        {budgetPct}% of budget
                      </Text>
                    </View>
                  )}
                </View>
              </LinearGradient>
            </Animated.View>

            {pieData.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).duration(220)} style={styles.chartCard}>
                <Text style={styles.chartTitle}>By category</Text>
                <View style={styles.pieRow}>
                  <PieChart
                    data={pieData}
                    donut
                    radius={82}
                    innerRadius={54}
                    innerCircleColor={colors.surface}
                    strokeWidth={3}
                    strokeColor={colors.surface}
                    showText={false}
                    focusOnPress
                    centerLabelComponent={() => (
                      <View style={styles.pieCenterWrap}>
                        <Text style={styles.pieCenterValue}>{formatCompactCurrency(total)}</Text>
                        <Text style={styles.pieCenterHint}>total</Text>
                      </View>
                    )}
                  />
                  <View style={styles.legend}>
                    {categories.slice(0, 5).map(c => {
                      const cfg = getCategoryConfig(c.category as any);
                      const pct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
                      return (
                        <View key={c.category} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: c.color }]} />
                          <View style={styles.legendCopy}>
                            <Text style={styles.legendLabel} numberOfLines={1}>
                              {cfg.label}
                            </Text>
                            <View style={styles.legendBarTrack}>
                              <View
                                style={[
                                  styles.legendBarFill,
                                  {
                                    width: `${Math.max(6, (c.amount / maxCategory) * 100)}%` as any,
                                    backgroundColor: c.color,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                          <View style={styles.legendRight}>
                            <Text style={styles.legendAmount}>{formatCompactCurrency(c.amount)}</Text>
                            <Text style={styles.legendPct}>{pct}%</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>
            )}

            {lineData.length > 1 && (
              <Animated.View entering={FadeInDown.delay(160).duration(220)} style={styles.chartCard}>
                <Text style={styles.chartTitle}>Spending trend</Text>
                <LineChart
                  data={lineData}
                  width={SCREEN_WIDTH - 72}
                  height={168}
                  spacing={Math.max(28, Math.min(48, (SCREEN_WIDTH - 100) / Math.max(lineData.length, 1)))}
                  color={colors.primaryLight}
                  thickness={2.5}
                  startFillColor={colors.primary + '55'}
                  endFillColor={colors.primary + '00'}
                  startOpacity={0.35}
                  endOpacity={0}
                  areaChart
                  curved
                  hideRules
                  hideYAxisText={false}
                  yAxisColor="transparent"
                  xAxisColor={colors.border}
                  yAxisTextStyle={styles.axisText}
                  xAxisLabelTextStyle={styles.axisText}
                  rulesColor={colors.border}
                  rulesType="solid"
                  noOfSections={3}
                  isAnimated
                  animationDuration={700}
                  initialSpacing={8}
                  endSpacing={8}
                />
              </Animated.View>
            )}

            {merchants.length > 0 && (
              <Animated.View entering={FadeInDown.delay(220).duration(220)} style={styles.chartCard}>
                <Text style={styles.chartTitle}>Top merchants</Text>
                <View style={styles.rankList}>
                  {merchants.slice(0, 6).map((m, i) => (
                    <View key={`${m.merchant}-${i}`} style={styles.rankRow}>
                      <Text style={styles.rankIndex}>{i + 1}</Text>
                      <View style={styles.rankBody}>
                        <View style={styles.rankTop}>
                          <Text style={styles.rankName} numberOfLines={1}>
                            {m.merchant}
                          </Text>
                          <Text style={styles.rankAmount}>{formatCompactCurrency(m.amount)}</Text>
                        </View>
                        <View style={styles.rankTrack}>
                          <LinearGradient
                            colors={[colors.gradientStart, colors.gradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                              styles.rankFill,
                              {
                                width: `${Math.max(8, (m.amount / maxMerchant) * 100)}%` as any,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(280).duration(220)} style={styles.insightCard}>
              <Text style={styles.insightEyebrow}>HIGHLIGHT</Text>
              {categories[0] && (
                <Text style={styles.insightText}>
                  <Text style={styles.insightEm}>
                    {getCategoryConfig(categories[0].category as any).label}
                  </Text>
                  {' '}took the largest share (
                  {Math.round((categories[0].amount / total) * 100)}%).
                </Text>
              )}
              {merchants[0] && (
                <Text style={[styles.insightText, { marginTop: 8 }]}>
                  Top merchant:{' '}
                  <Text style={styles.insightEm}>{merchants[0].merchant}</Text>
                  {' · '}
                  {formatCurrency(merchants[0].amount)}
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
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.lg,
      gap: Spacing.md,
    },
    title: { ...Typography.h1, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textSecondary, marginTop: 4 },
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    filterChip: {
      flex: 1,
      borderRadius: Radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipActive: {
      borderColor: 'transparent',
      backgroundColor: 'transparent',
    },
    filterGrad: {
      width: '100%',
      paddingVertical: Spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
    filterTextOn: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCard: {
      borderRadius: Radius.xl,
      overflow: 'hidden',
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroGrad: {
      padding: Spacing.lg,
      alignItems: 'center',
    },
    totalLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      letterSpacing: 1.4,
      fontWeight: '700',
    },
    totalAmount: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.text,
      marginTop: 6,
      letterSpacing: -0.5,
    },
    heroMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    totalSub: { ...Typography.caption, color: colors.textMuted },
    budgetPill: {
      paddingHorizontal: Spacing.sm + 2,
      paddingVertical: 4,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    budgetPillText: { ...Typography.small, fontWeight: '700' },
    chartCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chartTitle: {
      ...Typography.h2,
      color: colors.text,
      marginBottom: Spacing.md,
      fontSize: 17,
    },
    pieRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    pieCenterWrap: { alignItems: 'center' },
    pieCenterValue: { ...Typography.bodyBold, color: colors.text, fontSize: 15 },
    pieCenterHint: {
      ...Typography.small,
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontSize: 9,
    },
    legend: { flex: 1, gap: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendCopy: { flex: 1, gap: 4 },
    legendLabel: { ...Typography.small, color: colors.text, fontWeight: '600' },
    legendBarTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    legendBarFill: { height: '100%', borderRadius: 2 },
    legendRight: { alignItems: 'flex-end', minWidth: 52 },
    legendAmount: { ...Typography.small, color: colors.text, fontWeight: '700' },
    legendPct: { ...Typography.small, color: colors.textMuted, fontSize: 10 },
    axisText: { color: colors.textMuted, fontSize: 9 },
    rankList: { gap: Spacing.md },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    rankIndex: {
      ...Typography.caption,
      color: colors.textMuted,
      fontWeight: '700',
      width: 18,
    },
    rankBody: { flex: 1, gap: 6 },
    rankTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    rankName: { ...Typography.body, color: colors.text, fontWeight: '600', flex: 1, fontSize: 14 },
    rankAmount: { ...Typography.caption, color: colors.textSecondary, fontWeight: '700' },
    rankTrack: {
      height: 7,
      borderRadius: Radius.full,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    rankFill: { height: '100%', borderRadius: Radius.full },
    insightCard: {
      backgroundColor: colors.primary + '12',
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.primary + '28',
    },
    insightEyebrow: {
      ...Typography.small,
      color: colors.primaryLight,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
    },
    insightText: { ...Typography.body, color: colors.textSecondary, lineHeight: 22 },
    insightEm: { color: colors.text, fontWeight: '700' },
  });
}
