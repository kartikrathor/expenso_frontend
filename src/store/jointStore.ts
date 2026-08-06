import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';
import { useExpenseStore } from './expenseStore';
import { CategoryId, Expense, MerchantId, TimeFilter } from '../types/expense';
import { generateId } from '../utils/generateId';
import { userFacingError } from '../utils/userFacingError';
import { filterExpenses } from '../utils/expenseAnalytics';
import {
  BudgetMonthInput,
  monthKey,
  MonthlyBudgetEntry,
  normalizeMonthlyBudgets,
  resolveMonthlyBudget,
  upsertMonthlyBudget,
} from '../utils/monthlyBudget';
import {
  isToday,
  parseISO,
} from 'date-fns';

export interface JointAccount {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  memberCount: number;
  monthlyBudget: number;
  monthlyBudgets: MonthlyBudgetEntry[];
  repeatMonthlyBudget: boolean;
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
  month?: string;
  monthlyBudgets?: MonthlyBudgetEntry[];
  repeatMonthlyBudget?: boolean;
};

type CreatePayload = {
  /** Stable across retries/migrations so the backend can return the existing row. */
  clientId?: string;
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
      type: 'cancelCreate';
      clientId: string;
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
        date?: string;
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
  leaveJointAccount: () => Promise<boolean>;
  loadJointExpenses: () => Promise<void>;
  setMonthlyBudget: (
    amount: number,
    month?: BudgetMonthInput,
    repeatMonthlyBudget?: boolean,
  ) => Promise<void>;
  syncBudgetWithLocal: () => Promise<void>;
  addJointExpense: (data: CreatePayload) => Promise<Expense>;
  deleteJointExpense: (id: string) => Promise<void>;
  updateJointExpense: (
    id: string,
    changes: {
      amount?: number;
      merchantLabel?: string;
      merchant?: MerchantId;
      category?: CategoryId;
      note?: string;
      date?: string;
    },
  ) => Promise<void>;
  flushOutbox: () => Promise<void>;
  getFiltered: (filter: TimeFilter) => Expense[];
  getTotal: (filter: TimeFilter) => number;
  getTodayTotal: () => number;
  clearError: () => void;
  /** Clear in-memory joint state on logout / account switch */
  resetSession: () => Promise<void>;
}

function authToken(): string | null {
  return useAuthStore.getState().token;
}

function localBudget(): number {
  return useExpenseStore.getState().monthlyBudget || 0;
}

function localBudgetEntries(): MonthlyBudgetEntry[] {
  return useExpenseStore.getState().monthlyBudgets;
}

function toJoint(g: GroupApi): JointAccount {
  return {
    id: g.id,
    name: g.name,
    emoji: g.emoji || '💑',
    inviteCode: g.inviteCode,
    memberCount: g.memberCount ?? 1,
    monthlyBudget: g.monthlyBudget ?? 0,
    monthlyBudgets: normalizeMonthlyBudgets(g.monthlyBudgets),
    repeatMonthlyBudget: g.repeatMonthlyBudget === true,
  };
}

function mergeBudgetResponse(
  current: JointAccount,
  response: GroupApi,
  requestedMonth: BudgetMonthInput = new Date(),
): JointAccount {
  const monthlyBudgets =
    response.monthlyBudgets === undefined
      ? current.monthlyBudgets
      : normalizeMonthlyBudgets(response.monthlyBudgets);
  const repeatMonthlyBudget =
    response.repeatMonthlyBudget ?? current.repeatMonthlyBudget;
  const targetMonth = response.month || monthKey(requestedMonth);
  const responseAmount = Number(response.monthlyBudget);
  const monthlyBudget = resolveMonthlyBudget(
    monthlyBudgets,
    new Date(),
    repeatMonthlyBudget,
    monthKey(targetMonth) === monthKey(new Date()) && Number.isFinite(responseAmount)
      ? responseAmount
      : current.monthlyBudget,
  );
  return {
    ...toJoint({
      ...current,
      ...response,
      monthlyBudgets,
      repeatMonthlyBudget,
    }),
    monthlyBudget,
  };
}

function replaceGroup(groups: JointAccount[], updated: JointAccount): JointAccount[] {
  return groups.map(group => (group.id === updated.id ? updated : group));
}

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
  const cat = (raw.category?.trim() || 'other') as CategoryId;
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

