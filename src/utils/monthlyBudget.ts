export interface MonthlyBudgetEntry {
  month: string;
  amount: number;
}

export type BudgetMonthInput = Date | string;

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])(?:$|[T\s-])/;

/** Return a local calendar month key (`YYYY-MM`) without UTC date shifting. */
export function monthKey(value: BudgetMonthInput = new Date()): string {
  if (typeof value === 'string') {
    const direct = value.match(MONTH_KEY_RE);
    if (direct) return `${direct[1]}-${direct[2]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid budget month: ${String(value)}`);
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function normalizeMonthlyBudgets(value: unknown): MonthlyBudgetEntry[] {
  if (!Array.isArray(value)) return [];

  const byMonth = new Map<string, number>();
  value.forEach(raw => {
    if (!raw || typeof raw !== 'object') return;
    const entry = raw as { month?: unknown; amount?: unknown };
    if (typeof entry.month !== 'string' || !MONTH_KEY_RE.test(entry.month)) return;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount < 0) return;
    byMonth.set(monthKey(entry.month), amount);
  });

  return Array.from(byMonth, ([month, amount]) => ({ month, amount })).sort((a, b) =>
    a.month.localeCompare(b.month),
  );
}

export function upsertMonthlyBudget(
  entries: MonthlyBudgetEntry[],
  month: BudgetMonthInput,
  amount: number,
): MonthlyBudgetEntry[] {
  return normalizeMonthlyBudgets([
    ...entries.filter(entry => entry.month !== monthKey(month)),
    { month: monthKey(month), amount },
  ]);
}

/**
 * Resolve a month's budget. An exact entry always wins; repeating budgets use
 * the latest earlier entry. The legacy scalar only represents the current month.
 */
export function resolveMonthlyBudget(
  entries: MonthlyBudgetEntry[],
  requestedMonth: BudgetMonthInput,
  repeatMonthlyBudget: boolean,
  currentScalar = 0,
  currentMonth: BudgetMonthInput = new Date(),
): number {
  const requested = monthKey(requestedMonth);
  const normalized = normalizeMonthlyBudgets(entries);
  const exact = normalized.find(entry => entry.month === requested);
  if (exact) return exact.amount;

  if (repeatMonthlyBudget) {
    const prior = normalized
      .filter(entry => entry.month < requested)
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    if (prior) return prior.amount;
  }

  return requested === monthKey(currentMonth) && Number.isFinite(currentScalar)
    ? currentScalar
    : 0;
}
