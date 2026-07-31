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
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryId, MerchantId } from '../types/expense';
import { MERCHANTS, DEFAULT_MERCHANT, getMerchantConfig } from '../constants/merchants';
import { CATEGORIES, getCategoryConfig } from '../constants/categories';
import { MerchantIcon } from './MerchantIcon';
import { VoiceButton } from './VoiceButton';
import { parseExpenseText } from '../utils/expenseParser';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAppAlert } from './AppAlert';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

export interface ExpenseSaveData {
  amount: number;
  merchant: MerchantId;
  merchantLabel: string;
  category: CategoryId;
  note: string;
  inputMethod: 'voice' | 'manual';
}

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: ExpenseSaveData) => Promise<void> | void;
}

type Tab = 'quick' | 'voice' | 'manual';
type Step = 'input' | 'confirm';

export function AddExpenseModal({ visible, onClose, onSave }: AddExpenseModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { show: showAlert, alertNode } = useAppAlert();
  const [tab, setTab] = useState<Tab>('quick');
  const [step, setStep] = useState<Step>('input');
  const [smartInput, setSmartInput] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantId>('default');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('other');
  const [parsed, setParsed] = useState<ReturnType<typeof parseExpenseText> | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveScale = useSharedValue(1);

  const reset = useCallback(() => {
    setTab('quick');
    setStep('input');
    setSmartInput('');
    setAmount('');
    setNote('');
    setSelectedMerchant('default');
    setSelectedCategory('other');
    setParsed(null);
    setSaving(false);
  }, []);

  useEffect(() => {
    if (!visible) {
      reset();
      Keyboard.dismiss();
    }
  }, [visible, reset]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: { endCoordinates: { height: number } }) => {
      setKeyboardHeight(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardHeight(0);

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const goToConfirm = useCallback((data: ReturnType<typeof parseExpenseText>) => {
    if (!data.amount || data.amount <= 0) return;
    Keyboard.dismiss();
    setParsed(data);
    setStep('confirm');
    ReactNativeHapticFeedback.trigger('impactLight');
  }, []);

  const handleSmartInputChange = (text: string) => {
    setSmartInput(text);
    const result = parseExpenseText(text);
    if (result.merchant !== 'default') {
      setSelectedMerchant(result.merchant);
      setSelectedCategory(result.category);
    }
    if (result.amount) setAmount(String(result.amount));
  };

  const handleSmartSubmit = () => {
    const result = parseExpenseText(smartInput);
    if (result.amount) {
      goToConfirm(result);
    } else if (amount) {
      goToConfirm(parseExpenseText(`${smartInput} ${amount}`.trim()));
    } else {
      showAlert('Amount Required', 'Please enter an amount, e.g. "Blinkit 200"', undefined, '⚠️');
    }
  };

  const handleVoiceResult = (text: string) => {
    const result = parseExpenseText(text);
    if (result.amount) {
      goToConfirm({ ...result, note: text });
    } else {
      setTab('manual');
      setNote(text);
      setSmartInput(text);
    }
  };

  const handleManualSave = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;
    const merchantConfig = getMerchantConfig(selectedMerchant);
    goToConfirm({
      amount: numAmount,
      merchant: selectedMerchant,
      merchantLabel:
        selectedMerchant === 'default' && note ? note.slice(0, 30) : merchantConfig.label,
      category: selectedCategory,
      note: note || smartInput,
    });
  };

  const confirmSave = async () => {
    if (!parsed?.amount || saving) return;
    setSaving(true);
    try {
      await onSave({
        amount: parsed.amount,
        merchant: parsed.merchant,
        merchantLabel: parsed.merchantLabel,
        category: parsed.category,
        note: parsed.note,
        inputMethod: tab === 'voice' ? 'voice' : 'manual',
      });
      ReactNativeHapticFeedback.trigger('impactMedium');
      onClose();
    } catch (err) {
      showAlert('Save Failed', 'Could not save the expense. Please try again.', undefined, '❌');
      console.error('Save expense error:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const sheetPaddingBottom = Math.max(
    keyboardHeight > 0 ? keyboardHeight - insets.bottom + Spacing.sm : insets.bottom + Spacing.lg,
    Spacing.lg,
  );

  const renderConfirm = () => {
    if (!parsed) return null;
    const cat = getCategoryConfig(parsed.category);
    return (
      <Animated.View entering={FadeIn.duration(180)} style={styles.confirmWrap}>
        <LinearGradient
          colors={[colors.gradientStart + '33', colors.surface]}
          style={styles.confirmGlow}
        >
          <View style={styles.confirmIcon}>
            <MerchantIcon merchantId={parsed.merchant} size={68} />
          </View>
          <Text style={styles.confirmAmount}>₹{(parsed.amount ?? 0).toLocaleString('en-IN')}</Text>
          <Text style={styles.confirmMerchant}>{parsed.merchantLabel}</Text>
          <View style={[styles.confirmBadge, { backgroundColor: cat.color + '22' }]}>
            <Text>{cat.emoji}</Text>
            <Text style={[styles.confirmBadgeText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          {parsed.note ? <Text style={styles.confirmNote}>"{parsed.note}"</Text> : null}
        </LinearGradient>

        <Pressable style={styles.confirmBtn} onPress={confirmSave} disabled={saving}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.confirmBtnGrad}
          >
            <Text style={styles.confirmBtnText}>
              {saving ? 'Saving...' : 'Confirm & Save'}
            </Text>
          </LinearGradient>
        </Pressable>
        <Pressable style={styles.backBtn} onPress={() => setStep('input')}>
          <Text style={styles.backBtnText}>← Edit details</Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {alertNode}
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
              <View style={styles.headerText}>
                <Text style={styles.title}>
                  {step === 'confirm' ? 'Confirm' : 'Add Expense'}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 'confirm'
                    ? 'Review the details and save'
                    : 'Type, speak, or pick — smart detect'}
                </Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              bounces={false}
              contentContainerStyle={styles.scrollContent}
            >
              {step === 'confirm' ? (
                renderConfirm()
              ) : (
                <>
                  <View style={styles.tabs}>
                    {([
                      ['quick', '⚡', 'Quick'],
                      ['voice', '🎤', 'Voice'],
                      ['manual', '✏️', 'Detail'],
                    ] as [Tab, string, string][]).map(([t, emoji, label]) => {
                      const active = tab === t;
                      return (
                        <Pressable
                          key={t}
                          style={styles.tab}
                          onPress={() => {
                            Keyboard.dismiss();
                            setTab(t);
                          }}
                        >
                          {active ? (
                            <LinearGradient
                              colors={[colors.gradientStart, colors.gradientEnd]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.tabActiveGrad}
                            >
                              <Text style={styles.tabEmoji}>{emoji}</Text>
                              <Text style={styles.tabTextActive}>{label}</Text>
                            </LinearGradient>
                          ) : (
                            <View style={styles.tabIdle}>
                              <Text style={styles.tabEmoji}>{emoji}</Text>
                              <Text style={styles.tabText}>{label}</Text>
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  {tab === 'quick' && (
                    <Animated.View entering={FadeInDown.duration(200)}>
                      <Text style={styles.label}>Smart Input</Text>
                      <View style={styles.smartInputWrap}>
                        <TextInput
                          style={styles.smartInput}
                          value={smartInput}
                          onChangeText={handleSmartInputChange}
                          placeholder='e.g. "Blinkit 200" or "Swiggy 350"'
                          placeholderTextColor={colors.textMuted}
                          returnKeyType="done"
                          blurOnSubmit={false}
                          onSubmitEditing={handleSmartSubmit}
                        />
                      </View>

                      <Text style={styles.label}>Quick amounts</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.quickRow}
                        keyboardShouldPersistTaps="handled"
                      >
                        {QUICK_AMOUNTS.map(a => {
                          const active = amount === String(a);
                          return (
                            <Pressable
                              key={a}
                              onPress={() => {
                                setAmount(String(a));
                                setSmartInput(prev => {
                                  const base = prev.replace(/\d+/g, '').trim();
                                  return `${base} ${a}`.trim();
                                });
                              }}
                            >
                              {active ? (
                                <LinearGradient
                                  colors={[colors.gradientStart, colors.gradientEnd]}
                                  style={styles.quickChipActive}
                                >
                                  <Text style={styles.quickChipTextOn}>₹{a}</Text>
                                </LinearGradient>
                              ) : (
                                <View style={styles.quickChip}>
                                  <Text style={styles.quickChipText}>₹{a}</Text>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>

                      {(selectedMerchant !== 'default' || amount) && (
                        <Animated.View entering={FadeIn} style={styles.livePreview}>
                          {selectedMerchant !== 'default' && (
                            <MerchantIcon merchantId={selectedMerchant} size={36} />
                          )}
                          <View style={styles.livePreviewTextWrap}>
                            <Text style={styles.livePreviewAmount}>
                              {amount ? `₹${Number(amount).toLocaleString('en-IN')}` : '—'}
                            </Text>
                            <Text style={styles.livePreviewMerchant}>
                              {getMerchantConfig(selectedMerchant).label}
                            </Text>
                          </View>
                        </Animated.View>
                      )}

                      <Animated.View style={saveAnimStyle}>
                        <Pressable
                          style={[styles.saveBtn, !smartInput && !amount && styles.saveBtnDisabled]}
                          onPress={handleSmartSubmit}
                          onPressIn={() => { saveScale.value = withSpring(0.96); }}
                          onPressOut={() => { saveScale.value = withSpring(1); }}
                          disabled={!smartInput && !amount}
                        >
                          <LinearGradient
                            colors={[colors.gradientStart, colors.gradientEnd]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.saveBtnGrad}
                          >
                            <Text style={styles.saveBtnText}>Continue →</Text>
                          </LinearGradient>
                        </Pressable>
                      </Animated.View>
                    </Animated.View>
                  )}

                  {tab === 'voice' && <VoiceButton onResult={handleVoiceResult} />}

                  {tab === 'manual' && (
                    <Animated.View entering={FadeInDown.duration(200)} style={styles.manualForm}>
                      <Text style={styles.label}>Amount (₹)</Text>
                      <TextInput
                        style={styles.input}
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="numeric"
                        placeholder="200"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="next"
                      />
                      <Text style={styles.label}>Note / Merchant</Text>
                      <TextInput
                        style={styles.input}
                        value={note}
                        onChangeText={text => {
                          setNote(text);
                          const r = parseExpenseText(text);
                          if (r.merchant !== 'default') {
                            setSelectedMerchant(r.merchant);
                            setSelectedCategory(r.category);
                          }
                        }}
                        placeholder="Blinkit groceries"
                        placeholderTextColor={colors.textMuted}
                        returnKeyType="done"
                        onSubmitEditing={handleManualSave}
                      />
                      <Text style={styles.label}>Merchant</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {[DEFAULT_MERCHANT, ...MERCHANTS].map(m => (
                          <Pressable
                            key={m.id}
                            style={[styles.merchantChip, selectedMerchant === m.id && styles.merchantChipActive]}
                            onPress={() => {
                              setSelectedMerchant(m.id);
                              setSelectedCategory(m.category);
                            }}
                          >
                            <MerchantIcon merchantId={m.id} size={32} />
                            <Text style={[styles.merchantChipText, selectedMerchant === m.id && styles.merchantChipTextActive]}>
                              {m.label}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <Text style={styles.label}>Category</Text>
                      <View style={styles.categoryGrid}>
                        {CATEGORIES.map(c => (
                          <Pressable
                            key={c.id}
                            style={[styles.categoryChip, selectedCategory === c.id && { borderColor: c.color, backgroundColor: c.color + '22' }]}
                            onPress={() => setSelectedCategory(c.id)}
                          >
                            <Text>{c.emoji}</Text>
                            <Text style={[styles.categoryChipText, selectedCategory === c.id && { color: c.color }]}>
                              {c.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        style={[styles.saveBtn, !amount && styles.saveBtnDisabled]}
                        onPress={handleManualSave}
                        disabled={!amount}
                      >
                        <LinearGradient
                          colors={[colors.gradientStart, colors.gradientEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.saveBtnGrad}
                        >
                          <Text style={styles.saveBtnText}>Continue →</Text>
                        </LinearGradient>
                      </Pressable>
                    </Animated.View>
                  )}
                </>
              )}
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
      maxHeight: '90%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    scrollContent: { paddingBottom: Spacing.sm },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: Spacing.md,
      gap: Spacing.md,
    },
    headerText: { flex: 1 },
    title: { ...Typography.h2, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textSecondary, marginTop: 4 },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceHighlight,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: { color: colors.textSecondary, fontSize: 14, fontWeight: '700' },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      padding: 4,
      marginBottom: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    tab: { flex: 1 },
    tabIdle: {
      paddingVertical: 10,
      borderRadius: Radius.md,
      alignItems: 'center',
      gap: 2,
    },
    tabActiveGrad: {
      paddingVertical: 10,
      borderRadius: Radius.md,
      alignItems: 'center',
      gap: 2,
    },
    tabEmoji: { fontSize: 14 },
    tabText: { ...Typography.small, color: colors.textSecondary, fontWeight: '600' },
    tabTextActive: { ...Typography.small, color: '#FFF', fontWeight: '700' },
    label: {
      ...Typography.caption,
      color: colors.textSecondary,
      marginBottom: Spacing.xs,
      marginTop: Spacing.sm,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    smartInputWrap: {
      borderRadius: Radius.lg,
      borderWidth: 1.5,
      borderColor: colors.primary + '55',
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    smartInput: {
      padding: Spacing.lg,
      color: colors.text,
      ...Typography.body,
      fontSize: 17,
    },
    quickRow: { marginTop: Spacing.xs, marginBottom: Spacing.sm },
    quickChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.surfaceHighlight,
      marginRight: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickChipActive: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      marginRight: Spacing.sm,
    },
    quickChipText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
    quickChipTextOn: { ...Typography.caption, color: '#FFF', fontWeight: '700' },
    livePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.primary + '14',
      padding: Spacing.md,
      borderRadius: Radius.lg,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.primary + '33',
    },
    livePreviewTextWrap: { flex: 1 },
    livePreviewAmount: { ...Typography.h3, color: colors.text },
    livePreviewMerchant: { ...Typography.caption, color: colors.primaryLight, marginTop: 2 },
    manualForm: {},
    input: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.xs,
      fontSize: 16,
    },
    merchantChip: {
      alignItems: 'center',
      marginRight: Spacing.sm,
      padding: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      width: 72,
      backgroundColor: colors.surfaceElevated,
    },
    merchantChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '18',
    },
    merchantChipText: {
      ...Typography.small,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center',
    },
    merchantChipTextActive: { color: colors.primaryLight, fontWeight: '700' },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginVertical: Spacing.sm,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs + 2,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
      backgroundColor: colors.surfaceElevated,
    },
    categoryChipText: { ...Typography.small, color: colors.textSecondary },
    saveBtn: {
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginTop: Spacing.lg,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 6,
    },
    saveBtnDisabled: { opacity: 0.35, shadowOpacity: 0 },
    saveBtnGrad: { paddingVertical: Spacing.md + 2, alignItems: 'center' },
    saveBtnText: { ...Typography.bodyBold, color: '#FFF', fontSize: 16 },
    confirmWrap: { alignItems: 'center', paddingVertical: Spacing.sm },
    confirmGlow: {
      width: '100%',
      alignItems: 'center',
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.md,
    },
    confirmIcon: { marginBottom: Spacing.md },
    confirmAmount: {
      fontSize: 44,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -1,
    },
    confirmMerchant: { ...Typography.h3, color: colors.textSecondary, marginTop: 4 },
    confirmBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      marginTop: Spacing.md,
    },
    confirmBadgeText: { ...Typography.caption, fontWeight: '700' },
    confirmNote: {
      ...Typography.caption,
      color: colors.textMuted,
      marginTop: Spacing.sm,
      fontStyle: 'italic',
      textAlign: 'center',
    },
    confirmBtn: {
      width: '100%',
      borderRadius: Radius.lg,
      overflow: 'hidden',
      marginTop: Spacing.md,
    },
    confirmBtnGrad: { padding: Spacing.lg, alignItems: 'center' },
    confirmBtnText: { ...Typography.bodyBold, color: '#FFF', fontSize: 17 },
    backBtn: { marginTop: Spacing.md, padding: Spacing.sm },
    backBtnText: { ...Typography.caption, color: colors.textMuted },
  });
}
