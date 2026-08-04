import { format, parseISO, startOfMonth } from 'date-fns';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import { Expense } from '../types/expense';
import { getCategoryConfig } from '../constants/categories';

export type ExportMeta = {
  isJoint?: boolean;
  accountLabel?: string;
};

function safeDay(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'yyyy-MM-dd');
  } catch {
    return (dateStr || '').slice(0, 10);
  }
}

function safeMonth(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'yyyy-MM');
  } catch {
    return (dateStr || '').slice(0, 7);
  }
}

function formatInr(n: number): string {
  return `₹${Number(n || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

function formatInrPdf(n: number): string {
  return `Rs ${Number(n || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

/** Helvetica (WinAnsi) cannot draw ₹ / Hindi / most Unicode — strip to safe Latin. */
function pdfSafe(text: string): string {
  return String(text ?? '')
    .replace(/₹/g, 'Rs ')
    .replace(/[·•]/g, ' - ')
    .replace(/[→⇒➔]/g, '->')
    .replace(/[—–−]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortedExpenses(expenses: Expense[]): Expense[] {
  return [...expenses].sort(
    (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0),
  );
}

function buildSummary(expenses: Expense[]) {
  const list = sortedExpenses(expenses);
  const total = list.reduce((s, e) => s + (e.amount || 0), 0);
  const days = list.map(e => safeDay(e.date)).filter(Boolean).sort();
  const from = days[0] || '—';
  const to = days[days.length - 1] || '—';

  const thisMonthKey = format(startOfMonth(new Date()), 'yyyy-MM');
  const thisMonth = list
    .filter(e => safeMonth(e.date) === thisMonthKey)
    .reduce((s, e) => s + (e.amount || 0), 0);

  const byCat = new Map<string, { count: number; total: number }>();
  const byMonth = new Map<string, { count: number; total: number }>();
  const byMerchant = new Map<string, { count: number; total: number }>();

  for (const e of list) {
    const cat = getCategoryConfig(e.category).label;
    const month = safeMonth(e.date) || 'Unknown';
    const merchant = e.merchantLabel || 'Other';

    const c = byCat.get(cat) || { count: 0, total: 0 };
    c.count += 1;
    c.total += e.amount || 0;
    byCat.set(cat, c);

    const m = byMonth.get(month) || { count: 0, total: 0 };
    m.count += 1;
    m.total += e.amount || 0;
    byMonth.set(month, m);

    const mer = byMerchant.get(merchant) || { count: 0, total: 0 };
    mer.count += 1;
    mer.total += e.amount || 0;
    byMerchant.set(merchant, mer);
  }

  const categories = [...byCat.entries()]
    .map(([category, v]) => ({
      category,
      count: v.count,
      total: v.total,
      pct: total > 0 ? Math.round((v.total / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const months = [...byMonth.entries()]
    .map(([month, v]) => ({ month, count: v.count, total: v.total }))
    .sort((a, b) => b.month.localeCompare(a.month));

  const merchants = [...byMerchant.entries()]
    .map(([merchant, v]) => ({ merchant, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  return {
    list,
    total,
    count: list.length,
    from,
    to,
    thisMonth,
    thisMonthKey,
    categories,
    months,
    merchants,
  };
}

function autoWidth(rows: (string | number)[][]): { wch: number }[] {
  const cols = rows[0]?.length || 0;
  const widths: number[] = Array(cols).fill(10);
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = String(cell ?? '').length + 2;
      if (len > widths[i]) widths[i] = Math.min(len, 42);
    });
  }
  return widths.map(wch => ({ wch }));
}

/** Build a real .xlsx workbook (base64). */
export function expensesToExcelBase64(
  expenses: Expense[],
  meta: ExportMeta = {},
): string {
  const s = buildSummary(expenses);
  const wb = XLSX.utils.book_new();
  const generated = format(new Date(), 'yyyy-MM-dd HH:mm');

  const summaryRows: (string | number)[][] = [
    ['Expenso — Expense Report'],
    ['Generated', generated],
    ['Account', meta.accountLabel || (meta.isJoint ? 'Joint' : 'Personal')],
    [],
    ['Overview'],
    ['Total expenses', s.count],
    ['Total amount (₹)', s.total],
    ['This month (₹)', s.thisMonth],
    ['Date range', `${s.from} → ${s.to}`],
    [],
    ['Top categories'],
    ['Category', 'Amount (₹)', '% of total'],
    ...s.categories.slice(0, 8).map(c => [c.category, c.total, c.pct]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = autoWidth(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const expenseHeader = [
    'Date',
    'Amount (₹)',
    'Merchant',
    'Category',
    'Note',
    'Paid by',
    'Group',
    'Added via',
  ];
  const expenseRows: (string | number)[][] = [
    expenseHeader,
    ...s.list.map(e => [
      safeDay(e.date),
      e.amount || 0,
      e.merchantLabel || '',
      getCategoryConfig(e.category).label,
      e.note || '',
      e.paidByName || e.createdByName || '',
      e.groupName || '',
      e.inputMethod === 'voice' ? 'Voice' : 'Manual',
    ]),
  ];
  const wsExpenses = XLSX.utils.aoa_to_sheet(expenseRows);
  wsExpenses['!cols'] = autoWidth(expenseRows);
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');

  const catRows: (string | number)[][] = [
    ['Category', 'Count', 'Total (₹)', '% of total'],
    ...s.categories.map(c => [c.category, c.count, c.total, c.pct]),
  ];
  const wsCat = XLSX.utils.aoa_to_sheet(catRows);
  wsCat['!cols'] = autoWidth(catRows);
  XLSX.utils.book_append_sheet(wb, wsCat, 'By Category');

  const monthRows: (string | number)[][] = [
    ['Month', 'Count', 'Total (₹)'],
    ...s.months.map(m => [m.month, m.count, m.total]),
  ];
  const wsMonth = XLSX.utils.aoa_to_sheet(monthRows);
  wsMonth['!cols'] = autoWidth(monthRows);
  XLSX.utils.book_append_sheet(wb, wsMonth, 'By Month');

  const merchRows: (string | number)[][] = [
    ['Merchant', 'Count', 'Total (₹)'],
    ...s.merchants.map(m => [m.merchant, m.count, m.total]),
  ];
  const wsMerch = XLSX.utils.aoa_to_sheet(merchRows);
  wsMerch['!cols'] = autoWidth(merchRows);
  XLSX.utils.book_append_sheet(wb, wsMerch, 'Top Merchants');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/** Build a PDF report (base64). */
export async function expensesToPdfBase64(
  expenses: Expense[],
  meta: ExportMeta = {},
): Promise<string> {
  const s = buildSummary(expenses);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595; // A4
  const pageHeight = 842;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const lineH = 14;
  const ink = rgb(0.12, 0.14, 0.18);
  const muted = rgb(0.4, 0.42, 0.48);
  const accent = rgb(0.15, 0.45, 0.72);
  const rule = rgb(0.85, 0.87, 0.9);

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (need: number) => {
    if (y - need < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {},
  ) => {
    const size = opts.size ?? 11;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? ink;
    const x = opts.x ?? margin;
    const safe = pdfSafe(text);
    if (!safe) return;
    ensureSpace(size + 4);
    page.drawText(safe, { x, y: y - size, size, font: f, color });
    y -= size + 4;
  };

  const drawRule = () => {
    ensureSpace(10);
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rule,
    });
    y -= 12;
  };

  // Header
  drawText('Expenso', { size: 22, bold: true, color: accent });
  drawText('Expense Report', { size: 14, bold: true });
  drawText(`Generated ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, {
    size: 10,
    color: muted,
  });
  drawText(
    `Account: ${meta.accountLabel || (meta.isJoint ? 'Joint' : 'Personal')}`,
    { size: 10, color: muted },
  );
  y -= 6;
  drawRule();

  drawText('Overview', { size: 13, bold: true });
  drawText(`Total expenses: ${s.count}`);
  drawText(`Total amount: ${formatInrPdf(s.total)}`);
  drawText(`This month (${s.thisMonthKey}): ${formatInrPdf(s.thisMonth)}`);
  drawText(`Date range: ${s.from} -> ${s.to}`);
  y -= 6;
  drawRule();

  drawText('By category', { size: 13, bold: true });
  for (const c of s.categories.slice(0, 12)) {
    drawText(
      `${c.category}  -  ${c.count}  -  ${formatInrPdf(c.total)}  (${c.pct}%)`,
      { size: 10 },
    );
  }
  y -= 6;
  drawRule();

  drawText('By month', { size: 13, bold: true });
  for (const m of s.months.slice(0, 12)) {
    drawText(`${m.month}  -  ${m.count} txns  -  ${formatInrPdf(m.total)}`, { size: 10 });
  }
  y -= 6;
  drawRule();

  drawText('All expenses', { size: 13, bold: true });
  y -= 2;

  for (const e of s.list) {
    const day = safeDay(e.date);
    const cat = getCategoryConfig(e.category).label;
    const who = e.paidByName || e.createdByName || '';
    const title = pdfSafe(
      `${day}  -  ${formatInrPdf(e.amount)}  -  ${e.merchantLabel || 'Expense'}`,
    );
    const detail = pdfSafe([cat, who, e.note].filter(Boolean).join(' - '));

    ensureSpace(lineH * 3);
    if (title) {
      page.drawText(title, {
        x: margin,
        y: y - 11,
        size: 10,
        font: fontBold,
        color: ink,
      });
      y -= 14;
    }
    if (detail) {
      const lines = wrapText(detail, font, 9, contentWidth);
      for (const line of lines.slice(0, 2)) {
        const safeLine = pdfSafe(line);
        if (!safeLine) continue;
        ensureSpace(12);
        page.drawText(safeLine, {
          x: margin,
          y: y - 9,
          size: 9,
          font,
          color: muted,
        });
        y -= 12;
      }
    }
    y -= 4;
  }

  // Footer page numbers
  const pages = doc.getPages();
  pages.forEach((p: PDFPage, i: number) => {
    const label = `Page ${i + 1} of ${pages.length} - Expenso`;
    p.drawText(label, {
      x: margin,
      y: 24,
      size: 8,
      font,
      color: muted,
    });
  });

  const bytes = await doc.saveAsBase64({ dataUri: false });
  return bytes;
}

export function buildExportFileName(kind: 'xlsx' | 'pdf'): string {
  const stamp = format(new Date(), 'yyyy-MM-dd');
  return `Expenso-Expenses-${stamp}.${kind}`;
}

const MIME = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
} as const;

/** Write base64 file to cache and open the native share sheet as a real file. */
export async function shareBinaryFile(opts: {
  base64: string;
  fileName: string;
  mime: string;
  title?: string;
}): Promise<void> {
  const dir = ReactNativeBlobUtil.fs.dirs.CacheDir;
  const path = `${dir}/${opts.fileName}`;

  const exists = await ReactNativeBlobUtil.fs.exists(path);
  if (exists) {
    await ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
  }

  await ReactNativeBlobUtil.fs.writeFile(path, opts.base64, 'base64');

  const url = Platform.OS === 'android' ? `file://${path}` : path;

  try {
    await Share.open({
      title: opts.title || opts.fileName,
      subject: opts.title || opts.fileName,
      url,
      type: opts.mime,
      filename: opts.fileName,
      failOnCancel: false,
    });
  } catch (e: any) {
    // User cancelled share sheet
    if (e?.message === 'User did not share' || e?.message?.includes('User did not share')) {
      return;
    }
    throw e;
  }
}

export async function exportAndShareExcel(
  expenses: Expense[],
  meta: ExportMeta = {},
): Promise<void> {
  const fileName = buildExportFileName('xlsx');
  const base64 = expensesToExcelBase64(expenses, meta);
  await shareBinaryFile({
    base64,
    fileName,
    mime: MIME.xlsx,
    title: 'Expenso Excel export',
  });
}

export async function exportAndSharePdf(
  expenses: Expense[],
  meta: ExportMeta = {},
): Promise<void> {
  const fileName = buildExportFileName('pdf');
  const base64 = await expensesToPdfBase64(expenses, meta);
  await shareBinaryFile({
    base64,
    fileName,
    mime: MIME.pdf,
    title: 'Expenso PDF report',
  });
}
