import { useCallback, useState } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import { useJointStore } from '../store/jointStore';
import { useActivityStore } from '../store/activityStore';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal';
import { Expense } from '../types/expense';

export function useDeleteExpense() {
  const [pending, setPending] = useState<Expense | null>(null);
  const [source, setSource] = useState<'local' | 'joint'>('local');
  const deleteExpense = useExpenseStore(s => s.deleteExpense);
  const deleteJointExpense = useJointStore(s => s.deleteJointExpense);
  const logDeleted = useActivityStore(s => s.logDeleted);

  const requestDelete = useCallback((id: string) => {
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

  const cancelDelete = useCallback(() => {
    setPending(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pending) return;
    const expense = pending;
    const id = expense.id;
    const src = source;
    // Close modal first so it never remounts / blocks touches mid-delete
    setPending(null);
    await logDeleted(expense, src);
    if (src === 'joint') {
      await deleteJointExpense(id);
    } else {
      await deleteExpense(id);
    }
  }, [pending, source, deleteExpense, deleteJointExpense, logDeleted]);

  const deleteModal = (
    <DeleteConfirmModal
      visible={!!pending}
      expense={pending}
      onConfirm={confirmDelete}
      onCancel={cancelDelete}
    />
  );

  return { requestDelete, deleteModal };
}
