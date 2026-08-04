import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryId, Expense } from '../types/expense';
import { useAuthStore } from './authStore';

const LEGACY_KEY = '@expenso_activity_v1';
const MIGRATED_FLAG = '@expenso_activity_migrated_to';
const MAX_ITEMS = 500;

function activityKey(userId: string) {
  return `@expenso_activity_v1_${userId}`;
}

export type ActivityType = 'added' | 'edited' | 'deleted';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  at: string;
  expenseId: string;
  amount: number;
  merchantLabel: string;
  category: CategoryId;
  note: string;
  byName: string;
  /** Previous values when type is edited */
  previousAmount?: number;
  previousMerchantLabel?: string;
  previousCategory?: CategoryId;
  source: 'local' | 'joint';
}

interface ActivityStore {
  activities: ActivityItem[];
  isLoaded: boolean;
  activeUserId: string | null;
  load: () => Promise<void>;
  loadForUser: (userId: string | null) => Promise<void>;
  clearAll: () => Promise<void>;
  /**
   * After login/sync: create "added" rows for expenses that have no activity yet.
   * Activity is device-local; server expenses would otherwise leave the Log → Activity tab empty.
   */
  seedFromExpenses: (expenses: Expense[], source?: 'local' | 'joint') => Promise<void>;
  logAdded: (expense: Expense, source?: 'local' | 'joint') => Promise<void>;
  logEdited: (
    before: Expense,
    after: Partial<Pick<Expense, 'amount' | 'merchantLabel' | 'category' | 'note' | 'date'>>,
    source?: 'local' | 'joint',
  ) => Promise<void>;
  logDeleted: (expense: Expense, source?: 'local' | 'joint') => Promise<void>;
}

function actorName(): string {
  return useAuthStore.getState().user?.name || 'You';
}

function generateId(): string {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persist(activities: ActivityItem[], userId: string | null) {
  if (!userId) return;
  await AsyncStorage.setItem(activityKey(userId), JSON.stringify(activities));
}

function push(get: () => ActivityStore, set: (p: Partial<ActivityStore>) => void, item: ActivityItem) {
  const activities = [item, ...get().activities].slice(0, MAX_ITEMS);
  set({ activities });
  void persist(activities, get().activeUserId);
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  isLoaded: false,
  activeUserId: null,

  load: async () => {
    set({ isLoaded: true });
  },

  loadForUser: async (userId) => {
    if (!userId) {
      set({ activities: [], isLoaded: true, activeUserId: null });
      return;
    }

    set({ isLoaded: false, activeUserId: userId });
    try {
      let raw = await AsyncStorage.getItem(activityKey(userId));
      if (!raw) {
        const migratedTo = await AsyncStorage.getItem(MIGRATED_FLAG);
        if (!migratedTo) {
          // Legacy activity was not user-scoped — discard to avoid cross-account leak.
          await AsyncStorage.removeItem(LEGACY_KEY);
          await AsyncStorage.setItem(MIGRATED_FLAG, userId);
        }
      } else {
        const migratedTo = await AsyncStorage.getItem(MIGRATED_FLAG);
        if (!migratedTo) await AsyncStorage.setItem(MIGRATED_FLAG, userId);
      }
      set({
        activities: raw ? JSON.parse(raw) : [],
        isLoaded: true,
        activeUserId: userId,
      });
    } catch {
      set({ activities: [], isLoaded: true, activeUserId: userId });
    }
  },

  logAdded: async (expense, source = 'local') => {
    push(get, set, {
      id: generateId(),
      type: 'added',
      at: new Date().toISOString(),
      expenseId: expense.id,
      amount: expense.amount,
      merchantLabel: expense.merchantLabel,
      category: expense.category,
      note: expense.note,
      byName: actorName(),
      source,
    });
  },

  logEdited: async (before, after, source = 'local') => {
    push(get, set, {
      id: generateId(),
      type: 'edited',
      at: new Date().toISOString(),
      expenseId: before.id,
      amount: after.amount ?? before.amount,
      merchantLabel: after.merchantLabel ?? before.merchantLabel,
      category: after.category ?? before.category,
      note: after.note ?? before.note,
      byName: actorName(),
      previousAmount: before.amount,
      previousMerchantLabel: before.merchantLabel,
      previousCategory: before.category,
      source,
    });
  },

  logDeleted: async (expense, source = 'local') => {
    push(get, set, {
      id: generateId(),
      type: 'deleted',
      at: new Date().toISOString(),
      expenseId: expense.id,
      amount: expense.amount,
      merchantLabel: expense.merchantLabel,
      category: expense.category,
      note: expense.note,
      byName: actorName(),
      source,
    });
  },

  clearAll: async () => {
    const userId = get().activeUserId;
    set({ activities: [] });
    if (userId) await AsyncStorage.removeItem(activityKey(userId));
  },

  seedFromExpenses: async (expenses, source = 'local') => {
    const { activities, activeUserId } = get();
    if (!activeUserId || !expenses.length) return;

    const covered = new Set(activities.map(a => a.expenseId));
    const missing = expenses.filter(e => e?.id && !covered.has(e.id));
    if (!missing.length) return;

    const seeded: ActivityItem[] = missing.map(expense => ({
      id: `act_seed_${expense.id}`,
      type: 'added',
      at: expense.createdAt || expense.date || new Date().toISOString(),
      expenseId: expense.id,
      amount: expense.amount,
      merchantLabel: expense.merchantLabel || 'Expense',
      category: expense.category,
      note: expense.note || '',
      byName: expense.createdByName || actorName(),
      source,
    }));

    const merged = [...seeded, ...activities]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, MAX_ITEMS);
    set({ activities: merged });
    await persist(merged, activeUserId);
  },
}));
