import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';

const META_KEY = '@expenso_icon_cache_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

type CacheEntry = {
  /** Absolute path under CacheDir */
  path: string;
  kind: 'svg' | 'bin';
  updatedAt: number;
};

type CacheMeta = {
  lastSyncAt: number;
  byUrl: Record<string, CacheEntry>;
};

const svgMemory = new Map<string, string>();
const binMemory = new Map<string, string>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

let metaPromise: Promise<CacheMeta> | null = null;
let meta: CacheMeta | null = null;
let dirReady: Promise<void> | null = null;

function notify() {
  listeners.forEach(l => {
    try {
      l();
    } catch {
      // ignore subscriber errors
    }
  });
}

/** Subscribe to cache updates (new icons downloaded). Returns unsubscribe. */
export function subscribeIconCache(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function cacheDir(): string {
  return `${ReactNativeBlobUtil.fs.dirs.CacheDir}/expenso_icons`;
}

function hashKey(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Stable cache key: drop volatile tint so one file serves all colors when possible. */
export function normalizeIconUrl(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return '';

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const u = new URL(trimmed);
      if (/iconify\.design/i.test(u.hostname)) {
        u.searchParams.delete('color');
        // Tint applied at render via currentColor replace
        return u.toString();
      }
    }
  } catch {
    // fall through
  }
  return trimmed;
}

function isSvgUrl(uri: string): boolean {
  const u = uri.toLowerCase();
  return (
    u.includes('.svg') ||
    u.includes('image/svg') ||
    u.includes('api.iconify.design') ||
    u.includes('iconify')
  );
}

async function ensureDir() {
  if (!dirReady) {
    dirReady = (async () => {
      const dir = cacheDir();
      const exists = await ReactNativeBlobUtil.fs.exists(dir);
      if (!exists) await ReactNativeBlobUtil.fs.mkdir(dir);
    })().catch(() => {
      dirReady = null;
    });
  }
  await dirReady;
}

async function loadMeta(): Promise<CacheMeta> {
  if (meta) return meta;
  if (!metaPromise) {
    metaPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(META_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheMeta;
          if (parsed && typeof parsed === 'object' && parsed.byUrl) {
            meta = {
              lastSyncAt: typeof parsed.lastSyncAt === 'number' ? parsed.lastSyncAt : 0,
              byUrl: parsed.byUrl || {},
            };
            return meta;
          }
        }
      } catch {
        // corrupt — reset
      }
      meta = { lastSyncAt: 0, byUrl: {} };
      return meta;
    })();
  }
  return metaPromise;
}

async function saveMeta(next: CacheMeta) {
  meta = next;
  await AsyncStorage.setItem(META_KEY, JSON.stringify(next)).catch(() => {});
}

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function readSvgFromDisk(path: string): Promise<string | null> {
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(path);
    if (!exists) return null;
    const text = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
    return typeof text === 'string' && text.includes('<svg') ? text : null;
  } catch {
    return null;
  }
}

/** Apply tint for Iconify-style SVGs that use currentColor. */
export function tintSvgXml(xml: string, color?: string): string {
  if (!color || !xml) return xml;
  if (!xml.includes('currentColor')) return xml;
  return xml.split('currentColor').join(color);
}

/**
 * Synchronous peek — memory only. Use after ensure/sync so list UIs stay instant.
 */
export function peekCachedSvg(uri: string, color?: string): string | undefined {
  const key = normalizeIconUrl(uri);
  if (!key) return undefined;
  const xml = svgMemory.get(key);
  return xml ? tintSvgXml(xml, color) : undefined;
}

export function peekCachedLocalUri(uri: string): string | undefined {
  const key = normalizeIconUrl(uri);
  if (!key) return undefined;
  return binMemory.get(key);
}

async function hydrateEntry(key: string, entry: CacheEntry): Promise<boolean> {
  if (entry.kind === 'svg') {
    if (svgMemory.has(key)) return true;
    const xml = await readSvgFromDisk(entry.path);
    if (!xml) return false;
    svgMemory.set(key, xml);
    return true;
  }
  if (binMemory.has(key)) return true;
  try {
    const exists = await ReactNativeBlobUtil.fs.exists(entry.path);
    if (!exists) return false;
    binMemory.set(key, fileUri(entry.path));
    return true;
  } catch {
    return false;
  }
}

