import React, { useRef, useState, useCallback, useMemo } from 'react';
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
  Easing,
  cancelAnimation,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import {
  startVoiceRecognition,
  stopVoiceRecognition,
} from '../services/voiceService';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAppAlert } from './AppAlert';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
}

const haptic = () =>
  ReactNativeHapticFeedback.trigger('impactMedium', {
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
      title: 'Microphone Permission',
      message: 'Expense Management needs mic access for voice expense entry',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function MicIcon({ size = 34, color = '#FFF' }: { size?: number; color?: string }) {
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

function StopIcon({ size = 28, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.6} />
      <Path d="M9 9h6v6H9z" fill={color} />
    </Svg>
  );
}

export function VoiceButton({ onResult, onListeningChange }: VoiceButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { show: showAlert, alertNode } = useAppAlert();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [locale, setLocale] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const [busy, setBusy] = useState(false);
  const pulse = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const resultRef = useRef('');
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const startPulse = useCallback(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    ringOpacity.value = withRepeat(
      withSequence(withTiming(0.45, { duration: 900 }), withTiming(0, { duration: 900 })),
      -1,
      false,
    );
  }, [pulse, ringOpacity]);

  const stopPulse = useCallback(() => {
    cancelAnimation(pulse);
    cancelAnimation(ringOpacity);
    pulse.value = withTiming(1, { duration: 200 });
    ringOpacity.value = withTiming(0, { duration: 200 });
  }, [pulse, ringOpacity]);

  const finishListening = useCallback(
    (text: string) => {
      setIsListening(false);
      setBusy(false);
      onListeningChange?.(false);
      stopPulse();
      if (text.trim()) {
        onResultRef.current(text.trim());
        haptic();
      }
    },
    [onListeningChange, stopPulse],
  );

  const toggleListening = async () => {
    if (busy) return;

    if (isListening) {
      setBusy(true);
      await stopVoiceRecognition();
      finishListening(resultRef.current);
      return;
    }

    // Don't hard-block — isAvailable() is unreliable on modern Android.
    // Always attempt start; real errors surface from startVoiceRecognition.

    const permitted = await requestMicPermission();
    if (!permitted) {
      showAlert('Permission Required', 'Microphone access is needed for voice entry.', undefined, '🎙️');
      return;
    }

    try {
      setBusy(true);
      resultRef.current = '';
      setTranscript('');
      setIsListening(true);
      onListeningChange?.(true);
      startPulse();
      haptic();

      await startVoiceRecognition(locale, {
        onStart: () => setBusy(false),
        onPartial: text => {
          resultRef.current = text;
          setTranscript(text);
        },
        onResult: text => {
          resultRef.current = text;
          setTranscript(text);
        },
        onEnd: () => finishListening(resultRef.current),
        onError: msg => {
          console.warn('Voice error:', msg);
          setIsListening(false);
          setBusy(false);
          onListeningChange?.(false);
          stopPulse();
          showAlert(
            'Voice Error',
            `${msg}\n\nTips: Make sure internet is on, microphone permission is granted, and speak clearly.`,
            undefined,
            '❌',
          );
        },
      });
      setBusy(false);
    } catch (err: any) {
      setIsListening(false);
      setBusy(false);
      onListeningChange?.(false);
      stopPulse();
      const message = err?.message ? String(err.message) : 'Could not start the microphone. Please try again.';
      showAlert('Voice Error', message, undefined, '❌');
    }
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: pulse.value * 1.4 }],
  }));

  return (
    <View style={styles.container}>
      {alertNode}
      <View style={styles.heroHint}>
        <Text style={styles.heroHintTitle}>Speak your expense</Text>
        <Text style={styles.heroHintSub}>Say the amount and merchant — Hindi or English</Text>
      </View>

      {transcript.length > 0 ? (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.transcriptBox}>
          <Text style={styles.transcriptLabel}>
            {isListening ? 'Listening…' : 'Got it'}
          </Text>
          <Text style={styles.transcript}>{transcript}</Text>
        </Animated.View>
      ) : (
        <View style={styles.examples}>
          <Text style={styles.exampleChip}>“Blinkit 200”</Text>
          <Text style={styles.exampleChip}>“Swiggy pe 350”</Text>
          <Text style={styles.exampleChip}>“Amazon 999”</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        {(['hi-IN', 'en-IN'] as const).map(loc => (
          <Pressable
            key={loc}
            style={[styles.localeBtn, locale === loc && styles.localeActive]}
            onPress={() => !isListening && setLocale(loc)}
          >
            <Text style={[styles.localeText, locale === loc && styles.localeTextActive]}>
              {loc === 'hi-IN' ? '🇮🇳 Hindi' : '🇬🇧 English'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.micWrapper}>
        <Animated.View
          style={[
            styles.pulseRing,
            ringStyle,
            { backgroundColor: isListening ? colors.danger : colors.primary },
          ]}
        />
        <Animated.View style={pulseStyle}>
          <Pressable onPress={toggleListening} disabled={busy}>
            <LinearGradient
              colors={
                isListening
                  ? [colors.danger, '#E11D48']
                  : [colors.gradientStart, colors.gradientEnd]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.micButton, { shadowColor: isListening ? colors.danger : colors.primary }]}
            >
              {isListening ? <StopIcon /> : <MicIcon />}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>

      <Text style={styles.hint}>
        {isListening ? 'Speaking… tap again to stop' : 'Tap mic & speak naturally'}
      </Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: Spacing.sm },
    heroHint: { alignItems: 'center', marginBottom: Spacing.md },
    heroHintTitle: { ...Typography.h3, color: colors.text },
    heroHintSub: { ...Typography.caption, color: colors.textMuted, marginTop: 4 },
    examples: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    exampleChip: {
      ...Typography.small,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceHighlight,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    buttonRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    localeBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    localeActive: {
      backgroundColor: colors.primary + '22',
      borderColor: colors.primary,
    },
    localeText: { ...Typography.caption, color: colors.textSecondary },
    localeTextActive: { color: colors.primaryLight, fontWeight: '700' },
    micWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 140,
      height: 140,
    },
    pulseRing: {
      position: 'absolute',
      width: 108,
      height: 108,
      borderRadius: 54,
    },
    micButton: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 12,
    },
    hint: {
      ...Typography.caption,
      color: colors.textMuted,
      marginTop: Spacing.md,
      textAlign: 'center',
    },
    transcriptBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.md,
      width: '100%',
      borderWidth: 1,
      borderColor: colors.primary + '44',
    },
    transcriptLabel: {
      ...Typography.small,
      color: colors.primaryLight,
      marginBottom: 6,
      fontWeight: '700',
    },
    transcript: { ...Typography.body, color: colors.text, lineHeight: 22 },
  });
}
