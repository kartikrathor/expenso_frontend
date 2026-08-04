import { NativeModules, Platform } from 'react-native';

/** Production API (Render) — used for release builds */
export const PROD_API_BASE_URL = 'https://expenso-backend-f61z.onrender.com';

/** Public legal pages (always production host — for Play Console + in-app) */
export const LEGAL_PRIVACY_URL = `${PROD_API_BASE_URL}/privacy`;
export const LEGAL_TERMS_URL = `${PROD_API_BASE_URL}/terms`;

/**
 * Optional: Mac Wi‑Fi IP for wireless debugging (phone + Mac same network).
 * Leave empty when using USB — then 127.0.0.1 + `adb reverse` is used.
 * Find IP: `ipconfig getifaddr en0`
 */
const DEV_LAN_HOST = '';

const DEV_HOST =
  Platform.OS === 'android'
    ? DEV_LAN_HOST || '127.0.0.1'
    : 'localhost';

export const API_PORT = 4000;
export const DEV_API_BASE_URL = `http://${DEV_HOST}:${API_PORT}`;

/**
 * In __DEV__, prefer JS URL (Metro reload) over Gradle BuildConfig.
 * Release builds still use BuildConfig / Render.
 */
const nativeApiBaseUrl: string | undefined = NativeModules.ApiConfig?.apiBaseUrl;

export const API_BASE_URL = __DEV__
  ? DEV_API_BASE_URL
  : typeof nativeApiBaseUrl === 'string' && nativeApiBaseUrl.length > 0
    ? nativeApiBaseUrl
    : PROD_API_BASE_URL;

/** Dev-only setup hint (logged in __DEV__, never shown to users) */
export const API_HINT = API_BASE_URL.includes('onrender.com')
  ? 'Check your internet. Free Render may take ~30s to wake.'
  : Platform.OS === 'android'
    ? 'USB: run `npm run adb:api` then reopen app. Wi‑Fi: set DEV_LAN_HOST in api.ts'
    : 'Make sure server is on port 4000';
