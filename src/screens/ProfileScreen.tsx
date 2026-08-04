import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { getTabBarBottomInset } from '../constants/layout';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store/authStore';
import { useJointStore } from '../store/jointStore';
import { useExpenseStore } from '../store/expenseStore';
import { useActivityStore } from '../store/activityStore';
import { useCategoryStore } from '../store/categoryStore';
import { clearAskChatHistory } from '../utils/askChatHistory';
import { ThemeToggle } from '../components/ThemeToggle';
import { shareInviteViaWhatsApp, shareInviteCode } from '../utils/shareInvite';
import { CATEGORIES } from '../constants/categories';
import { SettingsScreen } from './SettingsScreen';
import { AppAlertModal, AppAlertContent } from '../components/AppAlertModal';
import { useNotificationNavStore } from '../store/notificationNavStore';
import { userFacingError } from '../utils/userFacingError';
import { SilkFluidOverlay } from '../components/SilkFluidOverlay';
import { SpiderWebBackground } from '../components/SpiderWebBackground';
import { useIsFocused } from '@react-navigation/native';

const RED_SPIDER_AVATAR = require('../assets/red-web-spider-avatar.png');

const KEEP_KEYS = new Set([
  '@expenso_auth_token',
  '@expenso_auth_user',
  '@expensewise_theme',
]);

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, packId, actionGradient } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomPad = getTabBarBottomInset(insets.bottom);
  const isFocused = useIsFocused();
  const spiderTheme = packId === 'red_web_spider';

  const user = useAuthStore(s => s.user);
  const clearAllData = useAuthStore(s => s.clearAllData);
  const authBusy = useAuthStore(s => s.isBusy);

  const joint = useJointStore(s => s.joint);
  const jointBusy = useJointStore(s => s.isBusy);
  const jointError = useJointStore(s => s.error);
  const loadJoint = useJointStore(s => s.loadJoint);
  const createJointAccount = useJointStore(s => s.createJointAccount);
  const joinJointAccount = useJointStore(s => s.joinJointAccount);
  const leaveJointAccount = useJointStore(s => s.leaveJointAccount);
  const clearJointError = useJointStore(s => s.clearError);

  const [inviteCode, setInviteCode] = useState('');
  const [sharing, setSharing] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [alert, setAlert] = useState<AppAlertContent | null>(null);
  const openSupportFromPush = useNotificationNavStore(s => s.openSupport);

  const showAlert = useCallback((content: AppAlertContent) => {
    setAlert(content);
  }, []);

  useEffect(() => {
    if (user) loadJoint();
  }, [user, loadJoint]);

  useEffect(() => {
    if (openSupportFromPush) {
      setSettingsOpen(true);
    }
  }, [openSupportFromPush]);

  const handleCreateJoint = useCallback(async () => {
    clearJointError();
    await createJointAccount('Our Home');
  }, [createJointAccount, clearJointError]);

  const handleJoinJoint = useCallback(async () => {
    clearJointError();
    if (!inviteCode.trim()) return;
    const ok = await joinJointAccount(inviteCode.trim().toUpperCase());
    if (ok) setInviteCode('');
  }, [inviteCode, joinJointAccount, clearJointError]);

  const handleWhatsAppShare = useCallback(async () => {
    if (!joint) return;
    setSharing(true);
    try {
      await shareInviteViaWhatsApp(joint.inviteCode, joint.name);
    } finally {
      setSharing(false);
    }
  }, [joint]);

  const handleMoreShare = useCallback(async () => {
    if (!joint) return;
    setSharing(true);
    try {
      await shareInviteCode(joint.inviteCode, joint.name);
    } finally {
      setSharing(false);
    }
  }, [joint]);

  const handleLeaveJoint = useCallback(() => {
    showAlert({
      icon: '👋',
      title: 'Leave joint account?',
      message:
        'You will separate from your partner. Shared expenses stay with them. You can create or join another joint account later.',
      buttons: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Leave',
          variant: 'danger',
          onPress: async () => {
            setActionBusy(true);
            clearJointError();
            try {
              const ok = await leaveJointAccount();
              if (!ok) {
                showAlert({
                  icon: '⚠️',
                  title: 'Couldn’t leave',
                  message: useJointStore.getState().error || 'Please try again.',
                });
              }
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    });
  }, [leaveJointAccount, clearJointError, showAlert]);

  const wipeLocalData = useCallback(async (userId: string) => {
    // Cancel any pending Ask-chat re-save first, then wipe storage + in-memory UI
    await clearAskChatHistory(userId);
    await useActivityStore.getState().clearAll();

    // Empty personal expenses + budget in memory/cache (cloud already cleared)
    useExpenseStore.setState({ expenses: [], monthlyBudget: 0 });
    await AsyncStorage.removeMany([
      `@expensewise_expenses_${userId}`,
      `@expensewise_budget_${userId}`,
      `@expensewise_personal_uploaded_ids_${userId}`,
      `@expensewise_expenses`,
      `@expensewise_budget`,
      `@expenso_ask_chat_${userId}_solo`,
      `@expenso_ask_chat_${userId}_joint`,
    ]).catch(() => {});
    await AsyncStorage.setItem(`@expensewise_budget_${userId}`, '0').catch(() => {});

    useCategoryStore.setState({ all: CATEGORIES, custom: [], isLoaded: false });

    const keys = await AsyncStorage.getAllKeys();
    const wipe = keys.filter(k => {
      if (KEEP_KEYS.has(k)) return false;
      // Personal data only — do not wipe joint cache / outbox
      return (
        k === `@expenso_ask_chat_${userId}_solo` ||
        k === `@expenso_ask_chat_${userId}_joint` ||
        k.startsWith(`@expenso_activity_${userId}`) ||
        k.startsWith('@expenso_activity_') ||
        k === `@expensewise_expenses_${userId}` ||
        k === `@expensewise_budget_${userId}` ||
        k.startsWith(`@expensewise_personal_uploaded`) ||
        k.startsWith('@expenso_onboarding') ||
        k.startsWith('@expensewise_onboarding')
      );
    });
    if (wipe.length) await AsyncStorage.removeMany(wipe);

    // Refresh joint from server (membership kept — only personal data wiped)
    await useJointStore.getState().loadJoint();
    await useCategoryStore.getState().loadCategories();
  }, []);

  const handleDeleteAllData = useCallback(() => {
    showAlert({
      icon: '🗑️',
      title: 'Delete all my data?',
      message:
        'This permanently deletes your personal expenses, budget, activity, and Ask chat history. Your login account stays. Joint account membership is kept.',
      buttons: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: 'Delete my data',
          variant: 'danger',
          onPress: () => {
            // Chain second confirm after first modal closes
            setTimeout(() => {
              showAlert({
                icon: '⚠️',
                title: 'Are you sure?',
                message:
                  'Account login will remain. Only your data will be wiped. This cannot be undone.',
                buttons: [
                  { label: 'Cancel', variant: 'secondary' },
                  {
                    label: 'Yes, clear data',
                    variant: 'danger',
                    onPress: async () => {
                      if (!user?.id) return;
                      setActionBusy(true);
                      try {
                        await clearAllData();
                        await wipeLocalData(user.id);
                        setTimeout(() => {
                          showAlert({
                            icon: '✅',
                            title: 'Done',
                            message: 'All your data was cleared. You are still logged in.',
                          });
                        }, 250);
                      } catch (err: any) {
                        setTimeout(() => {
                          showAlert({
                            icon: '⚠️',
                            title: 'Couldn’t clear data',
                            message: userFacingError(
                              err,
                              'Couldn’t clear your data. Please try again.',
                            ),
                          });
                        }, 250);
                      } finally {
                        setActionBusy(false);
                      }
                    },
                  },
                ],
              });
            }, 80);
          },
        },
      ],
    });
  }, [clearAllData, wipeLocalData, user?.id, showAlert]);

  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.subtitle}>Please login again</Text>
      </View>
    );
  }

  const busy = jointBusy || authBusy || actionBusy;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.primary + '18', colors.background, colors.background]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.silkHeaderWash} pointerEvents="none">
        <SilkFluidOverlay active={isFocused} fill={0.92} intensity="medium" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Joint account for you & your partner</Text>
          </View>
          <ThemeToggle />
        </View>

        <View style={styles.card}>
          {spiderTheme ? (
            <SpiderWebBackground variant="profile" opacity={0.24} />
          ) : (
            <SilkFluidOverlay active={isFocused} fill={0.75} intensity="bold" />
          )}
          <View style={styles.profileRow}>
            {spiderTheme ? (
              <View style={[styles.avatar, styles.spiderAvatar]}>
                <Image
                  source={RED_SPIDER_AVATAR}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </View>
            ) : (
              <View style={[styles.avatar, { backgroundColor: user.avatarColor }]}>
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => setSettingsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={({ pressed }) => [styles.settingsBtn, pressed && styles.settingsBtnPressed]}
        >
          <View style={styles.settingsIconWrap}>
            <LinearGradient
              colors={
                packId === 'red_web_spider'
                  ? [...actionGradient]
                  : [colors.primary, colors.accent]
              }
              start={{ x: 0, y: 0 }}
              end={packId === 'red_web_spider' ? { x: 1, y: 0 } : { x: 1, y: 1 }}
              style={styles.settingsIconGrad}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </LinearGradient>
          </View>
          <View style={styles.settingsTextCol}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <Text style={styles.settingsSub}>
              App lock · Notifications · Export · Feedback
            </Text>
          </View>
          <View style={styles.settingsChevronWrap}>
            <Text style={styles.settingsChevron}>›</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>💑 Joint Account</Text>
        <Text style={styles.sectionHint}>
          Husband & wife manage the same expenses on Home — both can add, both can see.
        </Text>

        {joint ? (
          <View style={styles.card}>
            <View style={styles.jointHeader}>
              <Text style={styles.jointEmoji}>{joint.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.jointName}>{joint.name}</Text>
                <Text style={styles.jointMeta}>
                  {joint.memberCount >= 2
                    ? 'Partner linked · shared on Home'
                    : 'Waiting for partner to join'}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Invite code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{joint.inviteCode}</Text>
            </View>

            <Pressable
              style={[styles.whatsappBtn, (sharing || busy) && styles.btnDisabled]}
              onPress={handleWhatsAppShare}
              disabled={sharing || busy}
            >
              <Text style={styles.whatsappBtnText}>
                {sharing ? 'Opening…' : 'Share code on WhatsApp'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryBtn}
              onPress={handleMoreShare}
              disabled={sharing || busy}
            >
              <Text style={styles.secondaryBtnText}>More share options</Text>
            </Pressable>

            {joint.memberCount < 2 && (
              <View style={styles.waitPill}>
                <Text style={styles.waitText}>
                  Share once — partner joins and Home syncs for both
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.dangerOutlineBtn, busy && styles.btnDisabled]}
              onPress={handleLeaveJoint}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.dangerOutlineText}>Leave joint account</Text>
              )}
            </Pressable>
            <Text style={styles.dangerHint}>
              Separates you from this shared home. Partner keeps the joint expenses.
            </Text>

            {!!jointError && <Text style={styles.error}>{jointError}</Text>}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Start a joint account</Text>
            <Text style={styles.inlineHint}>
              Create it, then share the invite code with your partner on WhatsApp.
            </Text>
            <Pressable
              style={[styles.primaryBtn, busy && styles.btnDisabled]}
              onPress={handleCreateJoint}
              disabled={busy}
            >
              <LinearGradient
                colors={[...actionGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGrad}
              >
                {jointBusy ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create Joint Account</Text>
                )}
              </LinearGradient>
            </Pressable>

            <View style={styles.divider} />

            <Text style={styles.label}>Join partner’s account</Text>
            <TextInput
              style={styles.input}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Enter invite code"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
            <Pressable
              style={[styles.secondaryBtn, busy && styles.btnDisabled]}
              onPress={handleJoinJoint}
              disabled={busy || !inviteCode.trim()}
            >
              <Text style={styles.secondaryBtnText}>Join Joint Account</Text>
            </Pressable>

            {!!jointError && <Text style={styles.error}>{jointError}</Text>}
          </View>
        )}

        {!!joint && (
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>How it works</Text>
            <Text style={styles.tipText}>1. Share invite code on WhatsApp</Text>
            <Text style={styles.tipText}>2. Partner registers & joins with the code</Text>
            <Text style={styles.tipText}>3. Both use Home — expenses sync together</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>Danger zone</Text>
        <Text style={styles.sectionHint}>
          Clear expenses, budget, activity, and Ask history — your login stays.
        </Text>
        <View style={styles.card}>
          <Pressable
            style={[styles.dangerFillBtn, busy && styles.btnDisabled]}
            onPress={handleDeleteAllData}
            disabled={busy}
          >
            {actionBusy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.dangerFillText}>Delete my all data</Text>
            )}
          </Pressable>
          <Text style={styles.dangerHint}>
            Removes personal expenses, budget, activity & Ask chat. Account login is kept. Cannot be
            undone.
          </Text>
        </View>
      </ScrollView>

      <SettingsScreen visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AppAlertModal
        visible={!!alert}
        title={alert?.title || ''}
        message={alert?.message || ''}
        icon={alert?.icon}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    silkHeaderWash: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 260,
      overflow: 'hidden',
    },
    scroll: { padding: Spacing.lg },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.lg,
      zIndex: 1,
    },
    title: { ...Typography.h1, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textSecondary, marginTop: 4, maxWidth: 240 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.lg,
      overflow: 'hidden',
      position: 'relative',
      minHeight: 88,
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
    primaryBtn: { marginTop: Spacing.md, borderRadius: Radius.lg, overflow: 'hidden' },
    primaryBtnGrad: { paddingVertical: Spacing.md, alignItems: 'center' },
    primaryBtnText: { ...Typography.bodyBold, color: '#FFF' },
    btnDisabled: { opacity: 0.5 },
    secondaryBtn: {
      marginTop: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
      backgroundColor: colors.primary + '18',
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    secondaryBtnText: { ...Typography.bodyBold, color: colors.primaryLight },
    whatsappBtn: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
      backgroundColor: '#25D366',
    },
    whatsappBtnText: { ...Typography.bodyBold, color: '#FFF' },
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, zIndex: 1 },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    spiderAvatar: {
      backgroundColor: '#0B1220',
      borderWidth: 1.5,
      borderColor: colors.primary + '88',
    },
    avatarImage: {
      width: 56,
      height: 56,
    },
    avatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
    profileInfo: { flex: 1 },
    profileName: { ...Typography.h3, color: colors.text },
    profileEmail: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    settingsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.md,
      borderWidth: 1.5,
      borderColor: colors.primary + '45',
      marginBottom: Spacing.lg,
      gap: Spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 4,
    },
    settingsBtnPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.985 }],
      borderColor: colors.primary + '70',
    },
    settingsIconWrap: {
      borderRadius: 16,
      overflow: 'hidden',
    },
    settingsIconGrad: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingsIcon: { fontSize: 22 },
    settingsTextCol: { flex: 1 },
    settingsTitle: { ...Typography.bodyBold, color: colors.text, fontSize: 17 },
    settingsSub: { ...Typography.caption, color: colors.textMuted, marginTop: 3, lineHeight: 17 },
    settingsChevronWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
      borderWidth: 1,
      borderColor: colors.primary + '35',
    },
    settingsChevron: { fontSize: 22, color: colors.primaryLight, fontWeight: '600', marginTop: -1 },
    sectionTitle: { ...Typography.h3, color: colors.text, marginBottom: Spacing.xs },
    sectionHint: {
      ...Typography.caption,
      color: colors.textMuted,
      marginBottom: Spacing.md,
      lineHeight: 18,
    },
    inlineHint: { ...Typography.caption, color: colors.textMuted, marginBottom: Spacing.sm, lineHeight: 18 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.lg },
    jointHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    jointEmoji: { fontSize: 36 },
    jointName: { ...Typography.h3, color: colors.text },
    jointMeta: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    codeBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.primary + '55',
      alignItems: 'center',
    },
    codeText: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 4,
      color: colors.primaryLight,
    },
    waitPill: {
      marginTop: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radius.lg,
      backgroundColor: colors.warning + '18',
      borderWidth: 1,
      borderColor: colors.warning + '40',
    },
    waitText: { ...Typography.caption, color: colors.warning, fontWeight: '600', textAlign: 'center' },
    tipCard: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tipTitle: { ...Typography.bodyBold, color: colors.text, marginBottom: Spacing.sm },
    tipText: { ...Typography.caption, color: colors.textSecondary, marginBottom: 4, lineHeight: 18 },
    dangerOutlineBtn: {
      marginTop: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.danger + '66',
      backgroundColor: colors.danger + '12',
    },
    dangerOutlineText: { ...Typography.bodyBold, color: colors.danger },
    dangerFillBtn: {
      paddingVertical: Spacing.md,
      borderRadius: Radius.lg,
      alignItems: 'center',
      backgroundColor: colors.danger,
    },
    dangerFillText: { ...Typography.bodyBold, color: '#FFF' },
    dangerHint: {
      ...Typography.caption,
      color: colors.textMuted,
      marginTop: Spacing.sm,
      lineHeight: 18,
    },
  });
}
