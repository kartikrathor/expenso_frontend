import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import Animated, { Easing, SlideInDown, FadeIn } from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Expense, CategoryId, MerchantId } from '../types/expense';
import { DEFAULT_MERCHANT, getMerchantConfig } from '../constants/merchants';
import { CATEGORIES, getCategoryConfig } from '../constants/categories';
import { useCategoryStore } from '../store/categoryStore';
import { useMerchantStore } from '../store/merchantStore';
import { MerchantIcon } from './MerchantIcon';
import { CategoryGlyph, CategoryIcon } from './CategoryIcon';
import { ExpenseDatePicker } from './ExpenseDatePicker';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency } from '../utils/expenseParser';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

interface EditExpenseModalProps {
  visible: boolean;
  expense: Expense | null;
  onClose: () => void;
  onSave: (id: string, changes: {
    amount: number;
    merchantLabel: string;
    merchant: MerchantId;
    category: CategoryId;
    note: string;
    date: string;
  }) => Promise<void> | void;
}

export function EditExpenseModal({ visible, expense, onClose, onSave }: EditExpenseModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const merchantOptions = useMerchantStore(s => s.all);
  const categoryOptions = useCategoryStore(s => (s.all.length ? s.all : CATEGORIES));
  const loadCategories = useCategoryStore(s => s.loadCategories);

  const [amount, setAmount] = useState('');
  const [merchantLabel, setMerchantLabel] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantId>('default');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('other');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Populate fields when expense changes
  useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount));
      setMerchantLabel(expense.merchantLabel);
      setSelectedMerchant(expense.merchant);
      setSelectedCategory(expense.category);
      setNote(expense.note ?? '');
      setExpenseDate(expense.date || new Date().toISOString());
      setSaving(false);
      loadCategories();
    }
  }, [expense, loadCategories]);

  useEffect(() => {
    if (!visible) Keyboard.dismiss();
  }, [visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number } }) => setKeyboardHeight(e.endCoordinates.height);
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, []);

  const handleSave = useCallback(async () => {
    if (!expense || saving) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    setSaving(true);
    Keyboard.dismiss();
    try {
      await onSave(expense.id, {
        amount: numAmount,
        merchantLabel: merchantLabel.trim() || getMerchantConfig(selectedMerchant).label,
        merchant: selectedMerchant,
        category: selectedCategory,
        note: note.trim(),
        date: expenseDate,
      });
      ReactNativeHapticFeedback.trigger('notificationSuccess', { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
      onClose();
    } catch {
      setSaving(false);
    }
  }, [expense, saving, amount, merchantLabel, selectedMerchant, selectedCategory, note, expenseDate, onSave, onClose]);

  const sheetPaddingBottom = Math.max(
    keyboardHeight > 0 ? keyboardHeight - insets.bottom + Spacing.sm : insets.bottom + Spacing.lg,
    Spacing.lg,
  );

  const cat = getCategoryConfig(selectedCategory);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <Animated.View
            entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
            style={[styles.sheet, { paddingBottom: sheetPaddingBottom }]}
          >
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Edit Expense</Text>
                <Text style={styles.subtitle}>Update the details below</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {/* Current expense preview pill */}
            {expense && (
              <Animated.View entering={FadeIn.duration(180)} style={styles.previewPill}>
                {expense.merchant === 'default' ? (
                  <CategoryIcon categoryId={selectedCategory} size={36} />
                ) : (
                  <MerchantIcon merchantId={expense.merchant} size={36} />
                )}
                <View style={styles.previewText}>
                  <Text style={styles.previewAmount}>{formatCurrency(expense.amount)}</Text>
                  <Text style={styles.previewMerchant} numberOfLines={1}>{expense.merchantLabel}</Text>
                </View>
                  <View style={[styles.previewBadge, { backgroundColor: cat.color + '22' }]}>
                    <CategoryGlyph categoryId={selectedCategory} size={13} color={cat.color} />
                    <Text style={[styles.previewBadgeText, { color: cat.color }]}>{cat.label}</Text>
                  </View>
              </Animated.View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Amount */}
              <Text style={styles.label}>Amount (₹)</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                selectTextOnFocus
              />

              {/* Merchant name */}
              <Text style={styles.label}>Merchant / Label</Text>
              <TextInput
                style={styles.input}
                value={merchantLabel}
                onChangeText={setMerchantLabel}
                placeholder="e.g. Blinkit"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
              />

              {/* Note */}
              <Text style={styles.label}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Add a note..."
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
              />

              {/* Date */}
              <ExpenseDatePicker valueIso={expenseDate} onChange={setExpenseDate} label="Date" />

              {/* Merchant picker */}
              <Text style={styles.label}>Merchant Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.merchantRow}>
                {[DEFAULT_MERCHANT, ...merchantOptions].map(m => (
                  <Pressable
                    key={m.id}
                    style={[styles.merchantChip, selectedMerchant === m.id && styles.merchantChipActive]}
                    onPress={() => {
                      setSelectedMerchant(m.id);
                      if (m.id !== 'default') setSelectedCategory(m.category);
                    }}
                  >
                    <MerchantIcon merchantId={m.id} size={32} />
                    <Text style={[styles.merchantChipText, selectedMerchant === m.id && styles.merchantChipTextActive]}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Category picker */}
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryGrid}>
                {categoryOptions.map(c => (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.categoryChip,
                      selectedCategory === c.id && { borderColor: c.color, backgroundColor: c.color + '22' },
                    ]}
                    onPress={() => setSelectedCategory(c.id)}
                  >
                    <CategoryGlyph categoryId={c.id} size={16} color={selectedCategory === c.id ? c.color : undefined} />
                    <Text style={[styles.categoryChipText, selectedCategory === c.id && { color: c.color, fontWeight: '700' }]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Save button */}
              <Pressable
                style={[styles.saveBtn, (!amount || saving) && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!amount || saving}
              >
                <LinearGradient
                  colors={[colors.gradientStart, colors.gradientEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGrad}
                >
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill },
    keyboardWrap: { justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      maxHeight: '92%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    scrollContent: { paddingBottom: Spacing.sm },
    handle: {
      width: 40, height: 4, backgroundColor: colors.border,
      borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'flex-start', marginBottom: Spacing.md,
    },
    title: { ...Typography.h2, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textSecondary, marginTop: 4 },
    closeBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: colors.surfaceHighlight, borderWidth: 1,
      borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    closeText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    previewPill: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: colors.surfaceElevated, borderRadius: Radius.lg,
      padding: Spacing.md, marginBottom: Spacing.md,
      borderWidth: 1, borderColor: colors.border,
    },
    previewText: { flex: 1 },
    previewAmount: { ...Typography.h3, color: colors.text },
    previewMerchant: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    previewBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.sm, paddingVertical: 4,
      borderRadius: Radius.full,
    },
    previewBadgeEmoji: { fontSize: 12 },
    previewBadgeText: { ...Typography.small, fontWeight: '700' },
    label: {
      ...Typography.caption, color: colors.textSecondary,
      marginBottom: Spacing.xs, marginTop: Spacing.sm,
      fontWeight: '600', letterSpacing: 0.3,
    },
    input: {
      backgroundColor: colors.surfaceElevated, borderRadius: Radius.lg,
      padding: Spacing.md, color: colors.text, borderWidth: 1,
      borderColor: colors.border, fontSize: 16,
    },
    merchantRow: { marginVertical: Spacing.xs },
    merchantChip: {
      alignItems: 'center', marginRight: Spacing.sm,
      padding: Spacing.sm, borderRadius: Radius.md,
      borderWidth: 1, borderColor: colors.border,
      width: 72, backgroundColor: colors.surfaceElevated,
    },
    merchantChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
    merchantChipText: { ...Typography.small, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
    merchantChipTextActive: { color: colors.primaryLight, fontWeight: '700' },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginVertical: Spacing.sm },
    categoryChip: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 2,
      borderRadius: Radius.full, borderWidth: 1,
      borderColor: colors.border, gap: 4,
      backgroundColor: colors.surfaceElevated,
    },
    categoryChipText: { ...Typography.small, color: colors.textSecondary },
    saveBtn: {
      borderRadius: Radius.lg, overflow: 'hidden',
      marginTop: Spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
    },
    saveBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
    saveBtnGrad: { paddingVertical: Spacing.md + 2, alignItems: 'center' },
    saveBtnText: { ...Typography.bodyBold, color: '#FFF', fontSize: 16 },
  });
}
