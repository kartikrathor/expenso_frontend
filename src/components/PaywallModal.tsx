import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useProStore, PaywallReason } from '../store/proStore';
import { getThemePackMeta } from '../constants/themePacks';
import { LEGAL_PRIVACY_URL, LEGAL_TERMS_URL } from '../constants/api';

const REASON_COPY: Record<
  Exclude<PaywallReason, 'theme'>,
  { title: string; body: string }
> = {
  ask_ai: {
    title: 'Ask Expenso is Pro',
    body: 'Chat, chips & smart answers unlock with Pro — 500 fresh tokens every day.',
  },
  analytics_nav: {
    title: 'Navigate deeper with Pro',
    body: 'Week / month / year arrows unlock so you can compare past periods.',
  },
  custom_date: {
    title: 'Custom dates are Pro',
    body: 'Pick any From–To range once you upgrade.',
  },
  app_lock: {
    title: 'App Lock is Pro',
    body: 'PIN lock keeps your spending private on this device.',
  },
  biometrics: {
    title: 'Biometrics is Pro',
    body: 'Unlock Expenso with Face ID / fingerprint.',
  },
  export_excel: {
    title: 'Excel export is Pro',
    body: 'Share clean .xlsx sheets with Pro.',
  },
  export_pdf: {
    title: 'PDF report is Pro',
    body: 'Beautiful PDF summaries unlock with Pro.',
  },
};

