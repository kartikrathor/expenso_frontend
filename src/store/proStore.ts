import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';
import { useThemeStore } from './themeStore';
import {
  DEFAULT_PRO_SKUS,
  DEFAULT_THEME_SKUS,
  purchaseProSubscription,
  purchaseThemePack,
  restoreThemePack,
  restoreProPurchases,
} from '../services/iap';

const CACHE_KEY = '@expensewise_pro_entitlement';

export type ProCatalog = {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  dailyTokens: number;
  monthlyLabel: string;
  yearlyLabel: string;
  description: string;
  features: string[];
  enabled: boolean;
  androidMonthlySku?: string;
  androidYearlySku?: string;
  iosMonthlySku?: string;
  iosYearlySku?: string;
};

export type ThemePrice = {
  packId: string;
  name: string;
  monthlyPrice: number;
  permanentPrice: number;
  currency: string;
  includedInPro: boolean;
  monthlyLabel?: string;
  permanentLabel?: string;
  subtitle?: string;
  androidMonthlySku?: string;
  androidPermanentSku?: string;
  iosMonthlySku?: string;
  iosPermanentSku?: string;
};

async function enforceCurrentThemeAccess(canUse: (packId: string) => boolean) {
  const theme = useThemeStore.getState();
  if (theme.packId !== 'ocean' && !canUse(theme.packId)) {
    await theme.setPackId('ocean', true);
  }
}

export type PaywallReason =
  | 'ask_ai'
  | 'analytics_nav'
  | 'custom_date'
  | 'app_lock'
  | 'biometrics'
  | 'export_excel'
  | 'export_pdf'
  | 'theme';

type PaywallState = {
  visible: boolean;
  reason: PaywallReason;
  themePackId?: string;
};

export type ProEntitlement = {
  isPro: boolean;
  plan: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
  ownedThemePacks: string[];
};

interface ProStore {
  isPro: boolean;
  plan: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
  ownedThemePacks: string[];
  catalog: ProCatalog | null;
  themePrices: ThemePrice[];
  isLoaded: boolean;
  paywall: PaywallState;
  loadPro: () => Promise<void>;
  /** Re-fetch Admin theme/Pro catalog (prices + Free with Pro flags). */
  refreshCatalog: () => Promise<void>;
  /** Apply Pro from login /auth/me — avoids race before /api/pro/me */
  applyEntitlement: (
    entitlement: Partial<ProEntitlement> | null | undefined,
  ) => Promise<void>;
  clearEntitlement: () => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  openPaywall: (reason: PaywallReason, themePackId?: string) => void;
  closePaywall: () => void;
  /** Launch Google Play / App Store IAP, then verify on server */
  subscribe: (plan: 'monthly' | 'yearly') => Promise<void>;
  restorePurchases: () => Promise<void>;
  purchaseTheme: (
    packId: string,
    kind: 'monthly' | 'permanent',
  ) => Promise<void>;
  restoreTheme: (packId: string) => Promise<void>;
  canUseThemePack: (packId: string) => boolean;
}

async function cacheEntitlement(payload: ProEntitlement) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}

function normalizeEntitlement(
  entitlement: Partial<ProEntitlement> | null | undefined,
): ProEntitlement {
  return {
    isPro: !!entitlement?.isPro,
    plan:
      entitlement?.plan === 'monthly' || entitlement?.plan === 'yearly'
        ? entitlement.plan
        : null,
    expiresAt: entitlement?.expiresAt || null,
    ownedThemePacks: Array.isArray(entitlement?.ownedThemePacks)
      ? entitlement!.ownedThemePacks!
      : [],
  };
}

function skusFromCatalog(catalog: ProCatalog | null) {
  if (Platform.OS === 'ios') {
    return {
      monthly: catalog?.iosMonthlySku || DEFAULT_PRO_SKUS.monthly,
      yearly: catalog?.iosYearlySku || DEFAULT_PRO_SKUS.yearly,
    };
  }
  return {
    monthly: catalog?.androidMonthlySku || DEFAULT_PRO_SKUS.monthly,
    yearly: catalog?.androidYearlySku || DEFAULT_PRO_SKUS.yearly,
  };
}

