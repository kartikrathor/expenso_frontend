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
  Alert,
  Linking,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAppLockStore } from '../store/appLockStore';
import { useHouseholdExpenses } from '../hooks/useHouseholdExpenses';
import { expensesToCsv, buildExportFileName } from '../utils/exportExpenses';
import {
  getBiometryAvailability,
  promptBiometricUnlock,
  BiometryAvailability,
} from '../utils/biometrics';

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
  const { colors } = useTheme();
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
  const { colors } = useTheme();
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
  const [bio, setBio] = useState<BiometryAvailability | null>(null);

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

  const onToggleLock = useCallback(
    async (value: boolean) => {
      if (value) {
        if (!hasPin) {
          setPinModal(true);
          return;
        }
        try {
          await setEnabled(true);
        } catch (e: any) {
          Alert.alert('Lock', e?.message || 'Could not enable lock');
        }
        return;
      }
      try {
        await setEnabled(false);
      } catch (e: any) {
        Alert.alert('Lock', e?.message || 'Could not disable lock');
      }
    },
    [hasPin, setEnabled],
  );

  const onToggleBiometric = useCallback(
    async (value: boolean) => {
      if (value) {
        if (!enabled) {
          Alert.alert('App lock first', 'Turn on App lock (PIN) before enabling biometrics.');
          return;
        }
        if (!bio?.available) {
          Alert.alert(
            'Not available',
            'Add a fingerprint or Face ID in your phone settings, then try again.',
          );
          return;
        }
        const ok = await promptBiometricUnlock(bio.label);
        if (!ok) {
          Alert.alert('Cancelled', `${bio.label} was not confirmed.`);
          return;
        }
      }
      try {
        await setBiometricEnabled(value);
      } catch (e: any) {
        Alert.alert('Biometric', e?.message || 'Could not update');
      }
    },
    [enabled, bio, setBiometricEnabled],
  );

  const savePin = useCallback(async () => {
    if (pin !== pin2) {
      Alert.alert('PIN mismatch', 'Both PINs must match.');
      return;
    }
    try {
      await setPin(pin);
      setPinModal(false);
      setPinInput('');
      setPin2('');
      Alert.alert(
        'App lock on',
        bio?.available
          ? `PIN saved. You can also enable ${bio.label} below for faster unlock.`
          : 'Expenso will ask for this PIN when you open the app.',
      );
    } catch (e: any) {
      Alert.alert('Invalid PIN', e?.message || 'Try again');
    }
  }, [pin, pin2, setPin, bio]);

  const exportCsv = useCallback(async () => {
    if (!expenses.length) {
      Alert.alert('Nothing to export', 'Add some expenses first.');
      return;
    }
    setExporting(true);
    try {
      const csv = expensesToCsv(expenses);
      const name = buildExportFileName('csv');
      await Share.share({
        title: name,
        message: Platform.OS === 'ios' ? csv : `Expenso export (${name})\n\n${csv}`,
      });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Try again');
    } finally {
      setExporting(false);
    }
  }, [expenses]);

  const exportPdf = useCallback(() => {
    Alert.alert(
      'PDF export — Pro',
      'Nice PDF reports (monthly summary + charts) are planned for Expenso Pro. CSV export is free for now.',
    );
  }, []);

  const sendFeedback = useCallback(async () => {
    const subject = encodeURIComponent('Expenso feedback');
    const body = encodeURIComponent(
      `Hi Expenso team,\n\nMy feedback:\n\n\n---\nApp: Expenso\nPlatform: ${Platform.OS}`,
    );
    const url = `mailto:kartikrathor.work@gmail.com?subject=${subject}&body=${body}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert('Email', 'No email app found. Write to kartikrathor.work@gmail.com');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Email', 'Could not open mail app.');
    }
  }, []);

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
                      : 'Turn on App lock first'
                  }
                  right={
                    <Switch
                      value={biometricEnabled && enabled}
                      onValueChange={onToggleBiometric}
                      disabled={!enabled}
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

          <Text style={styles.section}>Export</Text>
          <View style={styles.card}>
            <SettingsRow
              title="Export Excel (CSV)"
              subtitle={`${expenses.length} expense${expenses.length === 1 ? '' : 's'}${isJoint ? ' · includes joint' : ''}`}
              onPress={exportCsv}
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
              subtitle="Monthly summary with charts"
              onPress={exportPdf}
              pro
            />
          </View>

          <Text style={styles.section}>Support & share</Text>
          <View style={styles.card}>
            <SettingsRow
              title="Send feedback"
              subtitle="Bugs, ideas, or love notes"
              onPress={sendFeedback}
            />
            <View style={styles.divider} />
            <SettingsRow
              title="Share Expenso"
              subtitle="Invite friends & family"
              onPress={shareApp}
            />
          </View>

          <Text style={styles.section}>Coming in Pro</Text>
          <View style={styles.card}>
            <SettingsRow
              title="Cloud backup & sync"
              subtitle="Restore on a new phone"
              pro
              onPress={() =>
                Alert.alert('Pro', 'Full cloud backup beyond joint sync is planned for Pro.')
              }
            />
            <View style={styles.divider} />
            <SettingsRow
              title="Unlimited AI precise answers"
              subtitle="Higher daily Ask AI limits"
              pro
              onPress={() =>
                Alert.alert('Pro', 'Higher AI token limits will ship with Expenso Pro.')
              }
            />
            <View style={styles.divider} />
            <SettingsRow
              title="Custom themes & widgets"
              subtitle="Home-screen spending widget"
              pro
              onPress={() => Alert.alert('Pro', 'Widgets & extra themes are on the Pro roadmap.')}
            />
          </View>

          <Text style={styles.footerNote}>
            CSV opens in Excel / Google Sheets. PIN & biometric stay on this device only.
          </Text>
        </ScrollView>
      </View>

      <Modal visible={pinModal} transparent animationType="fade" onRequestClose={() => setPinModal(false)}>
        <View style={styles.pinBackdrop}>
          <View style={[styles.pinCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.pinTitle, { color: colors.text }]}>
              {hasPin ? 'Change PIN' : 'Create PIN'}
            </Text>
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
              <Pressable onPress={() => setPinModal(false)}>
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
    },
    pinTitle: { ...Typography.h3, marginBottom: Spacing.sm },
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
