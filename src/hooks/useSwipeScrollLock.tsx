import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import {
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

const SwipeEnabledContext = createContext<SharedValue<boolean> | null>(null);

/**
 * SharedValue: true when swipe-to-action is allowed.
 * Uses a SharedValue so scroll lock never re-renders the list.
 */
export function useSwipeEnabledSV(): SharedValue<boolean> | null {
  return useContext(SwipeEnabledContext);
}

/** Scroll handlers that disable swipe on the UI thread while the list moves. */
export function useSwipeScrollLock() {
  const swipeEnabled = useSharedValue(true);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    if (unlockTimer.current) {
      clearTimeout(unlockTimer.current);
      unlockTimer.current = null;
    }
    swipeEnabled.value = false;
  }, [swipeEnabled]);

  const unlock = useCallback(() => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => {
      swipeEnabled.value = true;
      unlockTimer.current = null;
    }, 60);
  }, [swipeEnabled]);

  const scrollProps = useMemo(
    () => ({
      onScrollBeginDrag: lock,
      onMomentumScrollBegin: lock,
      onScrollEndDrag: unlock,
      onMomentumScrollEnd: unlock,
    }),
    [lock, unlock],
  );

  return { swipeEnabled, scrollProps };
}

/** Provides swipe-enabled SharedValue to nested ExpenseCards (no React re-renders on scroll). */
export function SwipeScrollLockGate({
  children,
}: {
  children: (scrollProps: ReturnType<typeof useSwipeScrollLock>['scrollProps']) => React.ReactNode;
}) {
  const { swipeEnabled, scrollProps } = useSwipeScrollLock();
  return (
    <SwipeEnabledContext.Provider value={swipeEnabled}>
      {children(scrollProps)}
    </SwipeEnabledContext.Provider>
  );
}
