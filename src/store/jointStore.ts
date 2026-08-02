import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';
import { useExpenseStore } from './expenseStore';
import { CategoryId, Expense, MerchantId, TimeFilter } from '../types/expense';
import { generateId } from '../utils/generateId';
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
  monthlyBudget: number;
}

export interface JointExpenseRaw {
  _id: string;
  amount: number;
  merchantLabel: string;
  category: string;
  note: string;
  date: string;
  paidBy?: { _id?: string; name?: string; avatarColor?: string } | string;
  createdBy?: { _id?: string; name?: string } | string;
}

type GroupApi = {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  memberCount: number;
  monthlyBudget?: number;
};

type CreatePayload = {
  amount: number;
  merchantLabel: string;
  merchant?: MerchantId;
  category?: CategoryId;
  note?: string;
  date?: string;
  inputMethod?: 'voice' | 'manual';
};

type OutboxItem =
  | {
      id: string;
      type: 'create';
      clientId: string;
      payload: CreatePayload;
      attempts: number;
    }
  | {
      id: string;
      type: 'update';
      expenseId: string;
      changes: {
        amount?: number;
        merchantLabel?: string;
        merchant?: MerchantId;
        category?: CategoryId;
        note?: string;
      };
      attempts: number;
    }
  | {
      id: string;
      type: 'delete';
      expenseId: string;
      attempts: number;
    };

interface JointStore {
  joint: JointAccount | null;
  /** All joint groups (multi-account); primary is `joint` */
  groups: JointAccount[];
  expenses: Expense[];
  outbox: OutboxItem[];
  isBusy: boolean;
  isSyncing: boolean;
  error: string | null;
  pendingCount: number;
  loadJoint: () => Promise<void>;
  createJointAccount: (name?: string) => Promise<JointAccount | null>;
  joinJointAccount: (inviteCode: string) => Promise<JointAccount | null>;
  loadJointExpenses: () => Promise<void>;
  setMonthlyBudget: (amount: number) => Promise<void>;
  syncBudgetWithLocal: () => Promise<void>;
  addJointExpense: (data: CreatePayload) => Promise<void>;
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
  flushOutbox: () => Promise<void>;
  getFiltered: (filter: TimeFilter) => Expense[];
  getTotal: (filter: TimeFilter) => number;
  getTodayTotal: () => number;
  clearError: () => void;
}

function authToken(): string | null {
  return useAuthStore.getState().token;
}

function localBudget(): number {
  return useExpenseStore.getState().monthlyBudget || 0;
}

function toJoint(g: GroupApi): JointAccount {
  return {
    id: g.id,
    name: g.name,
    emoji: g.emoji || '💑',
    inviteCode: g.inviteCode,
    memberCount: g.memberCount ?? 1,
    monthlyBudget: g.monthlyBudget ?? 0,
  };
}

const CATEGORIES: CategoryId[] = [
  'food', 'groceries', 'shopping', 'transport', 'entertainment', 'bills', 'health', 'other',
];

function cacheKey(groupId: string) {
  return `@expenso_joint_cache_${groupId}`;
}

function outboxKey(groupId: string) {
  return `@expenso_joint_outbox_${groupId}`;
}

function personId(
  p?: { _id?: string; name?: string } | string | null,
): string | undefined {
  if (!p) return undefined;
  if (typeof p === 'string') return p;
  return p._id ? String(p._id) : undefined;
}

function personName(
  p?: { _id?: string; name?: string } | string | null,
): string | undefined {
  if (!p || typeof p === 'string') return undefined;
  return p.name?.trim() || undefined;
}

