import { create } from 'zustand';

type AddExpenseNavState = {
  openAdd: boolean;
  requestOpenAdd: () => void;
  clearOpenAdd: () => void;
};

/** Opens Add Expense from widget / shortcut / deep link `expenso://add`. */
export const useAddExpenseNavStore = create<AddExpenseNavState>(set => ({
  openAdd: false,
  requestOpenAdd: () => set({ openAdd: true }),
  clearOpenAdd: () => set({ openAdd: false }),
}));
