import React, { useState, useCallback, useMemo, useEffect, useRef, useDeferredValue } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ListRenderItem,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { WaterGradient } from '../components/WaterGradient';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useExpenseStore } from '../store/expenseStore';
import { useJointStore } from '../store/jointStore';
import { useActivityStore } from '../store/activityStore';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { ExpenseCard } from '../components/ExpenseCard';
import { EmptyState } from '../components/EmptyState';
import { AddExpenseModal, ExpenseSaveData } from '../components/AddExpenseModal';
import { HoldMicFab } from '../components/HoldMicFab';
import { SuccessToast } from '../components/SuccessToast';
import { BudgetProgress } from '../components/BudgetProgress';
import { QuickAddBar } from '../components/QuickAddBar';
import { ThemeToggle } from '../components/ThemeToggle';
import { NotificationsModal } from '../components/NotificationsModal';
import { WebFluidDripBurst } from '../components/WebFluidDripBurst';
import { useThemeStore } from '../store/themeStore';
import { useNotificationInboxStore } from '../store/notificationInboxStore';
import { AddExpenseHeroIcon } from '../components/icons/AddExpenseHeroIcon';
import { SwipeScrollLockGate } from '../hooks/useSwipeScrollLock';
import { formatCurrency } from '../utils/expenseParser';
import { syncExpenseWidget, startWidgetRefreshWatcher } from '../utils/expenseWidget';
import { useAuthStore } from '../store/authStore';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useAddExpenseNavStore } from '../store/addExpenseNavStore';
import { useDeleteExpense } from '../hooks/useDeleteExpense';
import { useEditExpense } from '../hooks/useEditExpense';
import { Expense, TimeFilter, MerchantId } from '../types/expense';
import { format, parseISO, startOfWeek } from 'date-fns';
import {
  applyCalendarDay,
  formatExpenseDayLabel,
  formatPeriodAnchor,
} from '../utils/expenseDate';
import {
  formatTimeFilterAnchor,
  shiftTimeFilterAnchor,
} from '../utils/expenseAnalytics';
import { ExpenseDatePicker } from '../components/ExpenseDatePicker';
import { monthKey } from '../utils/monthlyBudget';

type HomeFilter = TimeFilter | 'day';

const FILTERS: { key: HomeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

/** First paint + each scroll page on Home */
const HOME_PAGE_SIZE = 25;

function periodBucketKey(filter: Exclude<HomeFilter, 'all'>, date: Date): string {
  if (filter === 'day') return format(date, 'yyyy-MM-dd');
  if (filter === 'week') {
    return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  }
  if (filter === 'month') return format(date, 'yyyy-MM');
  return format(date, 'yyyy');
}

function firstName(full?: string | null) {
  const n = (full || '').trim();
  if (!n) return '';
  return n.split(/\s+/)[0];
}

function SearchGlyph({ color, close = false }: { color: string; close?: boolean }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      {close ? (
        <Path
          d="M6 6l12 12M18 6L6 18"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      ) : (
        <>
          <Path
            d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z"
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d="m16.2 16.2 4.3 4.3"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>
      )}
    </Svg>
  );
}

