import React, { useMemo } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { Radius, Spacing, Typography } from '../constants/theme';

type WidgetScreenProps = {
  visible: boolean;
  onClose: () => void;
};

const STEPS = [
  'Long-press an empty area on your Android home screen.',
  'Tap Widgets, then find Expenso in the app list.',
  'Press and drag the Expenso widget onto your home screen.',
  'Open Expenso and sign in once. Tap Sync on the widget whenever you want a fresh total.',
];

export function WidgetScreen({ visible, onClose }: WidgetScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>Home widget</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {Platform.OS !== 'android' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Android only for now</Text>
              <Text style={styles.body}>
                The Expenso home-screen widget is currently available on
                Android.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.preview}>
                <View style={styles.previewTop}>
                  <Text style={styles.brand}>Expenso</Text>
                  <Text style={styles.sync}>Sync</Text>
                </View>
                <Text style={styles.eyebrow}>TODAY</Text>
                <Text style={styles.amount}>₹840</Text>
                <Text style={styles.eyebrow}>RECENT EXPENSES</Text>
                <Text style={styles.previewRow}>Blinkit ₹200</Text>
                <Text style={styles.previewRow}>Swiggy ₹350</Text>
                <View style={styles.addButton}>
                  <Text style={styles.addText}>+ Add expense</Text>
                </View>
                <Text style={styles.actions}>🎙 Speak Today</Text>
              </View>

              <Text style={styles.section}>How to add it</Text>
              <View style={styles.card}>
                {STEPS.map((step, index) => (
                  <View key={step} style={styles.step}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.section}>What each action does</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>+ Add expense</Text>
                <Text style={styles.body}>
                  Type and save without waiting for the full app UI.
                </Text>
                <Text style={styles.cardTitle}>Speak</Text>
                <Text style={styles.body}>
                  Starts the voice quick-add flow.
                </Text>
                <Text style={styles.cardTitle}>Today</Text>
                <Text style={styles.body}>
                  Shows today’s total and recent expenses.
                </Text>
                <Text style={styles.cardTitle}>Sync</Text>
                <Text style={styles.body}>
                  Refreshes data from your signed-in Expenso account.
                </Text>
              </View>

              <Text style={styles.note}>
                The widget uses the Default color style so it stays readable on
                every launcher.
              </Text>
            </>
          )}
        </ScrollView>
      </View>
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
    back: { ...Typography.bodyBold, color: colors.primaryLight, width: 70 },
    title: { ...Typography.h3, color: colors.text },
    headerSpacer: { width: 70 },
    scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
    preview: {
      borderRadius: Radius.xl,
      padding: Spacing.lg,
      backgroundColor: '#101725',
      borderWidth: 1,
      borderColor: '#25324A',
    },
    previewTop: { flexDirection: 'row', justifyContent: 'space-between' },
    brand: { ...Typography.h3, color: '#FFFFFF' },
    sync: { ...Typography.bodyBold, color: '#6EA8FF' },
    eyebrow: { ...Typography.small, color: '#91A0B8', marginTop: Spacing.md },
    amount: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
    previewRow: { ...Typography.body, color: '#D7E0EF', marginTop: Spacing.sm },
    addButton: {
      marginTop: Spacing.lg,
      borderRadius: Radius.md,
      backgroundColor: '#2667FF',
      padding: Spacing.md,
      alignItems: 'center',
    },
    addText: { ...Typography.bodyBold, color: '#FFFFFF' },
    actions: {
      ...Typography.bodyBold,
      color: '#B9C7DB',
      textAlign: 'center',
      marginTop: Spacing.md,
    },
    section: {
      ...Typography.caption,
      color: colors.textSecondary,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginTop: Spacing.xl,
      marginBottom: Spacing.sm,
    },
    card: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: Spacing.lg,
    },
    step: { flexDirection: 'row', marginBottom: Spacing.md },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '22',
      marginRight: Spacing.md,
    },
    stepNumberText: { ...Typography.bodyBold, color: colors.primaryLight },
    stepText: { ...Typography.body, color: colors.text, flex: 1 },
    cardTitle: {
      ...Typography.bodyBold,
      color: colors.text,
      marginTop: Spacing.sm,
    },
    body: {
      ...Typography.body,
      color: colors.textSecondary,
      marginTop: 3,
      marginBottom: Spacing.sm,
    },
    note: {
      ...Typography.caption,
      color: colors.textMuted,
      marginTop: Spacing.lg,
      textAlign: 'center',
    },
  });
}
