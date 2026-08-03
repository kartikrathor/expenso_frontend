import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore } from '../store/expenseStore';
import { useJointStore } from '../store/jointStore';
import { TimeFilter } from '../types/expense';
import {
  categoryBreakdown,
  dailySpending,
  filterExpenses,
  merchantBreakdown,
  todaySpent,
  totalSpent,
} from '../utils/expenseAnalytics';

/**
 * One-time: queue this device's old local expenses into the joint outbox.
 * Tracks which local IDs were already queued so retries never duplicate.
 */
async function syncLocalIntoJointOnce() {
  const joint = useJointStore.getState().joint;
  if (!joint) return;

  const userId = useAuthStore.getState().user?.id;
  const localOwner = useExpenseStore.getState().activeUserId;
  // Never push another account's leftover locals into this joint group.
  if (!userId || !localOwner || localOwner !== userId) return;

  const flagKey = `@expenso_local_synced_${joint.id}`;
  const idsKey = `@expenso_local_synced_ids_${joint.id}`;
  const done = await AsyncStorage.getItem(flagKey);
  if (done === 'true') return;

  const local = useExpenseStore.getState().expenses;
  if (local.length === 0) {
    await AsyncStorage.setItem(flagKey, 'true');
    return;
  }

  let syncedIds: string[] = [];
  try {
    syncedIds = JSON.parse((await AsyncStorage.getItem(idsKey)) || '[]');
  } catch {
    syncedIds = [];
  }
  const synced = new Set(syncedIds);

  for (const e of local) {
    if (synced.has(e.id)) continue;
    try {
      await useJointStore.getState().addJointExpense({
        amount: e.amount,
        merchantLabel: e.merchantLabel,
        merchant: e.merchant,
        category: e.category,
        note: e.note,
        date: e.date,
        inputMethod: e.inputMethod,
      });
      synced.add(e.id);
      await AsyncStorage.setItem(idsKey, JSON.stringify([...synced]));
    } catch {
      // leave for retry on next focus; do not mark full sync done
    }
  }

  const remaining = local.filter(e => !synced.has(e.id));
  if (remaining.length === 0) {
    await AsyncStorage.setItem(flagKey, 'true');
  }
}

export function useHouseholdExpenses() {
  const user = useAuthStore(s => s.user);
  const joint = useJointStore(s => s.joint);
  const jointExpenses = useJointStore(s => s.expenses);
  const localExpenses = useExpenseStore(s => s.expenses);
  const localBudget = useExpenseStore(s => s.monthlyBudget);
  const loadJoint = useJointStore(s => s.loadJoint);
  const flushOutbox = useJointStore(s => s.flushOutbox);
  const refreshPersonal = useExpenseStore(s => s.refreshFromServer);
  const pendingCount = useJointStore(s => s.pendingCount);
  const isSyncing = useJointStore(s => s.isSyncing);
  const setJointBudget = useJointStore(s => s.setMonthlyBudget);
  const setLocalBudget = useExpenseStore(s => s.setMonthlyBudget);

  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);

  const isJoint = !!(user && joint);
  const expenses = isJoint ? jointExpenses : localExpenses;
  const monthlyBudget = isJoint
    ? (joint?.monthlyBudget ?? localBudget)
    : localBudget;

  const refresh = useCallback(async () => {
    if (!user || refreshLock.current) return;
    refreshLock.current = true;
    try {
      await loadJoint();
      if (useJointStore.getState().joint) {
        await syncLocalIntoJointOnce();
        await flushOutbox();
      } else {
        await refreshPersonal();
      }
    } finally {
      refreshLock.current = false;
    }
  }, [user, loadJoint, flushOutbox, refreshPersonal]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      // Soft refresh — never blocks UI; queue + cache keep data safe
      refresh();
    }, [refresh]),
  );

  const setMonthlyBudget = useCallback(
    async (amount: number) => {
      if (isJoint) {
        await setJointBudget(amount);
      } else {
        await setLocalBudget(amount);
      }
    },
    [isJoint, setJointBudget, setLocalBudget],
  );

  const getFiltered = useCallback(
    (filter: TimeFilter) => filterExpenses(expenses, filter),
    [expenses],
  );

  const getTotal = useCallback(
    (filter: TimeFilter) => totalSpent(expenses, filter),
    [expenses],
  );

  const getTodayTotal = useCallback(() => todaySpent(expenses), [expenses]);

  const getCategoryBreakdown = useCallback(
    (filter: TimeFilter) => categoryBreakdown(expenses, filter),
    [expenses],
  );

  const getMerchantBreakdown = useCallback(
    (filter: TimeFilter) => merchantBreakdown(expenses, filter),
    [expenses],
  );

  const getDailySpending = useCallback(
    (filter: TimeFilter) => dailySpending(expenses, filter),
    [expenses],
  );

  return useMemo(
    () => ({
      isJoint,
      joint,
      expenses,
      monthlyBudget,
      setMonthlyBudget,
      refresh,
      onRefresh,
      refreshing,
      pendingCount,
      isSyncing,
      getFiltered,
      getTotal,
      getTodayTotal,
      getCategoryBreakdown,
      getMerchantBreakdown,
      getDailySpending,
    }),
    [
      isJoint,
      joint,
      expenses,
      monthlyBudget,
      setMonthlyBudget,
      refresh,
      onRefresh,
      refreshing,
      pendingCount,
      isSyncing,
      getFiltered,
      getTotal,
      getTodayTotal,
      getCategoryBreakdown,
      getMerchantBreakdown,
      getDailySpending,
    ],
  );
}
