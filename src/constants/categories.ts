import { CategoryId } from '../types/expense';

export interface CategoryConfig {
  id: CategoryId;
  label: string;
  labelHi: string;
  emoji: string;
  color: string;
}

export const CATEGORIES: CategoryConfig[] = [
  { id: 'food', label: 'Food', labelHi: 'खाना', emoji: '🍔', color: '#F472B6' },
  { id: 'groceries', label: 'Groceries', labelHi: 'किराना', emoji: '🛒', color: '#10B981' },
  { id: 'shopping', label: 'Shopping', labelHi: 'खरीदारी', emoji: '🛍️', color: '#818CF8' },
  { id: 'transport', label: 'Transport', labelHi: 'यातायात', emoji: '🚗', color: '#38BDF8' },
  { id: 'entertainment', label: 'Entertainment', labelHi: 'मनोरंजन', emoji: '🎬', color: '#FBBF24' },
  { id: 'bills', label: 'Bills', labelHi: 'बिल', emoji: '📱', color: '#06B6D4' },
  { id: 'health', label: 'Health', labelHi: 'स्वास्थ्य', emoji: '💊', color: '#F87171' },
  { id: 'other', label: 'Other', labelHi: 'अन्य', emoji: '📦', color: '#94A3B8' },
];

export function getCategoryConfig(id: CategoryId): CategoryConfig {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