async function downloadIcon(key: string, remoteUrl: string): Promise<void> {
  await ensureDir();
  const svg = isSvgUrl(remoteUrl);
  const ext = svg ? 'svg' : 'bin';
  const path = `${cacheDir()}/${hashKey(key)}.${ext}`;

  if (svg) {
    const res = await fetch(remoteUrl);
    if (!res.ok) throw new Error(`icon fetch ${res.status}`);
    const text = await res.text();
    if (!text.includes('<svg')) throw new Error('not svg');
    await ReactNativeBlobUtil.fs.writeFile(path, text, 'utf8');
    svgMemory.set(key, text);
    const m = await loadMeta();
    m.byUrl[key] = { path, kind: 'svg', updatedAt: Date.now() };
    await saveMeta(m);
    notify();
    return;
  }

  const exists = await ReactNativeBlobUtil.fs.exists(path);
  if (exists) await ReactNativeBlobUtil.fs.unlink(path).catch(() => {});
  await ReactNativeBlobUtil.config({ path }).fetch('GET', remoteUrl);
  binMemory.set(key, fileUri(path));
  const m = await loadMeta();
  m.byUrl[key] = { path, kind: 'bin', updatedAt: Date.now() };
  await saveMeta(m);
  notify();
}

/**
 * Ensure a single icon is in memory/disk cache. Safe to call often — dedupes in-flight.
 */
export async function ensureIconCached(uri: string, color?: string): Promise<{
  svgXml?: string;
  localUri?: string;
} | null> {
  const key = normalizeIconUrl(uri);
  if (!key) return null;

  if (svgMemory.has(key)) {
    return { svgXml: tintSvgXml(svgMemory.get(key)!, color) };
  }
  if (binMemory.has(key)) {
    return { localUri: binMemory.get(key) };
  }

  const m = await loadMeta();
  const entry = m.byUrl[key];
  if (entry) {
    const ok = await hydrateEntry(key, entry);
    if (ok) {
      if (svgMemory.has(key)) return { svgXml: tintSvgXml(svgMemory.get(key)!, color) };
      if (binMemory.has(key)) return { localUri: binMemory.get(key) };
    }
    delete m.byUrl[key];
    await saveMeta(m);
  }

  let job = inflight.get(key);
  if (!job) {
    job = downloadIcon(key, key)
      .catch(() => {
        // leave uncached — UI falls back
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, job);
  }
  await job;

  if (svgMemory.has(key)) return { svgXml: tintSvgXml(svgMemory.get(key)!, color) };
  if (binMemory.has(key)) return { localUri: binMemory.get(key) };
  return null;
}

/**
 * Background sync for a set of icon URLs:
 * - Always download any URL not yet cached (new icons).
 * - At most once per day, mark a sync pass (so repeated category loads don't hit network
 *   for icons we already have).
 */
export async function syncIconUrls(uris: string[]): Promise<void> {
  const uniqueKeys = new Set<string>();
  for (const u of uris) {
    const key = normalizeIconUrl(u || '');
    if (key) uniqueKeys.add(key);
  }
  if (uniqueKeys.size === 0) return;

  const m = await loadMeta();
  const now = Date.now();
  const dueDaily = now - (m.lastSyncAt || 0) >= DAY_MS;

  const missing: string[] = [];
  let hydrated = false;
  for (const key of uniqueKeys) {
    const entry = m.byUrl[key];
    if (!entry) {
      missing.push(key);
      continue;
    }
    // Always hydrate disk → memory (no network). Daily pass also re-checks file exists.
    if (!svgMemory.has(key) && !binMemory.has(key)) {
      const ok = await hydrateEntry(key, entry);
      if (!ok) {
        delete m.byUrl[key];
        missing.push(key);
      } else {
        hydrated = true;
      }
    } else if (dueDaily) {
      const ok = await hydrateEntry(key, entry);
      if (!ok) {
        delete m.byUrl[key];
        missing.push(key);
      }
    }
  }

  if (missing.length) {
    await saveMeta(m);
    const queue = [...missing];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const key = queue.shift();
        if (!key) break;
        try {
          await ensureIconCached(key);
        } catch {
          // skip
        }
      }
    });
    await Promise.all(workers);
  } else if (hydrated) {
    notify();
  }

  if (dueDaily) {
    const latest = await loadMeta();
    latest.lastSyncAt = Date.now();
    await saveMeta(latest);
  }
}
