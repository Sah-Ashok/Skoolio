import { Request, Response, NextFunction } from 'express';
import { trackActiveUser } from '../Service/redis.service';
import { getClientIp } from './rateLimiter.middleware';
import { verifyToken } from '../config/jwt.config';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';

/**
 * Fire-and-forget middleware that registers user heartbeat in Redis
 */
export function activeUserMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let user = req.user as IJwtAdminPayload | IJwtUserPayload | undefined;

    // If req.user has not yet been attached by a downstream route protect middleware,
    // decode the JWT token directly from cookies or Authorization header
    if (!user) {
      const token =
        req.cookies?.token ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.split(' ')[1]
          : null);
      if (token) {
        try {
          user = verifyToken(token) as any;
        } catch {
          // invalid or expired token, safely ignore
        }
      }
    }

    if (user) {
      const role = user.role;
      const school_id =
        'school_id' in user && user.school_id
          ? Number(user.school_id)
          : role === 'admin'
          ? Number(user.id)
          : 0;
      const user_id = Number(user.id);
      const ip = getClientIp(req);
      const name =
        (user as any).school_name ||
        (user as any).full_name ||
        (user as any).owner_full_name ||
        (user as any).email ||
        '';

      // Fire and forget heartbeat to Redis
      trackActiveUser({
        school_id,
        user_id,
        role,
        name,
        ip,
      }).catch(() => {});
    }
  } catch {
    // Non-blocking telemetry error
  }
  next();
}