function dedupeExactExpenses(list: Expense[]): Expense[] {
  const seen = new Set<string>();
  return list.filter(expense => {
    const key = JSON.stringify([
      expense.groupId || '',
      Number(expense.amount),
      expense.merchantLabel.trim().toLowerCase(),
      expense.category.trim().toLowerCase(),
      expense.note.trim(),
      expense.date,
      expense.paidById || '',
      expense.createdById || '',
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Merge server list with in-memory pending creates (never drop local pending). */
function mergeExpenses(server: Expense[], current: Expense[], outbox: OutboxItem[]): Expense[] {
  const byId = new Map<string, Expense>();
  dedupeExactExpenses(server).forEach(e => byId.set(e.id, e));

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

let fetchSeq = 0;
let flushing = false;
const duplicateCleanupDone = new Set<string>();
/** Bumped on logout / account switch so in-flight flush/load never wipe disk or restore stale UI. */
let sessionEpoch = 0;

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
    const epoch = sessionEpoch;
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
      if (sessionEpoch !== epoch || !authToken()) return;

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
      if (sessionEpoch !== epoch || !authToken()) return;

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
      if (sessionEpoch !== epoch) return;
      await get().flushOutbox();
      if (sessionEpoch !== epoch) return;
      await get().loadJointExpenses();
    } catch (err: any) {
      if (sessionEpoch !== epoch) return;
      // Never clear expenses on network failure
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t load your joint account. Please try again.'),
      });
    }
  },

  syncBudgetWithLocal: async () => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) return;

    // Modern month histories stay scoped to their owner/group. This legacy
    // bridge only migrates a current scalar when one side has no history yet.
    if (joint.monthlyBudgets.length > 0) return;

    const personal = useExpenseStore.getState();
    const mine = personal.monthlyBudget || 0;
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
            body: {
              monthlyBudget: max,
              month: monthKey(new Date()),
              repeatMonthlyBudget: personal.repeatMonthlyBudget,
              mergeMax: true,
            },
          },
        );
        const updated = mergeBudgetResponse(joint, data.group);
        set(state => ({
          joint: updated,
          groups: replaceGroup(state.groups, updated),
        }));
      } catch {
        // keep local
      }
    } else if (shared > mine && localBudgetEntries().length === 0) {
      await useExpenseStore
        .getState()
        .setMonthlyBudget(shared, new Date(), joint.repeatMonthlyBudget);
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
      return joint;
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t create joint account. Please try again.'),
      });
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
      await get().syncBudgetWithLocal();
      await get().flushOutbox();
      await get().loadJointExpenses();
      return joint;
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t join. Check the invite code and try again.'),
      });
      return null;
    }
  },

  leaveJointAccount: async () => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) return false;
    set({ isBusy: true, error: null });
    try {
      await apiRequest(`/api/groups/${joint.id}/leave`, {
        method: 'POST',
        token,
        timeoutMs: 25000,
      });
      try {
        await AsyncStorage.removeMany([
          cacheKey(joint.id),
          outboxKey(joint.id),
          `@expenso_local_synced_${joint.id}`,
          `@expenso_local_synced_ids_${joint.id}`,
        ]);
      } catch {
        // ignore
      }
      set({
        joint: null,
        groups: [],
        expenses: [],
        outbox: [],
        pendingCount: 0,
        isBusy: false,
        error: null,
      });
      return true;
    } catch (err: any) {
      set({
        isBusy: false,
        error: userFacingError(err, 'Couldn’t leave the joint account. Please try again.'),
      });
      return false;
    }
  },

  setMonthlyBudget: async (amount, month = new Date(), repeatMonthlyBudget) => {
    const token = authToken();
    const joint = get().joint;
    if (!token || !joint) {
      await useExpenseStore
        .getState()
        .setMonthlyBudget(amount, month, repeatMonthlyBudget);
      return;
    }
    const targetMonth = monthKey(month);
    const monthlyBudgets = upsertMonthlyBudget(joint.monthlyBudgets, targetMonth, amount);
    const repeat = repeatMonthlyBudget ?? joint.repeatMonthlyBudget;
    const optimistic: JointAccount = {
      ...joint,
      monthlyBudgets,
      repeatMonthlyBudget: repeat,
      monthlyBudget: resolveMonthlyBudget(
        monthlyBudgets,
        new Date(),
        repeat,
        joint.monthlyBudget,
      ),
    };
    set(state => ({
      joint: optimistic,
      groups: replaceGroup(state.groups, optimistic),
    }));
    const data = await apiRequest<{ group: GroupApi }>(
      `/api/groups/${joint.id}/budget`,
      {
        method: 'PATCH',
        token,
        timeoutMs: 25000,
        body: {
          monthlyBudget: amount,
          month: targetMonth,
          ...(repeatMonthlyBudget === undefined
            ? {}
            : { repeatMonthlyBudget }),
          mergeMax: false,
        },
      },
    );
    const updated = mergeBudgetResponse(optimistic, data.group, targetMonth);
    set(state => ({
      joint: updated,
      groups: replaceGroup(state.groups, updated),
    }));
  },

  loadJointExpenses: async () => {
    const token = authToken();
    const joint = get().joint;
    const groups = get().groups.length ? get().groups : joint ? [joint] : [];
    if (!token || !joint || groups.length === 0) return;

    const seq = ++fetchSeq;
    const epoch = sessionEpoch;
    const groupId = joint.id;
    try {
      const results = await Promise.all(
        groups.map(async g => {
          try {
            if (!duplicateCleanupDone.has(g.id)) {
              try {
                await apiRequest(`/api/groups/${g.id}/expenses/dedupe`, {
                  method: 'POST',
                  token,
                  timeoutMs: 25000,
                });
                duplicateCleanupDone.add(g.id);
              } catch {
                // Older/offline backend: exact duplicates are still hidden client-side.
              }
            }
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

      // Ignore stale responses / logout
      if (seq !== fetchSeq || sessionEpoch !== epoch) return;
      if (get().joint?.id !== groupId) return;

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
      if (seq !== fetchSeq || sessionEpoch !== epoch) return;
      if (get().expenses.length === 0) {
        const cached = await readCache(joint.id);
        if (cached.length && sessionEpoch === epoch) set({ expenses: cached });
      }
      set({
        error: userFacingError(err, 'Couldn’t load shared expenses. Please try again.'),
      });
    }
  },

  addJointExpense: async payload => {
    const joint = get().joint;
    if (!joint) throw new Error('Join or create a joint account first.');

    const clientId = payload.clientId || `pending_${generateId()}`;
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
    return local;
  },

  deleteJointExpense: async id => {
    const joint = get().joint;
    if (!joint) return;

    // A timed-out POST may already exist on the server. Replace the create
    // with a queued cancellation keyed by the same idempotency clientId.
    const createItem = get().outbox.find(
      (i): i is Extract<OutboxItem, { type: 'create' }> =>
        i.type === 'create' && i.clientId === id,
    );
    if (createItem) {
      const cancelItem: OutboxItem = {
        id: generateId(),
        type: 'cancelCreate',
        clientId: createItem.clientId,
        attempts: 0,
      };
      const outbox = [
        ...get().outbox.filter(i => i.id !== createItem.id),
        cancelItem,
      ];
      const expenses = get().expenses.filter(e => e.id !== id);
      set({ outbox, expenses, pendingCount: outbox.length });
      await persistCache(joint.id, expenses);
      await persistOutbox(joint.id, outbox);
      await get().flushOutbox();
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
    if (!joint) throw new Error('Join or create a joint account first.');

    // Update pending create payload in place
    const createItem = get().outbox.find(
      (i): i is Extract<OutboxItem, { type: 'create' }> =>
        i.type === 'create' && i.clientId === id,
    );
    if (createItem) {
      createItem.payload = { ...createItem.payload, ...changes };
      const expenses = sortNewest(
        get().expenses.map(e => (e.id === id ? { ...e, ...changes } : e)),
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

    const expenses = sortNewest(
      get().expenses.map(e => (e.id === id ? { ...e, ...changes } : e)),
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

    const epoch = sessionEpoch;
    const groupId = joint.id;
    flushing = true;
    set({ isSyncing: true });

    try {
      while (get().outbox.length > 0) {
        // Logout / account switch mid-flush: stop without writing empty outbox to disk
        if (sessionEpoch !== epoch || get().joint?.id !== groupId || !authToken()) {
          break;
        }

        const item = get().outbox[0];
        if (!item) break;

        try {
          if (item.type === 'create') {
            const data = await apiRequest<{ expense: JointExpenseRaw }>(
              `/api/groups/${groupId}/expenses`,
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
                  clientId: item.clientId,
                },
              },
            );
            const jointNow = get().joint;
            const saved = toExpense(
              data.expense,
              jointNow?.id === groupId
                ? jointNow
                : {
                    id: groupId,
                    name: '',
                    emoji: '',
                    inviteCode: '',
                    memberCount: 0,
                    monthlyBudget: 0,
                    monthlyBudgets: [],
                    repeatMonthlyBudget: false,
                  },
            );
            if (item.payload.merchant) saved.merchant = item.payload.merchant;

            // Always drop this outbox row on disk (even if session ended) to avoid re-POST duplicates
            const diskOutbox = (await readOutbox(groupId)).filter(i => i.id !== item.id);
            await persistOutbox(groupId, diskOutbox);
            const diskCache = await readCache(groupId);
            const nextCache = sortNewest([
              saved,
              ...diskCache.filter(e => e.id !== item.clientId && e.id !== saved.id),
            ]);
            await persistCache(groupId, nextCache);

            if (sessionEpoch !== epoch || get().joint?.id !== groupId) break;

            // Bump fetchSeq so any in-flight list fetch can't overwrite this write
            fetchSeq += 1;

            const outbox = get().outbox.filter(i => i.id !== item.id);
            const expenses = sortNewest([
              saved,
              ...get().expenses.filter(e => e.id !== item.clientId && e.id !== saved.id),
            ]);
            set({ outbox, expenses, pendingCount: outbox.length, error: null });
          } else if (item.type === 'cancelCreate') {
            await apiRequest(
              `/api/groups/${groupId}/expenses/by-client/${encodeURIComponent(item.clientId)}`,
              {
                method: 'DELETE',
                token,
                timeoutMs: 30000,
              },
            );
            if (sessionEpoch !== epoch || get().joint?.id !== groupId) break;
            fetchSeq += 1;
            const outbox = get().outbox.filter(i => i.id !== item.id);
            set({ outbox, pendingCount: outbox.length, error: null });
            await persistOutbox(groupId, outbox);
            await persistCache(groupId, get().expenses);
          } else if (item.type === 'update') {
            await apiRequest(`/api/groups/${groupId}/expenses/${item.expenseId}`, {
              method: 'PATCH',
              token,
              timeoutMs: 30000,
              body: {
                amount: item.changes.amount,
                merchantLabel: item.changes.merchantLabel,
                merchant: item.changes.merchant,
                category: item.changes.category,
                note: item.changes.note,
                date: item.changes.date,
              },
            });
            if (sessionEpoch !== epoch || get().joint?.id !== groupId) break;
            fetchSeq += 1;
            const outbox = get().outbox.filter(i => i.id !== item.id);
            set({ outbox, pendingCount: outbox.length, error: null });
            await persistOutbox(groupId, outbox);
            await persistCache(groupId, get().expenses);
          } else if (item.type === 'delete') {
            await apiRequest(`/api/groups/${groupId}/expenses/${item.expenseId}`, {
              method: 'DELETE',
              token,
              timeoutMs: 30000,
            });
            if (sessionEpoch !== epoch || get().joint?.id !== groupId) break;
            fetchSeq += 1;
            const outbox = get().outbox.filter(i => i.id !== item.id);
            set({ outbox, pendingCount: outbox.length, error: null });
            await persistOutbox(groupId, outbox);
            await persistCache(groupId, get().expenses);
          }
        } catch (err: any) {
          if (sessionEpoch !== epoch || get().joint?.id !== groupId) break;
          // Leave item in queue, bump attempts, stop for now (retry on next refresh)
          const outbox = get().outbox.map(i =>
            i.id === item.id ? { ...i, attempts: i.attempts + 1 } : i,
          );
          set({
            outbox,
            pendingCount: outbox.length,
            error: userFacingError(
              err,
              'Some expenses are still syncing. We’ll retry automatically.',
            ),
          });
          await persistOutbox(groupId, outbox);
          break;
        }
      }
    } finally {
      flushing = false;
      if (sessionEpoch === epoch) {
        set({ isSyncing: false });
      }
    }
  },

  getFiltered: filter => filterExpenses(get().expenses, filter),

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

  resetSession: async () => {
    sessionEpoch += 1;
    fetchSeq += 1;
    flushing = false;
    set({
      joint: null,
      groups: [],
      expenses: [],
      outbox: [],
      pendingCount: 0,
      isBusy: false,
      isSyncing: false,
      error: null,
    });
  },
}));
