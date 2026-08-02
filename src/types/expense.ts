export type MerchantId =
  | 'blinkit'
  | 'zepto'
  | 'amazon'
  | 'flipkart'
  | 'swiggy'
  | 'zomato'
  | 'myntra'
  | 'uber'
  | 'ola'
  | 'netflix'
  | 'spotify'
  | 'paytm'
  | 'phonepe'
  | 'default';

export type CategoryId =
  | 'food'
  | 'groceries'
  | 'shopping'
  | 'transport'
  | 'entertainment'
  | 'bills'
  | 'health'
  | 'other';

export interface Expense {
  id: string;
  amount: number;
  merchant: MerchantId;
  merchantLabel: string;
  category: CategoryId;
  note: string;
  date: string;
  createdAt: string;
  inputMethod: 'voice' | 'manual';
  /** Joint: who logged / paid (for Ask Expenso splits) */
  createdById?: string;
  createdByName?: string;
  paidById?: string;
  paidByName?: string;
  groupId?: string;
  groupName?: string;
}

export interface ParsedExpenseInput {
  amount: number | null;
  merchant: MerchantId;
  merchantLabel: string;
  category: CategoryId;
  note: string;
}

export type TimeFilter = 'week' | 'month' | 'year' | 'all';
