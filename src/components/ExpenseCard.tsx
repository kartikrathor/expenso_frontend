import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Expense } from '../types/expense';
import { MerchantIcon } from './MerchantIcon';
import { getCategoryConfig } from '../constants/categories';
import { formatCurrency } from '../utils/expenseParser';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { format, parseISO } from 'date-fns';

interface ExpenseCardProps {
  expense: Expense;
  index: number;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function EditIcon({ size = 20, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ size = 22, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 6v13.5A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5V6"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 11v5M14 11v5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ExpenseCard({ expense, index, onDelete, onEdit }: ExpenseCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useSharedValue(1);
  const swipeableRef = useRef<SwipeableMethods>(null);
  const category = getCategoryConfig(expense.category);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleDeletePress = useCallback(() => {
    swipeableRef.current?.close();
    requestAnimationFrame(() => {
      onDelete?.(expense.id);
    });
  }, [expense.id, onDelete]);

  const handleEditPress = useCallback(() => {
    swipeableRef.current?.close();
    requestAnimationFrame(() => {
      onEdit?.(expense.id);
    });
  }, [expense.id, onEdit]);

  const deleteGradient = useMemo(
    () =>
      isDark
        ? ['#FB7185', '#E11D48']
        : ['#F87171', '#DC2626'],
    [isDark],
  );

  const renderRightActions = useCallback(
    () => (
      <Pressable style={styles.deleteWrap} onPress={handleDeletePress}>
        <LinearGradient
          colors={deleteGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.deleteAction}
        >
          <View style={styles.deleteIconRing}>
            <TrashIcon size={20} color="#FFF" />
          </View>
          <Text style={styles.deleteLabel}>Delete</Text>
        </LinearGradient>
      </Pressable>
    ),
    [handleDeletePress, styles, deleteGradient],
  );

  const renderLeftActions = useCallback(
    () => (
      <Pressable style={styles.editWrap} onPress={handleEditPress}>
        <LinearGradient
          colors={['#6366F1', '#4338CA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.editAction}
        >
          <View style={styles.editIconRing}>
            <EditIcon size={20} color="#FFF" />
          </View>
          <Text style={styles.editLabel}>Edit</Text>
        </LinearGradient>
      </Pressable>
    ),
    [handleEditPress, styles],
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={onDelete ? renderRightActions : undefined}
      renderLeftActions={onEdit ? renderLeftActions : undefined}
      overshootRight={false}
      overshootLeft={false}
      friction={2}
    >
      <Animated.View
        entering={FadeInDown.delay(Math.min(index * 30, 180)).duration(220)}
        exiting={FadeOut.duration(160)}
        layout={LinearTransition.duration(200)}
        style={styles.cardWrapper}
      >
        <AnimatedPressable
          style={[styles.card, animatedStyle]}
          onPressIn={() => { scale.value = withSpring(0.98); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onLongPress={onDelete ? handleDeletePress : undefined}
          delayLongPress={400}
        >
          <View style={[styles.iconRing, { borderColor: category.color + '44' }]}>
            <MerchantIcon merchantId={expense.merchant} size={46} />
          </View>
          <View style={styles.content}>
            <View style={styles.row}>
              <Text style={styles.merchant} numberOfLines={1}>{expense.merchantLabel}</Text>
              <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
            </View>
            <View style={styles.row}>
              <View style={[styles.categoryBadge, { backgroundColor: category.color + '18' }]}>
                <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                <Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text>
              </View>
              <Text style={styles.date}>
                {format(parseISO(expense.date), 'dd MMM, hh:mm a')}
                {expense.inputMethod === 'voice' ? '  🎤' : ''}
              </Text>
            </View>
          </View>
        </AnimatedPressable>
      </Animated.View>
    </Swipeable>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    cardWrapper: { marginBottom: Spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.md,
    },
    iconRing: { borderRadius: Radius.md, borderWidth: 1.5, padding: 2 },
    content: { flex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    merchant: { ...Typography.bodyBold, color: colors.text, flex: 1, marginRight: Spacing.sm },
    amount: { ...Typography.bodyBold, color: colors.text, fontSize: 17 },
    categoryBadge: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm,
      paddingVertical: 3, borderRadius: Radius.full, gap: 4,
    },
    categoryEmoji: { fontSize: 12 },
    categoryText: { ...Typography.small, fontWeight: '600' },
    date: { ...Typography.small, color: colors.textMuted },
    deleteWrap: {
      marginBottom: Spacing.sm,
      marginLeft: Spacing.sm,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      shadowColor: '#E11D48',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 4,
    },
    deleteAction: {
      width: 84,
      minHeight: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      gap: 6,
    },
    deleteIconRing: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteLabel: {
      ...Typography.small,
      color: '#FFF',
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    editWrap: {
      marginBottom: Spacing.sm,
      marginRight: Spacing.sm,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 4,
    },
    editAction: {
      width: 84,
      minHeight: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      gap: 6,
    },
    editIconRing: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    editLabel: {
      ...Typography.small,
      color: '#FFF',
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
}
