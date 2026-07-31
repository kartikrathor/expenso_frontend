import { format, parseISO } from 'date-fns';
import { Expense } from '../types/expense';

export const CACHE_SUGGEST_THRESHOLD = 5000;
export const CACHE_FORCE_THRESHOLD = 10000;

export interface YearCleanupOption {
  year: number;
  count: number;
  label: string;
}

export interface MonthCleanupOption {
  year: number;
  month: number;
  count: number;
  label: string;
}

export type CleanupMode = 'year' | 'month';

export function getExpenseCount(expenses: Expense[]): number {
  return expenses.length;
}

export function shouldSuggestCleanup(count: number): boolean {
  return count >= CACHE_SUGGEST_THRESHOLD && count < CACHE_FORCE_THRESHOLD;
}

export function shouldForceCleanup(count: number): boolean {
  return count >= CACHE_FORCE_THRESHOLD;
}

/** Build delete options: year-wise if data spans 2+ years, else month-wise. */
export function getCleanupOptions(expenses: Expense[]): {
  mode: CleanupMode;
  years: YearCleanupOption[];
  months: MonthCleanupOption[];
} {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const yearMap = new Map<number, number>();
  const monthMap = new Map<string, { year: number; month: number; count: number }>();

  for (const e of expenses) {
    const d = parseISO(e.date);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    yearMap.set(y, (yearMap.get(y) ?? 0) + 1);

    const key = `${y}-${m}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      monthMap.set(key, { year: y, month: m, count: 1 });
    }
  }

  const years = Array.from(yearMap.entries())
    .filter(([year]) => year < currentYear)
    .map(([year, count]) => ({
      year,
      count,
      label: String(year),
    }))
    .sort((a, b) => a.year - b.year);

  const months = Array.from(monthMap.values())
    .filter(({ year, month }) => year < currentYear || (year === currentYear && month < currentMonth))
    .map(({ year, month, count }) => ({
      year,
      month,
      count,
      label: format(new Date(year, month - 1, 1), 'MMMM yyyy'),
    }))
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

  const distinctYears = yearMap.size;
  const mode: CleanupMode = distinctYears >= 2 && years.length > 0 ? 'year' : 'month';

  return { mode, years, months };
}
