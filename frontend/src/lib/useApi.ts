'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from './api';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Generic data-fetching hook.
 * Usage: const { data, loading, error, refetch } = useApi<MyType[]>('/endpoint');
 */
export function useApi<T = any>(
  endpoint: string | null | undefined,
  deps: any[] = []
): UseApiResult<T> {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(!!endpoint); // don't show loading if no endpoint yet
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!endpoint) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    apiRequest<any>(endpoint)
      .then((res) => {
        if (!cancelled) {
          // Backend wraps in { data: ... } — unwrap if present
          setData(res?.data !== undefined ? res.data : res);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Failed to load data');
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
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'POST'
) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const execute = useCallback(
    async (body?: TBody, endpointOverride?: string): Promise<TResult> => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>(endpointOverride || endpoint, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        return res?.data !== undefined ? res.data : res;
      } catch (err: any) {
        const message = err.message || 'Request failed';
        setError(message);
        throw new Error(message); // re-throw so callers can catch it properly
      } finally {
        setLoading(false);
      }
    },
    [endpoint, method]
  );

  return { loading, error, execute };
}
