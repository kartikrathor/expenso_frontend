import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import {
  AuthField,
  AuthFieldErrors,
  validateLogin,
  validateRegister,
} from '../utils/authValidation';

type AuthTab = 'login' | 'register';

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isBusy = useAuthStore(s => s.isBusy);
  const authError = useAuthStore(s => s.error);
  const login = useAuthStore(s => s.login);
  const register = useAuthStore(s => s.register);
  const clearError = useAuthStore(s => s.clearError);

  const [authTab, setAuthTab] = useState<AuthTab>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});

  const clearFieldError = useCallback((field: AuthField) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const switchTab = useCallback((t: AuthTab) => {
    clearError();
    setFieldErrors({});
    setAuthTab(t);
  }, [clearError]);

  const handleAuth = useCallback(async () => {
    clearError();

    if (authTab === 'login') {
      const result = validateLogin({ email, password });
      if (!result.ok) {
        setFieldErrors(result.errors);
        return;
      }
      setFieldErrors({});
      try {
        await login(result.email, result.password);
        setPassword('');
      } catch {
        // store error
      }
      return;
    }

    const result = validateRegister({ name, email, password });
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    try {
      await register(result.name, result.email, result.password);
      setPassword('');
    } catch {
      // store error
    }
  }, [authTab, email, password, name, login, register, clearError]);

  const inputBorder = (field: AuthField) =>
    fieldErrors[field] ? { borderColor: colors.danger } : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={[colors.primary + '22', colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.logo}
            >
              <Text style={styles.logoEmoji}>💸</Text>
            </LinearGradient>
            <Text style={styles.appName}>Expenso</Text>
            <Text style={styles.tagline}>
              Sign in to manage expenses — alone or with your partner in a joint account.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              {(['register', 'login'] as AuthTab[]).map(t => (
                <Pressable
                  key={t}
                  style={[styles.tab, authTab === t && styles.tabActive]}
                  onPress={() => switchTab(t)}
                >
                  <Text style={[styles.tabText, authTab === t && styles.tabTextActive]}>
                    {t === 'login' ? 'Login' : 'Register'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {authTab === 'register' && (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={[styles.input, inputBorder('name')]}
                  value={name}
                  onChangeText={v => {
                    setName(v);
                    clearFieldError('name');
                  }}
                  placeholder="Your name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  maxLength={50}
                />
                {!!fieldErrors.name && <Text style={styles.fieldError}>{fieldErrors.name}</Text>}
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, inputBorder('email')]}
              value={email}
              onChangeText={v => {
                setEmail(v);
                clearFieldError('email');
              }}
              placeholder="you@email.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={100}
            />
            {!!fieldErrors.email && <Text style={styles.fieldError}>{fieldErrors.email}</Text>}

            <Text style={styles.label}>Password</Text>
            <View style={[styles.passwordWrap, inputBorder('password')]}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  clearFieldError('password');
                }}
                placeholder="Your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={72}
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={10}>
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </Pressable>
            </View>
            {!!fieldErrors.password && <Text style={styles.fieldError}>{fieldErrors.password}</Text>}

            {!!authError && <Text style={styles.error}>{authError}</Text>}

            <Pressable
              style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
              onPress={handleAuth}
              disabled={isBusy}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGrad}
              >
                {isBusy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    {authTab === 'login' ? 'Login' : 'Create Account'}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scroll: { padding: Spacing.lg, paddingTop: Spacing.xl, flexGrow: 1, justifyContent: 'center' },
    brand: { alignItems: 'center', marginBottom: Spacing.xl },
    logo: {
      width: 84,
      height: 84,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    logoEmoji: { fontSize: 40 },
    appName: { ...Typography.h1, color: colors.text },
    tagline: {
      ...Typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
      lineHeight: 20,
      paddingHorizontal: Spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      padding: 4,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
    tabActive: { backgroundColor: colors.primary + '28' },
    tabText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
    tabTextActive: { color: colors.primaryLight, fontWeight: '700' },
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
    passwordWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingRight: Spacing.sm,
    },
    passwordInput: { flex: 1, padding: Spacing.md, color: colors.text, fontSize: 16 },
    eyeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    eyeIcon: { fontSize: 18 },
    fieldError: { ...Typography.small, color: colors.danger, marginTop: 4 },
    error: { ...Typography.caption, color: colors.danger, marginTop: Spacing.sm },
    primaryBtn: { marginTop: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
    primaryBtnGrad: { paddingVertical: Spacing.md + 2, alignItems: 'center' },
    primaryBtnText: { ...Typography.bodyBold, color: '#FFF', fontSize: 16 },
    btnDisabled: { opacity: 0.5 },
  });
}
