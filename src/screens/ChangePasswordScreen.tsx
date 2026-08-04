import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';

/** Forced after support issues a temporary password. */
export function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const { colors, actionGradient } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const changePassword = useAuthStore(s => s.changePassword);
  const isBusy = useAuthStore(s => s.isBusy);
  const error = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);
  const logout = useAuthStore(s => s.logout);

  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  const onSave = async () => {
    clearError();
    setLocalError('');
    if (newPassword.length < 6) {
      setLocalError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirm) {
      setLocalError('New passwords do not match');
      return;
    }
    try {
      await changePassword(currentPassword, newPassword);
    } catch {
      /* store error */
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.sub}>
          You signed in with a temporary password from support. Choose your own password to continue.
        </Text>

        <Text style={styles.label}>Temporary / current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrent}
          secureTextEntry
          autoCapitalize="none"
          placeholderTextColor={colors.textMuted}
          placeholder="From support message"
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNew}
          secureTextEntry
          autoCapitalize="none"
          placeholderTextColor={colors.textMuted}
          placeholder="At least 6 characters"
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          placeholderTextColor={colors.textMuted}
          placeholder="Repeat new password"
        />

        {!!(localError || error) && (
          <Text style={styles.error}>{localError || error}</Text>
        )}

        <Pressable
          style={[styles.primaryBtn, isBusy && styles.disabled]}
          onPress={onSave}
          disabled={isBusy}
        >
          <LinearGradient
            colors={[...actionGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryBtnGrad}
          >
            {isBusy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Save password</Text>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.linkBtn} onPress={() => logout()} hitSlop={8}>
          <Text style={styles.linkText}>Sign out instead</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: Spacing.lg },
    flex: { flex: 1, justifyContent: 'center' },
    title: { ...Typography.h1, color: colors.text, marginBottom: Spacing.sm },
    sub: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: Spacing.lg,
    },
    label: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: Spacing.xs,
      marginTop: Spacing.sm,
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 16,
    },
    error: { ...Typography.caption, color: colors.danger, marginTop: Spacing.sm },
    primaryBtn: { marginTop: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
    primaryBtnGrad: { paddingVertical: Spacing.md + 2, alignItems: 'center' },
    primaryBtnText: { ...Typography.bodyBold, color: '#FFF', fontSize: 16 },
    disabled: { opacity: 0.5 },
    linkBtn: { alignItems: 'center', marginTop: Spacing.lg },
    linkText: { ...Typography.caption, color: colors.primaryLight, fontWeight: '600' },
  });
}
