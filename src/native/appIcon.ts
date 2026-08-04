import { BackHandler, NativeModules, Platform } from 'react-native';
import type { ThemePackId } from '../constants/themePacks';

export type AppIconKey =
  | 'Default'
  | 'Mint'
  | 'Sunset'
  | 'Royal'
  | 'Rose'
  | 'Lavender'
  | 'Mono'
  | 'Forest'
  | 'MidnightGold'
  | 'Paper'
  | 'Neon'
  | 'RedWebSpider';

const PACK_TO_ICON: Record<ThemePackId, AppIconKey> = {
  ocean: 'Default',
  mint: 'Mint',
  sunset: 'Sunset',
  royal: 'Royal',
  rose: 'Rose',
  lavender: 'Lavender',
  mono: 'Mono',
  forest: 'Forest',
  midnight_gold: 'MidnightGold',
  paper: 'Paper',
  neon: 'Neon',
  red_web_spider: 'RedWebSpider',
};

const ICON_TO_PACK = Object.fromEntries(
  Object.entries(PACK_TO_ICON).map(([pack, icon]) => [icon, pack]),
) as Record<AppIconKey, ThemePackId>;

type AppIconNative = {
  getIcon: () => Promise<string>;
  setIcon: (iconKey: string) => Promise<string>;
  closeApp: () => Promise<boolean>;
};

function getNative(): AppIconNative | undefined {
  return NativeModules.AppIcon as AppIconNative | undefined;
}

export function packIdToIconKey(packId: ThemePackId): AppIconKey {
  return PACK_TO_ICON[packId] ?? 'Default';
}

export function iconKeyToPackId(iconKey: AppIconKey): ThemePackId {
  return ICON_TO_PACK[iconKey] ?? 'ocean';
}

export function isAppIconSupported(): boolean {
  return Platform.OS === 'android' && !!getNative()?.setIcon;
}

export async function getNativeAppIcon(): Promise<AppIconKey> {
  const native = getNative();
  if (!native?.getIcon) return 'Default';
  try {
    const key = await native.getIcon();
    return (key as AppIconKey) || 'Default';
  } catch {
    return 'Default';
  }
}

export async function setNativeAppIcon(iconKey: AppIconKey): Promise<boolean> {
  const native = getNative();
  if (!native?.setIcon) {
    console.warn('[AppIcon] Native module missing — rebuild the Android app');
    return false;
  }
  try {
    await native.setIcon(iconKey);
    return true;
  } catch (e) {
    console.warn('[AppIcon] setIcon failed', e);
    return false;
  }
}

/** Close the app after a successful icon change (launcher refresh). */
export async function closeAppForIconRefresh(): Promise<void> {
  const native = getNative();
  if (!native?.closeApp) {
    BackHandler.exitApp();
    return;
  }
  try {
    await native.closeApp();
  } catch (e) {
    console.warn('[AppIcon] closeApp failed', e);
  }
}
