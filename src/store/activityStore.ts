import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CategoryId, Expense } from '../types/expense';
import { useAuthStore } from './authStore';

const STORAGE_KEY = '@expenso_activity_v1';
const MAX_ITEMS = 500;

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
  load: () => Promise<void>;
  logAdded: (expense: Expense, source?: 'local' | 'joint') => Promise<void>;
  logEdited: (
    before: Expense,
    after: Partial<Pick<Expense, 'amount' | 'merchantLabel' | 'category' | 'note'>>,
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

async function persist(activities: ActivityItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

function push(get: () => ActivityStore, set: (p: Partial<ActivityStore>) => void, item: ActivityItem) {
  const activities = [item, ...get().activities].slice(0, MAX_ITEMS);
  set({ activities });
  void persist(activities);
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  activities: [],
  isLoaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      set({ activities: raw ? JSON.parse(raw) : [], isLoaded: true });
    } catch {
      set({ activities: [], isLoaded: true });
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
}));
