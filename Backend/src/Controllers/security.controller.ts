import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import {
  generate2FASetupService,
  verifyAndEnable2FAService,
  disable2FAService,
  getSecurityOverviewService,
  getUserDevicesService,
  revokeUserDeviceService,
  trackDeviceLoginService,
} from '../Service/security.service';
import { getTOTPSettingsRepo } from '../Repositories/security.repository';
import { findSchoolByEmail, findSchoolByEmailSafe } from '../Repositories/auth.repository';
import { generateToken, verifyToken } from '../config/jwt.config';
import { IJwtAdminPayload } from '../types/auth.types';
import AppError from '../utils/AppError';
import { verify as verifyTOTP } from 'otplib';

const setAuthCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// ── GET 2FA SETUP (QR CODE + SECRET) ──────────────────────────────────────────
export const get2FASetup = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const setupData = await generate2FASetupService(user.id, user.role, user.email);
  sendResponse(res, 200, true, '2FA setup data generated', setupData);
});

// ── ENABLE 2FA (VERIFY FIRST TOTP CODE) ────────────────────────────────────────
export const enable2FA = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const { code } = req.body;
  if (!code) throw new AppError('6-digit 2FA verification code is required.', 400);

  const result = await verifyAndEnable2FAService(user.id, user.role, String(code));
  sendResponse(res, 200, true, result.message, { recoveryCodes: result.recoveryCodes });
});

// ── DISABLE 2FA ───────────────────────────────────────────────────────────────
export const disable2FA = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const { password, code } = req.body;
  if (!password || !code) {
    throw new AppError('Password and 2FA code are required to disable protection.', 400);
  }

  const result = await disable2FAService(user.id, user.role, password, String(code));
  sendResponse(res, 200, true, result.message, null);
});

// ── GET SECURITY OVERVIEW ─────────────────────────────────────────────────────
export const getSecurityOverview = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const overview = await getSecurityOverviewService(user.id, user.role, req);
  sendResponse(res, 200, true, 'Security overview fetched', overview);
});

// ── GET USER DEVICES ──────────────────────────────────────────────────────────
export const getUserDevices = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const devices = await getUserDevicesService(user.id, user.role, req);
  sendResponse(res, 200, true, 'User logged-in devices fetched', devices);
});

// ── REVOKE DEVICE SESSION ─────────────────────────────────────────────────────
export const revokeDevice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const deviceId = Number(req.params.id);
  if (!deviceId || isNaN(deviceId)) throw new AppError('Invalid device ID.', 400);

  const result = await revokeUserDeviceService(user.id, user.role, deviceId);
  sendResponse(res, 200, true, result.message, null);
});

// ── VERIFY 2FA TOTP CHALLENGE ON LOGIN ────────────────────────────────────────
export const verify2FAChallenge = catchAsync(async (req: Request, res: Response) => {
  const { twofa_session, otp_code } = req.body;
  if (!twofa_session || !otp_code) {
    throw new AppError('2FA session token and 6-digit code are required.', 400);
  }

  let decoded: any;
  try {
    decoded = verifyToken(twofa_session);
  } catch {
    throw new AppError('2FA session expired. Please log in again.', 401);
  }

  if (decoded.purpose !== 'totp_pending') {
    throw new AppError('Invalid 2FA session token.', 400);
  }

  const userId = decoded.id;
  const role = decoded.role;
  const email = decoded.email;

  const userSecurity = await getTOTPSettingsRepo(userId, role);
  if (!userSecurity || !userSecurity.totp_secret || !userSecurity.totp_enabled) {
    throw new AppError('2FA is not configured for this account.', 400);
  }

  const cleanCode = String(otp_code).toUpperCase().trim();
  const verifyRes = await verifyTOTP({
    token: cleanCode,
    secret: userSecurity.totp_secret,
  });

  const isTotpValid = typeof verifyRes === 'boolean' ? verifyRes : (verifyRes as any)?.valid;
  const isRecoveryCode = (userSecurity.totp_recovery_codes || []).includes(cleanCode);

  if (!isTotpValid && !isRecoveryCode) {
    throw new AppError('Invalid 2FA Authenticator code or recovery code.', 400);
  }

  // Load user data to construct final JWT payload
  let school: any = null;
  if (role === 'admin' || role === 'super_admin' || role === 'school_admin') {
    school = await findSchoolByEmail(email);
    if (!school) throw new AppError('Account not found.', 404);
  } else {
    throw new AppError('Role authentication not supported for 2FA challenge.', 400);
  }

  // Track device login & send alert if new device
  await trackDeviceLoginService(req, school.id, school.id, school.role, school.email);

  const payload: IJwtAdminPayload = {
    id: school.id,
    email: school.email,
    role: school.role,
    school_name: school.school_name,
    school_code: school.school_code,
    logo: school.logo,
    timezone: school.timezone,
    country: school.country,
    calendar_system: school.calendar_system ?? 'AD',
    is_verified: school.is_verified,
    is_account: school.is_account,
  };

  const token = generateToken(payload);
  const safeSchool = await findSchoolByEmailSafe(email);

  setAuthCookie(res, token);
  sendResponse(res, 200, true, '2FA authentication successful', { school: safeSchool, token });
});

