import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Request } from 'express';
import {
  getTOTPSettingsRepo,
  updateTOTPSecretRepo,
  updateTOTPEnableRepo,
  disableTOTPRepo,
  upsertUserDeviceRepo,
  getUserDevicesRepo,
  deleteUserDeviceRepo,
  findDeviceByHashRepo,
  IUserDeviceRecord,
} from '../Repositories/security.repository';
import { findSchoolById, findSchoolByEmail } from '../Repositories/auth.repository';
import { findFinanceUserByIdWithPassword } from '../Repositories/finance.repository';
import { sendNewDeviceAlertEmail } from '../utils/emailService';
import AppError from '../utils/AppError';

// Helper to generate 8-character single-use emergency recovery codes
const generateRecoveryCodes = (count: number = 8): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A1B2C3D4"
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
};

// User-Agent parser helper
export const parseUserAgent = (userAgent: string = ''): { browser: string; os: string } => {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  const ua = userAgent.toLowerCase();

  // Detect OS
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';

  // Detect Browser
  if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('chrome/')) browser = 'Google Chrome';
  else if (ua.includes('firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Apple Safari';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
  else if (ua.includes('skoolio') || ua.includes('dart')) browser = 'Skoolio Mobile App';
  else if (ua.includes('postman')) browser = 'Postman API Tool';

  return { browser, os };
};

/**
  Generate device hash string SHA256(user_id + role + user_agent + ip_subnet)
 */
export const computeDeviceHash = (
  userId: number,
  role: string,
  userAgent: string,
  ipAddress: string
): string => {
  // Use first 3 octets of IP for subnet tolerance on dynamic mobile networks
  const ipSubnet = ipAddress.split('.').slice(0, 3).join('.');
  const rawString = `${userId}:${role}:${userAgent}:${ipSubnet}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
};

// ── 2FA SETUP & MANAGEMENT SERVICES ─────────────────────────────────────────

export const generate2FASetupService = async (
  userId: number,
  role: string,
  userEmail: string
) => {
  const secret = generateSecret();
  const serviceName = 'Skoolio ERP';
  const otpauthUrl = generateURI({ secret, label: userEmail, issuer: serviceName });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  const recoveryCodes = generateRecoveryCodes(8);

  // Store unconfirmed secret and recovery codes temporarily until user verifies first code
  await updateTOTPSecretRepo(userId, role, secret, recoveryCodes);

  return {
    secret,
    qrCodeDataUrl,
    otpauthUrl,
    recoveryCodes,
  };
};

export const verifyAndEnable2FAService = async (
  userId: number,
  role: string,
  totpCode: string
) => {
  const userSecurity = await getTOTPSettingsRepo(userId, role);
  if (!userSecurity || !userSecurity.totp_secret) {
    throw new AppError('2FA setup session not found. Please initiate 2FA setup first.', 400);
  }

  const result = await verify({
    token: totpCode,
    secret: userSecurity.totp_secret,
  });

  const isValid = typeof result === 'boolean' ? result : (result as any)?.valid;

  if (!isValid) {
    throw new AppError('Invalid Authenticator code. Please check your app and try again.', 400);
  }

  await updateTOTPEnableRepo(userId, role, true);

  return {
    message: '2FA protection enabled successfully!',
    recoveryCodes: userSecurity.totp_recovery_codes || [],
  };
};

export const disable2FAService = async (
  userId: number,
  role: string,
  password: string,
  totpCode: string
) => {
  // Verify password first
  let storedPasswordHash = '';
  if (role === 'admin' || role === 'super_admin' || role === 'school_admin') {
    const school = await findSchoolById(userId);
    if (!school) throw new AppError('Account not found.', 404);
    storedPasswordHash = school.password;
  } else if (role === 'finance' || role === 'finance_manager') {
    const fin = await findFinanceUserByIdWithPassword(userId);
    if (!fin) throw new AppError('Finance user not found.', 404);
    storedPasswordHash = fin.password || '';
  } else {
    throw new AppError('Role not authorized for 2FA operation.', 403);
  }

  const isPasswordMatch = await bcrypt.compare(password, storedPasswordHash);
  if (!isPasswordMatch) {
    throw new AppError('Incorrect current password.', 401);
  }

  // Verify TOTP code or recovery code
  const userSecurity = await getTOTPSettingsRepo(userId, role);
  if (!userSecurity || !userSecurity.totp_secret) {
    throw new AppError('2FA is not currently enabled for this account.', 400);
  }

  const result = await verify({
    token: totpCode,
    secret: userSecurity.totp_secret,
  });
  const isTotpValid = typeof result === 'boolean' ? result : (result as any)?.valid;

  const isRecoveryCodeValid = (userSecurity.totp_recovery_codes || []).includes(totpCode.toUpperCase().trim());

  if (!isTotpValid && !isRecoveryCodeValid) {
    throw new AppError('Invalid 2FA code or recovery code.', 400);
  }

  await disableTOTPRepo(userId, role);

  return { message: '2FA protection disabled successfully.' };
};

export const getSecurityOverviewService = async (
  userId: number,
  role: string
) => {
  const userSecurity = await getTOTPSettingsRepo(userId, role);
  const devices = await getUserDevicesRepo(userId, role);

  const is2faEnabled = userSecurity ? userSecurity.totp_enabled : false;

  // Compute overall protection level score
  let securityScore = 50; // Base score
  if (is2faEnabled) securityScore += 40;
  if (devices.length <= 3) securityScore += 10;

  let protectionStatus: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (securityScore >= 80) protectionStatus = 'HIGH';
  else if (securityScore < 50) protectionStatus = 'LOW';

  return {
    totp_enabled: is2faEnabled,
    has_recovery_codes: (userSecurity?.totp_recovery_codes?.length ?? 0) > 0,
    active_devices_count: devices.length,
    securityScore,
    protectionStatus,
    devices,
  };
};

// ── SMART DEVICE LOGIN TRACKING ──────────────────────────────────────────────

export const trackDeviceLoginService = async (
  req: Request,
  schoolId: number | null,
  userId: number,
  role: string,
  userEmail: string
): Promise<{ isNewDevice: boolean; device: IUserDeviceRecord }> => {
  const userAgent = (req.headers['user-agent'] as string) || 'Unknown User-Agent';
  const rawIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const { browser, os } = parseUserAgent(userAgent);
  const deviceHash = computeDeviceHash(userId, role, userAgent, rawIp);

  const { isNew, device } = await upsertUserDeviceRepo(
    schoolId,
    userId,
    role,
    deviceHash,
    browser,
    os,
    rawIp,
    'Nepal' // Default fallback location
  );

  // If this is a NEW unrecognized device, send instant security alert email
  if (isNew && userEmail) {
    const formattedTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Kathmandu',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Fire and forget email so login is not delayed
    sendNewDeviceAlertEmail(userEmail, {
      browser,
      os,
      ip: rawIp,
      time: `${formattedTime} (NPT)`,
      location: 'Nepal',
    }).catch((err) => {
      console.error('[Device Tracker] Failed to dispatch new device email:', err.message);
    });
  }

  return { isNewDevice: isNew, device };
};

export const getUserDevicesService = async (userId: number, role: string) => {
  return await getUserDevicesRepo(userId, role);
};

export const revokeUserDeviceService = async (
  userId: number,
  role: string,
  deviceId: number
) => {
  const success = await deleteUserDeviceRepo(deviceId, userId, role);
  if (!success) {
    throw new AppError('Device not found or unauthorized to revoke.', 404);
  }
  return { message: 'Device session revoked successfully.' };
};
