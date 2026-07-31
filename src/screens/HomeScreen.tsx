import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { WaterGradient } from '../components/WaterGradient';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExpenseStore } from '../store/expenseStore';
import { useAuthStore } from '../store/authStore';
import { useJointStore } from '../store/jointStore';
import { useActivityStore } from '../store/activityStore';
import { ExpenseCard } from '../components/ExpenseCard';
import { EmptyState } from '../components/EmptyState';
import { AddExpenseModal, ExpenseSaveData } from '../components/AddExpenseModal';
import { HoldMicFab } from '../components/HoldMicFab';
import { SuccessToast } from '../components/SuccessToast';
import { BudgetProgress } from '../components/BudgetProgress';
import { QuickAddBar } from '../components/QuickAddBar';
import { ThemeToggle } from '../components/ThemeToggle';
import { formatCurrency } from '../utils/expenseParser';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useDeleteExpense } from '../hooks/useDeleteExpense';
import { useEditExpense } from '../hooks/useEditExpense';
import { TimeFilter, MerchantId } from '../types/expense';
import { format } from 'date-fns';

const FILTERS: { key: TimeFilter; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

export function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bottomPad = getTabBarBottomInset(insets.bottom);

  const [filter, setFilter] = useState<TimeFilter>('month');
  const [showAdd, setShowAdd] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [toast, setToast] = useState<{ amount: number; merchant: MerchantId; label: string } | null>(null);
  const fabScale = useSharedValue(1);

  const user = useAuthStore(s => s.user);
  const joint = useJointStore(s => s.joint);
  const jointExpenses = useJointStore(s => s.expenses);
  const loadJoint = useJointStore(s => s.loadJoint);
  const addJointExpense = useJointStore(s => s.addJointExpense);

  const isJoint = !!(user && joint);

  const addExpense = useExpenseStore(s => s.addExpense);
  const setMonthlyBudget = useExpenseStore(s => s.setMonthlyBudget);
  const expenses = useExpenseStore(s => s.expenses);
  const monthlyBudget = useExpenseStore(s => s.monthlyBudget);
  const { requestDelete, deleteModal } = useDeleteExpense();
  const { requestEdit, editModal } = useEditExpense();

  useFocusEffect(
    useCallback(() => {
      if (user) loadJoint();
    }, [user, loadJoint]),
  );

  const filtered = useMemo(() => {
    if (isJoint) return useJointStore.getState().getFiltered(filter);
    return useExpenseStore.getState().getFilteredExpenses(filter);
  }, [isJoint, jointExpenses, expenses, filter]);

  const total = useMemo(() => {
    if (isJoint) return useJointStore.getState().getTotal(filter);
    return useExpenseStore.getState().getTotalSpent(filter);
  }, [isJoint, jointExpenses, expenses, filter]);

  const monthTotal = useMemo(() => {
    if (isJoint) return useJointStore.getState().getTotal('month');
    return useExpenseStore.getState().getTotalSpent('month');
  }, [isJoint, jointExpenses, expenses]);

  const todayTotal = useMemo(() => {
    if (isJoint) return useJointStore.getState().getTodayTotal();
    return useExpenseStore.getState().getTodaySpent();
  }, [isJoint, jointExpenses, expenses]);

  const waterFill = useMemo(() => {
    if (monthlyBudget <= 0) return 0.58;
    const remaining = Math.max(0, monthlyBudget - monthTotal);
    return Math.max(0, Math.min(1, remaining / monthlyBudget));
  }, [monthlyBudget, monthTotal]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSave = useCallback(async (data: ExpenseSaveData) => {
    if (isJoint) {
      await addJointExpense({
        amount: data.amount,
        merchantLabel: data.merchantLabel,
        merchant: data.merchant,
        category: data.category,
        note: data.note,
        inputMethod: data.inputMethod,
      });
      const latest = useJointStore.getState().expenses[0];
      if (latest) await useActivityStore.getState().logAdded(latest, 'joint');
    } else {
      const created = await addExpense({ ...data, date: new Date().toISOString() });
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 72 }]}
      >
        <Animated.View entering={FadeInDown.duration(220)} style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Hello 👋</Text>
            <Text style={styles.date}>{format(new Date(), 'EEEE, d MMMM')}</Text>
          </View>
          <ThemeToggle />
        </Animated.View>

        {isJoint && (
          <View style={styles.jointBanner}>
            <Text style={styles.jointBannerText}>
              {joint!.emoji} Joint account · {joint!.name}
              {joint!.memberCount >= 2 ? ' · shared with partner' : ' · invite partner from Profile'}
            </Text>
          </View>
        )}

        <Animated.View entering={FadeInDown.delay(60).duration(220)}>
          <WaterGradient fill={waterFill} style={styles.heroCard}>
            <Text style={styles.heroLabel}>
              {filter === 'month' ? 'This Month' : filter === 'week' ? 'This Week' : filter === 'year' ? 'This Year' : 'All Time'}
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
        </Animated.View>

        <BudgetProgress
          spent={monthTotal}
          budget={monthlyBudget}
          onSetBudget={() => {
            setBudgetInput(monthlyBudget > 0 ? String(monthlyBudget) : '');
            setShowBudget(true);
          }}
        />

        <QuickAddBar onPress={() => setShowAdd(true)} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
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
        </ScrollView>

        <Text style={styles.sectionTitle}>{isJoint ? 'Shared expenses' : 'Recent'}</Text>

        {filtered.length === 0 ? (
          <EmptyState
            emoji="💸"
            title={isJoint ? 'Add a shared expense' : 'Add your first expense'}
            subtitle={
              isJoint
                ? 'Both partners can add here — it syncs for both of you'
                : 'In the Quick tab, type "Blinkit 200" or speak via the mic'
            }
          />
        ) : (
          filtered.slice(0, 25).map((expense, i) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              index={i}
              onDelete={handleDelete}
              onEdit={requestEdit}
            />
          ))
        )}
      </ScrollView>

      <View style={[styles.fabRow, { bottom: bottomPad - 8 }]}>
        <HoldMicFab onSave={handleSave} />
        <Animated.View style={fabStyle}>
          <Pressable
            onPress={() => setShowAdd(true)}
            onPressIn={() => { fabScale.value = withSpring(0.9); }}
            onPressOut={() => { fabScale.value = withSpring(1); }}
          >
            <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.fab}>
              <Text style={styles.fabIcon}>+</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      <AddExpenseModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={handleSave} />
      {deleteModal}
      {editModal}

      <Modal visible={showBudget} transparent animationType="fade">
        <KeyboardAvoidingView
          style={[styles.budgetOverlay, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBudget(false)} />
          <Pressable style={styles.budgetSheet} onPress={e => e.stopPropagation()}>
            <Text style={styles.budgetTitle}>Monthly Budget</Text>
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
    scroll: { padding: Spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
    headerLeft: { flex: 1 },
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
    filterRow: { marginBottom: Spacing.lg },
    filterChip: {
      paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: Spacing.sm,
    },
    filterChipActive: { backgroundColor: colors.primary + '33', borderColor: colors.primary },
    filterText: { ...Typography.caption, color: colors.textSecondary },
    filterTextActive: { color: colors.primaryLight, fontWeight: '700' },
    sectionTitle: { ...Typography.h3, color: colors.text, marginBottom: Spacing.md },
    fabRow: {
      position: 'absolute',
      right: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
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
