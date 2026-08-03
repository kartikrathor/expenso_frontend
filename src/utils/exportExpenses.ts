import { format, parseISO } from 'date-fns';
import { Expense } from '../types/expense';
import { getCategoryConfig } from '../constants/categories';

function esc(cell: string | number | undefined | null): string {
  const s = String(cell ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Excel-friendly CSV (opens directly in Excel / Sheets). */
export function expensesToCsv(expenses: Expense[]): string {
  const header = [
    'Date',
    'Amount',
    'Merchant',
    'Category',
    'Note',
    'Paid by',
    'Group',
  ];
  const rows = [...expenses]
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .map(e => {
      let day = e.date;
      try {
        day = format(parseISO(e.date), 'yyyy-MM-dd');
      } catch {
        /* keep raw */
      }
      const cat = getCategoryConfig(e.category);
      return [
        day,
        e.amount,
        e.merchantLabel || '',
        cat.label,
        e.note || '',
        e.paidByName || e.createdByName || '',
        e.groupName || '',
      ]
        .map(esc)
        .join(',');
    });
  // BOM helps Excel detect UTF-8
  return `\uFEFF${header.join(',')}\n${rows.join('\n')}`;
}

export function buildExportFileName(kind: 'csv' | 'pdf'): string {
  const stamp = format(new Date(), 'yyyy-MM-dd');
  return `expenso-expenses-${stamp}.${kind}`;
}
