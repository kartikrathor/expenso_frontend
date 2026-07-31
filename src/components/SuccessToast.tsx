import React, { useEffect, useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { MerchantIcon } from './MerchantIcon';
import { MerchantId } from '../types/expense';
import { formatCurrency } from '../utils/expenseParser';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface SuccessToastProps {
  visible: boolean;
  amount: number;
  merchant: MerchantId;
  label: string;
  onHide: () => void;
}

export function SuccessToast({ visible, amount, merchant, label, onHide }: SuccessToastProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withDelay(
        2200,
        withTiming(-120, { duration: 350 }, finished => {
          if (finished) runOnJS(onHide)();
        }),
      );
      opacity.value = withDelay(2200, withTiming(0, { duration: 350 }));
    }
  }, [visible, translateY, opacity, onHide]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.toast, style]}>
      <MerchantIcon merchantId={merchant} size={44} />
      <Animated.View style={styles.textWrap}>
        <Text style={styles.title}>Saved!</Text>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
      <Text style={styles.amount}>{formatCurrency(amount)}</Text>
    </Animated.View>
  );
}


function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 56,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: colors.success + '55',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 999,
  },
  textWrap: { flex: 1 },
  title: { ...Typography.bodyBold, color: colors.success },
  label: { ...Typography.caption, color: colors.textSecondary },
  amount: { ...Typography.h3, color: colors.primaryLight, fontWeight: '700' },
  });
}
