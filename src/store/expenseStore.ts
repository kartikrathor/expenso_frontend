import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Expense, MerchantId, TimeFilter, CategoryId } from '../types/expense';
import {
  parseISO,
  isToday,
} from 'date-fns';
import { filterExpenses, sortByNewest } from '../utils/expenseAnalytics';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';

function expensesKey(userId: string) {
  return `@expensewise_expenses_${userId}`;
}
function budgetKey(userId: string) {
  return `@expensewise_budget_${userId}`;
}
function uploadedIdsKey(userId: string) {
  return `@expensewise_personal_uploaded_ids_${userId}`;
}

const LEGACY_EXPENSES_KEY = '@expensewise_expenses';
const LEGACY_BUDGET_KEY = '@expensewise_budget';
const MONGO_ID_RE = /^[a-f0-9]{24}$/i;

interface ExpenseStore {
  expenses: Expense[];
  monthlyBudget: number;
  isLoaded: boolean;
  activeUserId: string | null;
  isSyncing: boolean;
  loadExpenses: () => Promise<void>;
  loadForUser: (userId: string | null) => Promise<void>;
  refreshFromServer: () => Promise<void>;
  clearAllExpenses: () => Promise<void>;
  setMonthlyBudget: (amount: number) => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'createdAt'>) => Promise<Expense>;
  updateExpense: (id: string, changes: Partial<Omit<Expense, 'id' | 'createdAt'>>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteExpensesByYear: (year: number) => Promise<number>;
  deleteExpensesByMonth: (year: number, month: number) => Promise<number>;
  deleteOldestEntries: (count: number) => Promise<number>;
  getFilteredExpenses: (filter: TimeFilter) => Expense[];
  getTotalSpent: (filter: TimeFilter) => number;
  getTodaySpent: () => number;
  getCategoryBreakdown: (filter: TimeFilter) => { category: string; amount: number; color: string }[];
  getMerchantBreakdown: (filter: TimeFilter) => { merchant: string; amount: number }[];
  getDailySpending: (filter: TimeFilter) => { label: string; value: number }[];
}

type ServerExpense = {
  _id: string;
  amount: number;
  merchantLabel: string;
  merchant?: string;
  category?: string;
  note?: string;
  date: string | Date;
  inputMethod?: 'voice' | 'manual';
  createdAt?: string | Date;
};

const CATEGORY_COLORS: Record<string, string> = {
  food: '#F472B6',
  groceries: '#10B981',
  shopping: '#818CF8',
  transport: '#38BDF8',
  entertainment: '#FBBF24',
  bills: '#06B6D4',
  rent: '#A78BFA',
  taxes: '#FB923C',
  gifts: '#E879F9',
  donation: '#34D399',
  insurance: '#0EA5E9',
  personal_care: '#D946EF',
  health: '#F87171',
  other: '#94A3B8',
};

function authToken(): string | null {
  return useAuthStore.getState().token;
}

function toExpense(raw: ServerExpense): Expense {
  // Keep any category slug (including user custom); blank → other
  const cat = (raw.category?.trim() || 'other') as CategoryId;
  const date = typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString();
  const createdAt = raw.createdAt
    ? typeof raw.createdAt === 'string'
      ? raw.createdAt
      : new Date(raw.createdAt).toISOString()
    : date;
  return {
    id: raw._id,
    amount: raw.amount,
    merchant: (raw.merchant as MerchantId) || 'default',
    merchantLabel: raw.merchantLabel,
    category: cat,
    note: raw.note || '',
    date,
    createdAt,
    inputMethod: raw.inputMethod === 'voice' ? 'voice' : 'manual',
  };
}

let pendingPersist: { userId: string; expenses: Expense[]; budget: number } | null = null;
/** Bumps on every loadForUser so stale network responses never overwrite a newer session. */
let loadSeq = 0;

async function writePersistJob(job: { userId: string; expenses: Expense[]; budget: number }) {
  await AsyncStorage.setItem(expensesKey(job.userId), JSON.stringify(job.expenses));
  await AsyncStorage.setItem(budgetKey(job.userId), String(job.budget));
}

/** Flush any pending cache write immediately (critical before logout / account switch). */
async function flushPersistCache() {
  const job = pendingPersist;
  pendingPersist = null;
  if (!job) return;
  try {
    await writePersistJob(job);
  } catch {
    /* ignore */
  }
}

async function persistCacheNow(userId: string | null, expenses: Expense[], budget: number) {
  if (!userId) return;
  pendingPersist = { userId, expenses, budget };
  await flushPersistCache();
}

