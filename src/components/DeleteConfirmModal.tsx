import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { format, parseISO } from 'date-fns';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Expense } from '../types/expense';
import { MerchantIcon } from './MerchantIcon';
import { CategoryIcon, CategoryGlyph } from './CategoryIcon';
import { getCategoryConfig } from '../constants/categories';
import { formatCurrency } from '../utils/expenseParser';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface DeleteConfirmModalProps {
  visible: boolean;
  expense: Expense | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const ENTER_MS = 280;
const EXIT_MS = 200;
const SPRING = { damping: 28, stiffness: 300, mass: 0.85 };

export function DeleteConfirmModal({
  visible,
  expense,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const { colors, isDark } = useTheme();
  const palette = useMemo(
    () => ({
      cardBorder: isDark ? colors.primary + '30' : colors.border,
      cardShadow: isDark ? colors.primary : colors.primaryDark,
      iconOuter: isDark ? colors.primary + '16' : colors.primary + '10',
      iconOuterBorder: isDark ? colors.primary + '40' : colors.primary + '22',
      iconInner: isDark ? colors.danger + '20' : colors.danger + '12',
      previewBg: isDark ? colors.surface : colors.surfaceHighlight,
      previewBorder: colors.border,
      amountColor: colors.primaryLight,
      deleteColors: isDark ? [colors.danger, '#E8382A'] : [colors.danger, '#C62828'],
      deleteShadow: isDark ? 'rgba(255, 68, 51, 0.35)' : 'rgba(232, 56, 42, 0.28)',
    }),
    [colors, isDark],
  );
  const styles = useMemo(() => createStyles(colors, palette), [colors, palette]);

  // Keep content visible during exit animation after parent clears `expense`
  const [displayExpense, setDisplayExpense] = useState<Expense | null>(expense);
  const [busy, setBusy] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const backdropOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(24);
  const cardScale = useSharedValue(0.96);

  const category = displayExpense ? getCategoryConfig(displayExpense.category) : null;

  const clearSafety = useCallback(() => {
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, []);

  const resetAnim = useCallback(() => {
    backdropOpacity.value = 0;
    cardOpacity.value = 0;
    cardTranslateY.value = 24;
    cardScale.value = 0.96;
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const finishClose = useCallback(() => {
    clearSafety();
    closingRef.current = false;
    setClosing(false);
    setBusy(false);
    setModalVisible(false);
    setDisplayExpense(null);
    resetAnim();
  }, [clearSafety, resetAnim]);

  const animateIn = useCallback(() => {
    backdropOpacity.value = withTiming(1, {
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
    });
    cardOpacity.value = withTiming(1, {
      duration: ENTER_MS,
      easing: Easing.out(Easing.cubic),
    });
    cardTranslateY.value = withSpring(0, SPRING);
    cardScale.value = withSpring(1, SPRING);
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const animateOut = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);

    clearSafety();
    // Hard guarantee: never leave Modal mounted if animation callback is cancelled
    safetyTimer.current = setTimeout(finishClose, EXIT_MS + 120);

    cardOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
    cardTranslateY.value = withTiming(16, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
    cardScale.value = withTiming(0.97, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
    backdropOpacity.value = withTiming(
      0,
      { duration: EXIT_MS + 20, easing: Easing.in(Easing.cubic) },
      finished => {
        // Always unmount — cancelled animations previously left Modal blocking touches
        runOnJS(finishClose)();
      },
    );
  }, [
    backdropOpacity,
    cardOpacity,
    cardScale,
    cardTranslateY,
    clearSafety,
    finishClose,
  ]);

  useEffect(() => {
    if (visible && expense) {
      clearSafety();
      closingRef.current = false;
      setClosing(false);
      setBusy(false);
      setDisplayExpense(expense);
      setModalVisible(true);
      resetAnim();
      requestAnimationFrame(() => animateIn());
      return;
    }

    if (!visible && modalVisible && !closingRef.current) {
      animateOut();
    }
  }, [visible, expense, modalVisible, animateIn, animateOut, clearSafety, resetAnim]);

  useEffect(() => () => clearSafety(), [clearSafety]);

  const handleCancel = useCallback(() => {
    if (busy || closingRef.current) return;
    onCancel();
  }, [busy, onCancel]);

  const handleConfirm = useCallback(async () => {
    if (busy || closingRef.current) return;
    setBusy(true);
    ReactNativeHapticFeedback.trigger('notificationWarning');
    try {
      await onConfirm();
    } catch {
      setBusy(false);
    }
  }, [busy, onConfirm]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }, { scale: cardScale.value }],
  }));

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay} pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            style={[styles.backdrop, { backgroundColor: colors.overlay }]}
            onPress={handleCancel}
            disabled={busy || closing}
          />
        </Animated.View>

        {displayExpense && category ? (
          <Animated.View style={[styles.card, cardStyle]}>
            <View style={styles.cardGradient}>
              <LinearGradient
                colors={[colors.gradientMid, colors.gradientEnd]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.topAccent}
              />

              <View style={styles.iconRing}>
                <View
                  style={[
                    styles.iconOuter,
                    {
                      backgroundColor: palette.iconOuter,
                      borderColor: palette.iconOuterBorder,
                    },
                  ]}
                >
                  <View style={[styles.iconInner, { backgroundColor: palette.iconInner }]}>
                    <Text style={styles.iconEmoji}>🗑️</Text>
                  </View>
                </View>
              </View>

              <View style={styles.body}>
                <Text style={styles.title}>Delete Expense?</Text>
                <Text style={styles.subtitle}>This action cannot be undone</Text>

                <View
                  style={[
                    styles.preview,
                    {
                      backgroundColor: palette.previewBg,
                      borderColor: palette.previewBorder,
                    },
                  ]}
                >
                  <View style={[styles.previewIcon, { borderColor: category.color + '55' }]}>
                    {!displayExpense.merchant || displayExpense.merchant === 'default' ? (
                      <CategoryIcon categoryId={displayExpense.category} size={52} />
                    ) : (
                      <MerchantIcon merchantId={displayExpense.merchant} size={52} />
                    )}
                  </View>
                  <View style={styles.previewContent}>
                    <Text style={styles.previewMerchant} numberOfLines={1}>
                      {displayExpense.merchantLabel}
                    </Text>
                    <Text style={[styles.previewAmount, { color: palette.amountColor }]}>
                      {formatCurrency(displayExpense.amount)}
                    </Text>
                    <View style={styles.previewMeta}>
                      <View
                        style={[styles.categoryBadge, { backgroundColor: category.color + '22' }]}
                      >
                        <CategoryGlyph categoryId={displayExpense.category} size={13} color={category.color} />
                        <Text style={[styles.categoryText, { color: category.color }]}>
                          {category.label}
                        </Text>
                      </View>
                      <Text style={styles.previewDate}>
                        {format(parseISO(displayExpense.date), 'dd MMM, hh:mm a')}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable
                  style={({ pressed }) => [styles.cancelBtn, pressed && styles.btnPressed]}
                  onPress={handleCancel}
                  disabled={busy}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { shadowColor: palette.deleteShadow },
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleConfirm}
                  disabled={busy}
                >
                  <LinearGradient
                    colors={palette.deleteColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.deleteGrad}
                  >
                    <Text style={styles.deleteText}>{busy ? 'Deleting...' : 'Delete'}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

function createStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  palette: {
    cardBorder: string;
    cardShadow: string;
  },
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    backdrop: {
      ...StyleSheet.absoluteFill,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      borderRadius: Radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: palette.cardBorder,
      shadowColor: palette.cardShadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 16,
    },
    cardGradient: {
      padding: Spacing.lg,
      paddingTop: Spacing.md,
      alignItems: 'center',
    },
    topAccent: {
      width: 56,
      height: 4,
      borderRadius: Radius.full,
      marginBottom: Spacing.lg,
    },
    iconRing: {
      marginBottom: Spacing.md,
    },
    iconOuter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    iconInner: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconEmoji: {
      fontSize: 24,
    },
    body: {
      width: '100%',
      alignItems: 'center',
    },
    title: {
      ...Typography.h2,
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 6,
      marginBottom: Spacing.lg,
      lineHeight: 18,
    },
    preview: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    previewIcon: {
      borderRadius: Radius.md,
      borderWidth: 1.5,
      padding: 2,
      backgroundColor: colors.background + '88',
    },
    previewContent: {
      flex: 1,
    },
    previewMerchant: {
      ...Typography.bodyBold,
      color: colors.text,
    },
    previewAmount: {
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginTop: 2,
    },
    previewMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
      gap: Spacing.sm,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: Radius.full,
      gap: 4,
    },
    categoryEmoji: {
      fontSize: 11,
    },
    categoryText: {
      ...Typography.small,
      fontWeight: '600',
    },
    previewDate: {
      ...Typography.small,
      color: colors.textMuted,
      flexShrink: 1,
    },
    actions: {
      flexDirection: 'row',
      width: '100%',
      gap: Spacing.sm,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
      backgroundColor: colors.surfaceHighlight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cancelText: {
      ...Typography.bodyBold,
      color: colors.textSecondary,
    },
    deleteBtn: {
      flex: 1,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 6,
    },
    deleteGrad: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    deleteText: {
      ...Typography.bodyBold,
      color: '#FFF',
      letterSpacing: 0.2,
    },
    btnPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.98 }],
    },
  });
}
