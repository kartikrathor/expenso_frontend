import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';

export type BiometryKind = 'fingerprint' | 'face' | 'biometric' | null;

export type BiometryAvailability = {
  available: boolean;
  kind: BiometryKind;
  label: string;
  error?: string;
};

const rnBiometrics = new ReactNativeBiometrics({ allowDeviceCredentials: false });

function kindFromType(biometryType?: string): BiometryKind {
  if (biometryType === BiometryTypes.FaceID) return 'face';
  if (biometryType === BiometryTypes.TouchID) return 'fingerprint';
  if (biometryType === BiometryTypes.Biometrics) return 'biometric';
  return null;
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

export async function getBiometryAvailability(): Promise<BiometryAvailability> {
  try {
    const { available, biometryType, error } = await rnBiometrics.isSensorAvailable();
    const kind = available ? kindFromType(biometryType) : null;
    return {
      available: !!available && !!kind,
      kind,
      label: labelFromKind(kind),
      error,
    };
  } catch (e: any) {
    return {
      available: false,
      kind: null,
      label: 'Biometric',
      error: e?.message || 'Unavailable',
    };
  }
}

/** Prompt system biometric sheet. Returns true on success. */
export async function promptBiometricUnlock(label = 'Biometric'): Promise<boolean> {
  try {
    const { success } = await rnBiometrics.simplePrompt({
      promptMessage: `Unlock Expenso with ${label}`,
      cancelButtonText: 'Use PIN',
      fallbackPromptMessage: 'Use PIN instead',
    });
    return !!success;
  } catch {
    return false;
  }
}
