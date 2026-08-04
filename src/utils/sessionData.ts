import { useExpenseStore } from '../store/expenseStore';
import { useActivityStore } from '../store/activityStore';
import { useJointStore } from '../store/jointStore';
import { useCategoryStore } from '../store/categoryStore';
import { useMerchantStore } from '../store/merchantStore';
import { useNotificationInboxStore } from '../store/notificationInboxStore';
import { CATEGORIES } from '../constants/categories';
import { MERCHANTS, setRuntimeMerchants } from '../constants/merchants';
import { preloadAskChatHistory } from './askChatHistory';

/**
 * Clear in-memory (+ user-scoped) session data when logging out
 * or switching accounts so the previous user's expenses never linger.
 */
let bindEpoch = 0;

export async function clearSessionStores() {
  bindEpoch += 1;
  // Expenses first: flushes debounced personal cache before wiping memory
  await useExpenseStore.getState().loadForUser(null);
  await Promise.all([
    useActivityStore.getState().loadForUser(null),
    useJointStore.getState().resetSession(),
    useNotificationInboxStore.getState().loadForUser(null),
  ]);
  useCategoryStore.setState({ all: CATEGORIES, custom: [], isLoaded: false });
  setRuntimeMerchants(MERCHANTS);
  useMerchantStore.setState({ all: MERCHANTS, isLoaded: false });
}

/**
 * Bind local stores to the signed-in user and refresh joint from server.
 * Expenses load first (UI needs them); the rest run in parallel.
 */
export async function bindSessionToUser(userId: string | null) {
  const epoch = ++bindEpoch;
  if (!userId) {
    await clearSessionStores();
    return;
  }
  // Critical path: personal expenses cache → first paint
  await useExpenseStore.getState().loadForUser(userId);
  if (epoch !== bindEpoch) return;
  // Parallel: everything else
  await Promise.all([
    useActivityStore.getState().loadForUser(userId),
    useJointStore.getState().loadJoint(),
    useCategoryStore.getState().loadCategories(),
    useMerchantStore.getState().loadMerchants(),
  ]);
  if (epoch !== bindEpoch) return;

  // Activity is local-only — seed from synced expenses so Log → Activity isn't empty after login
  const joint = useJointStore.getState().joint;
  const expenses = joint
    ? useJointStore.getState().expenses
    : useExpenseStore.getState().expenses;
  await useActivityStore.getState().seedFromExpenses(expenses, joint ? 'joint' : 'local');
  if (epoch !== bindEpoch) return;

  await preloadAskChatHistory(userId);
}
