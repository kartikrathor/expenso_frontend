import { useExpenseStore } from '../store/expenseStore';
import { useActivityStore } from '../store/activityStore';
import { useJointStore } from '../store/jointStore';
import { useCategoryStore } from '../store/categoryStore';
import { useMerchantStore } from '../store/merchantStore';
import { CATEGORIES } from '../constants/categories';
import { MERCHANTS, setRuntimeMerchants } from '../constants/merchants';
import { preloadAskChatHistory } from './askChatHistory';

/**
 * Clear in-memory (+ user-scoped) session data when logging out
 * or switching accounts so the previous user's expenses never linger.
 */
export async function clearSessionStores() {
  await useExpenseStore.getState().loadForUser(null);
  await useActivityStore.getState().loadForUser(null);
  await useJointStore.getState().resetSession();
  useCategoryStore.setState({ all: CATEGORIES, custom: [], isLoaded: false });
  setRuntimeMerchants(MERCHANTS);
  useMerchantStore.setState({ all: MERCHANTS, isLoaded: false });
}

/**
 * Bind local stores to the signed-in user and refresh joint from server.
 */
export async function bindSessionToUser(userId: string | null) {
  if (!userId) {
    await clearSessionStores();
    return;
  }
  await useExpenseStore.getState().loadForUser(userId);
  await useActivityStore.getState().loadForUser(userId);
  await useJointStore.getState().loadJoint();
  await useCategoryStore.getState().loadCategories();
  await useMerchantStore.getState().loadMerchants();
  // Warm Ask chat so first open doesn't flash/re-scroll
  void preloadAskChatHistory(userId);
}
