import {
  start as nativeStart,
  stop as nativeStop,
  isAvailable as nativeIsAvailable,
} from '@dbkable/react-native-speech-to-text';
import {DeviceEventEmitter, type EmitterSubscription} from 'react-native';

export type VoiceHandlers = {
  onPartial?: (text: string) => void;
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
  onStart?: () => void;
};

type SpeechResultEvent = {
  transcript?: string;
  isFinal?: boolean;
};

type SpeechErrorEvent = {
  code?: string;
  message?: string;
};

let handlers: VoiceHandlers = {};
let started = false;
let subscriptions: EmitterSubscription[] = [];
let emitterReady = false;

function bindEvents() {
  if (emitterReady) {
    return;
  }
  emitterReady = true;

  // Native module emits via RCTDeviceEventEmitter → DeviceEventEmitter
  subscriptions.push(
    DeviceEventEmitter.addListener(
      'onSpeechResult',
      (result: SpeechResultEvent) => {
        const text = result?.transcript ?? '';
        if (!text) {
          return;
        }
        if (result.isFinal) {
          handlers.onResult?.(text);
        } else {
          handlers.onPartial?.(text);
        }
      },
    ),
  );

  subscriptions.push(
    DeviceEventEmitter.addListener('onSpeechEnd', () => {
      started = false;
      handlers.onEnd?.();
    }),
  );

  subscriptions.push(
    DeviceEventEmitter.addListener('onSpeechError', (error: SpeechErrorEvent) => {
      started = false;
      const msg = error?.message ?? 'Voice error';
      const code = String(error?.code ?? '');

      const soft =
        code === 'CLIENT_ERROR' ||
        msg.toLowerCase().includes('no match') ||
        msg.toLowerCase().includes('no speech') ||
        msg.toLowerCase().includes('speech timeout') ||
        msg.toLowerCase().includes('timeout');

      if (soft) {
        handlers.onEnd?.();
        return;
      }

      handlers.onError?.(
        'Couldn’t hear clearly. Check the mic, speak a bit louder, and try again.',
      );
    }),
  );
}

export async function startVoiceRecognition(
  locale: string,
  nextHandlers: VoiceHandlers,
): Promise<void> {
  handlers = nextHandlers;
  bindEvents();

  if (started) {
    try {
      await nativeStop();
    } catch {
      // ignore
    }
    started = false;
  }

  await nativeStart({language: locale});
  started = true;
  handlers.onStart?.();
}

export async function stopVoiceRecognition(): Promise<void> {
  try {
    if (started) {
      await nativeStop();
    }
  } catch {
    // ignore
  } finally {
    started = false;
  }
}

export async function destroyVoiceRecognition(): Promise<void> {
  handlers = {};
  started = false;
  try {
    await nativeStop();
  } catch {
    // ignore
  }
}

export async function isVoiceAvailable(): Promise<boolean> {
  try {
    return await nativeIsAvailable();
  } catch {
    return false;
  }
}
