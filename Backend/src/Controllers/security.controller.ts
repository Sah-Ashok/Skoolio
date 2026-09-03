import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import pool from '../config/db';
import {
  getActiveUsersStats,
  getBannedIps,
  banIp,
  unbanIp,
  getMaintenanceMode,
  setMaintenanceMode,
  getGlobalAnnouncement,
  setGlobalAnnouncement,
  syncBlockedSchools,
} from '../Service/redis.service';

/**
 * GET /api/security/traffic-stats
 * Real-time active users and platform security overview
 */
export const getTrafficStats = catchAsync(async (req: Request, res: Response) => {
  const activeStats = await getActiveUsersStats();
  const bannedIps = await getBannedIps();
  const maintenance = await getMaintenanceMode();
  const announcement = await getGlobalAnnouncement();

  // Get total events count in last 24h
  let events24h = 0;
  try {
    const evRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM platform_security_events WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    events24h = evRes.rows[0]?.count || 0;
  } catch {}

  sendResponse(res, 200, true, 'Traffic and security stats retrieved', {
    ...activeStats,
    bannedIpsCount: bannedIps.length,
    eventsLast24Hours: events24h,
    maintenance,
    announcement,
  });
});

/**
 * GET /api/security/events
 * Fetch recent security events
 */
export const getSecurityEvents = catchAsync(async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const event_type = req.query.event_type ? String(req.query.event_type) : null;

  let query = `
    SELECT e.*, s.school_name
    FROM platform_security_events e
    LEFT JOIN schools s ON s.id = e.school_id
  `;
  const params: any[] = [];

  if (event_type) {
    query += ` WHERE e.event_type = $1`;
    params.push(event_type);
  }

  query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await pool.query(query, params);
  sendResponse(res, 200, true, 'Security events retrieved', result.rows);
});

/**
 * GET /api/security/banned-ips
 */
export const getBannedIpsController = catchAsync(async (req: Request, res: Response) => {
  const ips = await getBannedIps();
  sendResponse(res, 200, true, 'Banned IPs retrieved', ips);
});

/**
 * POST /api/security/ban-ip
 */
export const banIpController = catchAsync(async (req: Request, res: Response) => {
  const { ip, reason, durationSeconds } = req.body;
  if (!ip || typeof ip !== 'string') {
    return sendResponse(res, 400, false, 'Valid IP address is required', null);
  }

  await banIp(ip.trim(), reason || 'Banned by Super Admin', durationSeconds ? Number(durationSeconds) : 86400);
  sendResponse(res, 200, true, `IP ${ip} has been banned`, null);
});

/**
 * DELETE /api/security/unban-ip/:ip
 */
export const unbanIpController = catchAsync(async (req: Request, res: Response) => {
  const ip = String(req.params.ip || '').trim();
  if (!ip) {
    return sendResponse(res, 400, false, 'IP address parameter is required', null);
  }

  await unbanIp(ip);
  sendResponse(res, 200, true, `IP ${ip} has been unbanned`, null);
});

/**
 * GET /api/security/maintenance
 */
export const getMaintenanceController = catchAsync(async (req: Request, res: Response) => {
  const state = await getMaintenanceMode();
  sendResponse(res, 200, true, 'Maintenance status', state);
});

/**
 * POST /api/security/maintenance
 */
export const setMaintenanceController = catchAsync(async (req: Request, res: Response) => {
  const { enabled, message } = req.body;
  await setMaintenanceMode(Boolean(enabled), message || 'Skoolio is currently undergoing scheduled maintenance.');
  sendResponse(res, 200, true, `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`, { enabled, message });
});

/**
 * GET /api/security/announcement
 */
export const getAnnouncementController = catchAsync(async (req: Request, res: Response) => {
  const ann = await getGlobalAnnouncement();
  sendResponse(res, 200, true, 'Global announcement', ann);
});

/**
 * POST /api/security/announcement
 */
export const setAnnouncementController = catchAsync(async (req: Request, res: Response) => {
  const { message, active } = req.body;
  await setGlobalAnnouncement(message || '', Boolean(active));
  sendResponse(res, 200, true, 'Announcement updated', { message, active });
});

/**
 * POST /api/security/sync-blocked-schools
 */
export const syncBlockedSchoolsController = catchAsync(async (req: Request, res: Response) => {
  await syncBlockedSchools();
  sendResponse(res, 200, true, 'Blocked schools synced with Redis', null);
});
