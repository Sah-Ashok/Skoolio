import redis from '../config/redis.config';

export const getCache = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err: any) {
    console.warn(`[Redis Cache] Get error for key "${key}":`, err.message);
    return null;
  }
};

export const setCache = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
  try {
    const serialized = JSON.stringify(value);
    await redis.set(key, serialized, 'EX', ttlSeconds);
  } catch (err: any) {
    console.warn(`[Redis Cache] Set error for key "${key}":`, err.message);
  }
};

export const deleteCache = async (...keys: string[]): Promise<void> => {
  try {
    if (!keys.length) return;
    await redis.del(...keys);
  } catch (err: any) {
    console.warn(`[Redis Cache] Del error for keys:`, err.message);
  }
};

export const deleteCachePattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys && keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err: any) {
    console.warn(`[Redis Cache] Pattern del error for "${pattern}":`, err.message);
  }
};