function toExpense(raw: JointExpenseRaw, group?: JointAccount): Expense {
  const cat = CATEGORIES.includes(raw.category as CategoryId)
    ? (raw.category as CategoryId)
    : 'other';
  const date = typeof raw.date === 'string' ? raw.date : new Date(raw.date).toISOString();
  const paidName = personName(raw.paidBy);
  const createdName = personName(raw.createdBy);
  return {
    id: raw._id,
    amount: raw.amount,
    merchant: 'default',
    merchantLabel: raw.merchantLabel,
    category: cat,
    note: raw.note || '',
    date,
    createdAt: date,
    inputMethod: 'manual',
    createdById: personId(raw.createdBy),
    createdByName: createdName,
    paidById: personId(raw.paidBy),
    paidByName: paidName,
    groupId: group?.id,
    groupName: group?.name,
  };
}

function pendingExpense(clientId: string, payload: CreatePayload, group: JointAccount): Expense {
  const date = payload.date || new Date().toISOString();
  const user = useAuthStore.getState().user;
  return {
    id: clientId,
    amount: payload.amount,
    merchant: payload.merchant || 'default',
    merchantLabel: payload.merchantLabel,
    category: payload.category || 'other',
    note: payload.note || '',
    date,
    createdAt: date,
    inputMethod: payload.inputMethod || 'manual',
    createdById: user?.id,
    createdByName: user?.name,
    paidById: user?.id,
    paidByName: user?.name,
    groupId: group.id,
    groupName: group.name,
  };
}

function sortNewest(list: Expense[]): Expense[] {
  return [...list].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}

