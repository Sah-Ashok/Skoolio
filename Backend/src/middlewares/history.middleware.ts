/**
 * History / Activity Log Middleware
 *
 * Fire-and-forget: logs are written AFTER the response is sent via res.on('finish').
 * It NEVER blocks the main request/response loop. Any logging error is silently swallowed.
 *
 * Usage — attach to individual routes that should be tracked:
 *
 *   import historyMiddleware from '../middlewares/history.middleware';
 *
 *   router.post('/students', protect, restrictTo('admin'), historyMiddleware({
 *     module: 'students',
 *     action: 'CREATE',
 *     getDescription: (req) => `Created student: ${req.body?.full_name || 'unknown'}`,
 *   }), createStudent);
 *
 * Or attach globally to all mutating routes in app.ts (see note below).
 */

import { Request, Response, NextFunction } from 'express';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import pool from '../config/db';

export interface HistoryContext {
  /** Which module triggered this action: 'students', 'fees', 'attendance', etc. */
  module: string;
  /** Action verb: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'GENERATE' | etc. */
  action: string;
  /**
   * Optional: derive a human-readable description from req.
   * If omitted, a generic "<action> on <module>" description is used.
   */
  getDescription?: (req: Request, statusCode: number) => string;
  /**
   * Optional: extract entity_id from req (e.g. req.params.id).
   * If omitted, attempts req.params.id automatically.
   */
  getEntityId?: (req: Request) => number | undefined;
  /**
   * Optional: human-readable label for the affected entity.
   */
  getEntityLabel?: (req: Request) => string | undefined;
}

/**
 * Resolve school_id from JWT payload.
 * Admin: id = school_id. Faculty/Student: school_id field.
 */
function resolveSchoolId(user: IJwtAdminPayload | IJwtUserPayload): number {
  return 'school_id' in user ? user.school_id : user.id;
}

function resolveActorName(user: IJwtAdminPayload | IJwtUserPayload): string {
  // Cast through `any` — both payload types have `email` but TS can't narrow the union here
  const email = (user as any).email as string;
  if ('school_name' in user) return (user as IJwtAdminPayload).school_name || email;
  return email;
}

/**
 * Factory that returns Express middleware for logging an activity.
 * The log is written fire-and-forget after response finishes — never blocks main loop.
 */
export function historyMiddleware(ctx: HistoryContext) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      // Only log successful mutating responses (2xx). Skip 4xx/5xx.
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      // Silently skip if not authenticated (shouldn't happen on protected routes)
      if (!req.user) return;

      const user = req.user as IJwtAdminPayload | IJwtUserPayload;
      const school_id = resolveSchoolId(user);
      const actor_id = user.id;
      const actor_role = user.role;
      const actor_name = resolveActorName(user);

      const entity_id = ctx.getEntityId
        ? ctx.getEntityId(req)
        : req.params?.id ? Number(req.params.id) : undefined;

      const entity_label = ctx.getEntityLabel ? ctx.getEntityLabel(req) : undefined;

      const description = ctx.getDescription
        ? ctx.getDescription(req, res.statusCode)
        : `${ctx.action} on ${ctx.module}`;

      const ip_address =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        null;

      const user_agent = (req.headers['user-agent'] || '').substring(0, 499);

      // Fire and forget — never await, never throw to caller
      setImmediate(() => {
        pool.query(
          `INSERT INTO activity_logs
             (school_id, actor_id, actor_role, actor_name, module, action,
              entity_id, entity_label, description, ip_address, user_agent)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            school_id,
            actor_id,
            actor_role,
            actor_name,
            ctx.module,
            ctx.action,
            entity_id ?? null,
            entity_label ?? null,
            description,
            ip_address,
            user_agent,
          ]
        ).catch(() => {
          // Silently ignore — logging must never crash the app
        });
      });
    });

    next();
  };
}

/**
 * Global auto-logger middleware.
 * Attach this in app.ts BEFORE route handlers to auto-log all mutating requests
 * (POST, PUT, PATCH, DELETE) across the entire app without touching each route.
 *
 * It infers module from the URL path and action from the HTTP method.
 * For fine-grained descriptions, use historyMiddleware() per-route instead.
 */
export function globalHistoryMiddleware(req: Request, res: Response, next: NextFunction): void {
  const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!MUTATING_METHODS.includes(req.method)) return next();

  // Infer module from the first path segment after /api/
  // e.g. /api/students/123 → 'students'
  const segments = req.path.replace(/^\/api\//, '').split('/');
  const module = segments[0] || 'unknown';

  const ACTION_MAP: Record<string, string> = {
    POST:   'CREATE',
    PUT:    'UPDATE',
    PATCH:  'UPDATE',
    DELETE: 'DELETE',
  };
  const action = ACTION_MAP[req.method] || req.method;

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    if (!req.user) return;

    const user = req.user as IJwtAdminPayload | IJwtUserPayload;
    const school_id = resolveSchoolId(user);
    const entity_id = req.params?.id ? Number(req.params.id) : null;

    const description =
      `${action} [${req.method} ${req.path}]` +
      (entity_id ? ` id=${entity_id}` : '') +
      (req.body?.full_name ? ` name="${req.body.full_name}"` : '');

    const ip_address =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    const user_agent = (req.headers['user-agent'] || '').substring(0, 499);

    setImmediate(() => {
      pool.query(
        `INSERT INTO activity_logs
           (school_id, actor_id, actor_role, actor_name, module, action,
            entity_id, entity_label, description, ip_address, user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          school_id,
          user.id,
          user.role,
          resolveActorName(user),
          module,
          action,
          entity_id,
          null,
          description,
          ip_address,
          user_agent,
        ]
      ).catch(() => {});
    });
  });

  next();
}