function FilterGlyph({ color }: { color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M7 12h10M10 18h4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { colors, gradientPoints, actionGradient } = useTheme();
  const bottomPad = getTabBarBottomInset(insets.bottom);
  const userName = useAuthStore(s => s.user?.name);
  const greetName = firstName(userName);

  const [filter, setFilter] = useState<HomeFilter>('month');
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date());
  const [filterOpen, setFilterOpen] = useState(false);
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [draftFilter, setDraftFilter] = useState<HomeFilter>('month');
  const [draftPeriodAnchor, setDraftPeriodAnchor] = useState(() => new Date());
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [visibleCount, setVisibleCount] = useState(HOME_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const listRef = useRef<FlatList<Expense>>(null);
  const searchYRef = useRef(0);
  const searchFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingMoreRef = useRef(false);
  const loadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [budgetRepeat, setBudgetRepeat] = useState(false);
  const [toast, setToast] = useState<{ amount: number; merchant: MerchantId; label: string } | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [dripBurst, setDripBurst] = useState(0);
  const fabScale = useSharedValue(1);
  const packId = useThemeStore(s => s.packId);
  const unreadNotifs = useNotificationInboxStore(
    s => s.items.reduce((n, item) => (item.read ? n : n + 1), 0),
  );
  const openAddFromWidget = useAddExpenseNavStore(s => s.openAdd);
  const clearOpenAdd = useAddExpenseNavStore(s => s.clearOpenAdd);

  const {
    isJoint,
    joint,
    expenses: householdExpenses,
    getTodayTotal,
    getBudgetForMonth,
    repeatMonthlyBudget,
    setMonthlyBudget,
    onRefresh,
    refreshing,
    pendingCount,
    isSyncing,
  } = useHouseholdExpenses();
  const addJointExpense = useJointStore(s => s.addJointExpense);

  const addExpense = useExpenseStore(s => s.addExpense);
  const { requestDelete, deleteModal } = useDeleteExpense();
  const { requestEdit, editModal } = useEditExpense();

  const periodBuckets = useMemo(() => {
    const buckets: Record<Exclude<HomeFilter, 'all'>, Map<string, Expense[]>> = {
      day: new Map(),
      week: new Map(),
      month: new Map(),
      year: new Map(),
    };
    householdExpenses.forEach(expense => {
      try {
        const date = parseISO(expense.date);
        if (Number.isNaN(date.getTime())) return;
        (['day', 'week', 'month', 'year'] as const).forEach(period => {
          const key = periodBucketKey(period, date);
          const existing = buckets[period].get(key);
          if (existing) existing.push(expense);
          else buckets[period].set(key, [expense]);
        });
      } catch {
        // Invalid dates remain available under All.
      }
    });
    return buckets;
  }, [householdExpenses]);

  const filtered = useMemo(() => {
    if (filter === 'all') return householdExpenses;
    return periodBuckets[filter].get(periodBucketKey(filter, periodAnchor)) ?? [];
  }, [filter, householdExpenses, periodAnchor, periodBuckets]);
  const displayedExpenses = useMemo(() => {
    if (!deferredSearch) return filtered;
    return householdExpenses.filter(expense => (
      expense.merchantLabel.toLowerCase().includes(deferredSearch) ||
      expense.note.toLowerCase().includes(deferredSearch) ||
      expense.amount.toString().includes(deferredSearch)
    ));
  }, [deferredSearch, filtered, householdExpenses]);
  const total = useMemo(
    () => displayedExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [displayedExpenses],
  );
  const budgetMonthDate = filter === 'month' ? periodAnchor : new Date();
  const budgetMonthKey = monthKey(budgetMonthDate);
  const budgetMonthLabel = format(budgetMonthDate, 'MMMM yyyy');
  const budgetAmount = getBudgetForMonth(budgetMonthKey);
  const monthTotal = useMemo(
    () => (periodBuckets.month.get(budgetMonthKey) ?? [])
      .reduce((sum, expense) => sum + expense.amount, 0),
    [budgetMonthKey, periodBuckets],
  );
  const todayTotal = useMemo(() => getTodayTotal(), [getTodayTotal]);

  // Widget / shortcut requested Add Expense
  useEffect(() => {
    if (!openAddFromWidget) return;
    setShowAdd(true);
    clearOpenAdd();
  }, [openAddFromWidget, clearOpenAdd]);

  // Keep Android home-screen widget in sync (debounced — avoid bridge spam)
  useEffect(() => {
    const timer = setTimeout(() => {
      const token = useAuthStore.getState().token;
      const userId = useAuthStore.getState().user?.id ?? null;
      syncExpenseWidget({
        expenses: householdExpenses,
        todayTotal,
        accountLabel: isJoint ? joint?.name || 'Joint' : 'Personal',
        token,
        userId,
        groupId: isJoint ? joint?.id ?? null : null,
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [householdExpenses, todayTotal, isJoint, joint?.id, joint?.name]);

  // If Quick Add saved while app was closed, pull fresh lists
  useEffect(() => {
    return startWidgetRefreshWatcher(() => {
      void onRefresh();
    });
  }, [onRefresh]);

  // Newest-first list for the filter/search; UI pages this so Home doesn't mount every card at once.
  const sortedExpenses = useMemo(() => {
    if (displayedExpenses.length <= 1) return displayedExpenses;
    let needsSort = false;
    for (let i = 1; i < Math.min(displayedExpenses.length, 8); i++) {
      const a = Date.parse(displayedExpenses[i - 1].date) || 0;
      const b = Date.parse(displayedExpenses[i].date) || 0;
      if (a < b) {
        needsSort = true;
        break;
      }
    }
    if (!needsSort) return displayedExpenses;
    return [...displayedExpenses].sort(
      (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
    );
  }, [displayedExpenses]);

  useEffect(() => {
    if (loadMoreTimerRef.current) {
      clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = null;
    }
    loadingMoreRef.current = false;
    setIsLoadingMore(false);
    setVisibleCount(HOME_PAGE_SIZE);
    return () => {
      if (loadMoreTimerRef.current) clearTimeout(loadMoreTimerRef.current);
    };
  }, [deferredSearch, filter, periodAnchor]);

  useEffect(() => () => {
    if (searchFocusTimerRef.current) clearTimeout(searchFocusTimerRef.current);
  }, []);

  const listData = useMemo(
    () => sortedExpenses.slice(0, visibleCount),
    [sortedExpenses, visibleCount],
  );
  const hasMore = visibleCount < sortedExpenses.length;

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    // Keep the footer visible while the next render batch is prepared.
    loadMoreTimerRef.current = setTimeout(() => {
      setVisibleCount(n => Math.min(n + HOME_PAGE_SIZE, sortedExpenses.length));
      loadingMoreRef.current = false;
      loadMoreTimerRef.current = null;
      setIsLoadingMore(false);
    }, 300);
  }, [hasMore, sortedExpenses.length]);

  const waterFill = useMemo(() => {
    if (budgetAmount <= 0) return 0.58;
    const remaining = Math.max(0, budgetAmount - monthTotal);
    return Math.max(0, Math.min(1, remaining / budgetAmount));
  }, [budgetAmount, monthTotal]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSave = useCallback(async (data: ExpenseSaveData) => {
    if (isJoint) {
      const created = await addJointExpense({
        amount: data.amount,
        merchantLabel: data.merchantLabel,
        merchant: data.merchant,
        category: data.category,
        note: data.note,
        inputMethod: data.inputMethod,
        date: data.date,
      });
      await useActivityStore.getState().logAdded(created, 'joint');
    } else {
      const created = await addExpense({ ...data, date: data.date });
      await useActivityStore.getState().logAdded(created, 'local');
    }
    setToast({ amount: data.amount, merchant: data.merchant, label: data.merchantLabel });
  }, [isJoint, addJointExpense, addExpense]);

  const handleDelete = useCallback((id: string) => {
    requestDelete(id);
  }, [requestDelete]);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const filterLabel =
    deferredSearch ? 'All Time Search'
      : filter === 'day' ? formatPeriodAnchor('day', periodAnchor)
      : filter === 'all' ? 'All Time'
      : formatTimeFilterAnchor(filter, periodAnchor);
  const listTitle =
    deferredSearch ? 'Search results'
      : filter === 'day' ? 'Selected day’s expenses'
      : filter === 'week' ? 'Selected week’s expenses'
      : filter === 'month' ? 'Selected month’s expenses'
        : filter === 'year' ? 'Selected year’s expenses'
          : 'All expenses';

  const openBudget = useCallback(() => {
    setBudgetInput(budgetAmount > 0 ? String(budgetAmount) : '');
    setBudgetRepeat(repeatMonthlyBudget);
    setShowBudget(true);
  }, [budgetAmount, repeatMonthlyBudget]);

  const ListHeader = useMemo(() => (
    <View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {greetName ? `Hello ${greetName} 👋` : 'Hello 👋'}
          </Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, d MMMM')}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            style={styles.bellBtn}
            onPress={() => setNotifOpen(true)}
            hitSlop={8}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadNotifs > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifs > 9 ? '9+' : String(unreadNotifs)}
                </Text>
              </View>
            ) : null}
          </Pressable>
          <ThemeToggle />
        </View>
      </View>

      {isJoint && (
        <View style={styles.jointBanner}>
          <Text style={styles.jointBannerText}>
            {joint!.emoji} Joint account · {joint!.name}
            {joint!.memberCount >= 2 ? ' · shared with partner' : ' · invite partner from Profile'}
          </Text>
          {(pendingCount > 0 || isSyncing) && (
            <Text style={styles.syncHint}>
              {isSyncing
                ? 'Syncing shared expenses…'
                : `${pendingCount} change${pendingCount > 1 ? 's' : ''} waiting to sync`}
            </Text>
          )}
        </View>
      )}

      <View>
        <WaterGradient fill={waterFill} active={isFocused} style={styles.heroCard}>
          <Text style={styles.heroLabel}>
            {filterLabel}
            {isJoint ? ' · Joint' : ''}
          </Text>
          <Text style={styles.heroAmount}>{formatCurrency(total)}</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Today</Text>
              <Text style={styles.heroStatValue}>{formatCurrency(todayTotal)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatLabel}>Transactions</Text>
              <Text style={styles.heroStatValue}>{displayedExpenses.length}</Text>
            </View>
          </View>
        </WaterGradient>
      </View>

      <BudgetProgress
        spent={monthTotal}
        budget={budgetAmount}
        monthLabel={budgetMonthLabel}
        onSetBudget={openBudget}
      />

      <QuickAddBar onPress={() => setShowAdd(true)} />

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>{listTitle}</Text>
          <Text style={styles.sectionHint}>
            {displayedExpenses.length} transaction{displayedExpenses.length === 1 ? '' : 's'}
            {isJoint ? ' · shared account' : ''}
          </Text>
        </View>
        <View style={styles.sectionActions}>
          <Pressable
            style={[styles.sectionFilterBtn, searchOpen && styles.sectionFilterBtnActive]}
            onPress={() => {
              setSearchOpen(open => {
                if (open) setSearch('');
                return !open;
              });
            }}
            hitSlop={6}
            accessibilityLabel={searchOpen ? 'Close expense search' : 'Search all expenses'}
          >
            <SearchGlyph color={colors.primaryLight} close={searchOpen} />
          </Pressable>
          <Pressable
            style={[styles.sectionFilterBtn, filterOpen && styles.sectionFilterBtnActive]}
            onPress={() => {
              setDraftFilter(filter);
              setDraftPeriodAnchor(periodAnchor);
              setIsApplyingFilter(false);
              setFilterOpen(true);
            }}
            hitSlop={6}
            accessibilityLabel={`Filter expenses, currently ${filterLabel}`}
          >
            <FilterGlyph color={colors.primaryLight} />
          </Pressable>
        </View>
      </View>

      {searchOpen ? (
        <View
          style={styles.searchBox}
          onLayout={event => {
            searchYRef.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.searchIcon}>
            <SearchGlyph color={colors.textMuted} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search all merchants, notes, amounts..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => {
              if (searchFocusTimerRef.current) clearTimeout(searchFocusTimerRef.current);
              searchFocusTimerRef.current = setTimeout(() => {
                listRef.current?.scrollToOffset({
                  offset: Math.max(0, searchYRef.current - Spacing.lg),
                  animated: true,
                });
                searchFocusTimerRef.current = null;
              }, 120);
            }}
            autoFocus
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={6}>
              <Text style={styles.clearBtn}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  ), [
    styles,
    greetName,
    isJoint,
    joint,
    pendingCount,
    isSyncing,
    unreadNotifs,
    waterFill,
    filterLabel,
    total,
    todayTotal,
    displayedExpenses.length,
    monthTotal,
    budgetAmount,
    budgetMonthLabel,
    openBudget,
    filter,
    periodAnchor,
    filterOpen,
    searchOpen,
    search,
    colors.textMuted,
    colors.primaryLight,
    listTitle,
    isFocused,
  ]);

  const renderItem = useCallback<ListRenderItem<Expense>>(
    ({ item, index }) => {
      const itemDay = item.date.slice(0, 10);
      const previousDay = index > 0 ? sortedExpenses[index - 1]?.date.slice(0, 10) : null;
      const showDayHeading = index === 0 || itemDay !== previousDay;
      return (
        <View>
          {showDayHeading ? (
            <View style={styles.dayHeading}>
              <Text style={styles.dayHeadingText}>{formatExpenseDayLabel(item.date)}</Text>
              <View style={styles.dayHeadingLine} />
            </View>
          ) : null}
          <ExpenseCard
            expense={item}
            index={index}
            onDelete={handleDelete}
            onEdit={requestEdit}
          />
        </View>
      );
    },
    [handleDelete, requestEdit, sortedExpenses, styles],
  );

  const keyExtractor = useCallback((item: Expense) => item.id, []);

  const ListEmpty = useMemo(() => (
    <EmptyState
      icon={
        <LinearGradient
          colors={[...actionGradient]}
          style={styles.emptyIcon}
        >
          <AddExpenseHeroIcon size={48} color="#FFF" plusColor={colors.gradientStart} />
        </LinearGradient>
      }
      title={
        deferredSearch
          ? 'No matching expenses'
          : householdExpenses.length > 0
          ? 'No expenses in this period'
          : isJoint
            ? 'Add a shared expense'
            : 'Add your first expense'
      }
      subtitle={
        deferredSearch
          ? 'Try another merchant, note, or amount'
          : householdExpenses.length > 0
          ? 'Try Week, Month, Year, or All — or pull down to refresh'
          : isJoint
            ? 'Both partners can add here — it syncs for both of you'
            : 'In the Quick tab, type "Blinkit 200" or speak via the mic'
      }
    />
  ), [actionGradient, styles.emptyIcon, isJoint, householdExpenses.length, colors.gradientStart, deferredSearch]);

  const ListFooter = useMemo(() => {
    if (listData.length === 0 || (!hasMore && !isLoadingMore)) return null;
    return (
      <View style={styles.loadMoreWrap}>
        {isLoadingMore ? (
          <>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadMoreText}>Loading more expenses…</Text>
          </>
        ) : (
          <Text style={styles.loadMoreText}>
            Showing {listData.length} of {sortedExpenses.length} · scroll for more
          </Text>
        )}
      </View>
    );
  }, [hasMore, isLoadingMore, listData.length, sortedExpenses.length, styles, colors.primary]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.primary + '18', colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {toast && (
        <SuccessToast
          visible
          amount={toast.amount}
          merchant={toast.merchant}
          label={toast.label}
          onHide={() => setToast(null)}
        />
      )}

      <SwipeScrollLockGate>
        {(scrollProps) => (
          <FlatList
            {...scrollProps}
            ref={listRef}
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            ListFooterComponent={ListFooter}
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 72 }]}
            initialNumToRender={HOME_PAGE_SIZE}
            maxToRenderPerBatch={10}
            windowSize={7}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === 'android'}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}
      </SwipeScrollLockGate>

      <View style={[styles.fabRow, { bottom: bottomPad - 8 }]}>
        <HoldMicFab onSave={handleSave} />
        <View style={styles.fabWrap}>
          {packId === 'red_web_spider' ? (
            <View style={styles.dripLayer} pointerEvents="none">
              <WebFluidDripBurst trigger={dripBurst} />
            </View>
          ) : null}
          <Animated.View style={[fabStyle, styles.fabFront]}>
            <Pressable
              onPress={() => {
                if (packId === 'red_web_spider') {
                  setDripBurst(n => n + 1);
                  setTimeout(() => setShowAdd(true), 320);
                } else {
                  setShowAdd(true);
                }
              }}
              onPressIn={() => {
                fabScale.value = withSpring(0.9);
              }}
              onPressOut={() => {
                fabScale.value = withSpring(1);
              }}
            >
              <LinearGradient
                colors={[...actionGradient]}
                {...(gradientPoints
                  ? { start: gradientPoints.start, end: gradientPoints.end }
                  : {})}
                style={styles.fab}
              >
                <Text style={styles.fabIcon}>+</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <AddExpenseModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={handleSave} />
      <NotificationsModal visible={notifOpen} onClose={() => setNotifOpen(false)} />
      {deleteModal}
      {editModal}

      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={[styles.filterOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterOpen(false)} />
          <Pressable style={styles.filterSheet} onPress={event => event.stopPropagation()}>
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>Filter expenses</Text>
                <Text style={styles.filterSheetHint}>View expenses by date or period</Text>
              </View>
              <Pressable
                style={styles.filterCloseBtn}
                onPress={() => setFilterOpen(false)}
                accessibilityLabel="Close filters"
              >
                <SearchGlyph color={colors.textSecondary} close />
              </Pressable>
            </View>

            <Text style={styles.filterSectionLabel}>PERIOD</Text>
            <View style={styles.filterOptions}>
              {FILTERS.map(option => (
                <Pressable
                  key={option.key}
                  style={[
                    styles.filterOption,
                    draftFilter === option.key && styles.filterOptionActive,
                  ]}
                  onPress={() => setDraftFilter(option.key)}
                >
                  <View
                    style={[
                      styles.filterOptionDot,
                      draftFilter === option.key && styles.filterOptionDotActive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      draftFilter === option.key && styles.filterOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {draftFilter === 'day' ? (
              <ExpenseDatePicker
                valueIso={applyCalendarDay(draftPeriodAnchor)}
                onChange={iso => setDraftPeriodAnchor(parseISO(iso))}
                label="Select date"
              />
            ) : draftFilter !== 'all' ? (
              <View style={styles.filterPeriodNav}>
                <Pressable
                  style={styles.filterPeriodBtn}
                  onPress={() => setDraftPeriodAnchor(
                    anchor => shiftTimeFilterAnchor(draftFilter, anchor, -1),
                  )}
                  accessibilityLabel={`Previous ${draftFilter}`}
                >
                  <Text style={styles.filterPeriodArrow}>‹</Text>
                </Pressable>
                <Text style={styles.filterPeriodLabel}>
                  {formatTimeFilterAnchor(draftFilter, draftPeriodAnchor)}
                </Text>
                <Pressable
                  style={styles.filterPeriodBtn}
                  onPress={() => setDraftPeriodAnchor(
                    anchor => shiftTimeFilterAnchor(draftFilter, anchor, 1),
                  )}
                  accessibilityLabel={`Next ${draftFilter}`}
                >
                  <Text style={styles.filterPeriodArrow}>›</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.filterApplyBtn,
                isApplyingFilter && styles.filterApplyBtnDisabled,
              ]}
              disabled={isApplyingFilter}
              onPress={() => {
                if (isApplyingFilter) return;
                setIsApplyingFilter(true);
                requestAnimationFrame(() => {
                  setFilter(draftFilter);
                  setPeriodAnchor(draftPeriodAnchor);
                  requestAnimationFrame(() => {
                    setFilterOpen(false);
                    setIsApplyingFilter(false);
                  });
                });
              }}
            >
              {isApplyingFilter ? (
                <View style={styles.filterApplyingRow}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.filterApplyText}>Applying…</Text>
                </View>
              ) : (
                <Text style={styles.filterApplyText}>Apply filter</Text>
              )}
            </Pressable>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={showBudget} transparent animationType="fade">
        <KeyboardAvoidingView
          style={[styles.budgetOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBudget(false)} />
          <Pressable style={styles.budgetSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.budgetTitle}>
              {isJoint ? 'Shared Monthly Budget' : 'Monthly Budget'}
            </Text>
            <Text style={styles.budgetMonth}>{budgetMonthLabel}</Text>
            <Text style={styles.budgetHint}>
              {isJoint
                ? 'Shared with your partner · changes update both'
                : 'Set your spending limit for this month'}
            </Text>
            <TextInput
              style={styles.budgetInput}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              placeholder="e.g. 15000"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.budgetRepeatRow}>
              <Text style={styles.budgetRepeatText}>
                Use the same budget automatically for future months
              </Text>
              <Switch
                value={budgetRepeat}
                onValueChange={setBudgetRepeat}
                trackColor={{ false: colors.border, true: colors.primary + '88' }}
                thumbColor={budgetRepeat ? colors.primaryLight : colors.textMuted}
                accessibilityLabel="Use the same budget automatically for future months"
              />
            </View>
            <Pressable
              style={styles.budgetSave}
              onPress={async () => {
                const val = parseFloat(budgetInput);
                if (val > 0) await setMonthlyBudget(val, budgetMonthKey, budgetRepeat);
                setShowBudget(false);
              }}
            >
              <Text style={styles.budgetSaveText}>Save Budget</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: Spacing.lg, flexGrow: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    headerLeft: { flex: 1 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    bellBtn: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bellIcon: { fontSize: 18 },
    bellBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    bellBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    greeting: { ...Typography.h1, color: colors.text },
    date: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
    jointBanner: {
      backgroundColor: colors.primary + '18',
      borderRadius: Radius.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.primary + '40',
      marginBottom: Spacing.md,
    },
    jointBannerText: { ...Typography.caption, color: colors.primaryLight, fontWeight: '700', textAlign: 'center' },
    syncHint: { ...Typography.small, color: colors.warning, textAlign: 'center', marginTop: 4 },
    heroCard: { borderRadius: Radius.xl, padding: Spacing.lg, marginBottom: Spacing.md, minHeight: 140, overflow: 'hidden' },
    heroLabel: {
      ...Typography.caption,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    heroAmount: {
      fontSize: 42,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1.5,
      marginVertical: 6,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
    heroStat: { flex: 1 },
    heroStatLabel: { ...Typography.small, color: colors.textMuted },
    heroStatValue: { ...Typography.bodyBold, color: colors.text, marginTop: 2 },
    heroDivider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: Spacing.md },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionTitle: { ...Typography.h2, color: colors.text, fontSize: 18 },
    sectionHint: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    sectionActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    sectionFilterBtn: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
      borderWidth: 1,
      borderColor: colors.primary + '35',
      borderRadius: 14,
    },
    sectionFilterBtnActive: { backgroundColor: colors.primary + '28', borderColor: colors.primary },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    searchIcon: { marginRight: Spacing.sm },
    searchInput: {
      flex: 1,
      ...Typography.body,
      color: colors.text,
      paddingVertical: Spacing.md,
    },
    clearBtn: { color: colors.textMuted, fontSize: 16, padding: Spacing.sm },
    dayHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    dayHeadingText: {
      ...Typography.small,
      color: colors.textMuted,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dayHeadingLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    loadMoreWrap: {
      minHeight: 64,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    loadMoreText: {
      ...Typography.caption,
      color: colors.textMuted,
    },
    emptyIcon: {
      width: 88,
      height: 88,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
    fabRow: {
      position: 'absolute',
      right: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      zIndex: 20,
    },
    fabWrap: {
      width: 58,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dripLayer: {
      position: 'absolute',
      width: 140,
      height: 170,
      top: -56,
      left: -41,
      zIndex: 1,
    },
    fabFront: {
      zIndex: 2,
    },
    fab: {
      width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center',
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 14, elevation: 12,
    },
    fabIcon: { fontSize: 28, color: '#FFF', fontWeight: '300' },
    filterOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      padding: Spacing.lg,
    },
    filterSheet: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.md,
    },
    filterSheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    filterSheetTitle: { ...Typography.h2, color: colors.text },
    filterSheetHint: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    filterSectionLabel: {
      ...Typography.small,
      color: colors.textMuted,
      fontWeight: '800',
      letterSpacing: 1,
      marginTop: Spacing.xs,
    },
    filterCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: Spacing.sm,
    },
    filterOption: {
      width: '31.5%',
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: Radius.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterOptionActive: {
      backgroundColor: colors.primary + '2B',
      borderColor: colors.primary,
    },
    filterOptionDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.textMuted + '55',
    },
    filterOptionDotActive: {
      backgroundColor: colors.primaryLight,
      shadowColor: colors.primary,
      shadowOpacity: 0.8,
      shadowRadius: 4,
    },
    filterOptionText: { ...Typography.small, color: colors.textSecondary, fontWeight: '600' },
    filterOptionTextActive: { color: colors.primaryLight, fontWeight: '800' },
    filterPeriodNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xs,
    },
    filterPeriodBtn: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    filterPeriodArrow: { color: colors.text, fontSize: 24, lineHeight: 26 },
    filterPeriodLabel: {
      ...Typography.bodyBold,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    filterApplyBtn: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.lg,
      backgroundColor: colors.primary,
    },
    filterApplyBtnDisabled: { opacity: 0.72 },
    filterApplyingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    filterApplyText: { ...Typography.bodyBold, color: '#FFF' },
    budgetOverlay: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
    budgetSheet: {
      backgroundColor: colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
      borderWidth: 1, borderColor: colors.border,
    },
    budgetTitle: { ...Typography.h2, color: colors.text, textAlign: 'center' },
    budgetMonth: {
      ...Typography.bodyBold,
      color: colors.primaryLight,
      textAlign: 'center',
      marginTop: 4,
    },
    budgetHint: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: Spacing.md,
    },
    budgetInput: {
      backgroundColor: colors.surfaceElevated, borderRadius: Radius.md, padding: Spacing.md,
      color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    budgetRepeatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.xs,
    },
    budgetRepeatText: {
      ...Typography.caption,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 18,
    },
    budgetSave: { backgroundColor: colors.primary, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
    budgetSaveText: { ...Typography.bodyBold, color: '#FFF' },
  });
}