/** Merge server list with in-memory pending creates (never drop local pending). */
function mergeExpenses(server: Expense[], current: Expense[], outbox: OutboxItem[]): Expense[] {
  const byId = new Map<string, Expense>();
  server.forEach(e => byId.set(e.id, e));

  // Keep pending_* items still in outbox as create
  const pendingCreateIds = new Set(
    outbox.filter(i => i.type === 'create').map(i => i.clientId),
  );
  current.forEach(e => {
    if (e.id.startsWith('pending_') && pendingCreateIds.has(e.id)) {
      byId.set(e.id, e);
    }
  });

  // Apply pending updates locally on top of server
  outbox.forEach(item => {
    if (item.type === 'update') {
      const existing = byId.get(item.expenseId);
      if (existing) byId.set(item.expenseId, { ...existing, ...item.changes });
    }
    if (item.type === 'delete') {
      byId.delete(item.expenseId);
    }
  });

  return sortNewest(Array.from(byId.values()));
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

let fetchSeq = 0;
let flushing = false;

async function persistCache(groupId: string, expenses: Expense[]) {
  try {
    await AsyncStorage.setItem(cacheKey(groupId), JSON.stringify(expenses));
  } catch {
    // ignore
  }
}

async function persistOutbox(groupId: string, outbox: OutboxItem[]) {
  try {
    await AsyncStorage.setItem(outboxKey(groupId), JSON.stringify(outbox));
  } catch {
    // ignore
  }
}

async function readCache(groupId: string): Promise<Expense[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(groupId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function readOutbox(groupId: string): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(outboxKey(groupId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const useJointStore = create<JointStore>((set, get) => ({
  joint: null,
  groups: [],
  expenses: [],
  outbox: [],
  isBusy: false,
  isSyncing: false,
  error: null,
  pendingCount: 0,

  loadJoint: async () => {
    const token = authToken();
    if (!token) {
      set({ joint: null, groups: [], expenses: [], outbox: [], pendingCount: 0 });
      return;
    }
    set({ isBusy: true, error: null });
    try {
      const data = await apiRequest<{ groups: GroupApi[] }>('/api/groups', {
        token,
        timeoutMs: 25000,
      });
      const groups = (data.groups || []).map(toJoint);
      const joint = groups[0] ?? null;

      if (!joint) {
        set({ joint: null, groups: [], expenses: [], outbox: [], pendingCount: 0, isBusy: false });
        return;
      }

      // Hydrate from disk first so UI never flashes empty / old wipe
      const [cached, outbox] = await Promise.all([
        readCache(joint.id),
        readOutbox(joint.id),
      ]);
      if (cached.length || outbox.length) {
        const merged = mergeExpenses(cached, cached, outbox);
        set({
          joint,
          groups,
          expenses: merged,
          outbox,
          pendingCount: outbox.length,
          isBusy: false,
        });
      } else {
        set({ joint, groups, isBusy: false, outbox, pendingCount: outbox.length });
      }

      await get().syncBudgetWithLocal();
      await get().flushOutbox();
      await get().loadJointExpenses();
    } catch (err: any) {
      // Never clear expenses on network failure
      set({ isBusy: false, error: err?.message || 'Could not load joint account' });
    }
  },

  syncBudgetWithLocal: async () => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) return;

    const mine = localBudget();
    const shared = joint.monthlyBudget || 0;
    const max = Math.max(mine, shared);
    if (max <= 0) return;

    if (max > shared) {
      try {
        const data = await apiRequest<{ group: GroupApi }>(
          `/api/groups/${joint.id}/budget`,
          {
            method: 'PATCH',
            token,
            timeoutMs: 25000,
            body: { monthlyBudget: max, mergeMax: true },
          },
        );
        const updated = toJoint({
          ...data.group,
          memberCount: data.group.memberCount ?? joint.memberCount,
        });
        set({ joint: updated });
        await useExpenseStore.getState().setMonthlyBudget(updated.monthlyBudget);
      } catch {
        // keep local
      }
    } else if (shared > mine) {
      await useExpenseStore.getState().setMonthlyBudget(shared);
      set({ joint: { ...joint, monthlyBudget: shared } });
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
      const data = await apiRequest<{ group: GroupApi }>('/api/groups', {
        method: 'POST',
        token,
        timeoutMs: 25000,
        body: { name, emoji: '💑', monthlyBudget: localBudget() },
      });
      const joint = toJoint(data.group);
      set({ joint, groups: [joint], expenses: [], outbox: [], pendingCount: 0, isBusy: false });
      if (joint.monthlyBudget > 0) {
        await useExpenseStore.getState().setMonthlyBudget(joint.monthlyBudget);
      }
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
      const data = await apiRequest<{ group: GroupApi }>('/api/groups/join', {
        method: 'POST',
        token,
        timeoutMs: 25000,
        body: { inviteCode, monthlyBudget: localBudget() },
      });
      const joint = toJoint(data.group);
      const [cached, outbox] = await Promise.all([
        readCache(joint.id),
        readOutbox(joint.id),
      ]);
      set({
        joint,
        groups: [joint],
        expenses: mergeExpenses(cached, cached, outbox),
        outbox,
        pendingCount: outbox.length,
        isBusy: false,
      });
      if (joint.monthlyBudget > 0) {
        await useExpenseStore.getState().setMonthlyBudget(joint.monthlyBudget);
      }
      await get().flushOutbox();
      await get().loadJointExpenses();
      return joint;
    } catch (err: any) {
      set({ isBusy: false, error: err?.message || 'Could not join joint account' });
      return null;
    }
  },

  setMonthlyBudget: async amount => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) {
      await useExpenseStore.getState().setMonthlyBudget(amount);
      return;
    }
    const data = await apiRequest<{ group: GroupApi }>(
      `/api/groups/${joint.id}/budget`,
      {
        method: 'PATCH',
        token,
        timeoutMs: 25000,
        body: { monthlyBudget: amount, mergeMax: false },
      },
    );
    const updated = toJoint({
      ...data.group,
      memberCount: data.group.memberCount ?? joint.memberCount,
    });
    set({ joint: updated });
    await useExpenseStore.getState().setMonthlyBudget(updated.monthlyBudget);
  },

  loadJointExpenses: async () => {
    const token = authToken();
    const joint = get().joint;
    const groups = get().groups.length ? get().groups : joint ? [joint] : [];
    if (!token || !joint || groups.length === 0) return;

    const seq = ++fetchSeq;
    try {
      const results = await Promise.all(
        groups.map(async g => {
          try {
            const data = await apiRequest<{ expenses: JointExpenseRaw[] }>(
              `/api/groups/${g.id}/expenses`,
              { token, timeoutMs: 25000 },
            );
            return (data.expenses || []).map(e => toExpense(e, g));
          } catch {
            return [] as Expense[];
          }
        }),
      );

      // Ignore stale responses
      if (seq !== fetchSeq) return;

      const server = sortNewest(results.flat());
      const { expenses: current, outbox } = get();
      const primaryServer = server.filter(e => e.groupId === joint.id);
      const otherServer = server.filter(e => e.groupId && e.groupId !== joint.id);
      const primaryCurrent = current.filter(e => !e.groupId || e.groupId === joint.id);
      const primaryMerged = mergeExpenses(primaryServer, primaryCurrent, outbox);
      const merged = sortNewest([...primaryMerged, ...otherServer]);
      set({ expenses: merged, error: null });
      await persistCache(joint.id, primaryMerged);
    } catch (err: any) {
      if (seq !== fetchSeq) return;
      if (get().expenses.length === 0) {
        const cached = await readCache(joint.id);
        if (cached.length) set({ expenses: cached });
      }
      set({ error: err?.message || 'Could not load shared expenses' });
    }
  },

  addJointExpense: async payload => {
    const joint = get().joint;
    if (!joint) throw new Error('No joint account');

    const clientId = `pending_${generateId()}`;
    const local = pendingExpense(clientId, payload, joint);
    const item: OutboxItem = {
      id: generateId(),
      type: 'create',
      clientId,
      payload: { ...payload, date: local.date },
      attempts: 0,
    };

    const expenses = sortNewest([local, ...get().expenses]);
    const outbox = [...get().outbox, item];
    set({ expenses, outbox, pendingCount: outbox.length, error: null });
    await persistCache(joint.id, expenses);
    await persistOutbox(joint.id, outbox);
    await get().flushOutbox();
  },

  deleteJointExpense: async id => {
    const joint = get().joint;
    if (!joint) return;

    // If still pending create, just drop it from outbox + UI
    const createItem = get().outbox.find(
      i => i.type === 'create' && i.clientId === id,
    );
    if (createItem) {
      const outbox = get().outbox.filter(i => i.id !== createItem.id);
      const expenses = get().expenses.filter(e => e.id !== id);
      set({ outbox, expenses, pendingCount: outbox.length });
      await persistCache(joint.id, expenses);
      await persistOutbox(joint.id, outbox);
      return;
    }

    const expenses = get().expenses.filter(e => e.id !== id);
    const item: OutboxItem = {
      id: generateId(),
      type: 'delete',
      expenseId: id,
      attempts: 0,
    };
    const outbox = [...get().outbox, item];
    set({ expenses, outbox, pendingCount: outbox.length });
    await persistCache(joint.id, expenses);
    await persistOutbox(joint.id, outbox);
    await get().flushOutbox();
  },

  updateJointExpense: async (id, changes) => {
    const joint = get().joint;
    if (!joint) throw new Error('No joint account');

    // Update pending create payload in place
    const createItem = get().outbox.find(
      (i): i is Extract<OutboxItem, { type: 'create' }> =>
        i.type === 'create' && i.clientId === id,
    );
    if (createItem) {
      createItem.payload = { ...createItem.payload, ...changes };
      const expenses = get().expenses.map(e =>
        e.id === id ? { ...e, ...changes } : e,
      );
      const outbox = get().outbox.map(i =>
        i.id === createItem.id ? { ...createItem } : i,
      );
      set({ expenses, outbox });
      await persistCache(joint.id, expenses);
      await persistOutbox(joint.id, outbox);
      await get().flushOutbox();
      return;
    }

    const expenses = get().expenses.map(e =>
      e.id === id ? { ...e, ...changes } : e,
    );
    const item: OutboxItem = {
      id: generateId(),
      type: 'update',
      expenseId: id,
      changes,
      attempts: 0,
    };
    const outbox = [...get().outbox, item];
    set({ expenses, outbox, pendingCount: outbox.length });
    await persistCache(joint.id, expenses);
    await persistOutbox(joint.id, outbox);
    await get().flushOutbox();
  },

  flushOutbox: async () => {
    if (flushing) return;
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) return;

    flushing = true;
    set({ isSyncing: true });

    try {
      while (get().outbox.length > 0) {
        const item = get().outbox[0];
        if (!item) break;

        try {
          if (item.type === 'create') {
            const data = await apiRequest<{ expense: JointExpenseRaw }>(
              `/api/groups/${joint.id}/expenses`,
              {
                method: 'POST',
                token,
                timeoutMs: 30000,
                body: {
                  amount: item.payload.amount,
                  merchantLabel: item.payload.merchantLabel,
                  category: item.payload.category || 'other',
                  note: item.payload.note || '',
                  date: item.payload.date || new Date().toISOString(),
                },
              },
            );
            const saved = toExpense(data.expense, joint);
            if (item.payload.merchant) saved.merchant = item.payload.merchant;

            // Bump fetchSeq so any in-flight list fetch can't overwrite this write
            fetchSeq += 1;

            const outbox = get().outbox.filter(i => i.id !== item.id);
            const expenses = sortNewest([
              saved,
              ...get().expenses.filter(e => e.id !== item.clientId && e.id !== saved.id),
            ]);
            set({ outbox, expenses, pendingCount: outbox.length, error: null });
            await persistCache(joint.id, expenses);
            await persistOutbox(joint.id, outbox);
          } else if (item.type === 'update') {
            await apiRequest(`/api/groups/${joint.id}/expenses/${item.expenseId}`, {
              method: 'PATCH',
              token,
              timeoutMs: 30000,
              body: {
                amount: item.changes.amount,
                merchantLabel: item.changes.merchantLabel,
                category: item.changes.category,
                note: item.changes.note,
              },
            });
            fetchSeq += 1;
            const outbox = get().outbox.filter(i => i.id !== item.id);
            set({ outbox, pendingCount: outbox.length, error: null });
            await persistOutbox(joint.id, outbox);
            await persistCache(joint.id, get().expenses);
          } else if (item.type === 'delete') {
            await apiRequest(`/api/groups/${joint.id}/expenses/${item.expenseId}`, {
              method: 'DELETE',
              token,
              timeoutMs: 30000,
            });
            fetchSeq += 1;
            const outbox = get().outbox.filter(i => i.id !== item.id);
            set({ outbox, pendingCount: outbox.length, error: null });
            await persistOutbox(joint.id, outbox);
            await persistCache(joint.id, get().expenses);
          }
        } catch (err: any) {
          // Leave item in queue, bump attempts, stop for now (retry on next refresh)
          const outbox = get().outbox.map(i =>
            i.id === item.id ? { ...i, attempts: i.attempts + 1 } : i,
          );
          set({
            outbox,
            pendingCount: outbox.length,
            error: err?.message || 'Sync pending — will retry',
          });
          await persistOutbox(joint.id, outbox);
          break;
        }
      }
    } finally {
      flushing = false;
      set({ isSyncing: false });
    }
  },

  getFiltered: filter => {
    const start = filterStart(filter);
    const list = get().expenses;
    if (!start) return list;
    const now = new Date();
    return list.filter(e => {
      try {
        const d = startOfDay(parseISO(e.date));
        return isWithinInterval(d, { start: startOfDay(start), end: now });
      } catch {
        return true;
      }
    });
  },

  getTotal: filter => get().getFiltered(filter).reduce((s, e) => s + e.amount, 0),

  getTodayTotal: () =>
    get().expenses
      .filter(e => {
        try {
          return isToday(parseISO(e.date));
        } catch {
          return false;
        }
      })
      .reduce((s, e) => s + e.amount, 0),

  clearError: () => set({ error: null }),
}));
