import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export type AppAlertButton = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
};

export type AppAlertContent = {
  title: string;
  message: string;
  icon?: string;
  buttons?: AppAlertButton[];
};

type AppAlertModalProps = {
  visible: boolean;
  title: string;
  message: string;
  icon?: string;
  buttons?: AppAlertButton[];
  onClose: () => void;
};

export function AppAlertModal({
  visible,
  title,
  message,
  icon = '✨',
  buttons,
  onClose,
}: AppAlertModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const actions: AppAlertButton[] =
    buttons && buttons.length > 0
      ? buttons
      : [{ label: 'OK', variant: 'primary' }];

  const handlePress = (btn: AppAlertButton) => {
    onClose();
    // Defer so the modal can dismiss before the next action (e.g. open PIN modal)
    setTimeout(() => btn.onPress?.(), 50);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '22' }]}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            {actions.map((btn, i) => {
              const variant = btn.variant || (actions.length === 1 ? 'primary' : i === actions.length - 1 ? 'primary' : 'secondary');
              if (variant === 'primary') {
                return (
                  <Pressable
                    key={`${btn.label}-${i}`}
                    style={styles.btnPrimary}
                    onPress={() => handlePress(btn)}
                  >
                    <LinearGradient
                      colors={[colors.gradientStart, colors.gradientEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnGrad}
                    >
                      <Text style={styles.btnPrimaryText}>{btn.label}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              }
              if (variant === 'danger') {
                return (
                  <Pressable
                    key={`${btn.label}-${i}`}
                    style={[styles.btnGhost, { borderColor: colors.danger + '55', backgroundColor: colors.danger + '12' }]}
                    onPress={() => handlePress(btn)}
                  >
                    <Text style={[styles.btnGhostText, { color: colors.danger }]}>{btn.label}</Text>
                  </Pressable>
                );
              }
              return (
                <Pressable
                  key={`${btn.label}-${i}`}
                  style={[styles.btnGhost, { borderColor: colors.border, backgroundColor: colors.background }]}
                  onPress={() => handlePress(btn)}
                >
                  <Text style={[styles.btnGhostText, { color: colors.textSecondary }]}>
                    {btn.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#00000099',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    card: {
      borderRadius: Radius.xl,
      padding: Spacing.xl,
      borderWidth: 1,
      alignItems: 'center',
    },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    icon: { fontSize: 26 },
    title: {
      ...Typography.h3,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    message: {
      ...Typography.body,
      textAlign: 'center',
      lineHeight: 22,
      fontSize: 15,
      marginBottom: Spacing.lg,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: Spacing.sm,
      width: '100%',
    },
    btnGhost: {
      flex: 1,
      height: 48,
      borderRadius: Radius.lg,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
    },
    btnGhostText: {
      ...Typography.bodyBold,
      fontSize: 15,
    },
    btnPrimary: {
      flex: 1.15,
      height: 48,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    btnGrad: {
      height: 48,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.md,
    },
    btnPrimaryText: {
      ...Typography.bodyBold,
      color: '#FFF',
      fontSize: 15,
    },
  });
}
