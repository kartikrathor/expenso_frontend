import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  TextInput,
  Share,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAppLockStore } from '../store/appLockStore';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { exportAndShareExcel, exportAndSharePdf } from '../utils/exportExpenses';
import {
  getBiometryAvailability,
  promptBiometricUnlock,
  BiometryAvailability,
} from '../utils/biometrics';
import { AppAlertModal, AppAlertContent } from '../components/AppAlertModal';
import { FeedbackModal } from '../components/FeedbackModal';
import { SupportModal } from '../components/SupportModal';
import { ThemesScreen } from './ThemesScreen';
import { useAuthStore } from '../store/authStore';
import { useJointStore } from '../store/jointStore';
import { useProStore } from '../store/proStore';
import { useThemeStore } from '../store/themeStore';
import { getThemePackMeta, THEME_PACKS } from '../constants/themePacks';
import { apiRequest } from '../services/api';
import { useNotificationNavStore } from '../store/notificationNavStore';
import { userFacingError } from '../utils/userFacingError';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '../constants/api';

type SettingsScreenProps = {
  visible: boolean;
  onClose: () => void;
};

type RowProps = {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  pro?: boolean;
  danger?: boolean;
};

function SettingsRow({ title, subtitle, onPress, right, pro, danger }: RowProps) {
  const { colors, actionGradient } = useTheme();
  const styles = useMemo(() => rowStyles(colors), [colors]);
  const content = (
    <>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, danger && { color: colors.danger }]}>{title}</Text>
          {pro ? (
            <View style={styles.proPill}>
              <Text style={styles.proText}>PRO</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ?? <Text style={styles.chevron}>›</Text>}
    </>
  );
  if (onPress) {
    return (
      <Pressable style={styles.row} onPress={onPress}>
        {content}
      </Pressable>
    );
  }
  return <View style={styles.row}>{content}</View>;
}

