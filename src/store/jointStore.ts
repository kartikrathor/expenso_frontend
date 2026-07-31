import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';
import { CategoryId, Expense, MerchantId, TimeFilter } from '../types/expense';
import {
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';

export interface JointAccount {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  memberCount: number;
}

export interface JointExpenseRaw {
  _id: string;
  amount: number;
  merchantLabel: string;
  category: string;
  note: string;
  date: string;
  paidBy?: { _id?: string; name?: string; avatarColor?: string };
  createdBy?: { _id?: string; name?: string };
}

interface JointStore {
  joint: JointAccount | null;
  expenses: Expense[];
  isBusy: boolean;
  error: string | null;
  loadJoint: () => Promise<void>;
  createJointAccount: (name?: string) => Promise<JointAccount | null>;
  joinJointAccount: (inviteCode: string) => Promise<JointAccount | null>;
  loadJointExpenses: () => Promise<void>;
  addJointExpense: (data: {
    amount: number;
    merchantLabel: string;
    merchant?: MerchantId;
    category?: CategoryId;
    note?: string;
    date?: string;
    inputMethod?: 'voice' | 'manual';
  }) => Promise<void>;
  deleteJointExpense: (id: string) => Promise<void>;
  updateJointExpense: (
    id: string,
    changes: {
      amount?: number;
      merchantLabel?: string;
      merchant?: MerchantId;
      category?: CategoryId;
      note?: string;
    },
  ) => Promise<void>;
  getFiltered: (filter: TimeFilter) => Expense[];
  getTotal: (filter: TimeFilter) => number;
  getTodayTotal: () => number;
  clearError: () => void;
}

function authToken(): string | null {
  return useAuthStore.getState().token;
}

const CATEGORIES: CategoryId[] = [
  'food', 'groceries', 'shopping', 'transport', 'entertainment', 'bills', 'health', 'other',
];

function toExpense(raw: JointExpenseRaw): Expense {
  const cat = CATEGORIES.includes(raw.category as CategoryId)
    ? (raw.category as CategoryId)
    : 'other';
  const date = typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString();
  const paidBy = raw.paidBy?.name ? ` · ${raw.paidBy.name}` : '';
  return {
    id: raw._id,
    amount: raw.amount,
    merchant: 'default',
    merchantLabel: raw.merchantLabel,
    category: cat,
    note: (raw.note || '') + paidBy,
    date,
    createdAt: date,
    inputMethod: 'manual',
  };
}

function filterStart(filter: TimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case 'week': return startOfWeek(now, { weekStartsOn: 1 });
    case 'month': return startOfMonth(now);
    case 'year': return startOfYear(now);
    default: return null;
  }
}

export const useJointStore = create<JointStore>((set, get) => ({
  joint: null,
  expenses: [],
  isBusy: false,
  error: null,

  loadJoint: async () => {
    const token = authToken();
    if (!token) {
      set({ joint: null, expenses: [] });
      return;
    }
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{
        groups: Array<{
          id: string;
          name: string;
          emoji: string;
          inviteCode: string;
          memberCount: number;
        }>;
      }>('/api/groups', { token });

      // One household joint account — use the first linked group
      const g = data.groups[0] ?? null;
      const joint = g
        ? {
            id: g.id,
            name: g.name,
            emoji: g.emoji || '💑',
            inviteCode: g.inviteCode,
            memberCount: g.memberCount,
          }
        : null;
      set({ joint, isBusy: false });
      if (joint) await get().loadJointExpenses();
      else set({ expenses: [] });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not load joint account' });
    }
  },

  createJointAccount: async (name = 'Our Home') => {
    const token = authToken();
    if (!token) return null;
    if (get().joint) {
      set({ error: 'You already have a joint account' });
      return get().joint;
    }
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ group: JointAccount & { memberCount: number } }>(
        '/api/groups',
        {
          method: 'POST',
          token,
          body: { name, emoji: '💑' },
        },
      );
      const joint: JointAccount = {
        id: data.group.id,
        name: data.group.name,
        emoji: data.group.emoji || '💑',
        inviteCode: data.group.inviteCode,
        memberCount: data.group.memberCount ?? 1,
      };
      set({ joint, expenses: [], isBusy: false });
      return joint;
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not create joint account' });
      return null;
    }
  },

  joinJointAccount: async inviteCode => {
    const token = authToken();
    if (!token) return null;
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ group: JointAccount & { memberCount: number } }>(
        '/api/groups/join',
        {
          method: 'POST',
          token,
          body: { inviteCode },
        },
      );
      const joint: JointAccount = {
        id: data.group.id,
        name: data.group.name,
        emoji: data.group.emoji || '💑',
        inviteCode: data.group.inviteCode,
        memberCount: data.group.memberCount ?? 2,
      };
      set({ joint, isBusy: false });
      await get().loadJointExpenses();
      return joint;
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not join joint account' });
      return null;
    }
  },

  loadJointExpenses: async () => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) return;
    try {
      const data = await apiRequest<{ expenses: JointExpenseRaw[] }>(
        `/api/groups/${joint.id}/expenses`,
        { token },
      );
      set({ expenses: data.expenses.map(toExpense) });
    } catch (err: any) {
      set({ error: err?.message || 'Could not load shared expenses' });
    }
  },

  addJointExpense: async payload => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) throw new Error('No joint account');
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ expense: JointExpenseRaw }>(
        `/api/groups/${joint.id}/expenses`,
        {
          method: 'POST',
          token,
          body: {
            amount: payload.amount,
            merchantLabel: payload.merchantLabel,
            category: payload.category || 'other',
            note: payload.note || '',
            date: payload.date || new Date().toISOString(),
          },
        },
      );
      const expense = toExpense(data.expense);
      set({ expenses: [expense, ...get().expenses], isBusy: false });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not add expense' });
      throw err;
    }
  },

  deleteJointExpense: async id => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) return;
    await apiRequest(`/api/groups/${joint.id}/expenses/${id}`, {
      method: 'DELETE',
      token,
    });
    set({ expenses: get().expenses.filter(e => e.id !== id) });
  },

  updateJointExpense: async (id, changes) => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) throw new Error('No joint account');
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ expense: JointExpenseRaw }>(
        `/api/groups/${joint.id}/expenses/${id}`,
        {
          method: 'PATCH',
          token,
          body: {
            amount: changes.amount,
            merchantLabel: changes.merchantLabel,
            category: changes.category,
            note: changes.note,
          },
        },
      );
      const updated = toExpense(data.expense);
      if (changes.merchant) updated.merchant = changes.merchant;
      set({
        expenses: get().expenses.map(e => (e.id === id ? { ...e, ...updated, merchant: changes.merchant ?? e.merchant } : e)),
        isBusy: false,
      });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not update expense' });
      throw err;
    }
  },

  getFiltered: filter => {
    const start = filterStart(filter);
    const list = get().expenses;
    if (!start) return list;
    const now = new Date();
    return list.filter(e => {
      const d = startOfDay(parseISO(e.date));
      return isWithinInterval(d, { start: startOfDay(start), end: now });
    });
  },

  getTotal: filter => get().getFiltered(filter).reduce((s, e) => s + e.amount, 0),

  getTodayTotal: () =>
    get().expenses.filter(e => isToday(parseISO(e.date))).reduce((s, e) => s + e.amount, 0),

  clearError: () => set({ error: null }),
}));
