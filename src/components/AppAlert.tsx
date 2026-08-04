import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { Spacing, Typography, Radius } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AppAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  onDismiss?: () => void;
  /** Icon emoji shown at top, e.g. "⚠️" */
  icon?: string;
}

const ENTER_MS = 240;
const EXIT_MS = 180;
const SPRING = { damping: 26, stiffness: 320, mass: 0.8 };

export function AppAlert({
  visible,
  title,
  message,
  buttons,
  onDismiss,
  icon,
}: AppAlertProps) {
  const { colors, isDark, actionGradient } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const backdropOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.92);
  const cardTranslateY = useSharedValue(16);

  const [modalVisible, setModalVisible] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const closingRef = React.useRef(false);

  const resetAnim = useCallback(() => {
    backdropOpacity.value = 0;
    cardOpacity.value = 0;
    cardScale.value = 0.92;
    cardTranslateY.value = 16;
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setClosing(false);
    setModalVisible(false);
    resetAnim();
    onDismiss?.();
  }, [onDismiss, resetAnim]);

  const animateIn = useCallback(() => {
    backdropOpacity.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    cardOpacity.value = withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    cardScale.value = withSpring(1, SPRING);
    cardTranslateY.value = withSpring(0, SPRING);
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const animateOut = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    cardOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
    cardScale.value = withTiming(0.94, { duration: EXIT_MS });
    cardTranslateY.value = withTiming(10, { duration: EXIT_MS });
    backdropOpacity.value = withTiming(0, { duration: EXIT_MS + 20, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(finishClose)();
    });
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY, finishClose]);

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setClosing(false);
      setModalVisible(true);
      resetAnim();
      requestAnimationFrame(() => animateIn());
    } else if (modalVisible && !closingRef.current) {
      animateOut();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedButtons: AppAlertButton[] = buttons && buttons.length > 0
    ? buttons
    : [{ text: 'OK', style: 'default', onPress: onDismiss }];

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }, { translateY: cardTranslateY.value }],
  }));

  return (
    <Modal visible={modalVisible} transparent animationType="none" statusBarTranslucent onRequestClose={() => !closing && animateOut()}>
      <View style={styles.overlay} pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => !closing && animateOut()} />
        </Animated.View>

        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient
            colors={[colors.gradientMid + '28', colors.surface]}
            style={styles.cardInner}
          >
            <LinearGradient
              colors={[...actionGradient]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.topAccent}
            />

            {icon ? (
              <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '35' }]}>
                <Text style={styles.iconEmoji}>{icon}</Text>
              </View>
            ) : null}

            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}

            <View style={[styles.actions, resolvedButtons.length === 1 && styles.actionsSingle]}>
              {resolvedButtons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';

                const handlePress = () => {
                  if (closing) return;
                  animateOut();
                  btn.onPress?.();
                };

                if (isDestructive) {
                  return (
                    <Pressable key={i} style={styles.btnWrap} onPress={handlePress}>
                      <LinearGradient
                        colors={[colors.danger, '#C0131F']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.btnGrad}
                      >
                        <Text style={styles.btnTextWhite}>{btn.text}</Text>
                      </LinearGradient>
                    </Pressable>
                  );
                }

                if (isCancel) {
                  return (
                    <Pressable key={i} style={[styles.btnWrap, styles.btnCancel]} onPress={handlePress}>
                      <Text style={[styles.btnText, { color: colors.textSecondary }]}>{btn.text}</Text>
                    </Pressable>
                  );
                }

                return (
                  <Pressable key={i} style={styles.btnWrap} onPress={handlePress}>
                    <LinearGradient
                      colors={[...actionGradient]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.btnGrad}
                    >
                      <Text style={styles.btnTextWhite}>{btn.text}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Lightweight hook to imperatively show AppAlert */
export function useAppAlert() {
  const [alertState, setAlertState] = React.useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons?: AppAlertButton[];
    icon?: string;
  }>({ visible: false, title: '' });

  const show = useCallback((
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    icon?: string,
  ) => {
    setAlertState({ visible: true, title, message, buttons, icon });
  }, []);

  const dismiss = useCallback(() => {
    setAlertState(prev => ({ ...prev, visible: false }));
  }, []);

  const alertNode = (
    <AppAlert
      visible={alertState.visible}
      title={alertState.title}
      message={alertState.message}
      buttons={alertState.buttons}
      icon={alertState.icon}
      onDismiss={dismiss}
    />
  );

  return { show, dismiss, alertNode };
}

function createStyles(colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: Spacing.lg,
    },
    backdrop: { ...StyleSheet.absoluteFill },
    card: {
      width: '100%',
      maxWidth: 320,
      borderRadius: Radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: isDark ? colors.primary + '30' : colors.border,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.16,
      shadowRadius: 28,
      elevation: 20,
    },
    cardInner: {
      padding: Spacing.lg,
      paddingTop: Spacing.md,
      alignItems: 'center',
    },
    topAccent: {
      width: 48,
      height: 4,
      borderRadius: Radius.full,
      marginBottom: Spacing.lg,
    },
    iconWrap: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginBottom: Spacing.md,
    },
    iconEmoji: { fontSize: 26 },
    title: {
      ...Typography.h2,
      color: colors.text,
      textAlign: 'center',
      marginBottom: Spacing.sm,
    },
    message: {
      ...Typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.lg,
    },
    actions: {
      width: '100%',
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    actionsSingle: { flexDirection: 'column' },
    btnWrap: {
      flex: 1,
      borderRadius: Radius.lg,
      overflow: 'hidden',
    },
    btnGrad: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    btnCancel: {
      backgroundColor: colors.surfaceHighlight,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    btnText: { ...Typography.bodyBold },
    btnTextWhite: { ...Typography.bodyBold, color: '#FFF' },
  });
}
