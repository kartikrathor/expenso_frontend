import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TextInput,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useActivityStore, ActivityItem } from '../store/activityStore';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { ExpenseCard } from '../components/ExpenseCard';
import { EmptyState } from '../components/EmptyState';
import { ThemeToggle } from '../components/ThemeToggle';
import { ExpenseDatePicker } from '../components/ExpenseDatePicker';
import { CATEGORIES, getCategoryConfig } from '../constants/categories';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useDeleteExpense } from '../hooks/useDeleteExpense';
import { useEditExpense } from '../hooks/useEditExpense';
import { formatCurrency } from '../utils/expenseParser';
import { CategoryId, Expense } from '../types/expense';
import { format, parseISO } from 'date-fns';
import { SwipeScrollLockGate } from '../hooks/useSwipeScrollLock';
import { SpiderWebBackground } from '../components/SpiderWebBackground';
import { BlackSpiderMark, pickSpiderByIndex } from '../components/BlackSpiderMark';
import { useThemeStore } from '../store/themeStore';
import {
  HistoryPeriod,
  applyCalendarDay,
  filterByHistoryPeriod,
  formatPeriodAnchor,
  groupExpensesByDay,
  shiftPeriodAnchor,
} from '../utils/expenseDate';

type Tab = 'expenses' | 'activity';

const EXPENSE_BATCH_SIZE = 30;
const ACTIVITY_BATCH_SIZE = 40;

