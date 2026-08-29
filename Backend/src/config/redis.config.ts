import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redisConnectionOptions = {
  host:     process.env.REDIS_HOST     || '127.0.0.1',
  port:     Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db:       Number(process.env.REDIS_DB)   || 0,
  maxRetriesPerRequest: null as null,
};

const redis = new Redis({
  ...redisConnectionOptions,
  maxRetriesPerRequest: 20,

  // NOTE: The TLS block was removed here. 
  // Redis Cloud Free Tier uses standard unencrypted connections.

  retryStrategy: (times) => {
    if (times > 3) {
      console.error('[Redis] Max reconnection attempts reached. Giving up.');
      return null;
    }
    return Math.min(times * 500, 2000);
  },

  lazyConnect: true,
  enableReadyCheck: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

redis.on('connect', () => console.log('[Redis] Connected to Redis Cloud ✓'));
redis.on('ready',   () => console.log('[Redis] Ready to accept commands'));
redis.on('error',   (err) => console.error('[Redis] Error:', err.message));
redis.on('close',   () => console.warn('[Redis] Connection closed'));

redis.connect().catch((err) => {
  console.error('[Redis] Initial connection failed:', err.message);
});

export default redis;