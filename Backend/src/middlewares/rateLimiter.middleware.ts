import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis.config';
import { banIp, logSecurityEvent } from '../Service/redis.service';

export interface RateLimiterOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
  autoBanThreshold?: number; // If count hits this, auto-ban the IP
}

/**
 * Extract clean client IP (handles reverse proxies, Cloudflare, Azure App Service)
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Creates a Redis-backed sliding window rate limiter middleware
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowSeconds,
    maxRequests,
    keyPrefix,
    message = 'Too many requests. Please try again later.',
    autoBanThreshold,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // If Redis is not available or connected, fail open
    if (!redis || redis.status !== 'ready') {
      return next();
    }

    const ip = getClientIp(req);
    const key = `rl:${keyPrefix}:${ip}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now, `${now}-${Math.random().toString(36).substring(2, 7)}`);
      pipeline.zcard(key);
      pipeline.expire(key, windowSeconds);

      const results = await pipeline.exec();
      const currentCount = (results?.[2]?.[1] as number) || 1;

      const remaining = Math.max(0, maxRequests - currentCount);
      const resetTime = Math.ceil(now / 1000) + windowSeconds;

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (currentCount > maxRequests) {
        res.setHeader('Retry-After', windowSeconds);

        // Check if auto-ban applies
        if (autoBanThreshold && currentCount >= autoBanThreshold) {
          await banIp(ip, `Auto-banned: Exceeded ${keyPrefix} rate limit (${currentCount}/${maxRequests} reqs)`, 3600);
          await logSecurityEvent({
            event_type: 'BRUTE_FORCE_BLOCKED',
            ip_address: ip,
            user_agent: req.headers['user-agent'] as string,
            endpoint: req.originalUrl || req.url,
            details: { count: currentCount, threshold: autoBanThreshold, prefix: keyPrefix },
          });
          return res.status(403).json({
            success: false,
            message: 'Your IP has been temporarily banned due to excessive suspicious requests.',
          });
        }

        // Log rate limit violation (throttled to avoid spamming the log)
        if (currentCount === maxRequests + 1) {
          logSecurityEvent({
            event_type: 'RATE_LIMIT_EXCEEDED',
            ip_address: ip,
            user_agent: req.headers['user-agent'] as string,
            endpoint: req.originalUrl || req.url,
            details: { count: currentCount, max: maxRequests, windowSeconds },
          }).catch(() => {});
        }

        return res.status(429).json({
          success: false,
          message,
          retryAfter: windowSeconds,
        });
      }

      next();
    } catch (err) {
      // Fail open so legitimate traffic is never blocked if Redis has a hiccup
      console.warn('[RateLimiter] Error evaluating rate limit:', (err as any).message);
      next();
    }
  };
}

// ── PRE-CONFIGURED LIMITERS ──

/**
 * Strict limiter for sensitive authentication endpoints (Login, Password Reset, OTP)
 * Limit: 5 attempts per minute per IP. Auto-bans at 15 attempts.
 */
export const strictAuthLimiter = createRateLimiter({
  keyPrefix: 'auth',
  windowSeconds: 60,
  maxRequests: 5,
  autoBanThreshold: 15,
  message: 'Too many login attempts. Please wait 1 minute before trying again.',
});

/**
 * Standard limiter for all general API endpoints
 * Limit: 150 requests per minute per IP.
 */
export const globalApiLimiter = createRateLimiter({
  keyPrefix: 'api',
  windowSeconds: 60,
  maxRequests: 150,
  autoBanThreshold: 350,
  message: 'API rate limit exceeded. Please slow down your requests.',
});

/**
 * Selective limiter for heavy batch operations (mass fee generation, mass reports)
 * Limit: 10 requests per minute per IP.
 */
export const heavyTaskLimiter = createRateLimiter({
  keyPrefix: 'heavy',
  windowSeconds: 60,
  maxRequests: 10,
  message: 'Operation in progress. Please wait before triggering another batch job.',
});
