import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {
  startVoiceRecognition,
  stopVoiceRecognition,
} from '../services/voiceService';
import { parseExpenseText } from '../utils/expenseParser';
import { userFacingError } from '../utils/userFacingError';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAppAlert } from './AppAlert';
import type { ExpenseSaveData } from './AddExpenseModal';

interface HoldMicFabProps {
  onSave: (data: ExpenseSaveData) => Promise<void> | void;
}

const haptic = (type: 'impactLight' | 'impactMedium' | 'notificationSuccess' | 'notificationWarning' = 'impactMedium') =>
  ReactNativeHapticFeedback.trigger(type, {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  });

async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const already = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  if (already) return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Allow microphone',
      message: 'Expenso uses the mic so you can add expenses by speaking.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function MicIcon({ size = 26, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2a3.5 3.5 0 0 0-3.5 3.5v6a3.5 3.5 0 1 0 7 0v-6A3.5 3.5 0 0 0 12 2Z"
        fill={color}
      />
      <Path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Path
        d="M12 18v3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HoldMicFab({ onSave }: HoldMicFabProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { show: showAlert, alertNode } = useAppAlert();

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [saving, setSaving] = useState(false);

  const resultRef = useRef('');
  const holdingRef = useRef(false);
  const startedRef = useRef(false);
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);

  const startPulse = useCallback(() => {
    ring.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 700, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [ring]);

  const stopPulse = useCallback(() => {
    cancelAnimation(ring);
    ring.value = withTiming(0, { duration: 160 });
  }, [ring]);

  const finishAndSave = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        showAlert('Nothing Heard', 'Hold the mic button and clearly say the amount and merchant — e.g. "Swiggy 350"', undefined, '🎤');
        return;
      }

      const parsed = parseExpenseText(trimmed);
      if (!parsed.amount || parsed.amount <= 0) {
        showAlert(
          'No amount heard',
          `We heard “${trimmed}” but couldn’t find an amount.\n\nTry saying something like “Blinkit 200”.`,
          undefined,
          '⚠️',
        );
        return;
      }

      setSaving(true);
      try {
        await onSave({
          amount: parsed.amount,
          merchant: parsed.merchant,
          merchantLabel: parsed.merchantLabel,
          category: parsed.category,
          note: trimmed,
          inputMethod: 'voice',
          date: new Date().toISOString(),
        });
        haptic('notificationSuccess');
      } catch (err) {
        showAlert(
          'Couldn’t save',
          userFacingError(
            err,
            'Your expense wasn’t saved. Please check your connection and try again.',
          ),
          undefined,
          '❌',
        );
      } finally {
        setSaving(false);
      }
    },
    [onSave],
  );

  const onHoldStart = useCallback(async () => {
    if (saving || holdingRef.current) return;
    holdingRef.current = true;
    startedRef.current = false;
    resultRef.current = '';
    setTranscript('');

    scale.value = withSpring(0.9);
    haptic('impactLight');

    const permitted = await requestMicPermission();
    if (!holdingRef.current) {
      scale.value = withSpring(1);
      return;
    }
    if (!permitted) {
      holdingRef.current = false;
      scale.value = withSpring(1);
      showAlert(
        'Microphone needed',
        'Please allow microphone access in your phone settings to add expenses by voice.',
        undefined,
        '🎙️',
      );
      return;
    }

    try {
      setListening(true);
      startPulse();
      await startVoiceRecognition('en-IN', {
        onStart: () => {
          if (!holdingRef.current) return;
          startedRef.current = true;
          haptic('impactMedium');
        },
        onPartial: text => {
          if (!holdingRef.current) return;
          resultRef.current = text;
          setTranscript(text);
        },
        onResult: text => {
          resultRef.current = text;
          setTranscript(text);
        },
        onEnd: () => {},
        onError: () => {},
      });
      if (!holdingRef.current) {
        await stopVoiceRecognition();
        setListening(false);
        stopPulse();
        return;
      }
      startedRef.current = true;
    } catch (err: any) {
      holdingRef.current = false;
      setListening(false);
      stopPulse();
      scale.value = withSpring(1);
      showAlert(
        'Voice input',
        userFacingError(err, 'Couldn’t start the microphone. Please try again.'),
        undefined,
        '❌',
      );
    }
  }, [saving, scale, startPulse, stopPulse]);

  const onHoldEnd = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;

    const wasListening = startedRef.current || transcript.length > 0 || resultRef.current.length > 0;

    scale.value = withSpring(1);
    setListening(false);
    stopPulse();

    try {
      await stopVoiceRecognition();
    } catch {
      // ignore
    }

    if (!wasListening && !resultRef.current) {
      setTranscript('');
      return;
    }

    await new Promise<void>(resolve => setTimeout(resolve, 180));
    const text = resultRef.current.trim();
    setTranscript('');
    await finishAndSave(text);
  }, [finishAndSave, scale, stopPulse, transcript]);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value,
    transform: [{ scale: 1 + ring.value * 0.55 }],
  }));

  return (
    <View style={styles.wrap}>
      {alertNode}
      {(listening || transcript.length > 0) && (
        <Animated.View entering={FadeIn.duration(140)} exiting={FadeOut.duration(120)} style={styles.bubble}>
          <Text style={styles.bubbleLabel}>{listening ? 'Listening… keep holding' : 'Got it'}</Text>
          <Text style={styles.bubbleText} numberOfLines={2}>
            {transcript || '…'}
          </Text>
        </Animated.View>
      )}

      <View style={styles.micWrap}>
        {listening ? (
          <Animated.View
            style={[styles.pulseRing, ringStyle, { backgroundColor: colors.danger }]}
          />
        ) : null}
        <Animated.View style={btnStyle}>
          <Pressable
            onPressIn={onHoldStart}
            onPressOut={onHoldEnd}
            disabled={saving}
            delayLongPress={99999}
          >
            <LinearGradient
              colors={
                listening
                  ? [colors.danger, '#E11D48']
                  : [colors.gradientMid, colors.gradientEnd]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.fab, { shadowColor: listening ? colors.danger : colors.primary }]}
            >
              <MicIcon />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
    },
    micWrap: {
      width: 58,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pulseRing: {
      position: 'absolute',
      width: 58,
      height: 58,
      borderRadius: 29,
    },
    fab: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 14,
      elevation: 12,
    },
    bubble: {
      position: 'absolute',
      bottom: 70,
      right: 0,
      minWidth: 160,
      maxWidth: 220,
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 10,
      elevation: 8,
    },
    bubbleLabel: {
      ...Typography.small,
      color: colors.primaryLight,
      fontWeight: '700',
      marginBottom: 2,
    },
    bubbleText: {
      ...Typography.caption,
      color: colors.text,
      lineHeight: 18,
    },
  });
}
