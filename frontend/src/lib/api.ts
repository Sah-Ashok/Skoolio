import { clearApiCache } from './apiCache';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { skipCacheInvalidation?: boolean } = {}
): Promise<T> {
  // If body is FormData, don't set Content-Type — let the browser set it
  // automatically with the correct multipart boundary for file uploads.
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: isFormData
      ? { ...options.headers }                              // no Content-Type
      : { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  // Automatically invalidate cached GET data on successful mutations
  const method = (options.method || 'GET').toUpperCase();
  if (!options.skipCacheInvalidation && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const pathWithoutQuery = endpoint.split('?')[0];
    const rootPrefix = '/' + pathWithoutQuery.replace(/^\//, '').split('/')[0];
    clearApiCache(rootPrefix);
    clearApiCache('/dashboard');
  }

  return data;
}
