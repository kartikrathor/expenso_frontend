import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  CACHE_FORCE_THRESHOLD,
  CACHE_SUGGEST_THRESHOLD,
  getCleanupOptions,
  MonthCleanupOption,
  YearCleanupOption,
} from '../utils/cacheCleanup';
import { useExpenseStore } from '../store/expenseStore';

export type CacheCleanupMode = 'suggest' | 'force';

interface CacheCleanupModalProps {
  visible: boolean;
  mode: CacheCleanupMode;
  entryCount: number;
  onClose: () => void;
}

const ENTER_MS = 240;
const EXIT_MS = 180;
const SPRING = { damping: 26, stiffness: 320, mass: 0.8 };

export function CacheCleanupModal({
  visible,
  mode,
  entryCount,
  onClose,
}: CacheCleanupModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const expenses = useExpenseStore(s => s.expenses);
  const deleteExpensesByYear = useExpenseStore(s => s.deleteExpensesByYear);
  const deleteExpensesByMonth = useExpenseStore(s => s.deleteExpensesByMonth);
  const deleteOldestEntries = useExpenseStore(s => s.deleteOldestEntries);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const closingRef = React.useRef(false);

  const backdropOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardTranslateY = useSharedValue(16);

  const { mode: optionMode, years, months } = useMemo(
    () => getCleanupOptions(expenses),
    [expenses],
  );

  const options = optionMode === 'year' ? years : months;
  const isForce = mode === 'force';

  const resetAnim = useCallback(() => {
    backdropOpacity.value = 0;
    cardOpacity.value = 0;
    cardScale.value = 0.92;
    cardTranslateY.value = 16;
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setClosing(false);
    setModalVisible(false);
    setBusyKey(null);
    resetAnim();
    onClose();
  }, [onClose, resetAnim]);

  const animateIn = useCallback(() => {
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    cardOpacity.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    cardScale.value = withSpring(1, SPRING);
    cardTranslateY.value = withSpring(0, SPRING);
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const animateOut = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    cardOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
    cardScale.value = withTiming(0.94, { duration: EXIT_MS });
    cardTranslateY.value = withTiming(10, { duration: EXIT_MS });
    backdropOpacity.value = withTiming(0, { duration: EXIT_MS + 20, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(finishClose)();
    });
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY, finishClose]);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setClosing(false);
      setBusyKey(null);
      setModalVisible(true);
      resetAnim();
      requestAnimationFrame(() => animateIn());
    } else if (modalVisible && !closingRef.current) {
      animateOut();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteYear = useCallback(async (opt: YearCleanupOption) => {
    const key = `y-${opt.year}`;
    setBusyKey(key);
    try {
      await deleteExpensesByYear(opt.year);
      const remaining = useExpenseStore.getState().expenses.length;
      if (!isForce || remaining < CACHE_FORCE_THRESHOLD) {
        animateOut();
      }
    } finally {
      setBusyKey(null);
    }
  }, [deleteExpensesByYear, isForce, animateOut]);

  const handleDeleteMonth = useCallback(async (opt: MonthCleanupOption) => {
    const key = `m-${opt.year}-${opt.month}`;
    setBusyKey(key);
    try {
      await deleteExpensesByMonth(opt.year, opt.month);
      const remaining = useExpenseStore.getState().expenses.length;
      if (!isForce || remaining < CACHE_FORCE_THRESHOLD) {
        animateOut();
      }
    } finally {
      setBusyKey(null);
    }
  }, [deleteExpensesByMonth, isForce, animateOut]);

  const handleDeleteOldest = useCallback(async (removeCount: number) => {
    setBusyKey('oldest');
    try {
      await deleteOldestEntries(removeCount);
      const remaining = useExpenseStore.getState().expenses.length;
      if (!isForce || remaining < CACHE_FORCE_THRESHOLD) {
        animateOut();
      }
    } finally {
      setBusyKey(null);
    }
  }, [deleteOldestEntries, isForce, animateOut]);

  const fallbackDeleteCount = Math.max(entryCount - CACHE_FORCE_THRESHOLD + 500, 500);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }, { translateY: cardTranslateY.value }],
  }));

  const title = isForce ? 'Storage Full — Action Required' : 'Keep Expenso Fast';
  const message = isForce
    ? `You have ${entryCount.toLocaleString('en-IN')} cached entries (limit ${CACHE_FORCE_THRESHOLD.toLocaleString('en-IN')}). Delete older entries below to continue using the app.`
    : `You have ${entryCount.toLocaleString('en-IN')} cached entries. Deleting older data keeps the app smooth. Choose a period to remove:`;

  const hint =
    optionMode === 'year'
      ? 'Entries are grouped by year — delete a full previous year.'
      : 'Entries are grouped by month — delete older months you no longer need.';

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => !isForce && !closing && animateOut()}
    >
      <View style={styles.overlay} pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            style={[styles.backdrop, { backgroundColor: colors.overlay }]}
            onPress={() => !isForce && !closing && animateOut()}
          />
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient
            colors={[colors.warning + '22', colors.surface]}
            style={styles.cardInner}
          >
            <LinearGradient
              colors={[colors.warning, '#D97706']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.topAccent}
            />

            <View style={[styles.iconWrap, { backgroundColor: colors.warning + '20', borderColor: colors.warning + '40' }]}>
              <Text style={styles.iconEmoji}>{isForce ? '🚨' : '⚡'}</Text>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            <Text style={styles.hint}>{hint}</Text>

            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {entryCount.toLocaleString('en-IN')} entries cached
              </Text>
              {!isForce && (
                <Text style={styles.countBadgeSub}>
                  Suggested from {CACHE_SUGGEST_THRESHOLD.toLocaleString('en-IN')}+
                </Text>
              )}
            </View>

            <ScrollView
              style={styles.optionsScroll}
              contentContainerStyle={styles.optionsContent}
              showsVerticalScrollIndicator={false}
            >
              {options.length === 0 ? (
                <>
                  <Text style={styles.emptyOptions}>
                    No older {optionMode === 'year' ? 'years' : 'months'} to delete.
                    {isForce ? ' Remove the oldest cached entries below.' : ' Remove individual expenses from History.'}
                  </Text>
                  {isForce && (
                    <Pressable
                      style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
                      onPress={() => handleDeleteOldest(fallbackDeleteCount)}
                      disabled={!!busyKey}
                    >
                      <View style={styles.optionLeft}>
                        <Text style={styles.optionLabel}>
                          Delete oldest {fallbackDeleteCount.toLocaleString('en-IN')} entries
                        </Text>
                        <Text style={styles.optionSub}>Frees enough cache to continue</Text>
                      </View>
                      {busyKey === 'oldest' ? (
                        <ActivityIndicator color={colors.danger} size="small" />
                      ) : (
                        <View style={styles.deleteChip}>
                          <Text style={styles.deleteChipText}>Delete</Text>
                        </View>
                      )}
                    </Pressable>
                  )}
                </>
              ) : optionMode === 'year' ? (
                (options as YearCleanupOption[]).map(opt => {
                  const key = `y-${opt.year}`;
                  const loading = busyKey === key;
                  return (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
                      onPress={() => handleDeleteYear(opt)}
                      disabled={!!busyKey}
                    >
                      <View style={styles.optionLeft}>
                        <Text style={styles.optionLabel}>Delete all of {opt.label}</Text>
                        <Text style={styles.optionSub}>{opt.count.toLocaleString('en-IN')} entries</Text>
                      </View>
                      {loading ? (
                        <ActivityIndicator color={colors.danger} size="small" />
                      ) : (
                        <View style={styles.deleteChip}>
                          <Text style={styles.deleteChipText}>Delete</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              ) : (
                (options as MonthCleanupOption[]).map(opt => {
                  const key = `m-${opt.year}-${opt.month}`;
                  const loading = busyKey === key;
                  return (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [styles.optionRow, pressed && styles.optionPressed]}
                      onPress={() => handleDeleteMonth(opt)}
                      disabled={!!busyKey}
                    >
                      <View style={styles.optionLeft}>
                        <Text style={styles.optionLabel}>Delete {opt.label}</Text>
                        <Text style={styles.optionSub}>{opt.count.toLocaleString('en-IN')} entries</Text>
                      </View>
                      {loading ? (
                        <ActivityIndicator color={colors.danger} size="small" />
                      ) : (
                        <View style={styles.deleteChip}>
                          <Text style={styles.deleteChipText}>Delete</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {!isForce && (
              <Pressable style={styles.laterBtn} onPress={() => !closing && animateOut()} disabled={!!busyKey}>
                <Text style={styles.laterText}>Maybe Later</Text>
              </Pressable>
            )}
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    backdrop: { ...StyleSheet.absoluteFill },
    card: {
      width: '100%',
      maxWidth: 360,
      maxHeight: '85%',
      borderRadius: Radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: isDark ? colors.warning + '35' : colors.border,
      shadowColor: colors.warning,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.2,
      shadowRadius: 28,
      elevation: 20,
    },
    cardInner: {
      padding: Spacing.lg,
      paddingTop: Spacing.md,
      maxHeight: '100%',
    },
    topAccent: {
      width: 48,
      height: 4,
      borderRadius: Radius.full,
      marginBottom: Spacing.lg,
      alignSelf: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    iconEmoji: { fontSize: 26 },
    title: {
      ...Typography.h2,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    message: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
    },
    hint: {
      ...Typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.sm,
      lineHeight: 18,
    },
    countBadge: {
      alignSelf: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.surfaceHighlight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    countBadgeText: {
      ...Typography.caption,
      color: colors.text,
      fontWeight: '700',
      textAlign: 'center',
    },
    countBadgeSub: {
      ...Typography.small,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
    },
    optionsScroll: {
      maxHeight: 280,
      marginTop: Spacing.sm,
    },
    optionsContent: {
      gap: Spacing.sm,
      paddingBottom: Spacing.xs,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: Spacing.md,
      borderRadius: Radius.lg,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionPressed: { opacity: 0.88 },
    optionLeft: { flex: 1, marginRight: Spacing.sm },
    optionLabel: { ...Typography.bodyBold, color: colors.text },
    optionSub: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    deleteChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.danger + '22',
      borderWidth: 1,
      borderColor: colors.danger + '44',
    },
    deleteChipText: {
      ...Typography.caption,
      color: colors.danger,
      fontWeight: '700',
    },
    emptyOptions: {
      ...Typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      padding: Spacing.md,
      lineHeight: 20,
    },
    laterBtn: {
      marginTop: Spacing.md,
      padding: Spacing.sm,
      alignItems: 'center',
    },
    laterText: {
      ...Typography.bodyBold,
      color: colors.textSecondary,
    },
  });
}
