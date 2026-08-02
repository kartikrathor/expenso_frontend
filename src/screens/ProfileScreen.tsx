import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
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
import { ThemeToggle } from '../components/ThemeToggle';
import { shareInviteViaWhatsApp, shareInviteCode } from '../utils/shareInvite';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomPad = getTabBarBottomInset(insets.bottom);

  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
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

  useEffect(() => {
    if (user) loadJoint();
  }, [user, loadJoint]);

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

  const handleLogout = useCallback(async () => {
    await logout();
    useJointStore.setState({ joint: null, groups: [], expenses: [], outbox: [], pendingCount: 0 });
  }, [logout]);

  const handleLeaveJoint = useCallback(() => {
    Alert.alert(
      'Leave joint account?',
      'You will separate from your partner. Shared expenses stay with them. You can create or join another joint account later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActionBusy(true);
            clearJointError();
            try {
              const ok = await leaveJointAccount();
              if (!ok) {
                Alert.alert('Could not leave', useJointStore.getState().error || 'Try again');
              }
            } finally {
              setActionBusy(false);
            }
          },
        },
      ],
    );
  }, [leaveJointAccount, clearJointError]);

  const wipeLocalData = useCallback(async () => {
    await useActivityStore.getState().clearAll();
    await useExpenseStore.getState().clearAllExpenses();
    const keys = await AsyncStorage.getAllKeys();
    const wipe = keys.filter(
      k =>
        k.startsWith('@expenso_') ||
        k.startsWith('@expensewise_') ||
        k.includes('joint'),
    );
    if (wipe.length) await AsyncStorage.multiRemove(wipe);
    useJointStore.setState({
      joint: null,
      groups: [],
      expenses: [],
      outbox: [],
      pendingCount: 0,
    });
  }, []);

  const handleDeleteAllData = useCallback(() => {
    Alert.alert(
      'Delete all my data?',
      'This permanently deletes your account, local expenses, activity, and leaves any joint account. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Are you sure?', 'Confirm delete account and all cloud + local data.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, delete',
                style: 'destructive',
                onPress: async () => {
                  setActionBusy(true);
                  try {
                    await deleteAccount();
                    await wipeLocalData();
                  } catch (err: any) {
                    Alert.alert('Delete failed', err?.message || 'Try again');
                  } finally {
                    setActionBusy(false);
                  }
                },
              },
            ]);
          },
        },
      ],
    );
  }, [deleteAccount, wipeLocalData]);

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
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: user.avatarColor }]}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>
          <Pressable style={styles.logoutBtn} onPress={handleLogout} disabled={busy}>
            <Text style={styles.logoutText}>Logout</Text>
          </Pressable>
        </View>

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
                colors={[colors.gradientStart, colors.gradientEnd]}
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
          Permanently remove your account and data from Expenso.
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
            Deletes account, cloud joint data you own, local expenses & activity. Cannot be undone.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: Spacing.lg },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.lg,
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
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
    profileInfo: { flex: 1 },
    profileName: { ...Typography.h3, color: colors.text },
    profileEmail: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    logoutBtn: {
      marginTop: Spacing.md,
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.danger + '18',
    },
    logoutText: { ...Typography.caption, color: colors.danger, fontWeight: '700' },
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
