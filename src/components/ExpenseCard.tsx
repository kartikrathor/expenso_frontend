import React, { memo, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Swipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Expense } from '../types/expense';
import { MerchantIcon } from './MerchantIcon';
import { CategoryIcon, CategoryGlyph } from './CategoryIcon';
import { getCategoryConfig } from '../constants/categories';
import { formatCurrency } from '../utils/expenseParser';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { format, parseISO } from 'date-fns';
import { useCategoryStore } from '../store/categoryStore';
import { useSwipeEnabledSV } from '../hooks/useSwipeScrollLock';
import { SpiderWebBackground } from './SpiderWebBackground';
import { BlackSpiderMark, pickSpiderByIndex } from './BlackSpiderMark';
import { useThemeStore } from '../store/themeStore';

/** Approximate row height (card + margin) — useful for FlatList tuning. */
export const EXPENSE_CARD_ROW_HEIGHT = 90;

interface ExpenseCardProps {
  expense: Expense;
  index?: number;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  /** When true, show only time (use under a day section heading). */
  timeOnly?: boolean;
  /** Subtle spider-web corner (Log page / Red Web Spider theme only). */
  webAccent?: boolean;
}

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

export const ExpenseCard = memo(function ExpenseCard({
  expense,
  index = 0,
  onDelete,
  onEdit,
  timeOnly,
  webAccent,
}: ExpenseCardProps) {
  const { colors, isDark } = useTheme();
  const packId = useThemeStore(s => s.packId);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const swipeableRef = useRef<SwipeableMethods>(null);
  const swipeEnabled = useSwipeEnabledSV();
  const getCat = useCategoryStore(s => s.getConfig);
  const category = getCat(expense.category) || getCategoryConfig(expense.category);
  const showCategoryAvatar = !expense.merchant || expense.merchant === 'default';
  const showSpider =
    packId === 'red_web_spider' && pickSpiderByIndex(index, 3);
  // Soft corner webs on spider cards (Home) and explicit webAccent (Log/History)
  const showWeb =
    packId === 'red_web_spider' && (!!webAccent || showSpider);
  const webVariant = index % 2 === 0 ? 'logSoft' : 'logSoftAlt';

  const dateLabel = useMemo(() => {
    try {
      const formatted = format(
        parseISO(expense.date),
        timeOnly ? 'hh:mm a' : 'dd MMM, hh:mm a',
      );
      return expense.inputMethod === 'voice' ? `${formatted}  🎤` : formatted;
    } catch {
      return '';
    }
  }, [expense.date, expense.inputMethod, timeOnly]);

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
        ? (['#FB7185', '#E11D48'] as const)
        : (['#F87171', '#DC2626'] as const),
    [isDark],
  );

  const renderRightActions = useCallback(
    () => (
      <Pressable style={styles.deleteWrap} onPress={handleDeletePress}>
        <LinearGradient
          colors={[...deleteGradient]}
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
      enabled={swipeEnabled ?? true}
      renderRightActions={onDelete ? renderRightActions : undefined}
      renderLeftActions={onEdit ? renderLeftActions : undefined}
      overshootRight={false}
      overshootLeft={false}
      friction={2.4}
      dragOffsetFromLeft={28}
      dragOffsetFromRight={-28}
    >
      <Pressable
        style={styles.card}
        onLongPress={onDelete ? handleDeletePress : undefined}
        delayLongPress={400}
      >
        {showWeb ? (
          <SpiderWebBackground variant={webVariant} opacity={0.26} />
        ) : null}
        {showSpider ? (
          <BlackSpiderMark
            size={28}
            style={
              index % 2 === 1
                ? { bottom: 4, right: 8 }
                : { top: 4, right: 8 }
            }
          />
        ) : null}
        <View style={[styles.iconRing, { borderColor: category.color + '44' }]}>
          {showCategoryAvatar ? (
            <CategoryIcon categoryId={expense.category} size={46} />
          ) : (
            <MerchantIcon merchantId={expense.merchant} size={46} />
          )}
        </View>
        <View style={styles.content}>
          <View style={styles.row}>
            <Text style={styles.merchant} numberOfLines={1}>{expense.merchantLabel}</Text>
            <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.categoryBadge, { backgroundColor: category.color + '18' }]}>
              <CategoryGlyph categoryId={expense.category} size={13} color={category.color} />
              <Text style={[styles.categoryText, { color: category.color }]}>{category.label}</Text>
            </View>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
});

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: Spacing.md,
      marginBottom: Spacing.sm,
      minHeight: EXPENSE_CARD_ROW_HEIGHT - Spacing.sm,
      overflow: 'hidden',
      position: 'relative',
    },
    iconRing: { borderRadius: Radius.md, borderWidth: 1.5, padding: 2, zIndex: 1 },
    content: { flex: 1, zIndex: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    merchant: { ...Typography.bodyBold, color: colors.text, flex: 1, marginRight: Spacing.sm },
    amount: { ...Typography.bodyBold, color: colors.text, fontSize: 17 },
    categoryBadge: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm,
      paddingVertical: 3, borderRadius: Radius.full, gap: 5,
    },
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
