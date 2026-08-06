import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { EmptyState } from '../components/EmptyState';
import { ThemeToggle } from '../components/ThemeToggle';
import { TimeFilterBar } from '../components/TimeFilterBar';
import { StatsChartIcon } from '../components/icons/StatsChartIcon';
import { CATEGORIES, getCategoryConfig, getCategoryColor } from '../constants/categories';
import { formatCurrency, formatCompactCurrency } from '../utils/expenseParser';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useProStore } from '../store/proStore';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { TimeFilter } from '../types/expense';
import {
  DateRange,
  formatTimeFilterAnchor,
  summarizeExpenses,
  TimeFilterOptions,
} from '../utils/expenseAnalytics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { useIsFocused } from '@react-navigation/native';
import { SilkFluidOverlay } from '../components/SilkFluidOverlay';
import { SpiderWebBackground } from '../components/SpiderWebBackground';
import { useThemeStore } from '../store/themeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function generatedCategoryColor(category: string, attempt = 0): string {
  const hash = Array.from(category).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 360000,
    0,
  );
  const hue = (hash + attempt * 47) % 360;
  return `hsl(${hue}, 72%, 58%)`;
}

export function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { colors, gradientPoints, chartPalette, actionGradient } = useTheme();
  const isPro = useProStore(s => s.isPro);
  const openPaywall = useProStore(s => s.openPaywall);
  const bottomPad = getTabBarBottomInset(insets.bottom);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFocused = useIsFocused();
  const packId = useThemeStore(s => s.packId);
  const spiderTheme = packId === 'red_web_spider';
  const [filter, setFilter] = useState<TimeFilter>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const {
    isJoint,
    expenses,
    getBudgetForMonth,
    onRefresh,
    refreshing,
  } = useHouseholdExpenses();

  const filterOpts: TimeFilterOptions = useMemo(
    () => ({ filter, anchor, customRange }),
    [filter, anchor, customRange],
  );

  const summary = useMemo(
    () => summarizeExpenses(expenses, filterOpts),
    [expenses, filterOpts],
  );
  const { total, categories, merchants, daily } = summary;
  const expenseCount = summary.filtered.length;
  const hasData = expenseCount > 0;
  const selectedMonthBudget = filter === 'month' ? getBudgetForMonth(anchor) : 0;
  const budgetPct =
    selectedMonthBudget > 0
      ? Math.min(999, Math.round((total / selectedMonthBudget) * 100))
      : null;

  const periodCaption = useMemo(() => {
    if (filter === 'all' && customRange) {
      return 'Custom range';
    }
    if (filter === 'all') return 'All time';
    return formatTimeFilterAnchor(filter, anchor);
  }, [filter, anchor, customRange]);

  // Keep every visible slice distinct, including custom categories and palettes with fewer colors.
  const categoryColors = useMemo(() => {
    const used = new Set<string>();
    const knownCategoryIds = new Set(CATEGORIES.map(category => category.id));

    return categories.map((category, index) => {
      let color =
        chartPalette === 'default'
          ? knownCategoryIds.has(category.category as any)
            ? getCategoryColor(category.category)
            : generatedCategoryColor(category.category)
          : colors.chartColors[index] ?? generatedCategoryColor(category.category);
      let attempt = 0;

      while (used.has(color.toLowerCase())) {
        attempt += 1;
        color = generatedCategoryColor(category.category, attempt);
      }
      used.add(color.toLowerCase());
      return color;
    });
  }, [categories, chartPalette, colors.chartColors]);

  const pieData = useMemo(
    () =>
      categories.map((c, i) => ({
        value: c.amount,
        color: categoryColors[i],
      })),
    [categories, categoryColors],
  );

  const lineData = useMemo(
    () =>
      daily.map((d, i) => ({
        value: d.value,
        label: i % Math.max(1, Math.ceil(daily.length / 5)) === 0 ? d.label : '',
        dataPointColor: colors.primaryLight,
        dataPointRadius: 3.5,
        hideDataPoint: d.value <= 0,
      })),
    [daily, colors.primaryLight],
  );

  const maxMerchant = useMemo(
    () => Math.max(...merchants.map(m => m.amount), 1),
    [merchants],
  );
  const maxCategory = useMemo(
    () => Math.max(...categories.map(c => c.amount), 1),
    [categories],
  );

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
            <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.subtitle}>
              {isJoint ? 'Shared joint spending' : 'Where your money went'}
            </Text>
          </View>
          <ThemeToggle />
        </View>

        <TimeFilterBar
          filter={filter}
          anchor={anchor}
          customRange={customRange}
          onFilterChange={setFilter}
          onAnchorChange={setAnchor}
          onCustomRangeChange={setCustomRange}
          proNavEnabled={isPro}
          onProGate={reason => openPaywall(reason)}
        />

        {!hasData ? (
          <EmptyState
            icon={
              <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '18' }]}>
                <StatsChartIcon size={36} color={colors.primaryLight} />
              </View>
            }
            title="No insights yet"
            subtitle={
              filter === 'all' && !customRange
                ? 'Add a few expenses and your spending charts will show up here'
                : `No expenses in ${periodCaption.toLowerCase()}. Try another period.`
            }
          />
        ) : (
          <>
            <View style={styles.heroCard}>
              <LinearGradient
                colors={[colors.gradientStart + '55', colors.surfaceElevated]}
                {...(gradientPoints
                  ? { start: gradientPoints.start, end: gradientPoints.end }
                  : { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } })}
                style={StyleSheet.absoluteFill}
              />
              {spiderTheme ? (
                <SpiderWebBackground variant="hero" opacity={0.34} />
              ) : (
                <SilkFluidOverlay active={isFocused} fill={0.88} intensity="bold" />
              )}
              <View style={styles.heroContent}>
                  <Text style={styles.totalLabel}>
                    {isJoint ? 'JOINT TOTAL' : 'TOTAL SPENT'}
                  </Text>
                  <Text style={styles.periodCaption}>{periodCaption}</Text>
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
              </View>
            </View>

            {pieData.length > 0 && (
              <View style={styles.chartCard}>
                {spiderTheme ? <SpiderWebBackground variant="category" opacity={0.24} /> : null}
                <View style={styles.cardContent}>
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
                    <ScrollView
                      style={styles.legend}
                      contentContainerStyle={styles.legendContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={categories.length > 5}
                    >
                      {categories.map((c, i) => {
                        const cfg = getCategoryConfig(c.category as any);
                        const pct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
                        const sliceColor = categoryColors[i];
                        return (
                          <View key={c.category} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: sliceColor }]} />
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
                                      backgroundColor: sliceColor,
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
                    </ScrollView>
                  </View>
                </View>
              </View>
            )}

            {lineData.length > 1 && (
              <View style={styles.chartCard}>
                {spiderTheme ? <SpiderWebBackground variant="trend" opacity={0.22} /> : null}
                <View style={styles.cardContent}>
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
                    isAnimated={false}
                    initialSpacing={8}
                    endSpacing={8}
                  />
                </View>
              </View>
            )}

            {merchants.length > 0 && (
              <View style={styles.chartCard}>
                {spiderTheme ? <SpiderWebBackground variant="merchants" opacity={0.26} /> : null}
                <View style={styles.cardContent}>
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
                              colors={[...actionGradient]}
                              {...(gradientPoints
                                ? { start: gradientPoints.start, end: gradientPoints.end }
                                : { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } })}
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
                </View>
              </View>
            )}

            <View style={styles.insightCard}>
              {spiderTheme ? <SpiderWebBackground variant="insight" opacity={0.2} /> : null}
              <View style={styles.cardContent}>
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
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: Spacing.lg, zIndex: 1 },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.lg,
      gap: Spacing.md,
    },
    title: { ...Typography.h1, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textSecondary, marginTop: 4 },
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
      minHeight: 140,
      position: 'relative',
      backgroundColor: colors.surfaceElevated,
    },
    heroGrad: {
      ...StyleSheet.absoluteFillObject,
    },
    heroContent: {
      padding: Spacing.lg,
      alignItems: 'center',
      zIndex: 2,
      minHeight: 140,
      justifyContent: 'center',
    },
    totalLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      letterSpacing: 1.4,
      fontWeight: '700',
    },
    periodCaption: {
      ...Typography.caption,
      color: colors.primaryLight,
      fontWeight: '700',
      marginTop: 4,
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
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      position: 'relative',
      minHeight: 120,
    },
    cardContent: {
      padding: Spacing.lg,
      zIndex: 2,
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
    legend: { flex: 1, maxHeight: 174 },
    legendContent: { gap: 10, paddingRight: 4 },
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
      borderWidth: 1,
      borderColor: colors.primary + '28',
      overflow: 'hidden',
      position: 'relative',
      minHeight: 96,
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
