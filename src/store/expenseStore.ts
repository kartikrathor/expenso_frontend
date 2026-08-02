import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { Expense, TimeFilter } from '../types/expense';
import { generateId } from '../utils/generateId';
import {
  startOfWeek,
  startOfMonth,
  startOfYear,
  parseISO,
  startOfDay,
  isWithinInterval,
  isToday,
} from 'date-fns';

const STORAGE_KEY = '@expensewise_expenses';
const BUDGET_KEY = '@expensewise_budget';

interface ExpenseStore {
  expenses: Expense[];
  monthlyBudget: number;
  isLoaded: boolean;
  loadExpenses: () => Promise<void>;
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

const CATEGORY_COLORS: Record<string, string> = {
  food: '#F472B6',
  groceries: '#10B981',
  shopping: '#818CF8',
  transport: '#38BDF8',
  entertainment: '#FBBF24',
  bills: '#06B6D4',
  health: '#F87171',
  other: '#94A3B8',
};

function getFilterDate(filter: TimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case 'week': return startOfWeek(now, { weekStartsOn: 1 });
    case 'month': return startOfMonth(now);
    case 'year': return startOfYear(now);
    default: return null;
  }
}

async function persist(expenses: Expense[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  monthlyBudget: 0,
  isLoaded: false,

  loadExpenses: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const budgetRaw = await AsyncStorage.getItem(BUDGET_KEY);
      const expenses: Expense[] = raw ? JSON.parse(raw) : [];
      const monthlyBudget = budgetRaw ? parseFloat(budgetRaw) : 0;
      set({ expenses, monthlyBudget, isLoaded: true });
    } catch {
      set({ expenses: [], monthlyBudget: 0, isLoaded: true });
    }
  },

  clearAllExpenses: async () => {
    set({ expenses: [] });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  },

  setMonthlyBudget: async (amount) => {
    await AsyncStorage.setItem(BUDGET_KEY, String(amount));
    set({ monthlyBudget: amount });
  },

  addExpense: async (data) => {
    const expense: Expense = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    const expenses = [expense, ...get().expenses];
    await persist(expenses);
    set({ expenses });
    return expense;
  },

  updateExpense: async (id, changes) => {
    const expenses = get().expenses.map(e =>
      e.id === id ? { ...e, ...changes } : e,
    );
    await persist(expenses);
    set({ expenses });
  },

  deleteExpense: async (id) => {
    const expenses = get().expenses.filter(e => e.id !== id);
    await persist(expenses);
    set({ expenses });
  },

  deleteExpensesByYear: async (year) => {
    const before = get().expenses.length;
    const expenses = get().expenses.filter(e => parseISO(e.date).getFullYear() !== year);
    await persist(expenses);
    set({ expenses });
    return before - expenses.length;
  },

  deleteExpensesByMonth: async (year, month) => {
    const before = get().expenses.length;
    const expenses = get().expenses.filter(e => {
      const d = parseISO(e.date);
      return !(d.getFullYear() === year && d.getMonth() + 1 === month);
    });
    await persist(expenses);
    set({ expenses });
    return before - expenses.length;
  },

  deleteOldestEntries: async (count) => {
    const before = get().expenses.length;
    if (count <= 0 || before === 0) return 0;
    const sorted = [...get().expenses].sort(
      (a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime(),
    );
    const toRemove = new Set(sorted.slice(0, Math.min(count, sorted.length)).map(e => e.id));
    const expenses = get().expenses.filter(e => !toRemove.has(e.id));
    await persist(expenses);
    set({ expenses });
    return before - expenses.length;
  },

  getFilteredExpenses: (filter) => {
    const startDate = getFilterDate(filter);
    if (!startDate) return get().expenses;
    const now = new Date();
    return get().expenses.filter(e => {
      const expenseDate = startOfDay(parseISO(e.date));
      return isWithinInterval(expenseDate, { start: startOfDay(startDate), end: now });
    });
  },

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