async function readCache(userId: string): Promise<{ expenses: Expense[]; monthlyBudget: number }> {
  try {
    const raw = await AsyncStorage.getItem(expensesKey(userId));
    const budgetRaw = await AsyncStorage.getItem(budgetKey(userId));
    return {
      expenses: raw ? JSON.parse(raw) : [],
      monthlyBudget: budgetRaw ? parseFloat(budgetRaw) || 0 : 0,
    };
  } catch {
    return { expenses: [], monthlyBudget: 0 };
  }
}

function expenseFingerprint(e: {
  amount: number;
  merchantLabel: string;
  date: string;
  note?: string;
}): string {
  const day = (e.date || '').slice(0, 10);
  return `${e.amount}|${(e.merchantLabel || '').trim().toLowerCase()}|${day}|${(e.note || '').trim()}`;
}

function isLocalOnlyId(id: string): boolean {
  return !MONGO_ID_RE.test(id);
}

/** User-scoped cache + old device-wide legacy key (if still present). */
async function collectLocalCandidates(userId: string): Promise<{
  expenses: Expense[];
  monthlyBudget: number;
}> {
  const cached = await readCache(userId);
  const byFp = new Map<string, Expense>();
  for (const e of cached.expenses) {
    byFp.set(expenseFingerprint(e), e);
  }

  let legacyBudget = 0;
  try {
    const legacyRaw = await AsyncStorage.getItem(LEGACY_EXPENSES_KEY);
    if (legacyRaw) {
      const list: Expense[] = JSON.parse(legacyRaw);
      for (const e of list) {
        const fp = expenseFingerprint(e);
        if (!byFp.has(fp)) byFp.set(fp, e);
      }
    }
    const lb = await AsyncStorage.getItem(LEGACY_BUDGET_KEY);
    if (lb) legacyBudget = parseFloat(lb) || 0;
  } catch {
    /* ignore bad legacy */
  }

  return {
    expenses: [...byFp.values()],
    monthlyBudget: cached.monthlyBudget > 0 ? cached.monthlyBudget : legacyBudget,
  };
}

/**
 * Automatically push any device-cached personal expenses that are not yet on the server.
 * Only uploads local-only IDs (never re-POSTs a Mongo id that was deleted remotely).
 * Dedupes by amount + merchant + day + note so pull/refresh won't create duplicates.
 */