// ── SUPER ADMIN TRAFFIC & SECURITY STATS ────────────────────────────────────
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

export const getTrafficStats = catchAsync(async (_req: Request, res: Response) => {
  const activeStats = await getActiveUsersStats();
  const maintenance = await getMaintenanceMode();
  const announcement = await getGlobalAnnouncement();
  const bannedIps = await getBannedIps();

  let eventsLast24Hours = 0;
  try {
    const evRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM platform_security_events WHERE created_at > NOW() - INTERVAL '24 hours'`
    );
    eventsLast24Hours = evRes.rows[0]?.count || 0;
  } catch {}

  const responseData = {
    ...activeStats,
    bannedIpsCount: bannedIps.length,
    eventsLast24Hours,
    maintenance,
    announcement,
  };

  sendResponse(res, 200, true, 'Traffic and security statistics fetched', responseData);
});

// ── GET SECURITY EVENTS AUDIT LOG ───────────────────────────────────────────
export const getSecurityEvents = catchAsync(async (req: Request, res: Response) => {
  const eventType = req.query.event_type as string | undefined;
  let query = `
    SELECT pse.*, s.school_name
    FROM platform_security_events pse
    LEFT JOIN schools s ON s.id = pse.school_id
  `;
  const params: any[] = [];
  if (eventType && eventType.trim()) {
    query += ` WHERE pse.event_type = $1`;
    params.push(eventType.trim());
  }
  query += ` ORDER BY pse.created_at DESC LIMIT 100`;

  let events: any[] = [];
  try {
    const result = await pool.query(query, params);
    events = result.rows;
  } catch (err: any) {
    console.warn('[SecurityEvents Query Error]', err.message);
  }

  sendResponse(res, 200, true, 'Security events retrieved', events);
});

// ── GET BANNED IPS ──────────────────────────────────────────────────────────
export const getBannedIpsList = catchAsync(async (_req: Request, res: Response) => {
  const ips = await getBannedIps();
  sendResponse(res, 200, true, 'Banned IPs retrieved', ips);
});

// ── BAN IP ──────────────────────────────────────────────────────────────────
export const banIpAddress = catchAsync(async (req: Request, res: Response) => {
  const { ip, reason, durationSeconds } = req.body;
  if (!ip) throw new AppError('IP address is required.', 400);

  await banIp(ip, reason || 'Manual ban by Super Admin', durationSeconds ? Number(durationSeconds) : 86400);
  sendResponse(res, 200, true, `IP ${ip} has been banned`, null);
});

// ── UNBAN IP ────────────────────────────────────────────────────────────────
export const unbanIpAddress = catchAsync(async (req: Request, res: Response) => {
  const ip = decodeURIComponent(String(req.params.ip || ''));
  if (!ip) throw new AppError('IP address parameter is required.', 400);

  await unbanIp(ip);
  sendResponse(res, 200, true, `IP ${ip} has been unbanned`, null);
});

// ── SET MAINTENANCE MODE ────────────────────────────────────────────────────
export const updateMaintenanceMode = catchAsync(async (req: Request, res: Response) => {
  const { enabled, message } = req.body;
  await setMaintenanceMode(Boolean(enabled), message || 'System is undergoing scheduled maintenance.');
  sendResponse(res, 200, true, 'Maintenance mode updated', { enabled, message });
});

// ── SET GLOBAL ANNOUNCEMENT ─────────────────────────────────────────────────
export const updateAnnouncement = catchAsync(async (req: Request, res: Response) => {
  const { active, message } = req.body;
  await setGlobalAnnouncement(message || '', Boolean(active));
  sendResponse(res, 200, true, 'Broadcast announcement updated', { active, message });
});

// ── SYNC BLOCKED SCHOOLS ────────────────────────────────────────────────────
export const syncBlockedSchoolsState = catchAsync(async (_req: Request, res: Response) => {
  await syncBlockedSchools();
  sendResponse(res, 200, true, 'Blocked schools synchronized with Redis', null);
});
