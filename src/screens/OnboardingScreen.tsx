import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { AddExpenseModal, ExpenseSaveData } from '../components/AddExpenseModal';
import { ExpenseCard } from '../components/ExpenseCard';
import { useExpenseStore } from '../store/expenseStore';
import { Expense } from '../types/expense';

const { width: SCREEN_W } = Dimensions.get('window');

interface OnboardingScreenProps {
  onDone: () => void;
}

type Step = 'welcome' | 'add' | 'swipe';

export function OnboardingScreen({ onDone }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('welcome');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addedExpense, setAddedExpense] = useState<Expense | null>(null);
  const addExpense = useExpenseStore(s => s.addExpense);

  // Swipe tutorial animation values
  const cardX = useSharedValue(0);
  const leftHintOpacity = useSharedValue(0);
  const rightHintOpacity = useSharedValue(0);
  const leftHintX = useSharedValue(-12);
  const rightHintX = useSharedValue(12);
  const swipeDemoRan = useRef(false);
  const userSwipedRef = useRef(false);         // user touched the card → stop auto-demo
  const swipeableRef = useRef<SwipeableMethods>(null);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ----- Handlers -----
  const handleSaveExpense = useCallback(
    async (data: ExpenseSaveData) => {
      const saved = await addExpense({ ...data, date: new Date().toISOString() });
      setAddedExpense(saved);
      setShowAddModal(false);
      setStep('swipe');
    },
    [addExpense],
  );

  const cancelDemo = useCallback(() => {
    demoTimers.current.forEach(clearTimeout);
    demoTimers.current = [];
    cancelAnimation(cardX);
    cancelAnimation(leftHintOpacity);
    cancelAnimation(leftHintX);
    cancelAnimation(rightHintOpacity);
    cancelAnimation(rightHintX);
    swipeDemoRan.current = false;
  }, [cardX, leftHintOpacity, leftHintX, rightHintOpacity, rightHintX]);

  const runSwipeDemoRef = useRef<() => void>(() => {});

  const runSwipeDemo = useCallback(() => {
    if (swipeDemoRan.current || userSwipedRef.current) return;
    swipeDemoRan.current = true;

    const addTimer = (fn: () => void, ms: number) => {
      const t = setTimeout(fn, ms);
      demoTimers.current.push(t);
    };

    // Phase 1 — slide right (reveal Edit)
    leftHintOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));
    leftHintX.value = withDelay(400, withSpring(0));
    cardX.value = withDelay(500, withTiming(96, { duration: 550, easing: Easing.out(Easing.cubic) }));

    // Phase 2 — snap back then slide left (reveal Delete)
    addTimer(() => {
      if (userSwipedRef.current) return;
      leftHintOpacity.value = withTiming(0, { duration: 200 });
      leftHintX.value = withTiming(-12, { duration: 200 });
      cardX.value = withTiming(0, { duration: 380, easing: Easing.inOut(Easing.cubic) });
    }, 1600);

    addTimer(() => {
      if (userSwipedRef.current) return;
      rightHintOpacity.value = withTiming(1, { duration: 300 });
      rightHintX.value = withSpring(0);
      cardX.value = withTiming(-96, { duration: 550, easing: Easing.out(Easing.cubic) });
    }, 2100);

    // Phase 3 — reset and loop
    addTimer(() => {
      if (userSwipedRef.current) return;
      rightHintOpacity.value = withTiming(0, { duration: 200 });
      rightHintX.value = withTiming(12, { duration: 200 });
      cardX.value = withTiming(0, { duration: 380, easing: Easing.inOut(Easing.cubic) });
      addTimer(() => {
        swipeDemoRan.current = false;
        if (!userSwipedRef.current) runSwipeDemoRef.current();
      }, 1000);
    }, 3500);
  }, [cardX, leftHintOpacity, leftHintX, rightHintOpacity, rightHintX]);

  runSwipeDemoRef.current = runSwipeDemo;

  // Auto-run swipe demo when step becomes 'swipe'
  React.useEffect(() => {
    if (step === 'swipe') {
      userSwipedRef.current = false;
      swipeDemoRan.current = false;
      const t = setTimeout(runSwipeDemo, 700);
      return () => {
        clearTimeout(t);
        cancelDemo();
      };
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animated styles
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardX.value }],
  }));

  const leftHintStyle = useAnimatedStyle(() => ({
    opacity: leftHintOpacity.value,
    transform: [{ translateX: leftHintX.value }],
  }));

  const rightHintStyle = useAnimatedStyle(() => ({
    opacity: rightHintOpacity.value,
    transform: [{ translateX: rightHintX.value }],
  }));

  // ----- Render steps -----
  const renderWelcome = () => (
    <Animated.View entering={FadeInDown.duration(400)} style={styles.stepWrap}>
      {/* Animated logo area */}
      <View style={styles.logoWrap}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoCircle}
        >
          <Text style={styles.logoEmoji}>💸</Text>
        </LinearGradient>
        <Text style={styles.logoLabel}>Expenso</Text>
      </View>

      <Text style={styles.stepTitle}>Track Your Expenses</Text>
      <Text style={styles.stepSubtitle}>
        Add expenses by typing, speaking, or picking — smart category detection included.
      </Text>

      {/* Feature pills */}
      <View style={styles.pills}>
        {[
          { emoji: '⚡', label: 'Quick add' },
          { emoji: '🎤', label: 'Voice entry' },
          { emoji: '📊', label: 'Smart insights' },
        ].map(p => (
          <View key={p.label} style={[styles.pill, { backgroundColor: colors.primary + '1A', borderColor: colors.primary + '40' }]}>
            <Text>{p.emoji}</Text>
            <Text style={[styles.pillText, { color: colors.primaryLight }]}>{p.label}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primaryBtn} onPress={() => setStep('add')}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryBtnGrad}
        >
          <Text style={styles.primaryBtnText}>Get Started →</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );

  const renderAdd = () => (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.stepWrap}>
      <View style={styles.stepIconWrap}>
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.stepIcon}>
          <Text style={styles.stepIconEmoji}>➕</Text>
        </LinearGradient>
      </View>
      <Text style={styles.stepTitle}>Add Your First Expense</Text>
      <Text style={styles.stepSubtitle}>
        Tap below and try typing something like{'\n'}
        <Text style={{ color: colors.primaryLight, fontWeight: '700' }}>"Swiggy 350"</Text>
        {' '}or{' '}
        <Text style={{ color: colors.primaryLight, fontWeight: '700' }}>"Blinkit 200"</Text>
        {'\n'}Expenso will auto-detect the merchant and category.
      </Text>

      <Pressable style={[styles.primaryBtn, { marginTop: Spacing.xl }]} onPress={() => setShowAddModal(true)}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryBtnGrad}
        >
          <Text style={styles.primaryBtnText}>+ Add Expense</Text>
        </LinearGradient>
      </Pressable>

      <Pressable style={styles.skipBtn} onPress={onDone}>
        <Text style={styles.skipText}>Skip tutorial</Text>
      </Pressable>
    </Animated.View>
  );

  const renderSwipe = () => (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.stepWrap}>
      <View style={styles.stepIconWrap}>
        <LinearGradient colors={['#6366F1', '#4338CA']} style={styles.stepIcon}>
          <Text style={styles.stepIconEmoji}>👆</Text>
        </LinearGradient>
      </View>
      <Text style={styles.stepTitle}>Swipe to Edit or Delete</Text>
      <Text style={styles.stepSubtitle}>
        Swipe an expense card{' '}
        <Text style={{ color: colors.primaryLight, fontWeight: '700' }}>right</Text>
        {' '}to edit,{' '}
        <Text style={{ color: colors.danger, fontWeight: '700' }}>left</Text>
        {' '}to delete.
      </Text>

      {/* Swipe demo area */}
      {addedExpense && (
        <View style={styles.demoWrap}>
          {/* Edit hint (left side, revealed when swiping right) */}
          <Animated.View style={[styles.swipeHint, styles.swipeHintLeft, leftHintStyle]}>
            <LinearGradient colors={['#6366F1', '#4338CA']} style={styles.swipeHintGrad}>
              <Text style={styles.swipeHintEmoji}>✏️</Text>
              <Text style={styles.swipeHintText}>Edit</Text>
            </LinearGradient>
          </Animated.View>

          {/* Delete hint (right side, revealed when swiping left) */}
          <Animated.View style={[styles.swipeHint, styles.swipeHintRight, rightHintStyle]}>
            <LinearGradient colors={['#F87171', '#E11D48']} style={styles.swipeHintGrad}>
              <Text style={styles.swipeHintEmoji}>🗑️</Text>
              <Text style={styles.swipeHintText}>Delete</Text>
            </LinearGradient>
          </Animated.View>

          {/*
           * Real Swipeable card — user can drag it.
           * When drag starts we cancel the auto-demo so it doesn't fight.
           * renderLeftActions / renderRightActions show the same colored panels.
           * No actual delete/edit fires (no onDelete/onEdit handlers passed).
           */}
          <Animated.View style={[styles.demoCard, cardAnimStyle]}>
            <Swipeable
              ref={swipeableRef}
              friction={2}
              overshootLeft={false}
              overshootRight={false}
              onSwipeableWillOpen={() => {
                // User started a real swipe — stop auto demo
                cancelDemo();
                userSwipedRef.current = true;
                // Reset auto-hint overlays (they're now underneath the real Swipeable panels)
                leftHintOpacity.value = withTiming(0, { duration: 150 });
                rightHintOpacity.value = withTiming(0, { duration: 150 });
                cardX.value = 0; // reset manual animation offset
              }}
              renderLeftActions={() => (
                <View style={[styles.swipeActionPanel, { backgroundColor: '#6366F1' }]}>
                  <Text style={styles.swipeHintEmoji}>✏️</Text>
                  <Text style={styles.swipeHintText}>Edit</Text>
                </View>
              )}
              renderRightActions={() => (
                <View style={[styles.swipeActionPanel, { backgroundColor: '#E11D48' }]}>
                  <Text style={styles.swipeHintEmoji}>🗑️</Text>
                  <Text style={styles.swipeHintText}>Delete</Text>
                </View>
              )}
            >
              <ExpenseCard expense={addedExpense} index={0} />
            </Swipeable>
          </Animated.View>
        </View>
      )}

      {/* Swipe arrow indicators */}
      <View style={styles.arrowRow}>
        <Animated.View entering={FadeIn.delay(800).duration(400)} style={styles.arrowChip}>
          <Text style={[styles.arrowText, { color: colors.primaryLight }]}>← Swipe right  ✏️ Edit</Text>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(1000).duration(400)} style={styles.arrowChip}>
          <Text style={[styles.arrowText, { color: colors.danger }]}>Delete 🗑️  Swipe left →</Text>
        </Animated.View>
      </View>

      <Pressable style={[styles.primaryBtn, { marginTop: Spacing.lg }]} onPress={onDone}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.primaryBtnGrad}
        >
          <Text style={styles.primaryBtnText}>Start Using Expenso 🚀</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );

  // Step dots
  const STEPS: Step[] = ['welcome', 'add', 'swipe'];
  const stepIdx = STEPS.indexOf(step);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={[colors.primary + '14', colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Step dots */}
      <View style={styles.dots}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[
              styles.dot,
              {
                backgroundColor: i === stepIdx ? colors.primary : colors.border,
                width: i === stepIdx ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.content}>
        {step === 'welcome' && renderWelcome()}
        {step === 'add' && renderAdd()}
        {step === 'swipe' && renderSwipe()}
      </View>

      <AddExpenseModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveExpense}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.sm,
    },
    dot: {
      height: 8,
      borderRadius: Radius.full,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    stepWrap: {
      alignItems: 'center',
    },
    logoWrap: {
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    logoCircle: {
      width: 96,
      height: 96,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 14,
    },
    logoEmoji: { fontSize: 44 },
    logoLabel: {
      ...Typography.h2,
      color: colors.text,
      marginTop: Spacing.md,
      letterSpacing: -0.5,
    },
    stepIconWrap: { marginBottom: Spacing.lg },
    stepIcon: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 12,
    },
    stepIconEmoji: { fontSize: 36 },
    stepTitle: {
      ...Typography.h1,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    stepSubtitle: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      paddingHorizontal: Spacing.sm,
    },
    pills: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    pillText: { ...Typography.caption, fontWeight: '700' },
    primaryBtn: {
      width: '100%',
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginTop: Spacing.xl,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
    primaryBtnGrad: {
      paddingVertical: Spacing.md + 2,
      alignItems: 'center',
    },
    primaryBtnText: {
      ...Typography.bodyBold,
      color: '#FFF',
      fontSize: 17,
    },
    skipBtn: {
      marginTop: Spacing.lg,
      padding: Spacing.sm,
    },
    skipText: {
      ...Typography.caption,
      color: colors.textMuted,
    },
    // Swipe demo
    demoWrap: {
      width: '100%',
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
      position: 'relative',
      overflow: 'visible',
    },
    demoCard: {
      zIndex: 2,
    },
    swipeHint: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 84,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      zIndex: 1,
      justifyContent: 'center',
    },
    swipeHintLeft: {
      left: 0,
    },
    swipeHintRight: {
      right: 0,
    },
    swipeHintGrad: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    swipeHintEmoji: { fontSize: 20 },
    swipeHintText: {
      ...Typography.small,
      color: '#FFF',
      fontWeight: '700',
    },
    swipeActionPanel: {
      width: 84,
      borderRadius: Radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      marginBottom: Spacing.sm,
    },
    arrowRow: {
      width: '100%',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    arrowChip: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    arrowText: {
      ...Typography.caption,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
}
