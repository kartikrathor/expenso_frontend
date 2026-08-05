import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
} from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { WaterGradient } from '../components/WaterGradient';
import LinearGradient from 'react-native-linear-gradient';
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
import { format } from 'date-fns';
import { formatExpenseDayLabel } from '../utils/expenseDate';

const FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

/** First paint + each scroll page on Home */
const HOME_PAGE_SIZE = 25;

function firstName(full?: string | null) {
  const n = (full || '').trim();
  if (!n) return '';
  return n.split(/\s+/)[0];
}

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { colors, gradientPoints, actionGradient } = useTheme();
  const bottomPad = getTabBarBottomInset(insets.bottom);
  const userName = useAuthStore(s => s.user?.name);
  const greetName = firstName(userName);

  const [filter, setFilter] = useState<TimeFilter>('month');
  const [visibleCount, setVisibleCount] = useState(HOME_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const loadMoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
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

  const { isJoint, joint, expenses: householdExpenses, getFiltered, getTotal, getTodayTotal, monthlyBudget, setMonthlyBudget, onRefresh, refreshing, pendingCount, isSyncing } =
    useHouseholdExpenses();
  const addJointExpense = useJointStore(s => s.addJointExpense);

  const addExpense = useExpenseStore(s => s.addExpense);
  const { requestDelete, deleteModal } = useDeleteExpense();
  const { requestEdit, editModal } = useEditExpense();

  const filtered = useMemo(() => getFiltered(filter), [getFiltered, filter]);
  const total = useMemo(
    () => filtered.reduce((sum, expense) => sum + expense.amount, 0),
    [filtered],
  );
  const monthTotal = useMemo(
    () => (filter === 'month' ? total : getTotal('month')),
    [filter, getTotal, total],
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

  // Newest-first list for the filter; UI pages this so Home doesn't mount every card at once.
  const sortedExpenses = useMemo(() => {
    if (filtered.length <= 1) return filtered;
    let needsSort = false;
    for (let i = 1; i < Math.min(filtered.length, 8); i++) {
      const a = Date.parse(filtered[i - 1].date) || 0;
      const b = Date.parse(filtered[i].date) || 0;
      if (a < b) {
        needsSort = true;
        break;
      }
    }
    if (!needsSort) return filtered;
    return [...filtered].sort(
      (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
    );
  }, [filtered]);

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
  }, [filter]);

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
    if (monthlyBudget <= 0) return 0.58;
    const remaining = Math.max(0, monthlyBudget - monthTotal);
    return Math.max(0, Math.min(1, remaining / monthlyBudget));
  }, [monthlyBudget, monthTotal]);

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
    filter === 'month' ? 'This Month'
      : filter === 'week' ? 'This Week'
        : filter === 'year' ? 'This Year'
          : 'All Time';
  const listTitle =
    filter === 'week' ? 'This week’s expenses'
      : filter === 'month' ? 'This month’s expenses'
        : filter === 'year' ? 'This year’s expenses'
          : 'All expenses';

  const openBudget = useCallback(() => {
    setBudgetInput(monthlyBudget > 0 ? String(monthlyBudget) : '');
    setShowBudget(true);
  }, [monthlyBudget]);

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
              <Text style={styles.heroStatValue}>{filtered.length}</Text>
            </View>
          </View>
        </WaterGradient>
      </View>

      <BudgetProgress
        spent={monthTotal}
        budget={monthlyBudget}
        onSetBudget={openBudget}
      />

      <QuickAddBar onPress={() => setShowAdd(true)} />

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={styles.sectionTitle}>{listTitle}</Text>
          <Text style={styles.sectionHint}>
            {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
            {isJoint ? ' · shared account' : ''}
          </Text>
        </View>
        <Text style={styles.periodPill}>{filterLabel}</Text>
      </View>
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
    filtered.length,
    monthTotal,
    monthlyBudget,
    openBudget,
    filter,
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
        householdExpenses.length > 0
          ? 'No expenses in this period'
          : isJoint
            ? 'Add a shared expense'
            : 'Add your first expense'
      }
      subtitle={
        householdExpenses.length > 0
          ? 'Try Week, Month, Year, or All — or pull down to refresh'
          : isJoint
            ? 'Both partners can add here — it syncs for both of you'
            : 'In the Quick tab, type "Blinkit 200" or speak via the mic'
      }
    />
  ), [actionGradient, styles.emptyIcon, isJoint, householdExpenses.length, colors.gradientStart]);

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
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            ListFooterComponent={ListFooter}
            showsVerticalScrollIndicator={false}
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
            {isJoint && (
              <Text style={[styles.date, { marginBottom: Spacing.sm }]}>
                Same for both partners · changing updates both
              </Text>
            )}
            <TextInput
              style={styles.budgetInput}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              placeholder="e.g. 15000"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Pressable
              style={styles.budgetSave}
              onPress={async () => {
                const val = parseFloat(budgetInput);
                if (val > 0) await setMonthlyBudget(val);
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
    filterRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    filterChip: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary + '33', borderColor: colors.primary },
    filterText: { ...Typography.caption, color: colors.textSecondary },
    filterTextActive: { color: colors.primaryLight, fontWeight: '700' },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    sectionTitle: { ...Typography.h2, color: colors.text, fontSize: 18 },
    sectionHint: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    periodPill: {
      ...Typography.small,
      color: colors.primaryLight,
      fontWeight: '700',
      backgroundColor: colors.primary + '18',
      borderWidth: 1,
      borderColor: colors.primary + '35',
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
      overflow: 'hidden',
    },
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
    budgetOverlay: { flex: 1, justifyContent: 'center', padding: Spacing.lg },
    budgetSheet: {
      backgroundColor: colors.surface, borderRadius: Radius.xl, padding: Spacing.lg,
      borderWidth: 1, borderColor: colors.border,
    },
    budgetTitle: { ...Typography.h2, color: colors.text, marginBottom: Spacing.md, textAlign: 'center' },
    budgetInput: {
      backgroundColor: colors.surfaceElevated, borderRadius: Radius.md, padding: Spacing.md,
      color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    budgetSave: { backgroundColor: colors.primary, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
    budgetSaveText: { ...Typography.bodyBold, color: '#FFF' },
  });
}