async function syncLocalCacheToServer(userId: string, token: string): Promise<number> {
  const local = await collectLocalCandidates(userId);
  let uploadedCount = 0;

  let uploadedIds: string[] = [];
  try {
    uploadedIds = JSON.parse((await AsyncStorage.getItem(uploadedIdsKey(userId))) || '[]');
  } catch {
    uploadedIds = [];
  }
  const uploaded = new Set(uploadedIds);

  const remote = await apiRequest<{ expenses: ServerExpense[] }>('/api/expenses', { token });
  const remoteList = remote.expenses || [];
  const remoteIds = new Set(remoteList.map(e => e._id));
  const remoteFps = new Set(remoteList.map(e => expenseFingerprint(toExpense(e))));

  for (const e of local.expenses) {
    if (uploaded.has(e.id)) continue;

    // Already on server under this id
    if (!isLocalOnlyId(e.id) && remoteIds.has(e.id)) {
      uploaded.add(e.id);
      continue;
    }

    // Mongo id missing remotely → deleted on server; never resurrect
    if (!isLocalOnlyId(e.id)) {
      uploaded.add(e.id);
      continue;
    }

    const fp = expenseFingerprint(e);
    if (remoteFps.has(fp)) {
      uploaded.add(e.id);
      continue;
    }

    try {
      await apiRequest('/api/expenses', {
        method: 'POST',
        token,
        body: {
          amount: e.amount,
          merchantLabel: e.merchantLabel,
          merchant: e.merchant,
          category: e.category,
          note: e.note,
          date: e.date,
          inputMethod: e.inputMethod,
        },
      });
      uploaded.add(e.id);
      remoteFps.add(fp);
      uploadedCount += 1;
      await AsyncStorage.setItem(uploadedIdsKey(userId), JSON.stringify([...uploaded]));
    } catch {
      // Retry on next login / refresh — keep going so one failure doesn't block others
      await AsyncStorage.setItem(uploadedIdsKey(userId), JSON.stringify([...uploaded]));
    }
  }

  await AsyncStorage.setItem(uploadedIdsKey(userId), JSON.stringify([...uploaded]));

  // Push personal budget if we have one and server is still 0
  try {
    const budgetRes = await apiRequest<{ monthlyBudget: number }>('/api/expenses/budget', { token });
    const serverBudget = budgetRes.monthlyBudget ?? 0;
    if (local.monthlyBudget > 0 && serverBudget <= 0) {
      await apiRequest('/api/expenses/budget', {
        method: 'PATCH',
        token,
        body: { monthlyBudget: local.monthlyBudget },
      });
    }
  } catch {
    /* budget optional */
  }

  // Legacy keys consumed — avoid re-reading forever
  if (local.expenses.length > 0 || local.monthlyBudget > 0) {
    await AsyncStorage.removeItem(LEGACY_EXPENSES_KEY);
    await AsyncStorage.removeItem(LEGACY_BUDGET_KEY);
  }

  return uploadedCount;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  monthlyBudget: 0,
  isLoaded: false,
  activeUserId: null,
  isSyncing: false,

  loadExpenses: async () => {
    set({ isLoaded: true });
  },

  loadForUser: async (userId) => {
    const seq = ++loadSeq;

    if (!userId) {
      // Persist any debounced writes for the previous user before wiping memory
      await flushPersistCache();
      if (seq !== loadSeq) return;
      set({
        expenses: [],
        monthlyBudget: 0,
        isLoaded: true,
        activeUserId: null,
        isSyncing: false,
      });
      return;
    }

    set({ isLoaded: false, activeUserId: userId });
    const localBundle = await collectLocalCandidates(userId);
    if (seq !== loadSeq || get().activeUserId !== userId) return;
    set({
      expenses: sortByNewest(localBundle.expenses),
      monthlyBudget: localBundle.monthlyBudget,
      isLoaded: true,
      activeUserId: userId,
    });

    const token = authToken();
    if (!token) return;

    set({ isSyncing: true });
    try {
      // Show cache first, then push any unsynced local/legacy rows, then pull server truth.
      await syncLocalCacheToServer(userId, token);
      if (seq !== loadSeq || get().activeUserId !== userId) return;

      const [listRes, budgetRes] = await Promise.all([
        apiRequest<{ expenses: ServerExpense[] }>('/api/expenses', { token }),
        apiRequest<{ monthlyBudget: number }>('/api/expenses/budget', { token }),
      ]);
      if (seq !== loadSeq || get().activeUserId !== userId) return;

      const remoteList = sortByNewest((listRes.expenses || []).map(toExpense));
      const remoteFps = new Set(remoteList.map(expenseFingerprint));
      // Keep any still-local-only rows that failed to upload (don't wipe them on pull)
      const orphans = (await collectLocalCandidates(userId)).expenses.filter(
        e => isLocalOnlyId(e.id) && !remoteFps.has(expenseFingerprint(e)),
      );
      const expenses = orphans.length
        ? sortByNewest([...orphans, ...remoteList])
        : remoteList;
      const monthlyBudget = budgetRes.monthlyBudget ?? 0;
      set({ expenses, monthlyBudget, isSyncing: false });
      await persistCacheNow(userId, expenses, monthlyBudget);
    } catch {
      // Keep cache if offline / server down
      if (seq === loadSeq && get().activeUserId === userId) {
        set({ isSyncing: false });
      }
    }
  },

  refreshFromServer: async () => {
    const userId = get().activeUserId;
    const token = authToken();
    if (!userId || !token) return;
    const seq = loadSeq;
    set({ isSyncing: true });
    try {
      await syncLocalCacheToServer(userId, token);
      if (seq !== loadSeq || get().activeUserId !== userId) return;
      const [listRes, budgetRes] = await Promise.all([
        apiRequest<{ expenses: ServerExpense[] }>('/api/expenses', { token }),
        apiRequest<{ monthlyBudget: number }>('/api/expenses/budget', { token }),
      ]);
      if (seq !== loadSeq || get().activeUserId !== userId) return;
      const remoteList = sortByNewest((listRes.expenses || []).map(toExpense));
      const remoteFps = new Set(remoteList.map(expenseFingerprint));
      const orphans = (await collectLocalCandidates(userId)).expenses.filter(
        e => isLocalOnlyId(e.id) && !remoteFps.has(expenseFingerprint(e)),
      );
      const expenses = orphans.length
        ? sortByNewest([...orphans, ...remoteList])
        : remoteList;
      const monthlyBudget = budgetRes.monthlyBudget ?? 0;
      set({ expenses, monthlyBudget, isSyncing: false });
      await persistCacheNow(userId, expenses, monthlyBudget);
    } catch {
      if (seq === loadSeq && get().activeUserId === userId) {
        set({ isSyncing: false });
      }
    }
  },

  clearAllExpenses: async () => {
    const userId = get().activeUserId;
    const token = authToken();
    const current = [...get().expenses];
    set({ expenses: [] });
    if (userId) await persistCacheNow(userId, [], get().monthlyBudget);
    if (token) {
      for (const e of current) {
        try {
          await apiRequest(`/api/expenses/${e.id}`, { method: 'DELETE', token });
        } catch {
          /* ignore */
        }
      }
    }
  },

  setMonthlyBudget: async (amount) => {
    const userId = get().activeUserId;
    const token = authToken();
    set({ monthlyBudget: amount });
    if (userId) await AsyncStorage.setItem(budgetKey(userId), String(amount));
    if (token) {
      await apiRequest('/api/expenses/budget', {
        method: 'PATCH',
        token,
        body: { monthlyBudget: amount },
      });
    }
  },

  addExpense: async (data) => {
    const token = authToken();
    const userId = get().activeUserId;
    if (!token || !userId) {
      throw new Error('Please sign in again to continue.');
    }

    const res = await apiRequest<{ expense: ServerExpense }>('/api/expenses', {
      method: 'POST',
      token,
      body: {
        amount: data.amount,
        merchantLabel: data.merchantLabel,
        merchant: data.merchant,
        category: data.category,
        note: data.note,
        date: data.date,
        inputMethod: data.inputMethod,
      },
    });

    const expense = toExpense(res.expense);
    const expenses = sortByNewest([expense, ...get().expenses]);
    set({ expenses });
    // Write through immediately so logout right after add never loses the row
    await persistCacheNow(userId, expenses, get().monthlyBudget);
    return expense;
  },

  updateExpense: async (id, changes) => {
    const token = authToken();
    const userId = get().activeUserId;
    if (!token || !userId) throw new Error('Please sign in again to continue.');

    const res = await apiRequest<{ expense: ServerExpense }>(`/api/expenses/${id}`, {
      method: 'PATCH',
      token,
      body: changes,
    });

    const updated = toExpense(res.expense);
    const expenses = sortByNewest(
      get().expenses.map(e => (e.id === id ? updated : e)),
    );
    set({ expenses });
    await persistCacheNow(userId, expenses, get().monthlyBudget);
  },

  deleteExpense: async (id) => {
    const token = authToken();
    const userId = get().activeUserId;
    if (!token || !userId) throw new Error('Please sign in again to continue.');

    await apiRequest(`/api/expenses/${id}`, { method: 'DELETE', token });
    const expenses = get().expenses.filter(e => e.id !== id);
    set({ expenses });
    await persistCacheNow(userId, expenses, get().monthlyBudget);
  },

  deleteExpensesByYear: async (year) => {
    const toDelete = get().expenses.filter(e => parseISO(e.date).getFullYear() === year);
    for (const e of toDelete) {
      await get().deleteExpense(e.id);
    }
    return toDelete.length;
  },

  deleteExpensesByMonth: async (year, month) => {
    const toDelete = get().expenses.filter(e => {
      const d = parseISO(e.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
    for (const e of toDelete) {
      await get().deleteExpense(e.id);
    }
    return toDelete.length;
  },

  deleteOldestEntries: async (count) => {
    const before = get().expenses.length;
    if (count <= 0 || before === 0) return 0;
    const sorted = [...get().expenses].sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
    );
    const victims = sorted.slice(0, Math.min(count, sorted.length));
    for (const e of victims) {
      await get().deleteExpense(e.id);
    }
    return victims.length;
  },

  getFilteredExpenses: (filter) => filterExpenses(get().expenses, filter),

  getTotalSpent: (filter) => {
    return get().getFilteredExpenses(filter).reduce((sum, e) => sum + e.amount, 0);
  },

  getTodaySpent: () => {
    return get().expenses
      .filter(e => isToday(parseISO(e.date)))
      .reduce((sum, e) => sum + e.amount, 0);
  },

  getCategoryBreakdown: (filter) => {
    const filtered = get().getFilteredExpenses(filter);
    const map = new Map<string, number>();
    filtered.forEach(e => {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        color: CATEGORY_COLORS[category] ?? '#A0A0B8',
      }))
      .sort((a, b) => b.amount - a.amount);
  },

  getMerchantBreakdown: (filter) => {
    const filtered = get().getFilteredExpenses(filter);
    const map = new Map<string, number>();
    filtered.forEach(e => {
      const key = e.merchantLabel;
      map.set(key, (map.get(key) ?? 0) + e.amount);
    });
    return Array.from(map.entries())
      .map(([merchant, amount]) => ({ merchant, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  },

  getDailySpending: (filter) => {
    const filtered = get().getFilteredExpenses(filter);
    const map = new Map<string, number>();
    filtered.forEach(e => {
      const day = e.date.split('T')[0];
      map.set(day, (map.get(day) ?? 0) + e.amount);
    });
    const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return sorted.slice(-7).map(([label, value]) => ({
      label: label.slice(5),
      value,
    }));
  },
}));
