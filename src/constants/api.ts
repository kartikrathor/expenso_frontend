import { Platform } from 'react-native';

/**
 * Mac LAN IP — works for Android emulator + physical device on same Wi‑Fi.
 * Update if your IP changes: `ipconfig getifaddr en0`
 */
export const DEV_LAN_IP = '10.163.132.223';

/**
 * Android: prefer 127.0.0.1 after `adb reverse tcp:4000 tcp:4000`
 * Fallback host is LAN IP (also works from most emulators).
 */
const DEV_HOST =
  Platform.OS === 'android'
    ? '127.0.0.1' // requires: adb reverse tcp:4000 tcp:4000
    : 'localhost';

export const API_PORT = 4000;
export const API_BASE_URL = `http://${DEV_HOST}:${API_PORT}`;

/** Shown in error messages */
export const API_HINT =
  Platform.OS === 'android'
    ? 'Run: adb reverse tcp:4000 tcp:4000'
    : 'Make sure server is on port 4000';
