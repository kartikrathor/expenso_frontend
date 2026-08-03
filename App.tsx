import React, { useEffect, useState } from 'react';
import { StatusBar, View, StyleSheet, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { useExpenseStore } from './src/store/expenseStore';
import { useThemeStore } from './src/store/themeStore';
import { useTheme } from './src/hooks/useTheme';
import { useOnboarding } from './src/hooks/useOnboarding';
import { useCacheCleanup } from './src/hooks/useCacheCleanup';
import { useAuthStore } from './src/store/authStore';
import { useAppLockStore } from './src/store/appLockStore';
import { bindSessionToUser, clearSessionStores } from './src/utils/sessionData';
import { AppLockScreen } from './src/screens/AppLockScreen';

function AppContent() {
  const isExpensesLoaded = useExpenseStore(s => s.isLoaded);
  const loadTheme = useThemeStore(s => s.loadTheme);
  const isThemeLoaded = useThemeStore(s => s.isLoaded);
  const loadAuth = useAuthStore(s => s.loadAuth);
  const isAuthLoaded = useAuthStore(s => s.isLoaded);
  const user = useAuthStore(s => s.user);
  const loadAppLock = useAppLockStore(s => s.load);
  const lockLoaded = useAppLockStore(s => s.isLoaded);
  const lockEnabled = useAppLockStore(s => s.enabled);
  const unlocked = useAppLockStore(s => s.unlocked);
  const lockNow = useAppLockStore(s => s.lockNow);
  const { colors, isDark } = useTheme();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    loadTheme();
    loadAuth();
  }, [loadTheme, loadAuth]);

  // Bind local + joint data to the signed-in user (clears previous account on switch).
  useEffect(() => {
    if (!isAuthLoaded) return;
    let cancelled = false;
    setSessionReady(false);
    (async () => {
      try {
        if (user?.id) {
          await bindSessionToUser(user.id);
          await loadAppLock(user.id);
        } else {
          await clearSessionStores();
          await loadAppLock(null);
        }
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoaded, user?.id, loadAppLock]);

  // Re-lock when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background') {
        lockNow();
      }
    });
    return () => sub.remove();
  }, [lockNow]);

  const { isLoading: isOnboardingLoading, showOnboarding, markDone } = useOnboarding(user?.id ?? null);
  const inMainApp =
    isExpensesLoaded &&
    isThemeLoaded &&
    isAuthLoaded &&
    sessionReady &&
    !isOnboardingLoading &&
    !!user &&
    !showOnboarding;
  const { cleanupModal } = useCacheCleanup(inMainApp);

  const isReady =
    isThemeLoaded &&
    isAuthLoaded &&
    sessionReady &&
    lockLoaded &&
    (!user || (isExpensesLoaded && !isOnboardingLoading));

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      {!isReady ? (
        <View style={[styles.loading, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !user ? (
        <AuthScreen />
      ) : showOnboarding ? (
        <OnboardingScreen onDone={markDone} />
      ) : lockEnabled && !unlocked ? (
        <AppLockScreen />
      ) : (
        <>
          <AppNavigator />
          {cleanupModal}
        </>
      )}
    </>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default App;
