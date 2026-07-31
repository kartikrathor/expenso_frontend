import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';

export interface GroupSummary {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  memberCount: number;
}

export interface GroupExpenseItem {
  _id: string;
  amount: number;
  merchantLabel: string;
  category: string;
  note: string;
  date: string;
  paidBy?: { name?: string; avatarColor?: string };
}

interface GroupStore {
  groups: GroupSummary[];
  expensesByGroup: Record<string, GroupExpenseItem[]>;
  isBusy: boolean;
  error: string | null;
  loadGroups: () => Promise<void>;
  createGroup: (name: string, emoji?: string) => Promise<GroupSummary | null>;
  joinGroup: (inviteCode: string) => Promise<GroupSummary | null>;
  loadGroupExpenses: (groupId: string) => Promise<void>;
  addGroupExpense: (
    groupId: string,
    data: { amount: number; merchantLabel: string; category?: string; note?: string },
  ) => Promise<void>;
  clearError: () => void;
}

function authToken(): string | null {
  return useAuthStore.getState().token;
}

export const useGroupStore = create<GroupStore>((set, get) => ({
  groups: [],
  expensesByGroup: {},
  isBusy: false,
  error: null,

  loadGroups: async () => {
    const token = authToken();
    if (!token) {
      set({ groups: [] });
      return;
    }
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ groups: GroupSummary[] }>('/api/groups', { token });
      set({ groups: data.groups, isBusy: false });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not load groups' });
    }
  },

  createGroup: async (name, emoji) => {
    const token = authToken();
    if (!token) return null;
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ group: GroupSummary }>('/api/groups', {
        method: 'POST',
        token,
        body: { name, emoji },
      });
      set({ groups: [data.group, ...get().groups], isBusy: false });
      return data.group;
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not create group' });
      return null;
    }
  },

  joinGroup: async inviteCode => {
    const token = authToken();
    if (!token) return null;
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ group: GroupSummary }>('/api/groups/join', {
        method: 'POST',
        token,
        body: { inviteCode },
      });
      const exists = get().groups.some(g => g.id === data.group.id);
      set({
        groups: exists ? get().groups : [data.group, ...get().groups],
        isBusy: false,
      });
      return data.group;
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not join group' });
      return null;
    }
  },

  loadGroupExpenses: async groupId => {
    const token = authToken();
    if (!token) return;
    try {
      const data = await apiRequest<{ expenses: GroupExpenseItem[] }>(
        `/api/groups/${groupId}/expenses`,
        { token },
      );
      set({
        expensesByGroup: { ...get().expensesByGroup, [groupId]: data.expenses },
      });
    } catch (err: any) {
      set({ error: err?.message || 'Could not load expenses' });
    }
  },

  addGroupExpense: async (groupId, payload) => {
    const token = authToken();
    if (!token) return;
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ expense: GroupExpenseItem }>(
        `/api/groups/${groupId}/expenses`,
        { method: 'POST', token, body: payload },
      );
      const prev = get().expensesByGroup[groupId] || [];
      set({
        expensesByGroup: {
          ...get().expensesByGroup,
          [groupId]: [data.expense, ...prev],
        },
        isBusy: false,
      });
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not add expense' });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
