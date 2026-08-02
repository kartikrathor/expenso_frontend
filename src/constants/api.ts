import { NativeModules, Platform } from 'react-native';

/** Production API (Render) — used for release builds */
export const PROD_API_BASE_URL = 'https://expenso-backend-f61z.onrender.com';

/**
 * Android: prefer 127.0.0.1 after `adb reverse tcp:4000 tcp:4000`
 * iOS simulator: localhost
 */
const DEV_HOST =
  Platform.OS === 'android'
    ? '127.0.0.1' // requires: adb reverse tcp:4000 tcp:4000
    : 'localhost';

export const API_PORT = 4000;
export const DEV_API_BASE_URL = `http://${DEV_HOST}:${API_PORT}`;

/**
 * Android release: URL comes from Gradle BuildConfig (assembleRelease).
 * Fallback: __DEV__ ? local : Render.
 */
const nativeApiBaseUrl: string | undefined = NativeModules.ApiConfig?.apiBaseUrl;

export const API_BASE_URL =
  typeof nativeApiBaseUrl === 'string' && nativeApiBaseUrl.length > 0
    ? nativeApiBaseUrl
    : __DEV__
      ? DEV_API_BASE_URL
      : PROD_API_BASE_URL;

/** Shown in error messages */
export const API_HINT =
  API_BASE_URL.includes('onrender.com')
    ? 'Check your internet. Free Render may take ~30s to wake.'
    : Platform.OS === 'android'
      ? 'Run: adb reverse tcp:4000 tcp:4000'
      : 'Make sure server is on port 4000';
