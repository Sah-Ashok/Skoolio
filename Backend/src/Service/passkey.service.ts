import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { Request } from 'express';
import redis from '../config/redis.config';
import {
  createPasskey,
  getPasskeysByUser,
  getPasskeyByCredentialId,
  getPasskeysByEmail,
  updatePasskeyCounter,
  deletePasskeyById,
  IPasskeyRecord,
} from '../Repositories/passkey.repository';
import { findSchoolById, findSchoolByIdSafe } from '../Repositories/auth.repository';
import { getTeacherById } from '../Repositories/teacher.repository';
import { getStudentById } from '../Repositories/student.repository';
import { findFinanceUserById } from '../Repositories/finance.repository';
import { generateToken } from '../config/jwt.config';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import AppError from '../utils/AppError';

// ── In-memory fallback if Redis is unavailable ──
const challengeMemoryStore = new Map<string, { challenge: string; expiresAt: number }>();

const storeChallenge = async (key: string, challenge: string): Promise<void> => {
  try {
    await redis.setex(`passkey:challenge:${key}`, 300, challenge);
  } catch {
    challengeMemoryStore.set(key, { challenge, expiresAt: Date.now() + 300000 });
  }
};

const getChallenge = async (key: string): Promise<string | null> => {
  try {
    const val = await redis.get(`passkey:challenge:${key}`);
    if (val) {
      await redis.del(`passkey:challenge:${key}`);
      return val;
    }
  } catch {
    // Redis unavailable fallback
  }

  const mem = challengeMemoryStore.get(key);
  if (mem) {
    challengeMemoryStore.delete(key);
    if (mem.expiresAt > Date.now()) {
      return mem.challenge;
    }
  }
  return null;
};

// ── Helpers to resolve RP ID and Origin ──
export const getRpID = (req: Request): string => {
  if (process.env.RP_ID) return process.env.RP_ID;
  const originHeader = req.get('origin') || req.get('referer');
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      return url.hostname;
    } catch {}
  }
  const hostHeader = req.get('host') || 'localhost';
  const cleanHost = hostHeader.split(':')[0]; // Remove port if present
  return cleanHost || 'localhost';
};

export const getExpectedOrigin = (req: Request): string => {
  const originHeader = req.get('origin') || req.get('referer');
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      return `${url.protocol}//${url.host}`;
    } catch {}
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
};

