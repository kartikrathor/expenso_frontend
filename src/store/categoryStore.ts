import { create } from 'zustand';
import { CategoryId } from '../types/expense';
import { CATEGORIES, CategoryConfig } from '../constants/categories';
import { apiRequest } from '../services/api';
import { useAuthStore } from './authStore';
import { setLearnedCategoryTerms } from '../utils/expenseParser';

type RemoteCat = {
  id: string;
  label: string;
  labelHi?: string;
  emoji: string;
  color: string;
  source: 'global' | 'custom';
};

interface CategoryStore {
  all: CategoryConfig[];
  custom: CategoryConfig[];
  isLoaded: boolean;
  loadCategories: () => Promise<void>;
  addCustomCategory: (label: string, emoji?: string, color?: string) => Promise<CategoryConfig>;
  getConfig: (id: CategoryId) => CategoryConfig;
}

function toConfig(c: RemoteCat): CategoryConfig {
  return {
    id: c.id as CategoryId,
    label: c.label,
    labelHi: c.labelHi || c.label,
    emoji: c.emoji,
    color: c.color,
  };
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  all: CATEGORIES,
  custom: [],
  isLoaded: false,

  loadCategories: async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ all: CATEGORIES, custom: [], isLoaded: true });
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
      const global = (data.global || []).map(toConfig);
      const custom = (data.custom || []).map(toConfig);
      const byId = new Map<string, CategoryConfig>();
      [...(global.length ? global : CATEGORIES), ...custom].forEach(c => byId.set(c.id, c));
      set({ all: [...byId.values()], custom, isLoaded: true });
    } catch {
      set({ all: CATEGORIES, custom: [], isLoaded: true });
    }
  },

  addCustomCategory: async (label, emoji = '✨', color = '#A855F7') => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Not logged in');
    const data = await apiRequest<{ category: RemoteCat }>('/api/categories/custom', {
      method: 'POST',
      token,
      body: { label, emoji, color },
    });
    const created = toConfig(data.category);
    const all = [...get().all.filter(c => c.id !== created.id), created];
    const custom = [...get().custom.filter(c => c.id !== created.id), created];
    set({ all, custom });
    return created;
  },

  getConfig: id => {
    return get().all.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
  },
}));
