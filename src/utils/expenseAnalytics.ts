import {
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
  endOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { Expense, TimeFilter } from '../types/expense';

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

function filterStart(filter: TimeFilter): Date | null {
  const now = new Date();
  switch (filter) {
    case 'week': return startOfWeek(now, { weekStartsOn: 1 });
    case 'month': return startOfMonth(now);
    case 'year': return startOfYear(now);
    default: return null;
  }
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

export function filterExpenses(expenses: Expense[], filter: TimeFilter): Expense[] {
  const start = filterStart(filter);
  if (!start) return expenses;
  const end = endOfDay(new Date());
  return expenses.filter(e => {
    const d = safeExpenseDay(e.date);
    // Bad/missing dates: still show (don't hide partner sync items)
    if (!d) return true;
    return isWithinInterval(d, { start: startOfDay(start), end });
  });
}

export function sortByNewest(expenses: Expense[]): Expense[] {
  return [...expenses].sort((a, b) => {
    const ta = Date.parse(a.date) || 0;
    const tb = Date.parse(b.date) || 0;
    return tb - ta;
  });
}


export function totalSpent(expenses: Expense[], filter: TimeFilter): number {
  return filterExpenses(expenses, filter).reduce((sum, e) => sum + e.amount, 0);
}

export function todaySpent(expenses: Expense[]): number {
  return expenses.filter(e => {
    try {
      return isToday(parseISO(e.date));
    } catch {
      return false;
    }
  }).reduce((sum, e) => sum + e.amount, 0);
}

export function categoryBreakdown(expenses: Expense[], filter: TimeFilter) {
  const map = new Map<string, number>();
  filterExpenses(expenses, filter).forEach(e => {
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

export function merchantBreakdown(expenses: Expense[], filter: TimeFilter) {
  const map = new Map<string, number>();
  filterExpenses(expenses, filter).forEach(e => {
    map.set(e.merchantLabel, (map.get(e.merchantLabel) ?? 0) + e.amount);
  });
  return Array.from(map.entries())
    .map(([merchant, amount]) => ({ merchant, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

export function dailySpending(expenses: Expense[], filter: TimeFilter) {
  const map = new Map<string, number>();
  filterExpenses(expenses, filter).forEach(e => {
    const day = e.date.split('T')[0];
    map.set(day, (map.get(day) ?? 0) + e.amount);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([label, value]) => ({ label: label.slice(5), value }));
}
