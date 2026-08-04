import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Keyboard } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing, Typography } from '../constants/theme';
import { FLOATING_TAB_HEIGHT, FLOATING_TAB_MARGIN } from '../constants/layout';
import { StatsChartIcon } from './icons/StatsChartIcon';

const TABS = [
  { name: 'Home', emoji: '🏠', label: 'Home' },
  { name: 'Ask', emoji: '✨', label: 'Ask' },
  { name: 'Analytics', emoji: '📊', label: 'Stats', icon: 'stats' as const },
  { name: 'History', emoji: '📋', label: 'Log' },
  { name: 'Profile', emoji: '👤', label: 'Profile' },
];

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = () => setKeyboardOpen(true);
    const onHide = () => setKeyboardOpen(false);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 8) + FLOATING_TAB_MARGIN,
          opacity: keyboardOpen ? 0 : 1,
        },
      ]}
      pointerEvents={keyboardOpen ? 'none' : 'box-none'}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.tabBar,
            borderColor: colors.tabBarBorder,
            shadowColor: isDark ? colors.primary : colors.primaryDark,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const tab = TABS.find(t => t.name === route.name) ?? TABS[0];

          return (
            <TabButton
              key={route.key}
              emoji={tab.emoji}
              icon={tab.icon}
              label={tab.label}
              focused={focused}
              colors={colors}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const TabButton = React.memo(function TabButton({
  emoji,
  icon,
  label,
  focused,
  colors,
  onPress,
}: {
  emoji: string;
  icon?: 'stats';
  label: string;
  focused: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.05 : 1, { damping: 16, stiffness: 220 });
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glyph = icon === 'stats' ? (
    <StatsChartIcon size={focused ? 15 : 17} color={focused ? '#FFF' : colors.textMuted} />
  ) : (
    <Text style={[focused ? styles.activeEmoji : styles.inactiveEmoji, !focused && { opacity: 0.5 }]}>
      {emoji}
    </Text>
  );

  return (
    <Pressable style={styles.tabBtn} onPress={onPress}>
      {focused ? (
        <Animated.View style={[styles.activePill, animStyle]}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientMid]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeGradient}
          >
            {glyph}
            <Text style={styles.activeLabel}>{label}</Text>
          </LinearGradient>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.inactiveTab, animStyle]}>
          {glyph}
          <Text style={[styles.inactiveLabel, { color: colors.textMuted }]}>{label}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    height: FLOATING_TAB_HEIGHT,
    borderRadius: Radius.full,
    borderWidth: 1,
    padding: 5,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 24,
  },
  tabBtn: {
    flex: 1,
    height: '100%',
  },
  activePill: {
    flex: 1,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  activeGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: Radius.full,
  },
  activeEmoji: { fontSize: 16 },
  activeLabel: { ...Typography.small, color: '#FFF', fontWeight: '700', fontSize: 11 },
  inactiveTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  inactiveEmoji: { fontSize: 17 },
  inactiveLabel: { ...Typography.small, fontSize: 9 },
});
