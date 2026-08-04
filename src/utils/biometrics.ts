import {
  isSensorAvailable,
  authenticateWithOptions,
} from '@sbaiahmed1/react-native-biometrics';
import { useAppLockStore } from '../store/appLockStore';

export type BiometryKind = 'fingerprint' | 'face' | 'biometric' | null;

export type BiometryAvailability = {
  available: boolean;
  kind: BiometryKind;
  label: string;
  error?: string;
};

export type BiometricPromptResult = {
  success: boolean;
  /** User cancelled or dismissed the sheet */
  cancelled?: boolean;
  error?: string;
};

function kindFromType(biometryType?: string | null): BiometryKind {
  if (!biometryType) return null;
  const t = biometryType.toLowerCase();
  if (t.includes('face')) return 'face';
  if (t.includes('touch') || t.includes('finger')) return 'fingerprint';
  if (t.includes('biometric') || t === 'unknown') return 'biometric';
  return 'biometric';
}

function labelFromKind(kind: BiometryKind): string {
  switch (kind) {
    case 'face':
      return 'Face ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'biometric':
      return 'Biometric';
    default:
      return 'Biometric';
  }
}

function friendlyError(code?: string, message?: string): string {
  const c = (code || '').toLowerCase();
  const m = (message || '').toLowerCase();
  if (
    c.includes('none_enrolled') ||
    c.includes('notenrolled') ||
    m.includes('none enrolled') ||
    m.includes('not enrolled')
  ) {
    return 'No fingerprint / Face ID enrolled. Add one in phone Settings, then try again.';
  }
  if (c.includes('no_hardware') || c.includes('notavailable') || m.includes('no hardware')) {
    return 'This device does not support biometric unlock.';
  }
  if (c.includes('hw_unavailable') || m.includes('unavailable')) {
    return 'Biometric hardware is temporarily unavailable. Try again.';
  }
  if (m.includes('lockout') || c.includes('lockout')) {
    return 'Too many attempts. Unlock your phone with PIN/pattern, then try again.';
  }
  return 'Fingerprint / Face unlock isn’t available right now. Try again.';
}

export async function getBiometryAvailability(): Promise<BiometryAvailability> {
  try {
    const info = await isSensorAvailable();
    if (!info?.available) {
      return {
        available: false,
        kind: null,
        label: 'Biometric',
        error: friendlyError(info?.errorCode, info?.error),
      };
    }
    const kind = kindFromType(info.biometryType) || 'biometric';
    return {
      available: true,
      kind,
      label: labelFromKind(kind),
      error: info.error ? friendlyError(info.errorCode, info.error) : undefined,
    };
  } catch (e: any) {
    return {
      available: false,
      kind: null,
      label: 'Biometric',
      error: 'Fingerprint / Face unlock isn’t available on this device right now.',
    };
  }
}

/**
 * Show system biometric sheet.
 * Arms App Lock suppress so Android AppState flicker does not re-lock mid-prompt.
 */
export async function promptBiometricUnlock(
  label = 'Biometric',
): Promise<BiometricPromptResult> {
  useAppLockStore.getState().beginBiometricPrompt();
  try {
    const result = await authenticateWithOptions({
      title: 'Unlock Expenso',
      subtitle: `Confirm with ${label}`,
      description: 'Use your fingerprint or face to unlock',
      cancelLabel: 'Use PIN',
      fallbackLabel: 'Use PIN',
      allowDeviceCredentials: false,
      disableDeviceFallback: true,
    });

    if (result?.success) {
      useAppLockStore.setState({ suppressLockUntil: Date.now() + 3000 });
      return { success: true };
    }

    const err = result?.error || result?.errorCode || '';
    const cancelled = /cancel|user.?cancel|negative|code.?10|code.?13|userCancel/i.test(
      String(err),
    );
    useAppLockStore.setState({ suppressLockUntil: Date.now() + 1500 });
    return {
      success: false,
      cancelled: cancelled || !err,
      error: cancelled ? undefined : friendlyError(result?.errorCode, result?.error),
    };
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    const cancelled = /cancel|user.?cancel|negative.?button|code.?10|code.?13/i.test(msg);
    useAppLockStore.setState({ suppressLockUntil: Date.now() + 1500 });
    return {
      success: false,
      cancelled,
      error: cancelled
        ? undefined
        : friendlyError(undefined, msg) ||
          'Couldn’t verify. Please try again.',
    };
  }
}
