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
  const overview = await getSecurityOverviewService(user.id, user.role);
  sendResponse(res, 200, true, 'Security overview fetched', overview);
});

// ── GET USER DEVICES ──────────────────────────────────────────────────────────
export const getUserDevices = catchAsync(async (req: Request, res: Response) => {
  const user = req.user!;
  const devices = await getUserDevicesService(user.id, user.role);
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
