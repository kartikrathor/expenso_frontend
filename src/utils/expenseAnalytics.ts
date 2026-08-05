import {
  isToday,
  parseISO,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  addWeeks,
  addMonths,
  format,
  isSameWeek,
  isSameMonth,
  isSameYear,
  isAfter,
} from 'date-fns';
import { Expense, TimeFilter } from '../types/expense';
import { CATEGORIES } from '../constants/categories';

const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.id, c.color]),
);

export type DateRange = { start: Date; end: Date };

/** Rich filter used by Insights (and optionally Home). */
export type TimeFilterOptions = {
  filter: TimeFilter;
  /** Which week / month / year window (defaults to now). */
  anchor?: Date;
  /** When filter is `all`, optional custom From–To range. */
  customRange?: DateRange | null;
};

function normalizeOpts(filterOrOpts: TimeFilter | TimeFilterOptions): TimeFilterOptions {
  if (typeof filterOrOpts === 'string') return { filter: filterOrOpts };
  return filterOrOpts;
}

/** Closed calendar interval for the selection, or null = all time. */
export function resolveFilterInterval(
  filterOrOpts: TimeFilter | TimeFilterOptions,
): DateRange | null {
  const opts = normalizeOpts(filterOrOpts);
  const anchor = opts.anchor ?? new Date();

  if (opts.filter === 'all') {
    if (opts.customRange?.start && opts.customRange?.end) {
      const a = startOfDay(opts.customRange.start);
      const b = endOfDay(opts.customRange.end);
      return a.getTime() <= b.getTime() ? { start: a, end: b } : { start: b, end: a };
    }
    return null;
  }

  if (opts.filter === 'week') {
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    };
  }
  if (opts.filter === 'month') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  return { start: startOfYear(anchor), end: endOfYear(anchor) };
}

export function formatTimeFilterAnchor(filter: TimeFilter, anchor: Date): string {
  const now = new Date();
  if (filter === 'week') {
    const s = startOfWeek(anchor, { weekStartsOn: 1 });
    const e = endOfWeek(anchor, { weekStartsOn: 1 });
    const range = `${format(s, 'd MMM')} – ${format(e, 'd MMM')}`;
    if (isSameWeek(anchor, now, { weekStartsOn: 1 })) return `This week · ${range}`;
    return range;
  }
  if (filter === 'month') {
    const label = format(anchor, 'MMM yyyy');
    if (isSameMonth(anchor, now)) return `This month · ${label}`;
    return label;
  }
  if (filter === 'year') {
    const label = format(anchor, 'yyyy');
    if (isSameYear(anchor, now)) return `This year · ${label}`;
    return label;
  }
  return 'All time';
}

export function shiftTimeFilterAnchor(
  filter: TimeFilter,
  anchor: Date,
  dir: -1 | 1,
): Date {
  if (filter === 'week') return addWeeks(anchor, dir);
  if (filter === 'month') return addMonths(anchor, dir);
  if (filter === 'year') {
    const d = new Date(anchor);
    d.setFullYear(d.getFullYear() + dir);
    return d;
  }
  return anchor;
}

/** Block navigating into a future week/month/year beyond the current one. */
export function canShiftTimeFilterForward(filter: TimeFilter, anchor: Date): boolean {
  if (filter === 'all') return false;
  const next = shiftTimeFilterAnchor(filter, anchor, 1);
  const now = new Date();
  if (filter === 'week') {
    return !isAfter(
      startOfWeek(next, { weekStartsOn: 1 }),
      startOfWeek(now, { weekStartsOn: 1 }),
    );
  }
  if (filter === 'month') {
    return !isAfter(startOfMonth(next), startOfMonth(now));
  }
  return !isAfter(startOfYear(next), startOfYear(now));
}

export function isCurrentPeriod(filter: TimeFilter, anchor: Date): boolean {
  const now = new Date();
  if (filter === 'week') return isSameWeek(anchor, now, { weekStartsOn: 1 });
  if (filter === 'month') return isSameMonth(anchor, now);
  if (filter === 'year') return isSameYear(anchor, now);
  return true;
}

