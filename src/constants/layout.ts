import { Platform } from 'react-native';

/** Total vertical space reserved for the floating tab bar area */
export const FLOATING_TAB_HEIGHT = 64;
export const FLOATING_TAB_MARGIN = 16;

export function getTabBarBottomInset(safeBottom: number): number {
  return FLOATING_TAB_HEIGHT + FLOATING_TAB_MARGIN + Math.max(safeBottom, Platform.OS === 'android' ? 8 : 0) + 12;
}