export const useProStore = create<ProStore>((set, get) => ({
  isPro: false,
  plan: null,
  expiresAt: null,
  ownedThemePacks: [],
  catalog: null,
  themePrices: [],
  isLoaded: false,
  paywall: { visible: false, reason: 'ask_ai' },

  refreshCatalog: async () => {
    const catalog = await apiRequest<{
      pro: ProCatalog | null;
      themes: ThemePrice[];
    }>('/api/pro/catalog');
    set({
      catalog: catalog.pro,
      themePrices: (catalog.themes || []).map(t => ({
        ...t,
        includedInPro: t.includedInPro === true,
      })),
    });
    await enforceCurrentThemeAccess(get().canUseThemePack);
  },

  loadPro: async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        set(normalizeEntitlement(parsed));
      }
    } catch {
      // ignore cache
    }

    try {
      await get().refreshCatalog();
    } catch {
      // offline — keep last catalog; never invent Free-with-Pro packs
    }

    // Entitlement refresh waits for auth (App.tsx + login applyEntitlement).
    // Calling /api/pro/me here races loadAuth and used to wipe Pro to false.
    set({ isLoaded: true });
  },

  applyEntitlement: async entitlement => {
    const next = normalizeEntitlement(entitlement);
    set(next);
    await cacheEntitlement(next);
    await enforceCurrentThemeAccess(get().canUseThemePack);
    if (next.isPro) {
      set({ paywall: { visible: false, reason: get().paywall.reason } });
    }
  },

  clearEntitlement: async () => {
    const next = normalizeEntitlement(null);
    set({
      ...next,
      paywall: { visible: false, reason: get().paywall.reason },
    });
    await cacheEntitlement(next);
  },

  refreshEntitlement: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      // Logged out — clear memory only. Disk wipe is clearEntitlement on logout
      // so a boot race with loadAuth doesn't persist isPro:false over a Pro user.
      set({
        isPro: false,
        plan: null,
        expiresAt: null,
        ownedThemePacks: [],
        paywall: { visible: false, reason: get().paywall.reason },
      });
      return;
    }
    try {
      const data = await apiRequest<{
        entitlement: ProEntitlement;
      }>('/api/pro/me', { token });
      await get().applyEntitlement(data.entitlement);
    } catch {
      // keep cache
    }
  },

  openPaywall: (reason, themePackId) => {
    if (reason !== 'theme' && get().isPro) return;
    if (reason === 'theme' && themePackId && get().canUseThemePack(themePackId))
      return;
    set({ paywall: { visible: true, reason, themePackId } });
  },

  closePaywall: () => {
    set({ paywall: { visible: false, reason: get().paywall.reason } });
  },

  subscribe: async plan => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Please sign in again.');
    const skus = skusFromCatalog(get().catalog);
    const pendingThemePackId =
      get().paywall.reason === 'theme' ? get().paywall.themePackId : undefined;
    await purchaseProSubscription(plan, skus);
    await get().refreshEntitlement();
    if (
      pendingThemePackId &&
      get().canUseThemePack(pendingThemePackId)
    ) {
      await useThemeStore
        .getState()
        .setPackId(pendingThemePackId as any, true);
    }
    set({ paywall: { visible: false, reason: get().paywall.reason } });
  },

  restorePurchases: async () => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Please sign in again.');
    const skus = skusFromCatalog(get().catalog);
    await restoreProPurchases(skus);
    await get().refreshEntitlement();
    set({ paywall: { visible: false, reason: get().paywall.reason } });
  },

  purchaseTheme: async (packId, kind) => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Please sign in again.');
    const theme = get().themePrices.find(t => t.packId === packId);
    if (!theme) throw new Error('This theme is not available right now.');
    const skus =
      Platform.OS === 'ios'
        ? {
            monthly: theme.iosMonthlySku || DEFAULT_THEME_SKUS.monthly,
            permanent: theme.iosPermanentSku || DEFAULT_THEME_SKUS.permanent,
          }
        : {
            monthly: theme.androidMonthlySku || DEFAULT_THEME_SKUS.monthly,
            permanent:
              theme.androidPermanentSku || DEFAULT_THEME_SKUS.permanent,
          };
    await purchaseThemePack(kind, skus, packId);
    await get().refreshEntitlement();
    if (get().canUseThemePack(packId)) {
      await useThemeStore.getState().setPackId(packId as any, true);
    }
    set({ paywall: { visible: false, reason: get().paywall.reason } });
  },

  restoreTheme: async packId => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Please sign in again.');
    const theme = get().themePrices.find(t => t.packId === packId);
    if (!theme) throw new Error('This theme is not available right now.');
    const skus =
      Platform.OS === 'ios'
        ? {
            monthly: theme.iosMonthlySku || DEFAULT_THEME_SKUS.monthly,
            permanent: theme.iosPermanentSku || DEFAULT_THEME_SKUS.permanent,
          }
        : {
            monthly: theme.androidMonthlySku || DEFAULT_THEME_SKUS.monthly,
            permanent:
              theme.androidPermanentSku || DEFAULT_THEME_SKUS.permanent,
          };
    await restoreThemePack(skus, packId);
    await get().refreshEntitlement();
    set({ paywall: { visible: false, reason: get().paywall.reason } });
  },

  canUseThemePack: packId => {
    if (packId === 'ocean') return true;
    if (get().ownedThemePacks.includes(packId)) return true;
    // Admin catalog is the only source for Free with Pro — no hardcoded packs.
    const remote = get().themePrices.find(t => t.packId === packId);
    return get().isPro && remote?.includedInPro === true;
  },
}));