// ── 1. GENERATE REGISTRATION OPTIONS ──
export const getPasskeyRegistrationOptionsService = async (
  req: Request,
  user: { id: number; email: string; role: string; name?: string }
) => {
  const rpID = getRpID(req);
  const rpName = 'Skoolio Cloud ERP';

  const userPasskeys = await getPasskeysByUser(user.id, user.role);
  const excludeCredentials = userPasskeys.map((p) => ({
    id: p.credential_id,
    transports: (p.transports || []) as any,
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(`${user.role}:${user.id}:${Date.now()}`)),
    userName: user.email,
    userDisplayName: user.name || user.email,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await storeChallenge(`reg:${user.role}:${user.id}`, options.challenge);
  return options;
};

// ── 2. VERIFY REGISTRATION RESPONSE ──
export const verifyPasskeyRegistrationService = async (
  req: Request,
  user: { id: number; email: string; role: string },
  response: RegistrationResponseJSON,
  deviceName?: string
) => {
  const expectedChallenge = await getChallenge(`reg:${user.role}:${user.id}`);
  if (!expectedChallenge) {
    throw new AppError('Registration session expired or invalid. Please try again.', 400);
  }

  const expectedOrigin = getExpectedOrigin(req);
  const expectedRPID = getRpID(req);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: [
      expectedOrigin,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://20.219.6.128',
      'http://20.219.6.128:3000',
      'https://localhost:3000',
      'https://20.219.6.128',
    ],
    expectedRPID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError('Passkey verification failed.', 400);
  }

  const { credential } = verification.registrationInfo;

  // Convert Uint8Array to base64url string
  const credentialID = credential.id;
  const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64url');

  const resolvedDeviceName =
    deviceName ||
    (req.headers['user-agent']?.includes('Mac')
      ? 'MacBook (Touch ID)'
      : req.headers['user-agent']?.includes('Windows')
      ? 'Windows Hello'
      : req.headers['user-agent']?.includes('iPhone')
      ? 'iPhone (Face ID)'
      : req.headers['user-agent']?.includes('Android')
      ? 'Android Biometric'
      : 'Security Passkey');

  const saved = await createPasskey({
    user_id: user.id,
    role: user.role,
    email: user.email,
    credential_id: credentialID,
    public_key: publicKeyBase64,
    counter: credential.counter,
    device_name: resolvedDeviceName,
    transports: response.response.transports || [],
  });

  return saved;
};

// ── 3. LIST USER PASSKEYS ──
export const listUserPasskeysService = async (userId: number, role: string) => {
  return await getPasskeysByUser(userId, role);
};

// ── 4. DELETE PASSKEY ──
export const deletePasskeyService = async (passkeyId: number, userId: number, role: string) => {
  const deleted = await deletePasskeyById(passkeyId, userId, role);
  if (!deleted) throw new AppError('Passkey not found or unauthorized.', 404);
  return true;
};

// ── 5. GENERATE AUTHENTICATION (LOGIN) OPTIONS ──
export const getPasskeyLoginOptionsService = async (req: Request, email?: string) => {
  const rpID = getRpID(req);

  let allowCredentials: any[] | undefined = undefined;

  if (email && email.trim()) {
    const userPasskeys = await getPasskeysByEmail(email);
    if (userPasskeys.length > 0) {
      allowCredentials = userPasskeys.map((p) => ({
        id: p.credential_id,
        transports: p.transports as any,
      }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  // Store auth challenge
  const challengeKey = email ? `auth:${email.toLowerCase().trim()}` : `auth_anon:${options.challenge}`;
  await storeChallenge(challengeKey, options.challenge);

  return { options, challengeKey };
};

// ── 6. VERIFY AUTHENTICATION (LOGIN) RESPONSE ──
export const verifyPasskeyLoginService = async (
  req: Request,
  response: AuthenticationResponseJSON,
  challengeKey?: string
) => {
  const passkey = await getPasskeyByCredentialId(response.id);
  if (!passkey) {
    throw new AppError('Passkey not recognized. Please sign in with password.', 404);
  }

  const resolvedChallengeKey = challengeKey || `auth:${passkey.email}` || `auth_anon:${response.id}`;
  let expectedChallenge = await getChallenge(resolvedChallengeKey);

  if (!expectedChallenge) {
    // Try email lookup fallback
    expectedChallenge = await getChallenge(`auth:${passkey.email}`);
  }

  if (!expectedChallenge) {
    throw new AppError('Authentication session expired. Please click Sign in with Passkey again.', 400);
  }

  const expectedOrigin = getExpectedOrigin(req);
  const expectedRPID = getRpID(req);

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: [
      expectedOrigin,
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://20.219.6.128',
      'http://20.219.6.128:3000',
      'https://localhost:3000',
      'https://20.219.6.128',
    ],
    expectedRPID,
    credential: {
      id: passkey.credential_id,
      publicKey: new Uint8Array(Buffer.from(passkey.public_key, 'base64url')),
      counter: passkey.counter,
      transports: (passkey.transports || []) as any,
    },
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.authenticationInfo) {
    throw new AppError('Passkey authentication failed.', 400);
  }

  // Update replay prevention counter
  await updatePasskeyCounter(passkey.id, verification.authenticationInfo.newCounter);

  // Issue appropriate JWT Token based on user role
  if (passkey.role === 'admin' || passkey.role === 'super_admin') {
    const school = await findSchoolById(passkey.user_id);
    if (!school) throw new AppError('Account not found.', 404);
    if (school.is_account === 'blocked') throw new AppError('Account is blocked.', 423);

    const payload: IJwtAdminPayload = {
      id: school.id,
      email: school.email,
      role: school.role,
      school_name: school.school_name,
      school_code: school.school_code,
      logo: school.logo,
      timezone: school.timezone,
      country: school.country || 'India',
      calendar_system: school.calendar_system ?? 'AD',
      is_verified: school.is_verified,
      is_account: school.is_account,
    };

    const token = generateToken(payload);
    const safeSchool = await findSchoolByIdSafe(school.id);
    return { user: safeSchool, token, role: school.role };
  }

  if (passkey.role === 'faculty') {
    const teacher = await getTeacherById(passkey.user_id, passkey.user_id);
    if (!teacher) throw new AppError('Teacher account not found.', 404);

    const payload: IJwtUserPayload = {
      id: teacher.id,
      email: teacher.email,
      role: 'faculty',
      school_id: teacher.school_id,
      school_name: (teacher as any).school_name || 'School',
      timezone: (teacher as any).school_timezone || 'Asia/Kolkata',
      country: (teacher as any).school_country || teacher.country || 'India',
      currency: (teacher as any).school_currency || undefined,
      calendar_system: ((teacher as any).school_calendar_system as any) ?? 'AD',
      is_account: ((teacher as any).school_account_status as any) || 'active',
    };

    const token = generateToken(payload);
    return { user: teacher, token, role: 'faculty' };
  }

  if (passkey.role === 'student') {
    const student = await getStudentById(passkey.user_id, passkey.user_id);
    if (!student) throw new AppError('Student account not found.', 404);

    const payload: IJwtUserPayload = {
      id: student.id,
      email: student.email as string,
      role: 'student',
      school_id: student.school_id,
      school_name: (student as any).school_name || 'School',
      timezone: (student as any).school_timezone || 'Asia/Kolkata',
      country: (student as any).school_country || student.country || 'India',
      currency: (student as any).school_currency || undefined,
      calendar_system: ((student as any).school_calendar_system as any) ?? 'AD',
      is_account: ((student as any).school_account_status as any) || 'active',
    };

    const token = generateToken(payload);
    return { user: student, token, role: 'student' };
  }

  if (passkey.role === 'finance') {
    const financeUser = await findFinanceUserById(passkey.user_id);
    if (!financeUser) throw new AppError('Finance account not found.', 404);

    const payload: IJwtUserPayload = {
      id: financeUser.id,
      email: financeUser.email,
      role: 'finance',
      school_id: financeUser.school_id,
      school_name: financeUser.school_name || 'School',
      timezone: financeUser.timezone || 'Asia/Kolkata',
      country: (financeUser as any).country || 'India',
      currency: (financeUser as any).currency || undefined,
      calendar_system: (financeUser.calendar_system as any) ?? 'AD',
      is_account: financeUser.is_account || 'active',
    };

    const token = generateToken(payload);
    return { user: financeUser, token, role: 'finance' };
  }

  throw new AppError('Unsupported user role for passkey.', 400);
};
