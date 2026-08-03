import { useCallback, useState } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import { useJointStore } from '../store/jointStore';
import { useActivityStore } from '../store/activityStore';
import { EditExpenseModal } from '../components/EditExpenseModal';
import { Expense, CategoryId, MerchantId } from '../types/expense';

export function useEditExpense() {
  const [pending, setPending] = useState<Expense | null>(null);
  const [source, setSource] = useState<'local' | 'joint'>('local');
  const updateExpense = useExpenseStore(s => s.updateExpense);
  const updateJointExpense = useJointStore(s => s.updateJointExpense);
  const logEdited = useActivityStore(s => s.logEdited);

  const requestEdit = useCallback((id: string) => {
    const fromJoint = useJointStore.getState().expenses.find(e => e.id === id);
    if (fromJoint) {
      setSource('joint');
      setPending(fromJoint);
      return;
    }
    const fromLocal = useExpenseStore.getState().expenses.find(e => e.id === id) ?? null;
    if (fromLocal) {
      setSource('local');
      setPending(fromLocal);
    }
  }, []);

  const cancelEdit = useCallback(() => {
    setPending(null);
  }, []);

  const confirmEdit = useCallback(async (
    id: string,
    changes: {
      amount: number;
      merchantLabel: string;
      merchant: MerchantId;
      category: CategoryId;
      note: string;
      date: string;
    },
  ) => {
    if (!pending) return;
    const before = pending;
    if (source === 'joint') {
      await updateJointExpense(id, changes);
    } else {
      await updateExpense(id, changes);
    }
    await logEdited(before, changes, source);
    setPending(null);
  }, [pending, source, updateExpense, updateJointExpense, logEdited]);

  const editModal = (
    <EditExpenseModal
      visible={!!pending}
      expense={pending}
      onClose={cancelEdit}
      onSave={confirmEdit}
    />
  );

  return { requestEdit, editModal };
}
