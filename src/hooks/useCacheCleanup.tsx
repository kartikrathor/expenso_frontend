import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheCleanupModal, CacheCleanupMode } from '../components/CacheCleanupModal';
import { useExpenseStore } from '../store/expenseStore';
import {
  shouldForceCleanup,
  shouldSuggestCleanup,
  CACHE_SUGGEST_THRESHOLD,
} from '../utils/cacheCleanup';

const SUGGEST_DISMISS_KEY = '@expenso_cache_suggest_dismissed';
const DISMISS_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

interface UseCacheCleanupResult {
  cleanupModal: React.ReactNode;
  checkCleanup: () => void;
}

export function useCacheCleanup(enabled: boolean): UseCacheCleanupResult {
  const expenses = useExpenseStore(s => s.expenses);
  const count = expenses.length;

  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<CacheCleanupMode>('suggest');
  const checkedRef = useRef(false);

  const evaluate = useCallback(async () => {
    if (!enabled || count < CACHE_SUGGEST_THRESHOLD) {
      setVisible(false);
      return;
    }

    if (shouldForceCleanup(count)) {
      setMode('force');
      setVisible(true);
      return;
    }

    if (!shouldSuggestCleanup(count)) return;

    try {
      const dismissedAt = await AsyncStorage.getItem(SUGGEST_DISMISS_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (!Number.isNaN(elapsed) && elapsed < DISMISS_COOLDOWN_MS) {
          return;
        }
      }
    } catch {
      // show suggestion if read fails
    }

    setMode('suggest');
    setVisible(true);
  }, [enabled, count]);

  useEffect(() => {
    if (!enabled) return;
    evaluate();
    checkedRef.current = true;
  }, [enabled, count, evaluate]);

  const handleClose = useCallback(async () => {
    if (mode === 'suggest') {
      await AsyncStorage.setItem(SUGGEST_DISMISS_KEY, String(Date.now()));
    }
    setVisible(false);

    const remaining = useExpenseStore.getState().expenses.length;
    if (shouldForceCleanup(remaining)) {
      setMode('force');
      setVisible(true);
    }
  }, [mode]);

  const cleanupModal = (
    <CacheCleanupModal
      visible={visible}
      mode={mode}
      entryCount={count}
      onClose={handleClose}
    />
  );

  return {
    cleanupModal,
    checkCleanup: evaluate,
  };
}