function safeExpenseDay(dateStr: string): Date | null {
  try {
    const d = parseISO(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return startOfDay(d);
  } catch {
    return null;
  }
}

export function filterExpenses(
  expenses: Expense[],
  filterOrOpts: TimeFilter | TimeFilterOptions,
): Expense[] {
  const interval = resolveFilterInterval(filterOrOpts);
  if (!interval) return expenses;
  const startTime = interval.start.getTime();
  const endTime = interval.end.getTime();
  return expenses.filter(e => {
    const d = safeExpenseDay(e.date);
    // A bounded period must contain only rows that can be placed inside it.
    // Invalid dates remain available under "All" instead of leaking into
    // Week, Month, and Year results.
    if (!d) return false;
    const time = d.getTime();
    return time >= startTime && time <= endTime;
  });
}

export function sortByNewest(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    const ta = Date.parse(a.date) || 0;
    const tb = Date.parse(b.date) || 0;
    return tb - ta;
  });
}

export function totalSpent(
  expenses: Expense[],
  filterOrOpts: TimeFilter | TimeFilterOptions,
): number {
  return filterExpenses(expenses, filterOrOpts).reduce((sum, e) => sum + e.amount, 0);
}

export function todaySpent(expenses: Expense[]): number {
  return expenses
    .filter(e => {
      try {
        return isToday(parseISO(e.date));
      } catch {
        return false;
      }
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

/** One filtered snapshot for screens that need every analytics slice together. */
export function summarizeExpenses(
  expenses: Expense[],
  filterOrOpts: TimeFilter | TimeFilterOptions,
) {
  const filtered = filterExpenses(expenses, filterOrOpts);
  const categoryMap = new Map<string, number>();
  const merchantMap = new Map<string, number>();
  const dailyMap = new Map<string, number>();
  let total = 0;

  for (const expense of filtered) {
    total += expense.amount;
    categoryMap.set(
      expense.category,
      (categoryMap.get(expense.category) ?? 0) + expense.amount,
    );
    merchantMap.set(
      expense.merchantLabel,
      (merchantMap.get(expense.merchantLabel) ?? 0) + expense.amount,
    );
    const day = expense.date.split('T')[0];
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + expense.amount);
  }

  const categories = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      color: CATEGORY_COLORS[category] ?? '#A0A0B8',
    }))
    .sort((a, b) => b.amount - a.amount);
  const merchants = Array.from(merchantMap.entries())
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const limit = normalizeOpts(filterOrOpts).filter === 'week' ? 7 : 31;
  const daily = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([label, value]) => ({ label: label.slice(5), value }));

  return { filtered, total, categories, merchants, daily };
}

export function categoryBreakdown(
  expenses: Expense[],
  filterOrOpts: TimeFilter | TimeFilterOptions,
) {
  const map = new Map<string, number>();
  filterExpenses(expenses, filterOrOpts).forEach(e => {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  });
  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      color: CATEGORY_COLORS[category] ?? '#A0A0B8',
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function merchantBreakdown(
  expenses: Expense[],
  filterOrOpts: TimeFilter | TimeFilterOptions,
) {
  const map = new Map<string, number>();
  filterExpenses(expenses, filterOrOpts).forEach(e => {
    map.set(e.merchantLabel, (map.get(e.merchantLabel) ?? 0) + e.amount);
  });
  return Array.from(map.entries())
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

export function dailySpending(
  expenses: Expense[],
  filterOrOpts: TimeFilter | TimeFilterOptions,
) {
  const opts = normalizeOpts(filterOrOpts);
  const map = new Map<string, number>();
  filterExpenses(expenses, filterOrOpts).forEach(e => {
    const day = e.date.split('T')[0];
    map.set(day, (map.get(day) ?? 0) + e.amount);
  });
  const points = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Cap chart density: week ~7, month ~31, year/custom keep last 31 spend-days
  const limit = opts.filter === 'week' ? 7 : 31;
  return points.slice(-limit).map(([label, value]) => ({
    label: label.slice(5),
    value,
  }));
}