const PERIODS: { id: HistoryPeriod; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: 'Day' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomPad = getTabBarBottomInset(insets.bottom);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('expenses');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'added' | 'edited' | 'deleted'>('all');
  const [period, setPeriod] = useState<HistoryPeriod>('all');
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
  const [expenseLimit, setExpenseLimit] = useState(EXPENSE_BATCH_SIZE);
  const [activityLimit, setActivityLimit] = useState(ACTIVITY_BATCH_SIZE);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const { isJoint, expenses, onRefresh, refreshing } = useHouseholdExpenses();
  const activities = useActivityStore(s => s.activities);

  const { requestDelete, deleteModal } = useDeleteExpense();
  const { requestEdit, editModal } = useEditExpense();

  const filteredExpenses = useMemo(() => {
    const byPeriod = filterByHistoryPeriod(expenses, period, periodAnchor);
    return byPeriod.filter(e => {
      const matchesSearch =
        !deferredSearch ||
        e.merchantLabel.toLowerCase().includes(deferredSearch) ||
        e.note.toLowerCase().includes(deferredSearch) ||
        e.amount.toString().includes(deferredSearch);
      const matchesCategory = categoryFilter === 'all' || e.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [expenses, deferredSearch, categoryFilter, period, periodAnchor]);

  const visibleExpenses = useMemo(
    () => filteredExpenses.slice(0, expenseLimit),
    [filteredExpenses, expenseLimit],
  );
  const sections = useMemo(() => groupExpensesByDay(visibleExpenses), [visibleExpenses]);

  const filteredActivity = useMemo(() => {
    return activities.filter(a => {
      if (activityFilter !== 'all' && a.type !== activityFilter) return false;
      if (!deferredSearch) return true;
      return (
        a.merchantLabel.toLowerCase().includes(deferredSearch) ||
        a.note.toLowerCase().includes(deferredSearch) ||
        a.amount.toString().includes(deferredSearch) ||
        a.byName.toLowerCase().includes(deferredSearch)
      );
    });
  }, [activities, activityFilter, deferredSearch]);
  const visibleActivity = useMemo(
    () => filteredActivity.slice(0, activityLimit),
    [filteredActivity, activityLimit],
  );

  useEffect(() => {
    setExpenseLimit(EXPENSE_BATCH_SIZE);
  }, [deferredSearch, categoryFilter, period, periodAnchor]);

  useEffect(() => {
    setActivityLimit(ACTIVITY_BATCH_SIZE);
  }, [deferredSearch, activityFilter]);

  const ListHeader = useMemo(() => (
    <>
      <Animated.View entering={FadeInDown.springify()} style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>History 📋</Text>
            <Text style={styles.subtitle}>
              {tab === 'expenses'
                ? `${filteredExpenses.length} shown · ${expenses.length} total · ${isJoint ? 'Joint' : 'Personal'}`
                : `${activities.length} activity logs`}
            </Text>
          </View>
          <ThemeToggle />
        </View>
      </Animated.View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'expenses' && styles.tabActive]}
          onPress={() => setTab('expenses')}
        >
          <Text style={[styles.tabText, tab === 'expenses' && styles.tabTextActive]}>Expenses</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === 'activity' && styles.tabActive]}
          onPress={() => setTab('activity')}
        >
          <Text style={[styles.tabText, tab === 'activity' && styles.tabTextActive]}>Activity</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={tab === 'activity' ? 'Search activity...' : 'Search merchant, amount...'}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        )}
      </View>

      {tab === 'expenses' ? (
        <>
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <Pressable
                key={p.id}
                style={[styles.periodChip, period === p.id && styles.periodChipActive]}
                onPress={() => {
                  setPeriod(p.id);
                  if (p.id !== 'all') setPeriodAnchor(new Date());
                }}
              >
                <Text style={[styles.periodText, period === p.id && styles.periodTextActive]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {period !== 'all' && (
            <View style={styles.anchorRow}>
              {period === 'day' ? (
                <View style={styles.dayPickerWrap}>
                  <ExpenseDatePicker
                    valueIso={applyCalendarDay(periodAnchor)}
                    onChange={iso => setPeriodAnchor(parseISO(iso))}
                    label="Show day"
                  />
                </View>
              ) : (
                <>
                  <Pressable
                    style={styles.anchorNav}
                    onPress={() => setPeriodAnchor(a => shiftPeriodAnchor(period, a, -1))}
                  >
                    <Text style={styles.anchorNavText}>‹</Text>
                  </Pressable>
                  <Text style={styles.anchorLabel}>{formatPeriodAnchor(period, periodAnchor)}</Text>
                  <Pressable
                    style={styles.anchorNav}
                    onPress={() => setPeriodAnchor(a => shiftPeriodAnchor(period, a, 1))}
                  >
                    <Text style={styles.anchorNavText}>›</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          <FlatList
            horizontal
            data={[{ id: 'all' as const, label: 'All', emoji: '📦' }, ...CATEGORIES]}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilter}
            contentContainerStyle={styles.categoryFilterContent}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.catChip, categoryFilter === item.id && styles.catChipActive]}
                onPress={() => setCategoryFilter(item.id as CategoryId | 'all')}
              >
                <Text>{item.emoji}</Text>
                <Text style={[styles.catChipText, categoryFilter === item.id && styles.catChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </>
      ) : (
        <View style={styles.activityFilterRow}>
          {([
            { id: 'all', label: 'All' },
            { id: 'added', label: 'Added' },
            { id: 'edited', label: 'Edited' },
            { id: 'deleted', label: 'Deleted' },
          ] as const).map(f => (
            <Pressable
              key={f.id}
              style={[styles.catChip, activityFilter === f.id && styles.catChipActive]}
              onPress={() => setActivityFilter(f.id)}
            >
              <Text style={[styles.catChipText, activityFilter === f.id && styles.catChipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  ), [
    styles,
    colors.textMuted,
    search,
    categoryFilter,
    activityFilter,
    expenses.length,
    filteredExpenses.length,
    activities.length,
    tab,
    isJoint,
    period,
    periodAnchor,
  ]);

  const renderExpenseSectionHeader = useCallback(
    ({ section }: { section: { title: string; total: number } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <Text style={styles.sectionTotal}>{formatCurrency(section.total)}</Text>
      </View>
    ),
    [styles],
  );

  const renderExpenseItem = useCallback(
    ({ item, index }: { item: Expense; index: number }) => (
      <View style={styles.cardWrap}>
        <ExpenseCard
          expense={item}
          index={index}
          onDelete={requestDelete}
          onEdit={requestEdit}
          timeOnly
          webAccent={index % 3 === 0}
        />
      </View>
    ),
    [requestDelete, requestEdit, styles],
  );

  const renderActivityItem = useCallback(
    ({ item, index }: { item: ActivityItem; index: number }) => (
      <View style={styles.cardWrap}>
        <ActivityRow item={item} index={index} styles={styles} />
      </View>
    ),
    [styles],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <SwipeScrollLockGate>
        {(scrollProps) =>
          tab === 'expenses' ? (
        <SectionList
          {...scrollProps}
          sections={sections}
          keyExtractor={item => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          onEndReachedThreshold={0.35}
          onEndReached={() =>
            setExpenseLimit(current =>
              Math.min(current + EXPENSE_BATCH_SIZE, filteredExpenses.length),
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              emoji="🔍"
              title="No results found"
              subtitle="Try changing the search term or filter"
            />
          }
          renderSectionHeader={renderExpenseSectionHeader}
          renderItem={renderExpenseItem}
        />
      ) : (
        <FlatList
          {...scrollProps}
          data={visibleActivity}
          keyExtractor={item => item.id}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          onEndReachedThreshold={0.35}
          onEndReached={() =>
            setActivityLimit(current =>
              Math.min(current + ACTIVITY_BATCH_SIZE, filteredActivity.length),
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              emoji="📝"
              title="No activity yet"
              subtitle="Adds, edits, and deletes will show up here"
            />
          }
          renderItem={renderActivityItem}
        />
      )
        }
      </SwipeScrollLockGate>
      {deleteModal}
      {editModal}
    </View>
  );
}

const ActivityRow = React.memo(function ActivityRowComponent({
  item,
  index = 0,
  styles,
}: {
  item: ActivityItem;
  index?: number;
  styles: ReturnType<typeof createStyles>;
}) {
  const packId = useThemeStore(s => s.packId);
  const showWeb = packId === 'red_web_spider' && index % 3 === 0;
  const showSpider = packId === 'red_web_spider' && pickSpiderByIndex(index, 3);
  const cat = getCategoryConfig(item.category);
  const badge =
    item.type === 'added'
      ? { label: 'Added', color: '#22C55E' }
      : item.type === 'edited'
        ? { label: 'Edited', color: '#3B82F6' }
        : { label: 'Deleted', color: '#EF4444' };

  return (
    <View style={styles.activityCard}>
      {showWeb ? (
        <SpiderWebBackground
          variant={index % 2 === 0 ? 'logSoft' : 'logSoftAlt'}
          opacity={0.22}
        />
      ) : null}
      {showSpider ? (
        <BlackSpiderMark size={26} style={{ top: 6, right: 8 }} />
      ) : null}
      <View style={styles.activityTop}>
        <View style={[styles.badge, { backgroundColor: badge.color + '22' }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
        <Text style={styles.activityTime}>
          {format(parseISO(item.at), 'd MMM · h:mm a')}
        </Text>
      </View>

      <Text style={styles.activityTitle}>
        {cat.emoji} {item.merchantLabel}
      </Text>
      <Text style={styles.activityAmount}>{formatCurrency(item.amount)}</Text>

      {item.type === 'edited' && (
        <Text style={styles.activityMeta}>
          Was {formatCurrency(item.previousAmount ?? 0)}
          {item.previousMerchantLabel && item.previousMerchantLabel !== item.merchantLabel
            ? ` · ${item.previousMerchantLabel}`
            : ''}
          {' → '}
          {formatCurrency(item.amount)}
          {item.previousMerchantLabel !== item.merchantLabel ? ` · ${item.merchantLabel}` : ''}
        </Text>
      )}

      {!!item.note && item.type !== 'edited' && (
        <Text style={styles.activityNote} numberOfLines={2}>{item.note}</Text>
      )}

      <Text style={styles.activityBy}>
        by {item.byName} · {item.source === 'joint' ? 'Joint' : 'Personal'}
      </Text>
    </View>
  );
});

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { ...Typography.h1, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textSecondary },
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.md,
      alignItems: 'center',
    },
    tabActive: { backgroundColor: colors.primary + '33' },
    tabText: { ...Typography.small, color: colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: colors.primaryLight, fontWeight: '700' },
    searchBox: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      borderRadius: Radius.lg, marginHorizontal: Spacing.lg, paddingHorizontal: Spacing.md,
      borderWidth: 1, borderColor: colors.border, marginBottom: Spacing.md,
    },
    searchIcon: { fontSize: 16, marginRight: Spacing.sm },
    searchInput: { flex: 1, ...Typography.body, color: colors.text, paddingVertical: Spacing.md },
    clearBtn: { color: colors.textMuted, fontSize: 16, padding: Spacing.sm },
    periodRow: {
      flexDirection: 'row',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    periodChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    periodChipActive: {
      backgroundColor: colors.primary + '33',
      borderColor: colors.primary,
    },
    periodText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
    periodTextActive: { color: colors.primaryLight, fontWeight: '700' },
    anchorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      gap: Spacing.md,
    },
    dayPickerWrap: { flex: 1 },
    anchorNav: {
      width: 36,
      height: 36,
      borderRadius: Radius.full,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    anchorNavText: { fontSize: 22, color: colors.text, lineHeight: 24 },
    anchorLabel: { ...Typography.bodyBold, color: colors.text, minWidth: 120, textAlign: 'center' },
    categoryFilter: { maxHeight: 44, marginBottom: Spacing.md },
    categoryFilterContent: { paddingHorizontal: Spacing.lg },
    activityFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    catChip: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs, borderRadius: Radius.full, backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm, gap: 4,
    },
    catChipActive: { backgroundColor: colors.primary + '33', borderColor: colors.primary },
    catChipText: { ...Typography.small, color: colors.textSecondary },
    catChipTextActive: { color: colors.primaryLight, fontWeight: '700' },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
      backgroundColor: colors.background,
    },
    sectionTitle: { ...Typography.bodyBold, color: colors.text },
    sectionTotal: { ...Typography.caption, color: colors.textSecondary, fontWeight: '700' },
    cardWrap: { paddingHorizontal: Spacing.lg },
    activityCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    activityTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.sm,
      zIndex: 1,
    },
    badge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radius.full,
    },
    badgeText: { ...Typography.small, fontWeight: '700' },
    activityTime: { ...Typography.small, color: colors.textMuted },
    activityTitle: { ...Typography.body, color: colors.text, fontWeight: '600', zIndex: 1 },
    activityAmount: {
      ...Typography.body,
      color: colors.text,
      marginTop: 2,
      fontWeight: '700',
      fontSize: 18,
      zIndex: 1,
    },
    activityMeta: { ...Typography.caption, color: colors.textSecondary, marginTop: Spacing.xs, zIndex: 1 },
    activityNote: { ...Typography.caption, color: colors.textMuted, marginTop: Spacing.xs, zIndex: 1 },
    activityBy: { ...Typography.small, color: colors.textMuted, marginTop: Spacing.sm, zIndex: 1 },
  });
}