export function PaywallModal() {
  const { colors, gradientPoints, actionGradient } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const paywall = useProStore(s => s.paywall);
  const catalog = useProStore(s => s.catalog);
  const themePrices = useProStore(s => s.themePrices);
  const closePaywall = useProStore(s => s.closePaywall);
  const subscribe = useProStore(s => s.subscribe);
  const restorePurchases = useProStore(s => s.restorePurchases);
  const purchaseTheme = useProStore(s => s.purchaseTheme);

  const [busy, setBusy] = useState<
    'monthly' | 'yearly' | 'theme_m' | 'theme_p' | 'restore' | null
  >(null);
  const [error, setError] = useState('');

  if (!paywall.visible) return null;

  const isTheme = paywall.reason === 'theme';
  const themeMeta = paywall.themePackId
    ? getThemePackMeta(paywall.themePackId as any)
    : null;
  const themePrice = themePrices.find(t => t.packId === paywall.themePackId);

  const title = isTheme
    ? `Unlock ${themeMeta?.name || 'theme'}`
    : REASON_COPY[paywall.reason as Exclude<PaywallReason, 'theme'>].title;
  const body = isTheme
    ? 'Preview is free. Choose a monthly trial or buy forever — prices set by Expenso.'
    : REASON_COPY[paywall.reason as Exclude<PaywallReason, 'theme'>].body;

  const monthly = catalog?.monthlyPrice ?? 49;
  const yearly = catalog?.yearlyPrice ?? 399;
  const monthlyLabel = catalog?.monthlyLabel || 'Pro Monthly';
  const yearlyLabel = catalog?.yearlyLabel || 'Pro Yearly';
  const tokens = catalog?.dailyTokens ?? 500;

  const run = async (fn: () => Promise<void>, key: typeof busy) => {
    setBusy(key);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message || 'Purchase failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closePaywall}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinearGradient
            colors={[...actionGradient]}
            {...(gradientPoints
              ? { start: gradientPoints.start, end: gradientPoints.end }
              : { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } })}
            style={styles.hero}
          >
            <Text style={styles.heroBadge}>{isTheme ? 'THEME' : 'PRO'}</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroBody}>{body}</Text>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {!isTheme ? (
              <>
                <Text style={styles.perk}>✦ Ask Expenso — {tokens} tokens / day</Text>
                <Text style={styles.perk}>✦ Analytics arrows & custom dates</Text>
                <Text style={styles.perk}>✦ App Lock, biometrics, Excel & PDF</Text>

                <Pressable
                  style={styles.primaryBtn}
                  disabled={!!busy}
                  onPress={() => run(() => subscribe('yearly'), 'yearly')}
                >
                  <LinearGradient
                    colors={[...actionGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryGrad}
                  >
                    {busy === 'yearly' ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryText}>{yearlyLabel}</Text>
                        <Text style={styles.primaryPrice}>₹{yearly}/year</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  disabled={!!busy}
                  onPress={() => run(() => subscribe('monthly'), 'monthly')}
                >
                  {busy === 'monthly' ? (
                    <ActivityIndicator color={colors.primaryLight} />
                  ) : (
                    <>
                      <Text style={[styles.secondaryText, { color: colors.text }]}>
                        {monthlyLabel}
                      </Text>
                      <Text style={[styles.secondaryPrice, { color: colors.primaryLight }]}>
                        ₹{monthly}/month
                      </Text>
                    </>
                  )}
                </Pressable>

                <Text style={[styles.storeHint, { color: colors.textMuted }]}>
                  Payment via {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}. Cancel
                  anytime in store subscriptions.
                </Text>

                <Text style={[styles.legalLine, { color: colors.textMuted }]}>
                  <Text
                    style={[styles.legalLink, { color: colors.primaryLight }]}
                    onPress={() => Linking.openURL(LEGAL_TERMS_URL)}
                  >
                    Terms
                  </Text>
                  {' · '}
                  <Text
                    style={[styles.legalLink, { color: colors.primaryLight }]}
                    onPress={() => Linking.openURL(LEGAL_PRIVACY_URL)}
                  >
                    Privacy
                  </Text>
                </Text>

                <Pressable
                  disabled={!!busy}
                  onPress={() => run(() => restorePurchases(), 'restore')}
                  style={styles.restoreBtn}
                >
                  {busy === 'restore' ? (
                    <ActivityIndicator color={colors.primaryLight} />
                  ) : (
                    <Text style={[styles.restoreText, { color: colors.primaryLight }]}>
                      Restore purchases
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.perk, { color: colors.textSecondary }]}>
                  {themeMeta?.subtitle || 'Color pack'}
                </Text>
                <Pressable
                  style={styles.primaryBtn}
                  disabled={!!busy || !themePrice}
                  onPress={() =>
                    run(
                      () => purchaseTheme(paywall.themePackId!, 'monthly'),
                      'theme_m',
                    )
                  }
                >
                  <LinearGradient
                    colors={[...actionGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryGrad}
                  >
                    {busy === 'theme_m' ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <>
                        <Text style={styles.primaryText}>Monthly trial</Text>
                        <Text style={styles.primaryPrice}>
                          ₹{themePrice?.monthlyPrice ?? 19}/month
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                <Pressable
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  disabled={!!busy || !themePrice}
                  onPress={() =>
                    run(
                      () => purchaseTheme(paywall.themePackId!, 'permanent'),
                      'theme_p',
                    )
                  }
                >
                  {busy === 'theme_p' ? (
                    <ActivityIndicator color={colors.primaryLight} />
                  ) : (
                    <>
                      <Text style={[styles.secondaryText, { color: colors.text }]}>
                        Buy forever
                      </Text>
                      <Text style={[styles.secondaryPrice, { color: colors.primaryLight }]}>
                        ₹{themePrice?.permanentPrice ?? 37} one-time
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}

            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

            <Pressable onPress={closePaywall} style={styles.dismiss}>
              <Text style={[styles.dismissText, { color: colors.textMuted }]}>Not now</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay || 'rgba(0,0,0,0.72)',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    card: {
      borderRadius: Radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      maxHeight: '88%',
    },
    hero: {
      padding: Spacing.lg,
      paddingTop: Spacing.xl,
      paddingBottom: Spacing.lg,
    },
    heroBadge: {
      ...Typography.small,
      color: '#FFFFFFCC',
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
    },
    heroTitle: {
      ...Typography.h2,
      color: '#FFF',
      marginBottom: Spacing.sm,
    },
    heroBody: {
      ...Typography.caption,
      color: '#FFFFFFDD',
      lineHeight: 18,
    },
    body: {
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    perk: {
      ...Typography.caption,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    primaryBtn: {
      marginTop: Spacing.md,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    primaryGrad: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
      gap: 2,
    },
    primaryText: { ...Typography.bodyBold, color: '#FFF' },
    primaryPrice: { ...Typography.caption, color: '#FFFFFFCC', fontWeight: '700' },
    secondaryBtn: {
      marginTop: Spacing.sm,
      borderRadius: Radius.lg,
      borderWidth: 1,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.surfaceHighlight,
    },
    secondaryText: { ...Typography.bodyBold },
    secondaryPrice: { ...Typography.caption, fontWeight: '700' },
    storeHint: {
      ...Typography.small,
      textAlign: 'center',
      marginTop: Spacing.sm,
      lineHeight: 16,
    },
    legalLine: {
      ...Typography.small,
      textAlign: 'center',
      marginTop: 4,
    },
    legalLink: {
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    restoreBtn: {
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    restoreText: { ...Typography.caption, fontWeight: '700' },
    error: { ...Typography.caption, marginTop: Spacing.sm, textAlign: 'center' },
    dismiss: { paddingVertical: Spacing.md, alignItems: 'center' },
    dismissText: { ...Typography.bodyBold },
  });
}
