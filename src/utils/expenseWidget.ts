import { AppState, Linking, NativeModules, Platform } from 'react-native';
import { useAddExpenseNavStore } from '../store/addExpenseNavStore';
import type { Expense } from '../types/expense';

type ExpenseWidgetNative = {
  setSession?: (
    token: string | null,
    userId: string | null,
    groupId: string | null,
    accountLabel: string | null,
  ) => void;
  clearSession?: () => void;
  setRecentExpenses?: (
    rows: Array<{
      id: string;
      amount: number;
      merchantLabel: string;
      date: string;
    }>,
  ) => void;
  setTodayTotal?: (todayTotal: number) => void;
  updateStats?: (
    todayTotal: number,
    monthTotal: number,
    budget: number,
    accountLabel: string | null,
  ) => void;
  setAccountLabel?: (accountLabel: string | null) => void;
  refresh?: () => void;
  syncFromServer?: () => void;
  consumeNeedsRefresh?: () => boolean;
};

const Widget = NativeModules.ExpenseWidget as ExpenseWidgetNative | undefined;

export function isAddExpenseDeepLink(url: string | null | undefined): boolean {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  return (
    u === 'expenso://add' ||
    u.startsWith('expenso://add?') ||
    u.startsWith('expenso://add/') ||
    /^expenso:\/\/add(\b|[/?#])/.test(u)
  );
}

/** Handle widget / shortcut / URL → open Add Expense modal (full app path). */
export function handleAddExpenseUrl(url: string | null | undefined) {
  if (isAddExpenseDeepLink(url)) {
    useAddExpenseNavStore.getState().requestOpenAdd();
  }
}

/** Subscribe to cold-start + runtime deep links. */
export function startAddExpenseLinking(): () => void {
  Linking.getInitialURL()
    .then(handleAddExpenseUrl)
    .catch(() => {});

  const sub = Linking.addEventListener('url', ({ url }) => {
    handleAddExpenseUrl(url);
  });

  return () => sub.remove();
}

/** Mirror auth + joint context so the native Quick Add / widget Sync can call the API. */
export function syncWidgetSession(opts: {
  token?: string | null;
  userId?: string | null;
  groupId?: string | null;
  accountLabel?: string;
}) {
  if (Platform.OS !== 'android' || !Widget) return;
  try {
    if (Widget.setSession) {
      Widget.setSession(
        opts.token ?? null,
        opts.userId ?? null,
        opts.groupId ?? null,
        opts.accountLabel || 'Personal',
      );
      return;
    }
    Widget.setAccountLabel?.(opts.accountLabel || 'Personal');
  } catch {
    // ignore
  }
}

export function clearWidgetSession() {
  if (Platform.OS !== 'android' || !Widget?.clearSession) return;
  try {
    Widget.clearSession();
  } catch {
    // ignore
  }
}

/** Push last 4 expenses into the home-screen widget list. */
export function syncExpenseWidget(opts: {
  expenses?: Expense[];
  todayTotal?: number;
  accountLabel?: string;
  token?: string | null;
  userId?: string | null;
  groupId?: string | null;
}) {
  if (Platform.OS !== 'android' || !Widget) return;
  try {
    if (opts.token !== undefined || opts.groupId !== undefined || opts.userId !== undefined) {
      syncWidgetSession({
        token: opts.token,
        userId: opts.userId,
        groupId: opts.groupId,
        accountLabel: opts.accountLabel,
      });
    } else if (opts.accountLabel) {
      Widget.setAccountLabel?.(opts.accountLabel);
    }

    if (typeof opts.todayTotal === 'number') {
      Widget.setTodayTotal?.(opts.todayTotal || 0);
    }

    const rows = (opts.expenses || [])
      .slice()
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .slice(0, 4)
      .map(e => ({
        id: e.id,
        amount: e.amount,
        merchantLabel: e.merchantLabel || 'Expense',
        date: e.date,
      }));

    if (Widget.setRecentExpenses) {
      Widget.setRecentExpenses(rows);
    } else {
      Widget.refresh?.();
    }
  } catch {
    // Widget module missing on old builds — ignore
  }
}

/** True if Quick Add saved something while the app was closed / backgrounded. */
export function consumeWidgetNeedsRefresh(): boolean {
  if (Platform.OS !== 'android' || !Widget?.consumeNeedsRefresh) return false;
  try {
    return !!Widget.consumeNeedsRefresh();
  } catch {
    return false;
  }
}

/** When app becomes active, refresh lists if widget Quick Add marked dirty. */
export function startWidgetRefreshWatcher(onNeedRefresh: () => void): () => void {
  if (Platform.OS !== 'android') return () => {};

  const check = () => {
    if (consumeWidgetNeedsRefresh()) {
      onNeedRefresh();
    }
  };

  check();
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') check();
  });
  return () => sub.remove();
}
