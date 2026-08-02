import React, { useEffect } from 'react';
import { StatusBar, View, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useActivityStore } from './src/store/activityStore';
import { useJointStore } from './src/store/jointStore';

const WIPE_EMAIL = 'kartikrathor.work@gmail.com';

function AppContent() {
  const loadExpenses = useExpenseStore(s => s.loadExpenses);
  const clearAllExpenses = useExpenseStore(s => s.clearAllExpenses);
  const isExpensesLoaded = useExpenseStore(s => s.isLoaded);
  const loadTheme = useThemeStore(s => s.loadTheme);
  const isThemeLoaded = useThemeStore(s => s.isLoaded);
  const loadAuth = useAuthStore(s => s.loadAuth);
  const isAuthLoaded = useAuthStore(s => s.isLoaded);
  const loadActivity = useActivityStore(s => s.load);
  const clearActivity = useActivityStore(s => s.clearAll);
  const user = useAuthStore(s => s.user);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    loadExpenses();
    loadTheme();
    loadAuth();
    loadActivity();
  }, [loadExpenses, loadTheme, loadAuth, loadActivity]);

  // One-shot: wipe local history + activity for this account after server cleanup
  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== WIPE_EMAIL) return;
    const flag = `@expenso_history_wipe_${user.id}`;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(flag);
        if (done === '1') return;
        await clearActivity();
        await clearAllExpenses();
        const joint = useJointStore.getState().joint;
        if (joint?.id) {
          await AsyncStorage.removeItem(`@expenso_joint_cache_${joint.id}`);
          await AsyncStorage.removeItem(`@expenso_joint_outbox_${joint.id}`);
        }
        useJointStore.setState({ expenses: [], outbox: [], pendingCount: 0, joint: null, groups: [] });
        await AsyncStorage.setItem(flag, '1');
      } catch {
        // ignore
      }
    })();
  }, [user, clearActivity, clearAllExpenses]);

  const { isLoading: isOnboardingLoading, showOnboarding, markDone } = useOnboarding(user?.id ?? null);
  const inMainApp =
    isExpensesLoaded &&
    isThemeLoaded &&
    isAuthLoaded &&
    !isOnboardingLoading &&
    !!user &&
    !showOnboarding;
  const { cleanupModal } = useCacheCleanup(inMainApp);

  const isReady = isExpensesLoaded && isThemeLoaded && isAuthLoaded && (!user || !isOnboardingLoading);

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
