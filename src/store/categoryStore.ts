import { create } from 'zustand';
import { CategoryId } from '../types/expense';
import { CATEGORIES, CategoryConfig } from '../constants/categories';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';
import { setLearnedCategoryTerms } from '../utils/expenseParser';
import { syncIconUrls } from '../utils/iconCache';

type RemoteCat = {
  id: string;
  label: string;
  labelHi?: string;
  emoji: string;
  color: string;
  iconUrl?: string;
  source: 'global' | 'custom';
};

export type IconSuggestion = { key: string; url: string; svg?: string };

interface CategoryStore {
  all: CategoryConfig[];
  custom: CategoryConfig[];
  isLoaded: boolean;
  loadCategories: () => Promise<void>;
  refreshLearnedTerms: () => Promise<void>;
  learnCorrection: (input: {
    fromCategory?: string;
    toCategory: string;
    merchantLabel: string;
    note?: string;
  }) => Promise<void>;
  addCustomCategory: (opts: {
    label: string;
    emoji?: string;
    color?: string;
    iconUrl?: string;
  }) => Promise<CategoryConfig>;
  deleteCustomCategory: (slug: string) => Promise<{ movedCount: number }>;
  fetchIconSuggestions: (query: string) => Promise<{ emojis: string[]; icons: IconSuggestion[] }>;
  getConfig: (id: CategoryId) => CategoryConfig;
}

function toConfig(c: RemoteCat): CategoryConfig {
  return {
    id: c.id as CategoryId,
    label: c.label,
    labelHi: c.labelHi || c.label,
    emoji: c.emoji,
    color: c.color,
    iconUrl: c.iconUrl || '',
    source: c.source,
  };
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  all: CATEGORIES.map(c => ({ ...c, source: 'global' as const })),
  custom: [],
  isLoaded: false,

  refreshLearnedTerms: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      setLearnedCategoryTerms({});
      return;
    }
    const data = await apiRequest<{ terms: Record<string, string> }>('/api/categories/terms', {
      token,
    });
    setLearnedCategoryTerms(data.terms || {});
  },

  learnCorrection: async input => {
    const from = input.fromCategory?.trim().toLowerCase();
    const to = input.toCategory.trim().toLowerCase();
    if (!to || to === 'other' || from === to) return;
    const token = useAuthStore.getState().token;
    if (!token) return;
    await apiRequest('/api/categories/learn', {
      method: 'POST',
      token,
      body: {
        fromCategory: from,
        toCategory: to,
        merchantLabel: input.merchantLabel,
        note: input.note,
      },
    });
    await get().refreshLearnedTerms();
  },

  loadCategories: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ all: CATEGORIES.map(c => ({ ...c, source: 'global' as const })), custom: [], isLoaded: true });
      setLearnedCategoryTerms({});
      return;
    }
    try {
      const [data, termsData] = await Promise.all([
        apiRequest<{ global: RemoteCat[]; custom: RemoteCat[] }>('/api/categories', { token }),
        apiRequest<{ terms: Record<string, string> }>('/api/categories/terms', { token }).catch(
          () => ({ terms: {} }),
        ),
      ]);
      setLearnedCategoryTerms(termsData.terms || {});
      const global = (data.global || []).map(c => toConfig({ ...c, source: 'global' }));
      const custom = (data.custom || []).map(c => toConfig({ ...c, source: 'custom' }));
      const byId = new Map<string, CategoryConfig>();
      [...(global.length ? global : CATEGORIES.map(c => ({ ...c, source: 'global' as const }))), ...custom].forEach(
        c => byId.set(c.id, c),
      );
      const all = [...byId.values()];
      set({ all, custom, isLoaded: true });
      // Disk-cache category icons; only hits network for missing (or daily integrity check).
      const iconUrls = all.map(c => c.iconUrl || '').filter(Boolean);
      if (iconUrls.length) void syncIconUrls(iconUrls);
    } catch {
      set({ all: CATEGORIES.map(c => ({ ...c, source: 'global' as const })), custom: [], isLoaded: true });
    }
  },

  addCustomCategory: async ({ label, emoji = '✨', color = '#A855F7', iconUrl = '' }) => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Please sign in again to continue.');
    const data = await apiRequest<{ category: RemoteCat }>('/api/categories/custom', {
      method: 'POST',
      token,
      body: { label, emoji, color, iconUrl: iconUrl || undefined },
    });
    const created = toConfig({ ...data.category, source: 'custom' });
    const all = [...get().all.filter(c => c.id !== created.id), created];
    const custom = [...get().custom.filter(c => c.id !== created.id), created];
    set({ all, custom });
    if (created.iconUrl) void syncIconUrls([created.iconUrl]);
    return created;
  },

  deleteCustomCategory: async slug => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Please sign in again to continue.');
    const data = await apiRequest<{ movedCount?: number }>(`/api/categories/custom/${slug}`, {
      method: 'DELETE',
      token,
    });
    const all = get().all.filter(c => c.id !== slug);
    const custom = get().custom.filter(c => c.id !== slug);
    set({ all, custom });
    return { movedCount: data.movedCount || 0 };
  },

  fetchIconSuggestions: async query => {
    const token = useAuthStore.getState().token;
    if (!token || query.trim().length < 2) {
      return { emojis: ['✨', '⭐', '💜', '📦'], icons: [] };
    }
    try {
      return await apiRequest<{ emojis: string[]; icons: IconSuggestion[] }>(
        `/api/categories/icon-suggestions?q=${encodeURIComponent(query.trim())}`,
        { token },
      );
    } catch {
      return { emojis: ['✨', '⭐', '💜', '📦', '🔖', '🧡'], icons: [] };
    }
  },

  getConfig: id => {
    return get().all.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
  },
}));
