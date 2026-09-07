// ── In-Memory SWR API Cache ─────────────────────────────────────────────────
// Persistent across Next.js route chunks in browser memory (window.__skoolioApiCache)

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export const DEFAULT_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes default
export const MAX_CACHE_ENTRIES = 100; // max entries to prevent memory leaks

export function normalizeCacheKey(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const dummyBase = 'http://localhost';
    const parsed = new URL(url, dummyBase);
    const params = new URLSearchParams(parsed.search);
    const sortedKeys = Array.from(params.keys()).sort();
    const sortedParams = new URLSearchParams();
    for (const key of sortedKeys) {
      const vals = params.getAll(key).sort();
      for (const val of vals) {
        sortedParams.append(key, val);
      }
    }
    const query = sortedParams.toString();
    return parsed.pathname + (query ? `?${query}` : '');
  } catch {
    return url;
  }
}

export function getApiCache(): Map<string, CacheEntry> {
  if (typeof window !== 'undefined') {
    if (!(window as any).__skoolioApiCache) {
      (window as any).__skoolioApiCache = new Map<string, CacheEntry>();
    }
    return (window as any).__skoolioApiCache;
  }
  return new Map<string, CacheEntry>();
}

export function getCached(key: string | null | undefined): any | null {
  if (!key) return null;
  const normalized = normalizeCacheKey(key);
  const cache = getApiCache();
  const entry = cache.get(normalized);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > entry.ttl) {
    cache.delete(normalized);
    return null;
  }
  return entry.data;
}

export function setCached(key: string, data: any, ttl: number = DEFAULT_CACHE_TTL_MS): void {
  if (!key) return;
  const normalized = normalizeCacheKey(key);
  const cache = getApiCache();

  // Bounded capacity: evict oldest entry if limit reached
  if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(normalized)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }

  cache.set(normalized, {
    data,
    timestamp: Date.now(),
    ttl: ttl > 0 ? ttl : DEFAULT_CACHE_TTL_MS,
  });
}

/**
 * Purge cache entries. If endpointPrefix is provided, deletes matching normalized keys;
 * otherwise purges the entire cache.
 */
export function clearApiCache(endpointPrefix?: string): void {
  const cache = getApiCache();
  if (!endpointPrefix) {
    cache.clear();
    return;
  }
  const prefix = normalizeCacheKey(endpointPrefix).replace(/\?.*$/, '');
  for (const key of cache.keys()) {
    if (key === prefix || key.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`) || key.startsWith(`${prefix}?`)) {
      cache.delete(key);
    }
  }
}
