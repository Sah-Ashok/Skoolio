import bcrypt from 'bcrypt';
import {
  IRegisterSchool, IJwtAdminPayload, IJwtUserPayload, IJwtPayload,
} from '../types/auth.types';
import {
  createSchool, findSchoolByEmail, findSchoolByPhone, findSchoolByEmailSafe,
  findSchoolById, findSchoolByIdSafe, updateSchoolSettingsRepo, updateSchoolPassword,
  toggleSchoolTwoFA, blockUnblockSchool, verifySchool,
  IUpdateSchoolSettings,
} from '../Repositories/auth.repository';
import pool from '../config/db';
import { storeOTP, consumeOTP } from '../Repositories/otp.repository';
import { findTeacherByEmailGlobal, getTeacherByIdWithPassword, updateTeacherPassword } from '../Repositories/teacher.repository';
import { findStudentByEmailGlobal, getStudentByIdWithPassword, updateStudentPassword } from '../Repositories/student.repository';
import { findFinanceUserById } from '../Repositories/finance.repository';
import { getTeacherByIdService }                 from './teacher.service';
import { getStudentByIdService, getStudentProfileService } from './student.service';
import { isMaintenanceModeActive }               from './platform.service';
import { generateToken, generateShortToken, verifyToken } from '../config/jwt.config';
import { sendOTPEmail, send2FAEnabledEmail }     from '../utils/emailService';
import { generateSchoolStorageFolder, initializeSchoolStorage } from '../utils/azureStorage';
import { setupTrialSubscription } from './subscription.service';
import { setupDefaultAcademicYear } from './academic.service';
import AppError from '../utils/AppError';
import { ILoginSchool } from '../types/auth.types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const generateSchoolCode = (schoolName: string): string => {
  const prefix = schoolName.slice(0, 3).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${random}`;
};

const generateOTPCode = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ── SEND REGISTRATION OTP ─────────────────────────────────────────────────────

export const sendRegistrationOTPService = async (email: string): Promise<void> => {
  const existing = await findSchoolByEmail(email);
  if (existing) throw new AppError('An account with this email already exists.', 400);

  const otp = generateOTPCode();
  await storeOTP(email, otp, 'registration');

  // ── Debug: log SMTP config at send time ──────────────────────────────
  console.log('[OTP Debug] Sending registration OTP to:', email);
  console.log('[OTP Debug] SMTP_HOST:', process.env.SMTP_HOST);
  console.log('[OTP Debug] SMTP_PORT:', process.env.SMTP_PORT);
  console.log('[OTP Debug] SMTP_USER:', process.env.SMTP_USER);
  console.log('[OTP Debug] SMTP_PASS:', process.env.SMTP_PASS ? `****${process.env.SMTP_PASS.slice(-4)}` : 'MISSING!');
  // ─────────────────────────────────────────────────────────────────────

  try {
    await sendOTPEmail(email, otp, 'registration');
    console.log('[OTP Debug] Email sent successfully to:', email);
  } catch (err: any) {
    console.error('[Registration OTP] Failed to send email:', err.message);
    console.error('[Registration OTP] Full error:', err);
    throw new AppError('Could not send verification code. Please try again.', 503);
  }
};

// ── VERIFY REGISTRATION OTP ───────────────────────────────────────────────────

export const verifyRegistrationOTPService = async (email: string, otp: string): Promise<boolean> => {
  const valid = await consumeOTP(email, otp, 'registration');
  if (!valid) throw new AppError('Invalid or expired OTP. Please try again.', 400);
  return true;
};

// ── REGISTER ─────────────────────────────────────────────────────────────────

export const registerSchoolService = async (data: IRegisterSchool) => {
  const existingEmail = await findSchoolByEmail(data.email);
  if (existingEmail) throw new AppError('Email already exists', 400);

  const existingPhone = await findSchoolByPhone(data.phone);
  if (existingPhone) throw new AppError('Phone number already exists', 400);

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const school_code    = generateSchoolCode(data.school_name);

  let school = await createSchool({ ...data, password: hashedPassword, school_code });

  // Auto-setup 14-Day Free Trial on Plus plan
  try {
    const trialSub = await setupTrialSubscription(school.id, 'Plus', 14);
    if (trialSub) {
      school = { ...school, subscription_id: trialSub.id };
    }
  } catch (err: any) {
    console.warn('[Subscription] Failed to auto-assign Plus trial on registration:', err.message);
  }

  // Auto-setup current active academic year (April-March for Indian/AD, Baishakh-Chaitra for BS)
  try {
    await setupDefaultAcademicYear(school.id, school.country, school.calendar_system);
  } catch (err: any) {
    console.warn('[AcademicYear] Failed to setup default academic year on registration:', err.message);
  }

  // Initialize school storage directory in Azure Blob and auto-verify if enabled
  const storageFolder = generateSchoolStorageFolder(school.school_name, school.id);
  await initializeSchoolStorage(storageFolder, { id: school.id, school_name: school.school_name }).catch((err) => {
    console.warn('[Storage] Auto-init storage folder failed:', err.message);
  });

  try {
    const ps = await pool.query(`SELECT auto_verify_schools FROM platform_settings ORDER BY id ASC LIMIT 1`);
    const shouldAutoVerify = ps.rows.length === 0 || ps.rows[0]?.auto_verify_schools !== false;
    if (shouldAutoVerify) {
      await verifySchool(school.id, storageFolder);
      school = { ...school, is_verified: true, storage_folder: storageFolder };
    } else {
      await pool.query(`UPDATE schools SET storage_folder = $1 WHERE id = $2`, [storageFolder, school.id]);
      school = { ...school, storage_folder: storageFolder };
    }
  } catch {
    // If query failed or table not yet migrated, still verify by default
    await verifySchool(school.id, storageFolder).catch(() => {});
    school = { ...school, is_verified: true, storage_folder: storageFolder };
  }

  const payload: IJwtAdminPayload = {
    id: school.id, email: school.email, role: school.role,
    school_name: school.school_name, school_code: school.school_code,
    logo: school.logo, timezone: school.timezone, country: school.country,
    calendar_system: school.calendar_system ?? 'AD',
    is_verified: school.is_verified, is_account: school.is_account,
  };

  const token = generateToken(payload);
  return { school, token };
};

// ── ADMIN LOGIN ───────────────────────────────────────────────────────────────

export type LoginSchoolResult =
  | { type: 'success';      school: any; token: string }
  | { type: 'requires_2fa'; twofa_session: string };

export const loginSchoolService = async (data: ILoginSchool): Promise<LoginSchoolResult> => {
  const school = await findSchoolByEmail(data.email);
  if (!school) throw new AppError('Invalid email or password', 401);

  if (school.role !== 'super_admin') {
    const maintenanceActive = await isMaintenanceModeActive();
    if (maintenanceActive)
      throw new AppError('The platform is currently under maintenance. Please try again shortly.', 503);

    if (!school.is_verified)
      throw new AppError('Your account is not verified yet.', 403);
  }

  if (school.is_account === 'blocked')
    throw new AppError('Your account has been blocked. Contact support.', 423);

  const isMatch = await bcrypt.compare(data.password, school.password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  // ── 2FA flow ──
  if ((school as any).two_fa_enabled) {
    const otp = generateOTPCode();
    await storeOTP(school.email, otp, 'two_fa');
    try {
      await sendOTPEmail(school.email, otp, 'two_fa');
    } catch (err: any) {
      console.error('[2FA] Failed to send OTP email:', err.message);
      throw new AppError('Could not send verification code. Please try again later.', 503);
    }
    const twofa_session = generateShortToken(
      { id: school.id, email: school.email, purpose: 'twofa_pending' }, '5m'
    );
    return { type: 'requires_2fa', twofa_session };
  }

  // ── Normal login ──
  const payload: IJwtAdminPayload = {
    id: school.id, email: school.email, role: school.role,
    school_name: school.school_name, school_code: school.school_code,
    logo: school.logo, timezone: school.timezone, country: school.country,
    calendar_system: school.calendar_system ?? 'AD',
    is_verified: school.is_verified, is_account: school.is_account,
  };

  const token      = generateToken(payload);
  const safeSchool = await findSchoolByEmailSafe(data.email);
  return { type: 'success', school: safeSchool, token };
};

// ── VERIFY 2FA OTP ────────────────────────────────────────────────────────────

export const verify2FAService = async (twofa_session: string, otp_code: string) => {
  let decoded: any;
  try {
    decoded = verifyToken(twofa_session);
  } catch {
    throw new AppError('Session expired. Please login again.', 401);
  }

  if (decoded.purpose !== 'twofa_pending')
    throw new AppError('Invalid session token.', 400);

  const valid = await consumeOTP(decoded.email, otp_code, 'two_fa');
  if (!valid) throw new AppError('Invalid or expired verification code.', 400);

  const school = await findSchoolByEmail(decoded.email);
  if (!school) throw new AppError('Account not found.', 404);

  const payload: IJwtAdminPayload = {
    id: school.id, email: school.email, role: school.role,
    school_name: school.school_name, school_code: school.school_code,
    logo: school.logo, timezone: school.timezone, country: school.country,
    calendar_system: school.calendar_system ?? 'AD',
    is_verified: school.is_verified, is_account: school.is_account,
  };

  const token      = generateToken(payload);
  const safeSchool = await findSchoolByEmailSafe(decoded.email);
  return { school: safeSchool, token };
};

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────

export const forgotPasswordService = async (email: string): Promise<void> => {
  const school = await findSchoolByEmail(email);
  if (!school) throw new AppError('No account found with that email address.', 404);
  if (school.is_account === 'blocked')
    throw new AppError('Your account has been blocked. Contact support.', 423);

  const otp = generateOTPCode();
  await storeOTP(email, otp, 'forgot_password');
  try {
    await sendOTPEmail(email, otp, 'forgot_password');
  } catch (err: any) {
    console.error('[ForgotPassword] Failed to send OTP email:', err.message);
    throw new AppError('Could not send reset code. Please try again later.', 503);
  }
};

// ── VERIFY RESET OTP ──────────────────────────────────────────────────────────

export const verifyResetOTPService = async (email: string, otp: string): Promise<string> => {
  const valid = await consumeOTP(email, otp, 'forgot_password');
  if (!valid) throw new AppError('Invalid or expired OTP.', 400);

  const school = await findSchoolByEmail(email);
  if (!school) throw new AppError('Account not found.', 404);

  return generateShortToken(
    { id: school.id, email: school.email, purpose: 'password_reset' }, '10m'
  );
};

// ── RESET PASSWORD ────────────────────────────────────────────────────────────

export const resetPasswordService = async (reset_token: string, new_password: string): Promise<void> => {
  let decoded: any;
  try {
    decoded = verifyToken(reset_token);
  } catch {
    throw new AppError('Reset link expired. Please request a new one.', 401);
  }
  if (decoded.purpose !== 'password_reset') throw new AppError('Invalid reset token.', 400);
  if (!new_password || new_password.length < 6)
    throw new AppError('Password must be at least 6 characters.', 400);
  const hashed = await bcrypt.hash(new_password, 10);
  await updateSchoolPassword(decoded.id, hashed);
};

// ── TEACHER LOGIN ─────────────────────────────────────────────────────────────

export const loginTeacherService = async (data: ILoginSchool) => {
  const maintenanceActive = await isMaintenanceModeActive();
  if (maintenanceActive)
    throw new AppError('The platform is currently under maintenance. Please try again shortly.', 503);

  const teacher = await findTeacherByEmailGlobal(data.email);
  if (!teacher) throw new AppError('Invalid email or password', 401);

  if (teacher.status === 'inactive')
    throw new AppError('Your account has been deactivated. Contact your school admin.', 423);

  if (teacher.school_account_status === 'blocked')
    throw new AppError('Your school account has been blocked. Contact support.', 423);

  const isMatch = await bcrypt.compare(data.password, teacher.password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  const payload: IJwtUserPayload = {
    id: teacher.id, email: teacher.email, role: 'faculty',
    school_id: teacher.school_id, school_name: teacher.school_name,
    logo: teacher.school_logo || undefined,
    timezone: teacher.school_timezone,
    calendar_system: (teacher.school_calendar_system as any) ?? 'AD',
    is_account: teacher.school_account_status as any,
  };

  const token = generateToken(payload);
  const { password, ...safeTeacher } = teacher;
  return {
    user: {
      ...safeTeacher,
      calendar_system: teacher.school_calendar_system ?? 'AD',
      timezone:        teacher.school_timezone,
      logo:            teacher.school_logo,
    },
    token,
  };
};

// ── STUDENT LOGIN ─────────────────────────────────────────────────────────────

export const loginStudentService = async (data: ILoginSchool) => {
  const identifier = data.email || (data as any).identifier;
  if (!identifier) throw new AppError('Invalid email or password', 401);

  const maintenanceActive = await isMaintenanceModeActive();
  if (maintenanceActive)
    throw new AppError('The platform is currently under maintenance. Please try again shortly.', 503);

  const student = await findStudentByEmailGlobal(identifier);
  if (!student) throw new AppError('Invalid email or password', 401);

  if (student.status !== 'active')
    throw new AppError('Your account is not active. Contact your school admin.', 423);

  if (student.school_account_status === 'blocked')
    throw new AppError('Your school account has been blocked. Contact support.', 423);

  const isMatch = await bcrypt.compare(data.password, student.password);
  if (!isMatch) throw new AppError('Invalid email or password', 401);

  const payload: IJwtUserPayload = {
    id: student.id, email: student.email as string, role: 'student',
    school_id: student.school_id, school_name: student.school_name,
    logo: student.school_logo || undefined,
    timezone: student.school_timezone,
    calendar_system: (student.school_calendar_system as any) ?? 'AD',
    is_account: student.school_account_status as any,
  };

  const token = generateToken(payload);
  const { password, ...safeStudent } = student;
  return {
    user: {
      ...safeStudent,
      calendar_system: student.school_calendar_system ?? 'AD',
      timezone:        student.school_timezone,
      logo:            student.school_logo,
    },
    token,
  };
};

// ── GET ME ────────────────────────────────────────────────────────────────────

export const getMeService = async (jwtUser: IJwtPayload) => {
  if (jwtUser.role === 'admin' || jwtUser.role === 'super_admin') {
    const school = await findSchoolByEmailSafe(jwtUser.email);
    if (!school) throw new AppError('Account not found.', 404);
    return { ...school, role: jwtUser.role };
  }
  if (jwtUser.role === 'faculty') {
    const u = jwtUser as IJwtUserPayload;
    const teacher = await getTeacherByIdService(u.id, u.school_id);
    return {
      ...teacher,
      role: 'faculty',
      school_name: u.school_name,
      logo: u.logo,
      calendar_system: u.calendar_system ?? 'AD',
    };
  }
  if (jwtUser.role === 'finance') {
    const u = jwtUser as IJwtUserPayload;
    const financeUser = await findFinanceUserById(u.id);
    if (!financeUser) throw new AppError('Finance account not found.', 404);
    return {
      ...financeUser,
      role: 'finance',
      school_name: financeUser.school_name || u.school_name,
      logo: financeUser.logo || u.logo,
      timezone: financeUser.timezone || u.timezone,
      calendar_system: financeUser.calendar_system || u.calendar_system || 'AD',
      is_account: financeUser.is_account || 'active',
    };
  }
  const u = jwtUser as IJwtUserPayload;
  const student = await getStudentProfileService(u.id, u.school_id);
  return {
    ...student,
    role: 'student',
    school_name: u.school_name,
    logo: u.logo,
    calendar_system: u.calendar_system ?? 'AD',
  };
};

// ── SCHOOL SETTINGS ───────────────────────────────────────────────────────────

export const getSchoolSettingsService = async (schoolId: number) => {
  const school = await findSchoolByIdSafe(schoolId);
  if (!school) throw new AppError('School not found.', 404);
  return school;
};

export const updateSchoolSettingsService = async (schoolId: number, data: IUpdateSchoolSettings) => {
  const updated = await updateSchoolSettingsRepo(schoolId, data);
  if (!updated) throw new AppError('School not found.', 404);
  return updated;
};

export const changePasswordService = async (schoolId: number, current_password: string, new_password: string): Promise<void> => {
  const school = await findSchoolById(schoolId);
  if (!school) throw new AppError('Account not found.', 404);
  const isMatch = await bcrypt.compare(current_password, school.password);
  if (!isMatch) throw new AppError('Current password is incorrect.', 400);
  if (!new_password || new_password.length < 6)
    throw new AppError('New password must be at least 6 characters.', 400);
  const hashed = await bcrypt.hash(new_password, 10);
  await updateSchoolPassword(schoolId, hashed);
};

// ── TOGGLE 2FA ────────────────────────────────────────────────────────────────

export const toggleTwoFAService = async (schoolId: number, enabled: boolean): Promise<void> => {
  const school = await findSchoolById(schoolId);
  if (!school) throw new AppError('School not found.', 404);
  await toggleSchoolTwoFA(schoolId, enabled);
  if (enabled) await send2FAEnabledEmail(school.email, school.school_name);
};

// ── VERIFY SCHOOL (super admin) ─────────────────────────────────────────────

export const verifySchoolService = async (schoolId: number): Promise<void> => {
  const school = await findSchoolById(schoolId);
  if (!school) throw new AppError('School not found.', 404);
  if (school.is_verified) throw new AppError('School is already verified.', 400);

  const storageFolder = school.storage_folder || generateSchoolStorageFolder(school.school_name, school.id);
  await initializeSchoolStorage(storageFolder, { id: school.id, school_name: school.school_name }).catch((err) => {
    console.warn('[Storage] Init storage folder failed during verification:', err.message);
  });

  await verifySchool(schoolId, storageFolder);
};

// ── BLOCK / UNBLOCK SCHOOL (super admin) ─────────────────────────────────────

export const blockUnblockSchoolService = async (schoolId: number, action: 'block' | 'unblock'): Promise<void> => {
  const school = await findSchoolById(schoolId);
  if (!school) throw new AppError('School not found.', 404);
  if (school.role === 'super_admin')
    throw new AppError('Cannot block a super admin account.', 403);
  await blockUnblockSchool(schoolId, action);
};

// ── CHANGE PASSWORD (teacher) ─────────────────────────────────────────────────

export const changeTeacherPasswordService = async (
  teacherId: number, schoolId: number,
  current_password: string, new_password: string
): Promise<void> => {
  const teacher = await getTeacherByIdWithPassword(teacherId, schoolId);
  if (!teacher) throw new AppError('Account not found.', 404);
  const isMatch = await bcrypt.compare(current_password, teacher.password);
  if (!isMatch) throw new AppError('Current password is incorrect.', 400);
  if (!new_password || new_password.length < 6)
    throw new AppError('New password must be at least 6 characters.', 400);
  const hashed = await bcrypt.hash(new_password, 10);
  await updateTeacherPassword(teacherId, schoolId, hashed);
};

// ── CHANGE PASSWORD (student) ─────────────────────────────────────────────────

export const changeStudentPasswordService = async (
  studentId: number, schoolId: number,
  current_password: string, new_password: string
): Promise<void> => {
  const student = await getStudentByIdWithPassword(studentId, schoolId);
  if (!student) throw new AppError('Account not found.', 404);
  const isMatch = await bcrypt.compare(current_password, student.password);
  if (!isMatch) throw new AppError('Current password is incorrect.', 400);
  if (!new_password || new_password.length < 6)
    throw new AppError('New password must be at least 6 characters.', 400);
  const hashed = await bcrypt.hash(new_password, 10);
  await updateStudentPassword(studentId, schoolId, hashed);
};

// re-export for auth.controller
export { findSchoolByIdSafe };
