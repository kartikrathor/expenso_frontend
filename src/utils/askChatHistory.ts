import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredChatBubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  chips?: string[];
  intent?: string;
  /** Epoch ms — used for 30-day retention */
  createdAt: number;
  source?: 'rules' | 'llm' | 'fallback' | 'precise';
  canPrecise?: boolean;
};

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 300;
const memoryCache = new Map<string, StoredChatBubble[]>();

/** Bumps on wipe so in-memory Ask UI + pending saves don't resurrect chat. */
let clearEpoch = 0;
const clearListeners = new Set<(userId: string) => void>();

function storageKey(userId: string, isJoint: boolean) {
  return `@expenso_ask_chat_${userId}_${isJoint ? 'joint' : 'solo'}`;
}

function prune(messages: StoredChatBubble[]): StoredChatBubble[] {
  const cutoff = Date.now() - RETENTION_MS;
  return messages
    .filter(m => typeof m.createdAt === 'number' && m.createdAt >= cutoff)
    .filter(m => m.text?.trim())
    .slice(-MAX_MESSAGES);
}

export function getAskChatClearEpoch(): number {
  return clearEpoch;
}

/** AskExpensoChat listens so Clear all data resets the open thread immediately. */
export function subscribeAskChatCleared(listener: (userId: string) => void): () => void {
  clearListeners.add(listener);
  return () => {
    clearListeners.delete(listener);
  };
}

/** Sync read if already preloaded — avoids Ask tab flash. */
export function getAskChatHistoryCached(
  userId: string | null | undefined,
  isJoint: boolean,
): StoredChatBubble[] | null {
  if (!userId) return null;
  const key = storageKey(userId, isJoint);
  return memoryCache.has(key) ? memoryCache.get(key)! : null;
}

/**
 * Load Ask chat for this user (last 30 days). Older messages are dropped and persisted.
 */
export async function loadAskChatHistory(
  userId: string | null | undefined,
  isJoint: boolean,
): Promise<StoredChatBubble[]> {
  if (!userId) return [];
  const key = storageKey(userId, isJoint);
  if (memoryCache.has(key)) return memoryCache.get(key)!;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      memoryCache.set(key, []);
      return [];
    }
    const parsed = JSON.parse(raw) as StoredChatBubble[];
    if (!Array.isArray(parsed)) {
      memoryCache.set(key, []);
      return [];
    }
    const cleaned = prune(
      parsed.filter(
        m =>
          m &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.text === 'string' &&
          typeof m.id === 'string',
      ),
    );
    if (cleaned.length !== parsed.length) {
      await AsyncStorage.setItem(key, JSON.stringify(cleaned));
    }
    memoryCache.set(key, cleaned);
    return cleaned;
  } catch {
    memoryCache.set(key, []);
    return [];
  }
}

/** Warm both personal + joint threads after login so Ask opens instantly. */
export async function preloadAskChatHistory(userId: string | null | undefined): Promise<void> {
  if (!userId) return;
  await Promise.all([
    loadAskChatHistory(userId, false),
    loadAskChatHistory(userId, true),
  ]);
}

export async function saveAskChatHistory(
  userId: string | null | undefined,
  isJoint: boolean,
  messages: StoredChatBubble[],
  opts?: { epoch?: number },
): Promise<void> {
  if (!userId) return;
  // Drop stale writes after Clear all data / logout wipe
  if (opts?.epoch != null && opts.epoch !== clearEpoch) return;
  try {
    const cleaned = prune(messages);
    const key = storageKey(userId, isJoint);
    memoryCache.set(key, cleaned);
    if (opts?.epoch != null && opts.epoch !== clearEpoch) return;
    await AsyncStorage.setItem(key, JSON.stringify(cleaned));
  } catch {
    // ignore quota / serialize errors
  }
}

export async function clearAskChatHistory(
  userId: string | null | undefined,
  isJoint?: boolean,
): Promise<void> {
  if (!userId) return;
  clearEpoch += 1;
  try {
    if (isJoint === undefined) {
      memoryCache.set(storageKey(userId, false), []);
      memoryCache.set(storageKey(userId, true), []);
      await AsyncStorage.removeMany([
        storageKey(userId, false),
        storageKey(userId, true),
      ]);
    } else {
      memoryCache.set(storageKey(userId, isJoint), []);
      await AsyncStorage.removeItem(storageKey(userId, isJoint));
    }
  } catch {
    // ignore
  }
  clearListeners.forEach(listener => {
    try {
      listener(userId);
    } catch {
      // ignore listener errors
    }
  });
}

export function withTimestamps(
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    text: string;
    chips?: string[];
    intent?: string;
    createdAt?: number;
    source?: 'rules' | 'llm' | 'fallback' | 'precise';
    canPrecise?: boolean;
  }>,
): StoredChatBubble[] {
  const now = Date.now();
  return messages.map((m, i) => ({
    id: m.id,
    role: m.role,
    text: m.text,
    chips: m.chips,
    intent: m.intent,
    createdAt: m.createdAt || now + i,
    source: m.source,
    canPrecise: m.canPrecise,
  }));
}
