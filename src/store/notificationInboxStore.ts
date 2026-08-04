import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  ticketId?: string;
  read: boolean;
  createdAt: string;
};

type InboxState = {
  items: InboxNotification[];
  isLoaded: boolean;
  userId: string | null;
  loadForUser: (userId: string | null) => Promise<void>;
  addFromPush: (input: {
    title?: string | null;
    body?: string | null;
    type?: string | null;
    ticketId?: string | null;
    id?: string;
  }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
  unreadCount: () => number;
};

function storageKey(userId: string) {
  return `@expenso_notif_inbox_${userId}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function persist(userId: string | null, items: InboxNotification[]) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(items.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export const useNotificationInboxStore = create<InboxState>((set, get) => ({
  items: [],
  isLoaded: false,
  userId: null,

  loadForUser: async userId => {
    if (!userId) {
      set({ items: [], isLoaded: true, userId: null });
      return;
    }
    try {
      const raw = await AsyncStorage.getItem(storageKey(userId));
      const items: InboxNotification[] = raw ? JSON.parse(raw) : [];
      set({
        items: Array.isArray(items) ? items : [],
        isLoaded: true,
        userId,
      });
    } catch {
      set({ items: [], isLoaded: true, userId });
    }
  },

  addFromPush: input => {
    const title = String(input.title || '').trim() || 'Expenso';
    const body = String(input.body || '').trim();
    if (!body && !input.type) return;

    const item: InboxNotification = {
      id: input.id || makeId(),
      title,
      body: body || 'New notification',
      type: String(input.type || 'admin_broadcast'),
      ticketId: input.ticketId || undefined,
      read: false,
      createdAt: new Date().toISOString(),
    };

    const { userId, items } = get();
    // Dedupe identical title+body within 30s
    const recent = items[0];
    if (
      recent &&
      recent.title === item.title &&
      recent.body === item.body &&
      Date.now() - new Date(recent.createdAt).getTime() < 30_000
    ) {
      return;
    }

    const next = [item, ...items].slice(0, 100);
    set({ items: next });
    void persist(userId, next);
  },

  markRead: id => {
    const { userId, items } = get();
    const next = items.map(n => (n.id === id ? { ...n, read: true } : n));
    set({ items: next });
    void persist(userId, next);
  },

  markAllRead: () => {
    const { userId, items } = get();
    const next = items.map(n => ({ ...n, read: true }));
    set({ items: next });
    void persist(userId, next);
  },

  clearAll: () => {
    const { userId } = get();
    set({ items: [] });
    void persist(userId, []);
  },

  unreadCount: () => get().items.filter(n => !n.read).length,
}));
