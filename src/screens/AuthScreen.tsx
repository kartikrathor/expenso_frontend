import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import {
  PasswordResetRequestView,
  useAuthStore,
} from '../store/authStore';
import {
  AuthField,
  AuthFieldErrors,
  validateLogin,
  validateRegister,
} from '../utils/authValidation';
import { ExpensoMarkIcon } from '../components/icons/ExpensoMarkIcon';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '../constants/api';

type AuthTab = 'login' | 'register';
type ScreenMode = 'auth' | 'forgot' | 'resetTrack';

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { colors, actionGradient } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  const isBusy = useAuthStore(s => s.isBusy);
  const authError = useAuthStore(s => s.error);
  const login = useAuthStore(s => s.login);
  const register = useAuthStore(s => s.register);
  const clearError = useAuthStore(s => s.clearError);
  const requestPasswordReset = useAuthStore(s => s.requestPasswordReset);
  const fetchPasswordReset = useAuthStore(s => s.fetchPasswordReset);
  const verifyPasswordReset = useAuthStore(s => s.verifyPasswordReset);

  const [authTab, setAuthTab] = useState<AuthTab>('register');
  const [mode, setMode] = useState<ScreenMode>('auth');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [resetNote, setResetNote] = useState('');
  const [resetInfo, setResetInfo] = useState('');
  const [resetReq, setResetReq] = useState<PasswordResetRequestView | null>(null);
  const [otp, setOtp] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

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

  const scrollToFocused = useCallback(() => {
    const delay = Platform.OS === 'android' ? 120 : 50;
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, delay);
  }, []);

  useEffect(() => {
    if (keyboardHeight > 0) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [keyboardHeight]);

  // Poll reset thread while tracking
  useEffect(() => {
    if (mode !== 'resetTrack' || !resetReq?.id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const fresh = await fetchPasswordReset(resetReq.id);
        if (!cancelled) setResetReq(fresh);
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [mode, resetReq?.id, fetchPasswordReset]);

  const clearFieldError = useCallback((field: AuthField) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const switchTab = useCallback(
    (t: AuthTab) => {
      clearError();
      setFieldErrors({});
      setAuthTab(t);
    },
    [clearError],
  );

  const openForgot = () => {
    clearError();
    setResetInfo('');
    setMode('forgot');
    setAuthTab('login');
  };

  const backToAuth = () => {
    clearError();
    setResetInfo('');
    setMode('auth');
  };

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

  const handleResetRequest = async () => {
    clearError();
    setResetInfo('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setResetInfo('Enter the email for your account.');
      return;
    }
    try {
      const res = await requestPasswordReset(trimmed, resetNote);
      setResetInfo(res.message);
      if (res.request) {
        setResetReq(res.request);
        setMode('resetTrack');
      }
    } catch {
      /* store */
    }
  };

  const handleVerify = async () => {
    if (!resetReq) return;
    clearError();
    try {
      const res = await verifyPasswordReset(resetReq.id, {
        otp: otp.trim() || undefined,
        token: verifyToken.trim() || undefined,
      });
      setResetReq(res.request);
      setResetInfo(res.message);
      setOtp('');
      setVerifyToken('');
    } catch {
      /* store */
    }
  };

  const refreshReset = async () => {
    if (!resetReq) return;
    try {
      const fresh = await fetchPasswordReset(resetReq.id);
      setResetReq(fresh);
    } catch {
      /* ignore */
    }
  };

  const inputBorder = (field: AuthField) =>
    fieldErrors[field] ? { borderColor: colors.danger } : null;

  const keyboardOpen = keyboardHeight > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.primary + '22', colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            keyboardOpen && styles.scrollKeyboardOpen,
            {
              paddingBottom:
                Spacing.lg +
                insets.bottom +
                (keyboardOpen
                  ? Platform.OS === 'android'
                    ? keyboardHeight
                    : keyboardHeight * 0.35 + Spacing.xl
                  : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View style={[styles.brand, keyboardOpen && styles.brandCompact]}>
            <LinearGradient
              colors={[...actionGradient]}
              style={[styles.logo, keyboardOpen && styles.logoCompact]}
            >
              <ExpensoMarkIcon size={keyboardOpen ? 28 : 40} color="#FFF" />
            </LinearGradient>
            <Text style={styles.appName}>Expenso</Text>
            {!keyboardOpen && mode === 'auth' && (
              <Text style={styles.tagline}>
                Sign in to manage expenses — alone or with your partner in a joint account.
              </Text>
            )}
            {!keyboardOpen && mode !== 'auth' && (
              <Text style={styles.tagline}>Password help via support — device-aware for safety.</Text>
            )}
          </View>

          <View style={styles.card}>
            {mode === 'auth' && (
              <>
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
                      onFocus={scrollToFocused}
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
                  onFocus={scrollToFocused}
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
                    onFocus={scrollToFocused}
                    placeholder="Your password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={72}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(v => !v)}
                    hitSlop={10}
                  >
                    <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                  </Pressable>
                </View>
                {!!fieldErrors.password && (
                  <Text style={styles.fieldError}>{fieldErrors.password}</Text>
                )}

                {authTab === 'login' && (
                  <Pressable style={styles.forgotLink} onPress={openForgot} hitSlop={8}>
                    <Text style={styles.forgotLinkText}>Forgot password?</Text>
                  </Pressable>
                )}

                {!!authError && <Text style={styles.error}>{authError}</Text>}

                <Pressable
                  style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                  onPress={handleAuth}
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
                      <Text style={styles.primaryBtnText}>
                        {authTab === 'login' ? 'Login' : 'Create Account'}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>

                {authTab === 'register' && (
                  <Text style={styles.legalNote}>
                    By creating an account you agree to our{' '}
                    <Text
                      style={styles.legalLink}
                      onPress={() => Linking.openURL(LEGAL_TERMS_URL)}
                    >
                      Terms
                    </Text>{' '}
                    and{' '}
                    <Text
                      style={styles.legalLink}
                      onPress={() => Linking.openURL(LEGAL_PRIVACY_URL)}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                )}
              </>
            )}

            {mode === 'forgot' && (
              <>
                <Text style={styles.sectionTitle}>Forgot password</Text>
                <Text style={styles.helpText}>
                  We’ll open a support request. If this is your usual device, support can send a
                  temporary password here. If it’s a new device, support will verify you first
                  (OTP / link).
                </Text>

                <Text style={styles.label}>Account email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={scrollToFocused}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.label}>Note for support (optional)</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  value={resetNote}
                  onChangeText={setResetNote}
                  onFocus={scrollToFocused}
                  placeholder="e.g. Lost access after reinstall"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />

                {!!resetInfo && <Text style={styles.info}>{resetInfo}</Text>}
                {!!authError && <Text style={styles.error}>{authError}</Text>}

                <Pressable
                  style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                  onPress={handleResetRequest}
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
                      <Text style={styles.primaryBtnText}>Request help from support</Text>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable style={styles.forgotLink} onPress={backToAuth} hitSlop={8}>
                  <Text style={styles.forgotLinkText}>Back to login</Text>
                </Pressable>
              </>
            )}

            {mode === 'resetTrack' && resetReq && (
              <>
                <Text style={styles.sectionTitle}>Support · {resetReq.code}</Text>
                <View style={styles.badgeRow}>
                  <Text
                    style={[
                      styles.badge,
                      resetReq.sameDevice ? styles.badgeOk : styles.badgeWarn,
                    ]}
                  >
                    {resetReq.sameDevice ? 'Known device' : 'New device'}
                  </Text>
                  <Text style={styles.badgeMuted}>{resetReq.status.replace(/_/g, ' ')}</Text>
                </View>

                <Text style={styles.helpText}>
                  {resetReq.sameDevice
                    ? 'Support can send a temporary password to this thread. Pull to refresh below.'
                    : 'New device — ask support (admin) to send a verification OTP or link, then enter it here.'}
                </Text>

                <View style={styles.thread}>
                  {resetReq.messages.map((m, i) => (
                    <View
                      key={`${m.createdAt}-${i}`}
                      style={[
                        styles.bubble,
                        m.role === 'user'
                          ? styles.bubbleUser
                          : m.role === 'admin'
                            ? styles.bubbleAdmin
                            : styles.bubbleSystem,
                      ]}
                    >
                      <Text style={styles.bubbleRole}>{m.role}</Text>
                      <Text style={styles.bubbleText}>{m.message}</Text>
                    </View>
                  ))}
                </View>

                {!resetReq.sameDevice &&
                  resetReq.status !== 'temp_password_sent' &&
                  resetReq.status !== 'completed' && (
                    <>
                      <Text style={styles.label}>OTP from support</Text>
                      <TextInput
                        style={styles.input}
                        value={otp}
                        onChangeText={setOtp}
                        onFocus={scrollToFocused}
                        placeholder="6-digit code"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={8}
                      />
                      <Text style={styles.label}>Or verification token</Text>
                      <TextInput
                        style={styles.input}
                        value={verifyToken}
                        onChangeText={setVerifyToken}
                        onFocus={scrollToFocused}
                        placeholder="Paste token from support"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                      />
                      <Pressable
                        style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                        onPress={handleVerify}
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
                            <Text style={styles.primaryBtnText}>Verify device</Text>
                          )}
                        </LinearGradient>
                      </Pressable>
                    </>
                  )}

                {!!resetInfo && <Text style={styles.info}>{resetInfo}</Text>}
                {!!authError && <Text style={styles.error}>{authError}</Text>}

                {resetReq.status === 'temp_password_sent' && (
                  <Text style={styles.info}>
                    Temporary password is in the messages above. Go back, log in with it, then set
                    your own password.
                  </Text>
                )}

                <Pressable style={styles.secondaryBtn} onPress={refreshReset}>
                  <Text style={styles.secondaryBtnText}>Refresh messages</Text>
                </Pressable>
                <Pressable style={styles.forgotLink} onPress={backToAuth} hitSlop={8}>
                  <Text style={styles.forgotLinkText}>Back to login</Text>
                </Pressable>
              </>
            )}
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
    scrollKeyboardOpen: { justifyContent: 'flex-start', paddingTop: Spacing.md },
    brand: { alignItems: 'center', marginBottom: Spacing.xl },
    brandCompact: { marginBottom: Spacing.md },
    logo: {
      width: 84,
      height: 84,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    logoCompact: { width: 56, height: 56, borderRadius: 16, marginBottom: Spacing.sm },
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
    noteInput: { minHeight: 72, textAlignVertical: 'top' },
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
    info: { ...Typography.caption, color: colors.primaryLight, marginTop: Spacing.sm, lineHeight: 18 },
    primaryBtn: { marginTop: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
    primaryBtnGrad: { paddingVertical: Spacing.md + 2, alignItems: 'center' },
    primaryBtnText: { ...Typography.bodyBold, color: '#FFF', fontSize: 16 },
    btnDisabled: { opacity: 0.5 },
    legalNote: {
      ...Typography.small,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.md,
      lineHeight: 18,
      paddingHorizontal:30
    },
    legalLink: {
      color: colors.primaryLight,
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    forgotLink: { alignSelf: 'flex-end', marginTop: Spacing.sm },
    forgotLinkText: { ...Typography.caption, color: colors.primaryLight, fontWeight: '600' },
    sectionTitle: { ...Typography.h2, color: colors.text, marginBottom: Spacing.sm },
    helpText: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: Spacing.sm,
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
    badge: {
      ...Typography.small,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      overflow: 'hidden',
    },
    badgeOk: { backgroundColor: colors.success + '33', color: colors.success },
    badgeWarn: { backgroundColor: colors.warning + '33', color: colors.warning },
    badgeMuted: { ...Typography.small, color: colors.textMuted, textTransform: 'capitalize' },
    thread: { gap: 8, marginTop: Spacing.sm, marginBottom: Spacing.sm },
    bubble: { borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1 },
    bubbleUser: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
    bubbleAdmin: { backgroundColor: colors.primary + '18', borderColor: colors.primary + '44' },
    bubbleSystem: { backgroundColor: colors.background, borderColor: colors.border },
    bubbleRole: {
      ...Typography.small,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 2,
      fontWeight: '700',
    },
    bubbleText: { ...Typography.caption, color: colors.text, lineHeight: 18 },
    secondaryBtn: {
      marginTop: Spacing.md,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
    secondaryBtnText: { ...Typography.bodyBold, color: colors.text, fontSize: 15 },
  });
}
