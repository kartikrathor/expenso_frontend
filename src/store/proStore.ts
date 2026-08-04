import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';
import {
  DEFAULT_PRO_SKUS,
  purchaseProSubscription,
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
};

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
  refreshEntitlement: () => Promise<void>;
  openPaywall: (reason: PaywallReason, themePackId?: string) => void;
  closePaywall: () => void;
  /** Launch Google Play / App Store IAP, then verify on server */
  subscribe: (plan: 'monthly' | 'yearly') => Promise<void>;
  restorePurchases: () => Promise<void>;
  purchaseTheme: (packId: string, kind: 'monthly' | 'permanent') => Promise<void>;
  canUseThemePack: (packId: string) => boolean;
}

async function cacheEntitlement(payload: {
  isPro: boolean;
  plan: 'monthly' | 'yearly' | null;
  expiresAt: string | null;
  ownedThemePacks: string[];
}) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
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

  loadPro: async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({
          isPro: !!parsed.isPro,
          plan: parsed.plan || null,
          expiresAt: parsed.expiresAt || null,
          ownedThemePacks: parsed.ownedThemePacks || [],
        });
      }
    } catch {
      // ignore cache
    }

    try {
      const catalog = await apiRequest<{
        pro: ProCatalog | null;
        themes: ThemePrice[];
      }>('/api/pro/catalog');
      set({
        catalog: catalog.pro,
        themePrices: catalog.themes || [],
      });
    } catch {
      // offline — keep defaults
    }

    await get().refreshEntitlement();
    set({ isLoaded: true });
  },

  refreshEntitlement: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({
        isPro: false,
        plan: null,
        expiresAt: null,
        ownedThemePacks: [],
      });
      await cacheEntitlement({
        isPro: false,
        plan: null,
        expiresAt: null,
        ownedThemePacks: [],
      });
      return;
    }
    try {
      const data = await apiRequest<{
        entitlement: {
          isPro: boolean;
          plan: 'monthly' | 'yearly' | null;
          expiresAt: string | null;
          ownedThemePacks: string[];
        };
      }>('/api/pro/me', { token });
      const next = {
        isPro: !!data.entitlement.isPro,
        plan: data.entitlement.plan,
        expiresAt: data.entitlement.expiresAt,
        ownedThemePacks: data.entitlement.ownedThemePacks || [],
      };
      set(next);
      await cacheEntitlement(next);
    } catch {
      // keep cache
    }
  },

  openPaywall: (reason, themePackId) => {
    set({ paywall: { visible: true, reason, themePackId } });
  },

  closePaywall: () => {
    set({ paywall: { visible: false, reason: get().paywall.reason } });
  },

  subscribe: async plan => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Please sign in again.');
    const skus = skusFromCatalog(get().catalog);
    await purchaseProSubscription(plan, skus);
    await get().refreshEntitlement();
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
    await apiRequest('/api/pro/themes/purchase', {
      method: 'POST',
      token,
      body: { packId, kind },
    });
    await get().refreshEntitlement();
    set({ paywall: { visible: false, reason: get().paywall.reason } });
  },

  canUseThemePack: packId => {
    if (packId === 'ocean') return true;
    // Pro plan unlocks all color packs (matches in-app copy)
    if (get().isPro) return true;
    return get().ownedThemePacks.includes(packId);
  },
}));
