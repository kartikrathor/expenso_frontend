import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { ChangePasswordScreen } from './src/screens/ChangePasswordScreen';
import { useExpenseStore } from './src/store/expenseStore';
import { useThemeStore } from './src/store/themeStore';
import { useAppIconStore } from './src/store/appIconStore';
import { useProStore } from './src/store/proStore';
import { useTheme } from './src/hooks/useTheme';
import { useOnboarding } from './src/hooks/useOnboarding';
import { useCacheCleanup } from './src/hooks/useCacheCleanup';
import { useAuthStore } from './src/store/authStore';
import { useAppLockStore } from './src/store/appLockStore';
import { bindSessionToUser, clearSessionStores } from './src/utils/sessionData';
import { AppLockScreen } from './src/screens/AppLockScreen';
import {
  startPushListeners,
  setSupportPushOpenHandler,
  setForegroundPushHandler,
  type PushPayload,
} from './src/utils/pushNotifications';
import { useNotificationNavStore } from './src/store/notificationNavStore';
import { useNotificationInboxStore } from './src/store/notificationInboxStore';
import { PushBanner } from './src/components/PushBanner';
import { PaywallModal } from './src/components/PaywallModal';
import { AppBootSkeleton } from './src/components/Skeleton';
import { startAddExpenseLinking } from './src/utils/expenseWidget';

function AppContent() {
  const isExpensesLoaded = useExpenseStore(s => s.isLoaded);
  const loadTheme = useThemeStore(s => s.loadTheme);
  const loadAppIcon = useAppIconStore(s => s.load);
  const isThemeLoaded = useThemeStore(s => s.isLoaded);
  const loadPro = useProStore(s => s.loadPro);
  const loadAuth = useAuthStore(s => s.loadAuth);
  const isAuthLoaded = useAuthStore(s => s.isLoaded);
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const loadAppLock = useAppLockStore(s => s.load);
  const lockLoaded = useAppLockStore(s => s.isLoaded);
  const lockEnabled = useAppLockStore(s => s.enabled);
  const unlocked = useAppLockStore(s => s.unlocked);
  const lockNow = useAppLockStore(s => s.lockNow);
  const requestOpenSupport = useNotificationNavStore(s => s.requestOpenSupport);
  const loadInbox = useNotificationInboxStore(s => s.loadForUser);
  const { colors, isDark } = useTheme();
  const [sessionReady, setSessionReady] = useState(false);
  const [banner, setBanner] = useState<PushPayload | null>(null);

  useEffect(() => {
    loadTheme();
    loadAppIcon();
    loadPro();
    loadAuth();
  }, [loadTheme, loadAppIcon, loadPro, loadAuth]);

  // Widget / shortcut deep link → open Add Expense (survives lock / loading)
  useEffect(() => startAddExpenseLinking(), []);

  // Bind local + joint data to the signed-in user (clears previous account on switch).
  useEffect(() => {
    if (!isAuthLoaded) return;
    let cancelled = false;
    setSessionReady(false);
    (async () => {
      try {
        if (user?.id) {
          await Promise.all([
            bindSessionToUser(user.id),
            loadAppLock(user.id),
            loadInbox(user.id),
          ]);
        } else {
          // clearSessionStores also clears the notification inbox.
          await Promise.all([clearSessionStores(), loadAppLock(null)]);
        }
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoaded, user?.id, loadAppLock, loadInbox]);

  // FCM: register token + in-app banner + Support deep link
  useEffect(() => {
    if (!user?.id || !token) return;
    setSupportPushOpenHandler(data => {
      requestOpenSupport(data.ticketId);
    });
    setForegroundPushHandler(payload => {
      setBanner(payload);
    });
    const stop = startPushListeners(token);
    return () => {
      setSupportPushOpenHandler(null);
      setForegroundPushHandler(null);
      stop();
    };
  }, [user?.id, token, requestOpenSupport]);

  // Re-lock when app goes to background (biometric prompt uses suppressLockUntil)
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
        <AppBootSkeleton />
      ) : !user ? (
        <AuthScreen />
      ) : user.mustChangePassword ? (
        <ChangePasswordScreen />
      ) : showOnboarding ? (
        <OnboardingScreen onDone={markDone} />
      ) : lockEnabled && !unlocked ? (
        <AppLockScreen />
      ) : (
        <>
          <AppNavigator />
          {cleanupModal}
          <PushBanner
            payload={banner}
            onHide={() => setBanner(null)}
            onPress={() => {
              if (
                banner?.type === 'support_reply' ||
                banner?.type === 'support_ticket'
              ) {
                requestOpenSupport(banner.ticketId);
              }
            }}
          />
          <PaywallModal />
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
});

export default App;
