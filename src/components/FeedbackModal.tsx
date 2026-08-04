import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { apiRequest } from '../services/api';
import { userFacingError } from '../utils/userFacingError';

type FeedbackModalProps = {
  visible: boolean;
  onClose: () => void;
  onSent?: () => void;
};

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'bug', label: 'Bug' },
  { id: 'praise', label: 'Love it' },
  { id: 'other', label: 'Other' },
];

export function FeedbackModal({ visible, onClose, onSent }: FeedbackModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const token = useAuthStore(s => s.token);

  const [category, setCategory] = useState('idea');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setCategory('idea');
    setMessage('');
    setError('');
    setBusy(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const submit = useCallback(async () => {
    const text = message.trim();
    if (text.length < 5) {
      setError('Write a bit more so we can help.');
      return;
    }
    if (!token) {
      setError('Please log in again.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiRequest('/api/feedback', {
        method: 'POST',
        token,
        body: {
          message: text,
          category,
          platform: Platform.OS,
        },
      });
      reset();
      onClose();
      onSent?.();
    } catch (e: any) {
      setError(userFacingError(e, 'Couldn’t send feedback. Please try again.'));
    } finally {
      setBusy(false);
    }
  }, [message, category, token, reset, onClose, onSent]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={styles.back}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Send feedback</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            Ideas, bugs, or love notes — our team reads every message.
          </Text>

          <Text style={styles.label}>Type</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(c => {
              const on = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? colors.primary : colors.border,
                      backgroundColor: on ? colors.primary + '22' : colors.surface,
                    },
                  ]}
                >
                  <Text style={{ color: on ? colors.primaryLight : colors.textSecondary, fontWeight: '700' }}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Your message</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            value={message}
            onChangeText={setMessage}
            placeholder="Tell us what's on your mind…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.count}>{message.trim().length}/2000</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submitWrap, busy && { opacity: 0.6 }]}
            onPress={submit}
            disabled={busy}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGrad}
            >
              {busy ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.submitText}>Send to Expenso</Text>
              )}
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    back: { ...Typography.bodyBold, color: colors.primaryLight, width: 56 },
    title: { ...Typography.h3, color: colors.text },
    body: { padding: Spacing.lg },
    hint: { ...Typography.body, color: colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
    label: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: Spacing.sm,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    chip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      borderWidth: 1,
    },
    input: {
      minHeight: 140,
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      backgroundColor: colors.surface,
      fontSize: 16,
      lineHeight: 22,
    },
    count: { ...Typography.caption, color: colors.textMuted, textAlign: 'right', marginTop: 6 },
    error: { ...Typography.caption, color: colors.danger, marginTop: Spacing.sm },
    submitWrap: {
      marginTop: Spacing.lg,
      height: 48,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    submitGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    submitText: { ...Typography.bodyBold, color: '#FFF' },
  });
}