export function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, gradientPoints, actionGradient } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { expenses, isJoint } = useHouseholdExpenses();

  const enabled = useAppLockStore(s => s.enabled);
  const hasPin = useAppLockStore(s => s.hasPin);
  const biometricEnabled = useAppLockStore(s => s.biometricEnabled);
  const setEnabled = useAppLockStore(s => s.setEnabled);
  const setPin = useAppLockStore(s => s.setPin);
  const setBiometricEnabled = useAppLockStore(s => s.setBiometricEnabled);

  const [pinModal, setPinModal] = useState(false);
  const [pin, setPinInput] = useState('');
  const [pin2, setPin2] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const isPro = useProStore(s => s.isPro);
  const openPaywall = useProStore(s => s.openPaywall);
  const packId = useThemeStore(s => s.packId);
  const packMeta = getThemePackMeta(packId);
  const themeSwatches = useMemo(
    () => THEME_PACKS.slice(0, 5).map(p => [p.swatch, p.swatchAlt] as const),
    [],
  );
  const [supportUnread, setSupportUnread] = useState(0);
  const [bio, setBio] = useState<BiometryAvailability | null>(null);
  /** After PIN is created from biometric tap, continue enabling biometrics */
  const [pendingBioAfterPin, setPendingBioAfterPin] = useState(false);
  const [alert, setAlert] = useState<AppAlertContent | null>(null);
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const authBusy = useAuthStore(s => s.isBusy);
  const updateNotificationPrefs = useAuthStore(s => s.updateNotificationPrefs);
  const joint = useJointStore(s => s.joint);
  const openSupportFromPush = useNotificationNavStore(s => s.openSupport);
  const clearOpenSupport = useNotificationNavStore(s => s.clearOpenSupport);

  const notifyPartnerOnMyJointAdd = user?.notifyPartnerOnMyJointAdd !== false;
  const notifyMeOnPartnerJointAdd = user?.notifyMeOnPartnerJointAdd !== false;
  const showJointNotifPrefs = !!joint;

  const showAlert = useCallback((content: AppAlertContent) => {
    setAlert(content);
  }, []);

  const onToggleNotifyPartner = useCallback(
    async (value: boolean) => {
      try {
        await updateNotificationPrefs({ notifyPartnerOnMyJointAdd: value });
      } catch (err: any) {
        showAlert({
          icon: '⚠️',
          title: 'Couldn’t update',
          message: userFacingError(err, 'Couldn’t update this setting. Please try again.'),
        });
      }
    },
    [updateNotificationPrefs, showAlert],
  );

  const onToggleNotifyMe = useCallback(
    async (value: boolean) => {
      try {
        await updateNotificationPrefs({ notifyMeOnPartnerJointAdd: value });
      } catch (err: any) {
        showAlert({
          icon: '⚠️',
          title: 'Couldn’t update',
          message: userFacingError(err, 'Couldn’t update this setting. Please try again.'),
        });
      }
    },
    [updateNotificationPrefs, showAlert],
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getBiometryAvailability().then(info => {
      if (!cancelled) setBio(info);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (visible && openSupportFromPush) {
      setSupportOpen(true);
      clearOpenSupport();
    }
  }, [visible, openSupportFromPush, clearOpenSupport]);

  useEffect(() => {
    if (!visible || !token) return;
    let cancelled = false;
    apiRequest<{ unreadCount?: number; tickets?: { unread?: boolean; unreadByUser?: boolean }[] }>(
      '/api/support/tickets?limit=30',
      { token },
    )
      .then(data => {
        if (cancelled) return;
        const count =
          data.unreadCount ??
          (data.tickets || []).filter(t => t.unread || t.unreadByUser).length;
        setSupportUnread(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, token]);

  const onToggleLock = useCallback(
    async (value: boolean) => {
      if (value && !isPro) {
        openPaywall('app_lock');
        return;
      }
      if (value) {
        if (!hasPin) {
          setPinModal(true);
          return;
        }
        try {
          await setEnabled(true);
        } catch (e: any) {
          showAlert({
            icon: '🔒',
            title: 'Lock',
            message: userFacingError(e, 'Couldn’t turn on App lock. Please try again.'),
          });
        }
        return;
      }
      try {
        await setEnabled(false);
      } catch (e: any) {
        showAlert({
          icon: '🔒',
          title: 'Lock',
          message: userFacingError(e, 'Couldn’t turn off App lock. Please try again.'),
        });
      }
    },
    [hasPin, setEnabled, showAlert, isPro, openPaywall],
  );

  const enableBiometricFlow = useCallback(async () => {
    const availability = await getBiometryAvailability();
    setBio(availability);
    if (!availability.available) {
      showAlert({
        icon: '👆',
        title: 'Not available',
        message:
          availability.error ||
          'Add a fingerprint or Face ID in your phone settings, then try again.',
      });
      return;
    }
    const result = await promptBiometricUnlock(availability.label);
    if (!result.success) {
      if (!result.cancelled) {
        showAlert({
          icon: '👆',
          title: 'Couldn’t verify',
          message: result.error || 'Please try again.',
        });
      }
      return;
    }
    try {
      await setBiometricEnabled(true);
      showAlert({
        icon: '✅',
        title: `${availability.label} on`,
        message: `Next time you open Expenso, you can unlock with ${availability.label}. PIN stays as backup.`,
      });
    } catch (e: any) {
      showAlert({
        icon: '👆',
        title: 'Biometric',
        message: userFacingError(e, 'Couldn’t update biometric unlock. Please try again.'),
      });
    }
  }, [setBiometricEnabled, showAlert]);

  const openPinForBiometric = useCallback(() => {
    setPendingBioAfterPin(true);
    setPinInput('');
    setPin2('');
    setPinModal(true);
  }, []);

  const onToggleBiometric = useCallback(
    async (value: boolean) => {
      if (value && !isPro) {
        openPaywall('biometrics');
        return;
      }
      if (value) {
        if (!enabled || !hasPin) {
          showAlert({
            icon: '🔒',
            title: 'Set App lock first',
            message: `To use ${bio?.label || 'biometric'} unlock, you need an App lock PIN first. Your PIN is also the backup if fingerprint or Face ID fails.`,
            buttons: [
              { label: 'Cancel', variant: 'secondary' },
              { label: 'Set PIN', variant: 'primary', onPress: openPinForBiometric },
            ],
          });
          return;
        }
        await enableBiometricFlow();
        return;
      }
      try {
        await setBiometricEnabled(false);
      } catch (e: any) {
        showAlert({
          icon: '👆',
          title: 'Biometric',
          message: userFacingError(e, 'Couldn’t update biometric unlock. Please try again.'),
        });
      }
    },
    [
      enabled,
      hasPin,
      bio,
      enableBiometricFlow,
      setBiometricEnabled,
      showAlert,
      openPinForBiometric,
      isPro,
      openPaywall,
    ],
  );

  const savePin = useCallback(async () => {
    if (pin !== pin2) {
      showAlert({
        icon: '🔢',
        title: 'PIN mismatch',
        message: 'Both PINs must match.',
      });
      return;
    }
    try {
      await setPin(pin);
      setPinModal(false);
      setPinInput('');
      setPin2('');
      const continueBio = pendingBioAfterPin;
      setPendingBioAfterPin(false);

      if (continueBio) {
        void enableBiometricFlow();
        return;
      }

      showAlert({
        icon: '🔒',
        title: 'App lock on',
        message: bio?.available
          ? `PIN saved. You can also enable ${bio.label} below for faster unlock.`
          : 'Expenso will ask for this PIN when you open the app.',
      });
    } catch (e: any) {
      showAlert({
        icon: '🔢',
        title: 'Invalid PIN',
        message: userFacingError(e, 'Please enter a 4–8 digit PIN.'),
      });
    }
  }, [pin, pin2, setPin, bio, pendingBioAfterPin, enableBiometricFlow, showAlert]);

  const exportExcel = useCallback(async () => {
    if (!isPro) {
      openPaywall('export_excel');
      return;
    }
    if (!expenses.length) {
      showAlert({
        icon: '📤',
        title: 'Nothing to export',
        message: 'Add some expenses first.',
      });
      return;
    }
    setExporting(true);
    try {
      await exportAndShareExcel(expenses, {
        isJoint,
        accountLabel: isJoint ? 'Joint account' : 'Personal',
      });
    } catch (e: any) {
      showAlert({
        icon: '📤',
        title: 'Couldn’t export',
        message: userFacingError(e, 'Couldn’t create the Excel file. Please try again.'),
      });
    } finally {
      setExporting(false);
    }
  }, [expenses, isJoint, showAlert, isPro, openPaywall]);

  const exportPdf = useCallback(async () => {
    if (!isPro) {
      openPaywall('export_pdf');
      return;
    }
    if (!expenses.length) {
      showAlert({
        icon: '📄',
        title: 'Nothing to export',
        message: 'Add some expenses first.',
      });
      return;
    }
    setExportingPdf(true);
    try {
      await exportAndSharePdf(expenses, {
        isJoint,
        accountLabel: isJoint ? 'Joint account' : 'Personal',
      });
    } catch (e: any) {
      showAlert({
        icon: '📄',
        title: 'Couldn’t export',
        message: userFacingError(e, 'Couldn’t create the PDF. Please try again.'),
      });
    } finally {
      setExportingPdf(false);
    }
  }, [expenses, isJoint, showAlert, isPro, openPaywall]);

  const shareApp = useCallback(async () => {
    try {
      await Share.share({
        title: 'Expenso',
        message:
          'Try Expenso — track personal & joint expenses with Ask AI.\n' +
          'https://expenso.app',
      });
    } catch {
      /* cancelled */
    }
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Settings</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.section}>Security</Text>
          <View style={styles.card}>
            <SettingsRow
              title="App lock"
              subtitle={
                enabled
                  ? biometricEnabled
                    ? `PIN + ${bio?.label || 'biometric'} when opening Expenso`
                    : 'PIN required when opening Expenso'
                  : hasPin
                    ? 'Lock is off — toggle to enable'
                    : 'Protect the app with a PIN'
              }
              pro={!isPro}
              right={
                <Switch
                  value={enabled}
                  onValueChange={onToggleLock}
                  trackColor={{ false: colors.border, true: colors.primary + '99' }}
                  thumbColor={enabled ? colors.primaryLight : colors.textMuted}
                />
              }
            />
            <View style={styles.divider} />
            <SettingsRow
              title={hasPin ? 'Change PIN' : 'Set PIN'}
              subtitle="4–8 digit PIN stored on this device"
              onPress={() => {
                setPinInput('');
                setPin2('');
                setPinModal(true);
              }}
            />
            {bio?.available ? (
              <>
                <View style={styles.divider} />
                <SettingsRow
                  title={`${bio.label} unlock`}
                  subtitle={
                    enabled
                      ? `Use ${bio.label} instead of typing PIN`
                      : 'Set App lock PIN first — then enable this'
                  }
                  pro={!isPro}
                  right={
                    <Switch
                      value={biometricEnabled && enabled}
                      onValueChange={onToggleBiometric}
                      trackColor={{ false: colors.border, true: colors.primary + '99' }}
                      thumbColor={
                        biometricEnabled && enabled ? colors.primaryLight : colors.textMuted
                      }
                    />
                  }
                />
              </>
            ) : bio && !bio.available ? (
              <>
                <View style={styles.divider} />
                <SettingsRow
                  title="Biometric unlock"
                  subtitle="Add fingerprint / Face ID in phone Settings to enable"
                />
              </>
            ) : null}
          </View>

          {showJointNotifPrefs ? (
            <>
              <Text style={styles.section}>Joint notifications</Text>
              <View style={styles.card}>
                <SettingsRow
                  title="Notify partner when I add"
                  subtitle="Partner gets a push with your name and what you added"
                  right={
                    <Switch
                      value={notifyPartnerOnMyJointAdd}
                      onValueChange={onToggleNotifyPartner}
                      trackColor={{ false: colors.border, true: colors.primary + '99' }}
                      thumbColor={
                        notifyPartnerOnMyJointAdd ? colors.primaryLight : colors.textMuted
                      }
                    />
                  }
                />
                <View style={styles.divider} />
                <SettingsRow
                  title="Notify me when partner adds"
                  subtitle="You’ll get a push with their name and the expense"
                  right={
                    <Switch
                      value={notifyMeOnPartnerJointAdd}
                      onValueChange={onToggleNotifyMe}
                      trackColor={{ false: colors.border, true: colors.primary + '99' }}
                      thumbColor={
                        notifyMeOnPartnerJointAdd ? colors.primaryLight : colors.textMuted
                      }
                    />
                  }
                />
              </View>
            </>
          ) : null}

          <Text style={styles.section}>Export</Text>
          <View style={styles.card}>
            <SettingsRow
              title="Export Excel"
              subtitle={`${expenses.length} expense${expenses.length === 1 ? '' : 's'} · .xlsx file${isJoint ? ' · includes joint' : ''}`}
              pro={!isPro}
              onPress={exportExcel}
              right={
                exporting ? (
                  <ActivityIndicator color={colors.primaryLight} />
                ) : (
                  <Text style={{ fontSize: 22, color: colors.textMuted, fontWeight: '600' }}>›</Text>
                )
              }
            />
            <View style={styles.divider} />
            <SettingsRow
              title="Export PDF report"
              subtitle="Summary + category & full expense list"
              pro={!isPro}
              onPress={exportPdf}
              right={
                exportingPdf ? (
                  <ActivityIndicator color={colors.primaryLight} />
                ) : (
                  <Text style={{ fontSize: 22, color: colors.textMuted, fontWeight: '600' }}>›</Text>
                )
              }
            />
          </View>

          <Text style={styles.section}>Support & share</Text>
          <View style={styles.card}>
            <SettingsRow
              title="Send feedback"
              subtitle="Ideas, bugs, or love notes"
              onPress={() => setFeedbackOpen(true)}
            />
            <View style={styles.divider} />
            <SettingsRow
              title="Help & support"
              subtitle={
                supportUnread > 0
                  ? `${supportUnread} new reply${supportUnread === 1 ? '' : 's'} from support`
                  : 'Open a ticket · track replies here'
              }
              onPress={() => setSupportOpen(true)}
              right={
                supportUnread > 0 ? (
                  <View
                    style={{
                      minWidth: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 6,
                    }}
                  >
                    <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>
                      {supportUnread > 9 ? '9+' : supportUnread}
                    </Text>
                  </View>
                ) : undefined
              }
            />
            <View style={styles.divider} />
            <SettingsRow
              title="Share Expenso"
              subtitle="Invite friends & family"
              onPress={shareApp}
            />
          </View>

          <Text style={styles.section}>Look & feel</Text>
          <Pressable
            onPress={() => setThemesOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Custom themes"
            style={({ pressed }) => [styles.themesCtaWrap, pressed && styles.themesCtaPressed]}
          >
            <LinearGradient
              colors={[
                colors.gradientStart + '55',
                colors.primary + '28',
                colors.gradientEnd + '40',
              ]}
              {...(gradientPoints
                ? { start: gradientPoints.start, end: gradientPoints.end }
                : { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } })}
              style={styles.themesCta}
            >
              <View style={styles.themesCtaGlow} />
              <View style={styles.themesCtaTop}>
                <View style={styles.swatchRow}>
                  {themeSwatches.map(([a, b], i) => (
                    <LinearGradient
                      key={i}
                      colors={[a, b]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.swatch, { marginLeft: i === 0 ? 0 : -10, zIndex: 5 - i }]}
                    />
                  ))}
                </View>
                {!isPro ? (
                  <View style={styles.themesProPill}>
                    <Text style={styles.themesProText}>PRO PACKS</Text>
                  </View>
                ) : (
                  <View style={[styles.themesProPill, styles.themesLivePill]}>
                    <Text style={[styles.themesProText, styles.themesLiveText]}>ACTIVE</Text>
                  </View>
                )}
              </View>

              <Text style={styles.themesTitle}>Custom themes</Text>
              <Text style={styles.themesSub}>
                Now using {packMeta.name}
                {packMeta.subtitle ? ` · ${packMeta.subtitle}` : ''}
              </Text>

              <View style={styles.themesFooter}>
                <LinearGradient
                  colors={[...actionGradient]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.themesBrowseBtn}
                >
                  <Text style={styles.themesBrowseText}>Browse looks</Text>
                </LinearGradient>
                <Text style={styles.themesChevron}>›</Text>
              </View>
            </LinearGradient>
          </Pressable>

          <Text style={styles.footerNote}>
            Excel (.xlsx) and PDF open in Sheets / Drive / WhatsApp as real files. PIN &
            biometric stay on this device only.
          </Text>

          <Text style={styles.section}>Legal</Text>
          <View style={styles.card}>
            <SettingsRow
              title="Privacy Policy"
              subtitle="How we handle your data"
              onPress={() => Linking.openURL(LEGAL_PRIVACY_URL)}
            />
            <View style={styles.divider} />
            <SettingsRow
              title="Terms of Service"
              subtitle="Rules for using Expenso"
              onPress={() => Linking.openURL(LEGAL_TERMS_URL)}
            />
          </View>

          <Text style={styles.section}>Account</Text>
          <View style={styles.card}>
            <SettingsRow
              title={authBusy ? 'Signing out…' : 'Log out'}
              subtitle="Sign out of this device"
              danger
              onPress={async () => {
                if (authBusy) return;
                await logout();
                onClose();
              }}
            />
          </View>
        </ScrollView>
      </View>

      <AppAlertModal
        visible={!!alert}
        title={alert?.title || ''}
        message={alert?.message || ''}
        icon={alert?.icon}
        buttons={alert?.buttons}
        onClose={() => setAlert(null)}
      />

      <FeedbackModal
        visible={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onSent={() =>
          showAlert({
            icon: '💌',
            title: 'Thanks!',
            message: 'Thanks! Your feedback was sent to our team.',
          })
        }
      />

      <SupportModal
        visible={supportOpen}
        onClose={() => setSupportOpen(false)}
        onUnreadChange={setSupportUnread}
      />

      <ThemesScreen visible={themesOpen} onClose={() => setThemesOpen(false)} />

      <Modal
        visible={pinModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPendingBioAfterPin(false);
          setPinModal(false);
        }}
      >
        <View style={styles.pinBackdrop}>
          <View style={[styles.pinCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pinTitle, { color: colors.text }]}>
              {hasPin ? 'Change PIN' : 'Create PIN'}
            </Text>
            {pendingBioAfterPin ? (
              <Text style={[styles.pinHint, { color: colors.textSecondary }]}>
                Set this PIN first so {bio?.label || 'biometric'} unlock can turn on. It also
                stays as your backup if biometrics fail.
              </Text>
            ) : null}
            <TextInput
              style={[styles.pinInput, { color: colors.text, borderColor: colors.border }]}
              value={pin}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="New PIN"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.pinInput, { color: colors.text, borderColor: colors.border }]}
              value={pin2}
              onChangeText={setPin2}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="Confirm PIN"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.pinActions}>
              <Pressable
                onPress={() => {
                  setPendingBioAfterPin(false);
                  setPinModal(false);
                }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={savePin}>
                <Text style={{ color: colors.primaryLight, fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function rowStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    title: { ...Typography.bodyBold, color: colors.text },
    subtitle: { ...Typography.caption, color: colors.textMuted, marginTop: 2 },
    chevron: { fontSize: 22, color: colors.textMuted, fontWeight: '600' },
    proPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: Radius.full,
      backgroundColor: colors.warning + '33',
      borderWidth: 1,
      borderColor: colors.warning + '66',
    },
    proText: { fontSize: 10, fontWeight: '800', color: colors.warning, letterSpacing: 0.6 },
  });
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
    scroll: { padding: Spacing.lg },
    section: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: Radius.xl,
      paddingHorizontal: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.lg,
    },
    divider: { height: 1, backgroundColor: colors.border },
    themesCtaWrap: {
      marginBottom: Spacing.lg,
      borderRadius: Radius.xl + 2,
      overflow: 'hidden',
    },
    themesCtaPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
    themesCta: {
      borderRadius: Radius.xl + 2,
      padding: Spacing.lg,
      borderWidth: 1,
      borderColor: colors.primary + '44',
      overflow: 'hidden',
      minHeight: 148,
    },
    themesCtaGlow: {
      position: 'absolute',
      top: -40,
      right: -30,
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.accent + '22',
    },
    themesCtaTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    swatchRow: { flexDirection: 'row', alignItems: 'center' },
    swatch: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    themesProPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: Radius.full,
      backgroundColor: colors.warning + '28',
      borderWidth: 1,
      borderColor: colors.warning + '66',
    },
    themesProText: {
      fontSize: 10,
      fontWeight: '800',
      color: colors.warning,
      letterSpacing: 0.7,
    },
    themesLivePill: {
      backgroundColor: colors.success + '22',
      borderColor: colors.success + '55',
    },
    themesLiveText: { color: colors.success },
    themesTitle: {
      ...Typography.h3,
      color: colors.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    themesSub: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 18,
      marginBottom: Spacing.md,
    },
    themesFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    themesBrowseBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      borderRadius: Radius.full,
    },
    themesBrowseText: {
      ...Typography.caption,
      color: '#FFF',
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    themesChevron: {
      fontSize: 26,
      fontWeight: '600',
      color: colors.primaryLight,
      marginRight: 2,
    },
    footerNote: {
      ...Typography.caption,
      color: colors.textMuted,
      lineHeight: 18,
      marginTop: Spacing.sm,
    },
    pinBackdrop: {
      flex: 1,
      backgroundColor: '#00000088',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    pinCard: {
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pinTitle: { ...Typography.h3, marginBottom: Spacing.sm },
    pinHint: {
      ...Typography.caption,
      lineHeight: 18,
      marginBottom: Spacing.md,
    },
    pinInput: {
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      fontSize: 18,
      letterSpacing: 4,
    },
    pinActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: Spacing.lg,
      marginTop: Spacing.md,
    },
  });
}
