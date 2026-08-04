import { CategoryId } from '../types/expense';

export interface CategoryConfig {
  id: CategoryId;
  label: string;
  labelHi: string;
  emoji: string;
  color: string;
  /** Optional remote/local icon (SVG/PNG) from admin or user picker */
  iconUrl?: string;
  /** global = curated; custom = user-created (deletable) */
  source?: 'global' | 'custom';
}

export const CATEGORIES: CategoryConfig[] = [
  { id: 'food', label: 'Food', labelHi: 'खाना', emoji: '🍔', color: '#F472B6' },
  { id: 'groceries', label: 'Groceries', labelHi: 'किराना', emoji: '🛒', color: '#10B981' },
  { id: 'shopping', label: 'Shopping', labelHi: 'खरीदारी', emoji: '🛍️', color: '#818CF8' },
  { id: 'transport', label: 'Transport', labelHi: 'यातायात', emoji: '🚗', color: '#38BDF8' },
  { id: 'entertainment', label: 'Entertainment', labelHi: 'मनोरंजन', emoji: '🎬', color: '#FBBF24' },
  { id: 'bills', label: 'Bills', labelHi: 'बिल', emoji: '📱', color: '#06B6D4' },
  { id: 'rent', label: 'Rent', labelHi: 'किराया', emoji: '🏠', color: '#A78BFA' },
  { id: 'taxes', label: 'Taxes', labelHi: 'कर', emoji: '🧾', color: '#FB923C' },
  { id: 'gifts', label: 'Gifts', labelHi: 'उपहार', emoji: '🎁', color: '#E879F9' },
  { id: 'donation', label: 'Donation', labelHi: 'दान', emoji: '🤝', color: '#34D399' },
  { id: 'insurance', label: 'Insurance', labelHi: 'बीमा', emoji: '🛡️', color: '#0EA5E9' },
  { id: 'personal_care', label: 'Personal Care', labelHi: 'पर्सनल केयर', emoji: '💇', color: '#D946EF' },
  { id: 'health', label: 'Health', labelHi: 'स्वास्थ्य', emoji: '💊', color: '#F87171' },
  { id: 'other', label: 'Other', labelHi: 'अन्य', emoji: '📦', color: '#94A3B8' },
];

export function getCategoryConfig(id: CategoryId): CategoryConfig {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

/** Original pie / category colors (same as first Insights build). */
export const CATEGORY_CHART_COLORS: string[] = CATEGORIES.map(c => c.color);

export function getCategoryColor(id: string): string {
  return CATEGORIES.find(c => c.id === id)?.color ?? '#94A3B8';
}
