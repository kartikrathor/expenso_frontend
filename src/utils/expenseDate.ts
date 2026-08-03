import {
  addMonths,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  endOfMonth,
  endOfYear,
  endOfDay,
  isWithinInterval,
} from 'date-fns';
import { Expense } from '../types/expense';
import { sortByNewest } from './expenseAnalytics';

/** History period chips: Day / Month / Year / All */
export type HistoryPeriod = 'day' | 'month' | 'year' | 'all';

export type DaySection = {
  dayKey: string;
  title: string;
  data: Expense[];
  total: number;
};

/** Apply a calendar day while keeping the time-of-day from `baseIso` (or now). */
export function applyCalendarDay(day: Date, baseIso?: string): string {
  const base = baseIso ? parseISO(baseIso) : new Date();
  const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
  const next = new Date(day);
  next.setHours(
    safeBase.getHours(),
    safeBase.getMinutes(),
    safeBase.getSeconds(),
    safeBase.getMilliseconds(),
  );
  return next.toISOString();
}

export function formatExpenseDayLabel(dateStr: string): string {
  try {
    const d = parseISO(dateStr);
    if (Number.isNaN(d.getTime())) return 'Unknown date';
    if (isToday(d)) return `Today · ${format(d, 'd MMM yyyy')}`;
    if (isYesterday(d)) return `Yesterday · ${format(d, 'd MMM yyyy')}`;
    return format(d, 'd MMM yyyy');
  } catch {
    return 'Unknown date';
  }
}

export function formatDayHeading(dayKey: string): string {
  try {
    const d = parseISO(`${dayKey}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dayKey;
    if (isToday(d)) return `Today · ${format(d, 'd MMM yyyy')}`;
    if (isYesterday(d)) return `Yesterday · ${format(d, 'd MMM yyyy')}`;
    return format(d, 'd MMM yyyy');
  } catch {
    return dayKey;
  }
}

export function formatPeriodAnchor(period: HistoryPeriod, anchor: Date): string {
  switch (period) {
    case 'day':
      if (isToday(anchor)) return `Today · ${format(anchor, 'd MMM yyyy')}`;
      if (isYesterday(anchor)) return `Yesterday · ${format(anchor, 'd MMM yyyy')}`;
      return format(anchor, 'd MMM yyyy');
    case 'month':
      return format(anchor, 'MMM yyyy');
    case 'year':
      return format(anchor, 'yyyy');
    default:
      return 'All time';
  }
}

export function filterByHistoryPeriod(
  expenses: Expense[],
  period: HistoryPeriod,
  anchor: Date,
): Expense[] {
  if (period === 'all') return expenses;

  let start: Date;
  let end: Date;
  if (period === 'day') {
    start = startOfDay(anchor);
    end = endOfDay(anchor);
  } else if (period === 'month') {
    start = startOfMonth(anchor);
    end = endOfMonth(anchor);
  } else {
    start = startOfYear(anchor);
    end = endOfYear(anchor);
  }

  return expenses.filter(e => {
    try {
      const d = parseISO(e.date);
      if (Number.isNaN(d.getTime())) return true;
      return isWithinInterval(d, { start, end });
    } catch {
      return true;
    }
  });
}

export function groupExpensesByDay(expenses: Expense[]): DaySection[] {
  const sorted = sortByNewest(expenses);
  const map = new Map<string, Expense[]>();

  for (const e of sorted) {
    let key = 'unknown';
    try {
      const d = parseISO(e.date);
      if (!Number.isNaN(d.getTime())) key = format(d, 'yyyy-MM-dd');
    } catch {
      /* keep unknown */
    }
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }

  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dayKey, data]) => ({
      dayKey,
      title: dayKey === 'unknown' ? 'Unknown date' : formatDayHeading(dayKey),
      data,
      total: data.reduce((sum, e) => sum + e.amount, 0),
    }));
}

/** Days in month grid (null = empty cell), Mon-first. */
export function buildMonthGrid(month: Date): (Date | null)[] {
  const start = startOfMonth(month);
  const mondayIndex = (start.getDay() + 6) % 7;
  const daysInMonth = endOfMonth(month).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < mondayIndex; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function shiftPeriodAnchor(period: HistoryPeriod, anchor: Date, dir: -1 | 1): Date {
  if (period === 'day') {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir);
    return d;
  }
  if (period === 'month') return addMonths(anchor, dir);
  if (period === 'year') {
    const d = new Date(anchor);
    d.setFullYear(d.getFullYear() + dir);
    return d;
  }
  return anchor;
}
