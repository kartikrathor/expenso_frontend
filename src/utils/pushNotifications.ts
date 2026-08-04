import { Platform, PermissionsAndroid } from 'react-native';
import {
  getMessaging,
  getToken,
  requestPermission,
  registerDeviceForRemoteMessages,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  AuthorizationStatus,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { apiRequest } from '../services/api';
import { useNotificationInboxStore } from '../store/notificationInboxStore';

const CHANNEL_ID = 'expenso_default';

export type PushPayload = {
  title: string;
  body: string;
  type?: string;
  ticketId?: string;
  code?: string;
};

async function ensureAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** Ask permission, return FCM token or null. */
export async function getFcmToken(): Promise<string | null> {
  try {
    const allowed = await ensureAndroidPermission();
    if (!allowed) return null;

    const messaging = getMessaging();
    await registerDeviceForRemoteMessages(messaging);
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!enabled && Platform.OS === 'ios') return null;

    const token = await getToken(messaging);
    return token || null;
  } catch (err) {
    console.warn('FCM getToken failed:', err);
    return null;
  }
}

export async function registerFcmTokenWithServer(authToken: string): Promise<void> {
  const fcm = await getFcmToken();
  if (!fcm) return;
  try {
    await apiRequest('/api/devices/fcm-token', {
      method: 'POST',
      token: authToken,
      body: { token: fcm },
    });
  } catch (err) {
    console.warn('Could not register FCM token:', err);
  }
}

export async function unregisterFcmTokenFromServer(authToken: string | null): Promise<void> {
  try {
    const messaging = getMessaging();
    const fcm = await getToken(messaging).catch(() => null);
    if (!fcm || !authToken) return;
    await apiRequest(`/api/devices/fcm-token?token=${encodeURIComponent(fcm)}`, {
      method: 'DELETE',
      token: authToken,
    });
  } catch {
    /* ignore */
  }
}

export type SupportPushData = {
  type?: string;
  ticketId?: string;
  code?: string;
};

type OpenHandler = (data: SupportPushData) => void;
type ForegroundHandler = (payload: PushPayload) => void;

let openHandler: OpenHandler | null = null;
let foregroundHandler: ForegroundHandler | null = null;

export function setSupportPushOpenHandler(handler: OpenHandler | null) {
  openHandler = handler;
}

export function setForegroundPushHandler(handler: ForegroundHandler | null) {
  foregroundHandler = handler;
}

export function parseRemoteMessage(remoteMessage: RemoteMessage | null | undefined): PushPayload | null {
  if (!remoteMessage) return null;
  const data = (remoteMessage.data || {}) as Record<string, string>;
  const title =
    remoteMessage.notification?.title ||
    data.title ||
    'Expenso';
  const body =
    remoteMessage.notification?.body ||
    data.body ||
    '';
  if (!title && !body) return null;
  return {
    title: String(title),
    body: String(body || 'New notification'),
    type: data.type,
    ticketId: data.ticketId,
    code: data.code,
  };
}

function ingestPush(payload: PushPayload | null) {
  if (!payload) return;
  useNotificationInboxStore.getState().addFromPush({
    title: payload.title,
    body: payload.body,
    type: payload.type,
    ticketId: payload.ticketId,
  });
}

function handleOpenData(data: Record<string, string> | undefined) {
  if (!data?.type) return;
  if (data.type === 'support_reply' || data.type === 'support_ticket') {
    openHandler?.({
      type: data.type,
      ticketId: data.ticketId,
      code: data.code,
    });
  }
}

/** Call once when app is ready (logged in). Returns cleanup. */
export function startPushListeners(authToken: string): () => void {
  void registerFcmTokenWithServer(authToken);

  let messaging;
  try {
    messaging = getMessaging();
  } catch (err) {
    console.warn('FCM unavailable (native module not linked):', err);
    return () => {};
  }

  const unsubToken = onTokenRefresh(messaging, (token: string) => {
    void apiRequest('/api/devices/fcm-token', {
      method: 'POST',
      token: authToken,
      body: { token },
    }).catch(() => {});
  });

  const unsubMsg = onMessage(messaging, async (remoteMessage: RemoteMessage) => {
    const payload = parseRemoteMessage(remoteMessage);
    ingestPush(payload);
    if (payload) foregroundHandler?.(payload);
  });

  const unsubOpened = onNotificationOpenedApp(messaging, (remoteMessage: RemoteMessage) => {
    const payload = parseRemoteMessage(remoteMessage);
    ingestPush(payload);
    handleOpenData(remoteMessage?.data as Record<string, string> | undefined);
  });

  getInitialNotification(messaging)
    .then((remoteMessage: RemoteMessage | null) => {
      if (!remoteMessage) return;
      const payload = parseRemoteMessage(remoteMessage);
      ingestPush(payload);
      handleOpenData(remoteMessage.data as Record<string, string>);
    })
    .catch(() => {});

  return () => {
    unsubToken();
    unsubMsg();
    unsubOpened();
  };
}

export { CHANNEL_ID };
