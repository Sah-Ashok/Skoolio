import { Request, Response, NextFunction } from 'express';
import { isIpBanned, getMaintenanceMode } from '../Service/redis.service';
import { getClientIp } from './rateLimiter.middleware';

/**
 * First-line defense: blocks banned IPs and enforces platform maintenance mode
 */
export async function ipBanAndMaintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const ip = getClientIp(req);

    // 1. IP Ban check
    const banned = await isIpBanned(ip);
    if (banned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Your IP address has been banned due to security violations.',
      });
    }

    // 2. Platform Maintenance check
    // Allow health check and super-admin routes even during maintenance
    const path = req.originalUrl || req.url;
    if (!path.startsWith('/api/health') && !path.startsWith('/api/security') && !path.startsWith('/api/auth/super-admin')) {
      const maintenance = await getMaintenanceMode();
      if (maintenance.enabled) {
        return res.status(503).json({
          success: false,
          isMaintenance: true,
          message: maintenance.message || 'Skoolio is currently undergoing scheduled maintenance. Please check back shortly.',
        });
      }
    }

    next();
  } catch {
    // If Redis is briefly unreachable, proceed safely
    next();
  }
}
