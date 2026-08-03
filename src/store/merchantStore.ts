import { create } from 'zustand';
import { MerchantId } from '../types/expense';
import {
  DEFAULT_MERCHANT,
  MERCHANTS,
  MerchantConfig,
  setRuntimeMerchants,
} from '../constants/merchants';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';

type RemoteMerchant = {
  id: string;
  label: string;
  keywords?: string[];
  category: string;
  color: string;
  bgColor: string;
  iconLetter: string;
  iconUrl?: string;
};

interface MerchantStore {
  all: MerchantConfig[];
  isLoaded: boolean;
  loadMerchants: () => Promise<void>;
  getConfig: (id: MerchantId) => MerchantConfig;
}

function toConfig(m: RemoteMerchant): MerchantConfig {
  return {
    id: m.id,
    label: m.label,
    keywords: m.keywords || [],
    category: m.category,
    color: m.color,
    bgColor: m.bgColor,
    iconLetter: m.iconLetter || m.label?.[0] || '?',
    iconUrl: m.iconUrl || '',
  };
}

export const useMerchantStore = create<MerchantStore>((set, get) => ({
  all: MERCHANTS,
  isLoaded: false,

  loadMerchants: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      setRuntimeMerchants(MERCHANTS);
      set({ all: MERCHANTS, isLoaded: true });
      return;
    }
    try {
      const data = await apiRequest<{ merchants: RemoteMerchant[] }>('/api/merchants', {
        token,
      });
      const list = (data.merchants || []).map(toConfig);
      const next = list.length ? list : MERCHANTS;
      setRuntimeMerchants(next);
      set({ all: next, isLoaded: true });
    } catch {
      setRuntimeMerchants(MERCHANTS);
      set({ all: MERCHANTS, isLoaded: true });
    }
  },

  getConfig: id => {
    if (id === 'default') return DEFAULT_MERCHANT;
    return get().all.find(m => m.id === id) ?? DEFAULT_MERCHANT;
  },
}));
