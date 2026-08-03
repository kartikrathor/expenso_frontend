import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAppLockStore } from '../store/appLockStore';
import { useAuthStore } from '../store/authStore';
import { getBiometryAvailability, promptBiometricUnlock } from '../utils/biometrics';

export function AppLockScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const name = useAuthStore(s => s.user?.name);
  const userId = useAuthStore(s => s.user?.id);
  const logout = useAuthStore(s => s.logout);
  const unlock = useAppLockStore(s => s.unlock);
  const unlockWithBiometric = useAppLockStore(s => s.unlockWithBiometric);
  const beginBiometricPrompt = useAppLockStore(s => s.beginBiometricPrompt);
  const biometricEnabled = useAppLockStore(s => s.biometricEnabled);
  const clearForUser = useAppLockStore(s => s.clearForUser);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biometric');
  const [bioReady, setBioReady] = useState(false);
  const promptedRef = useRef(false);

  const tryBiometric = useCallback(async () => {
    if (!biometricEnabled) return;
    setBusy(true);
    setError('');
    try {
      const info = await getBiometryAvailability();
      if (!info.available) {
        setBioReady(false);
        return;
      }
      setBioLabel(info.label);
      setBioReady(true);
      beginBiometricPrompt();
      const ok = await promptBiometricUnlock(info.label);
      if (ok) unlockWithBiometric();
    } finally {
      setBusy(false);
    }
  }, [biometricEnabled, beginBiometricPrompt, unlockWithBiometric]);

  useEffect(() => {
    if (!biometricEnabled || promptedRef.current) return;
    promptedRef.current = true;
    const t = setTimeout(() => {
      void tryBiometric();
    }, 350);
    return () => clearTimeout(t);
  }, [biometricEnabled, tryBiometric]);

  const submit = async () => {
    setBusy(true);
    setError('');
    const ok = await unlock(pin);
    setBusy(false);
    if (!ok) {
      setError('Wrong PIN');
      setPin('');
    }
  };

  const forgotPin = useCallback(() => {
    Alert.alert(
      'Forgot PIN?',
      'App lock PIN will be cleared and you will be signed out. Sign in again with your email & password, then set a new PIN in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError('');
            try {
              if (userId) await clearForUser(userId);
              await logout();
            } catch {
              setError('Could not sign out. Try again.');
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [userId, clearForUser, logout]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 40, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={[colors.primary + '22', colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.brand}>Expenso</Text>
      <Text style={styles.hello}>Welcome back{name ? `, ${name.split(/\s+/)[0]}` : ''}</Text>
      <Text style={styles.hint}>
        {biometricEnabled
          ? `Unlock with ${bioLabel} or enter your PIN`
          : 'Enter your app lock PIN'}
      </Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={t => {
          setPin(t.replace(/\D/g, '').slice(0, 8));
          setError('');
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={8}
        placeholder="••••"
        placeholderTextColor={colors.textMuted}
        autoFocus={!biometricEnabled}
        onSubmitEditing={submit}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        style={[styles.btn, (busy || pin.length < 4) && styles.btnDisabled]}
        onPress={submit}
        disabled={busy || pin.length < 4}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.btnGrad}
        >
          <Text style={styles.btnText}>Unlock</Text>
        </LinearGradient>
      </Pressable>
      {biometricEnabled ? (
        <Pressable
          style={[styles.bioBtn, busy && styles.btnDisabled]}
          onPress={tryBiometric}
          disabled={busy}
        >
          <Text style={styles.bioBtnText}>
            Use {bioReady || bioLabel ? bioLabel : 'Biometric'}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.forgotBtn}
        onPress={forgotPin}
        disabled={busy}
        hitSlop={8}
      >
        <Text style={styles.forgotText}>Forgot PIN?</Text>
      </Pressable>
      <Text style={styles.forgotHint}>Clears lock & signs you out so you can log in again</Text>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, paddingHorizontal: Spacing.xl },
    brand: {
      ...Typography.caption,
      color: colors.primaryLight,
      fontWeight: '800',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    hello: { ...Typography.h1, color: colors.text, marginTop: Spacing.sm },
    hint: { ...Typography.body, color: colors.textSecondary, marginTop: Spacing.sm },
    input: {
      marginTop: Spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: Radius.lg,
      padding: Spacing.lg,
      fontSize: 28,
      letterSpacing: 10,
      textAlign: 'center',
      color: colors.text,
    },
    error: { ...Typography.caption, color: colors.danger, marginTop: Spacing.sm, textAlign: 'center' },
    btn: { marginTop: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
    btnDisabled: { opacity: 0.5 },
    btnGrad: { paddingVertical: Spacing.md, alignItems: 'center' },
    btnText: { ...Typography.bodyBold, color: '#FFF' },
    bioBtn: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.primary + '55',
      backgroundColor: colors.primary + '14',
    },
    bioBtnText: { ...Typography.bodyBold, color: colors.primaryLight },
    forgotBtn: {
      marginTop: Spacing.lg,
      alignSelf: 'center',
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
    },
    forgotText: {
      ...Typography.bodyBold,
      color: colors.primaryLight,
      fontSize: 15,
    },
    forgotHint: {
      ...Typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.xs,
      paddingHorizontal: Spacing.md,
    },
  });
}
