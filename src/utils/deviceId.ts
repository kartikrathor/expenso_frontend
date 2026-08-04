import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { generateId } from './generateId';

const DEVICE_ID_KEY = '@expenso_device_id';

/** Stable install id — used for password-reset device matching. */
export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing && existing.length >= 8) return existing;
  // Avoid `uuid` package — breaks in RN Metro/Hermes for some setups.
  const id = `dev_${generateId()}_${generateId()}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getDevicePlatform(): string {
  return Platform.OS;
}
