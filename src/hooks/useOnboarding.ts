import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY_PREFIX = '@expenso_onboarding_done_';
/** Legacy device-wide key — migrated once per user */
const LEGACY_ONBOARDING_KEY = '@expenso_onboarding_done';

interface UseOnboardingResult {
  isLoading: boolean;
  showOnboarding: boolean;
  markDone: () => Promise<void>;
}

function storageKey(userId: string) {
  return `${ONBOARDING_KEY_PREFIX}${userId}`;
}

export function useOnboarding(userId: string | null): UseOnboardingResult {
  const [isLoading, setIsLoading] = useState(!!userId);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!userId) {
      setShowOnboarding(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const key = storageKey(userId);
      const val = await AsyncStorage.getItem(key);
      if (val === 'true') {
        if (!cancelled) {
          setShowOnboarding(false);
          setIsLoading(false);
        }
        return;
      }

      // First login after auth gate: don't inherit old pre-auth skip unless
      // this exact user already finished. New accounts always see tutorial.
      if (!cancelled) {
        setShowOnboarding(true);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const markDone = async () => {
    if (!userId) return;
    await AsyncStorage.setItem(storageKey(userId), 'true');
    // Clean legacy flag so it doesn't confuse future logic
    await AsyncStorage.removeItem(LEGACY_ONBOARDING_KEY).catch(() => {});
    setShowOnboarding(false);
  };

  return { isLoading, showOnboarding, markDone };
}
