'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from './api';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── In-Memory SWR Cache (Persistent across Next.js route chunks) ───────────
interface CacheEntry {
  data: any;
  timestamp: number;
}

const getApiCache = (): Map<string, CacheEntry> => {
  if (typeof window !== 'undefined') {
    if (!(window as any).__skoolioApiCache) {
      (window as any).__skoolioApiCache = new Map<string, CacheEntry>();
    }
    return (window as any).__skoolioApiCache;
  }
  return new Map<string, CacheEntry>();
};

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string | null | undefined): any | null {
  if (!key) return null;
  const cache = getApiCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEFAULT_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Purge cache entries. If endpointPrefix is provided, deletes matching keys;
 * otherwise purges the entire cache.
 */
export function clearApiCache(endpointPrefix?: string) {
  const cache = getApiCache();
  if (!endpointPrefix) {
    cache.clear();
  } else {
    for (const key of cache.keys()) {
      if (key.startsWith(endpointPrefix)) {
        cache.delete(key);
      }
    }
  }
}

/**
 * Generic data-fetching hook with Stale-While-Revalidate (SWR) caching.
 * On repeated visits, cached data renders INSTANTLY (0ms, no spinner)
 * while a background fetch refreshes the latest data smoothly.
 *
 * Usage: const { data, loading, error, refetch } = useApi<MyType[]>('/endpoint');
 */
export function useApi<T = any>(
  endpoint: string | null | undefined,
  deps: any[] = []
): UseApiResult<T> {
  const initialCached = getCached(endpoint);
  const [data, setData]       = useState<T | null>(initialCached !== null ? initialCached : null);
  const [loading, setLoading] = useState(!!endpoint && initialCached === null);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  const refetch = useCallback(() => {
    if (endpoint) getApiCache().delete(endpoint);
    setTick((t) => t + 1);
  }, [endpoint]);

  useEffect(() => {
    if (!endpoint) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const hasCached = getCached(endpoint) !== null;
    if (!hasCached) {
      setLoading(true);
    }
    setError(null);

    apiRequest<any>(endpoint)
      .then((res) => {
        if (!cancelled) {
          // Backend wraps in { data: ... } — unwrap if present
          const unwrapped = res?.data !== undefined ? res.data : res;
          getApiCache().set(endpoint, { data: unwrapped, timestamp: Date.now() });
          setData(unwrapped);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          if (!hasCached) {
            setError(err.message || 'Failed to load data');
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, tick, ...deps]);

  return { data, loading, error, refetch };
}

/** POST/PATCH/DELETE helper that returns { loading, error, execute } */
export function useMutation<TBody = any, TResult = any>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST',
  invalidatePrefixes?: string[]
) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const execute = useCallback(
    async (body?: TBody, endpointOverride?: string): Promise<TResult> => {
      setLoading(true);
      setError(null);
      try {
        const target = endpointOverride || endpoint;
        const res = await apiRequest<any>(target, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        // Selectively clear related caches rather than nuking the entire global cache
        if (invalidatePrefixes && invalidatePrefixes.length > 0) {
          invalidatePrefixes.forEach(p => clearApiCache(p));
        } else {
          const root = '/' + target.replace(/^\//, '').split('/')[0].split('?')[0];
          clearApiCache(root);
          clearApiCache('/dashboard');
        }
        return res?.data !== undefined ? res.data : res;
      } catch (err: any) {
        const message = err.message || 'Request failed';
        setError(message);
        throw new Error(message); // re-throw so callers can catch it properly
      } finally {
        setLoading(false);
      }
    },
    [endpoint, method, invalidatePrefixes]
  );

  return { loading, error, execute };
}
