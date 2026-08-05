import React, { useEffect, useMemo, useRef } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  NavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { AskScreen } from '../screens/AskScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { useTheme } from '../hooks/useTheme';
import { useNotificationNavStore } from '../store/notificationNavStore';
import { useAddExpenseNavStore } from '../store/addExpenseNavStore';

const Tab = createBottomTabNavigator();

type TabParamList = {
  Home: undefined;
  Ask: undefined;
  Analytics: undefined;
  History: undefined;
  Profile: undefined;
};

export function AppNavigator() {
  const { colors, isDark } = useTheme();
  const navRef = useRef<NavigationContainerRef<TabParamList>>(null);
  const openSupport = useNotificationNavStore(s => s.openSupport);
  const openAdd = useAddExpenseNavStore(s => s.openAdd);

  useEffect(() => {
    if (!openSupport) return;
    // Ensure Profile is focused so Settings/Support modals can open
    navRef.current?.navigate('Profile');
  }, [openSupport]);

  useEffect(() => {
    if (!openAdd) return;
    navRef.current?.navigate('Home');
  }, [openAdd]);

  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        border: colors.border,
        primary: colors.primary,
        text: colors.text,
      },
    };
  }, [
    isDark,
    colors.background,
    colors.surface,
    colors.border,
    colors.primary,
    colors.text,
  ]);

  return (
    <NavigationContainer ref={navRef} theme={navTheme}>
      <Tab.Navigator
        tabBar={props => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          lazy: true,
          freezeOnBlur: true,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Ask" component={AskScreen} />
        <Tab.Screen name="Analytics" component={AnalyticsScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
