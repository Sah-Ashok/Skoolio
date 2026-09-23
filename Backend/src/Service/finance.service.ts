import bcrypt from 'bcrypt';
import AppError from '../utils/AppError';
import { generateToken } from '../config/jwt.config';
import { IJwtUserPayload } from '../types/auth.types';
import { ICreateFinanceUser, IUpdateFinanceUser } from '../types/finance.types';
import {
  findFinanceUserBySchoolId,
  findFinanceUserByEmailGlobal,
  createFinanceUser,
  updateFinanceUser,
  deleteFinanceUser,
  updateFinanceLastLogin,
} from '../Repositories/finance.repository';
import pool from '../config/db';

export const getSchoolFinanceAccountService = async (school_id: number) => {
  return await findFinanceUserBySchoolId(school_id);
};

export const createSchoolFinanceAccountService = async (
  school_id: number,
  data: ICreateFinanceUser
) => {
  // 1. Verify school plan (Plus or Ultra only)
  const planCheck = await pool.query(
    `SELECT sp.name AS plan_name
     FROM school_subscriptions ss
     INNER JOIN subscription_plans sp ON sp.id = ss.plan_id
     WHERE ss.school_id = $1
     ORDER BY ss.id DESC LIMIT 1`,
    [school_id]
  );

  const planName = planCheck.rows[0]?.plan_name?.toLowerCase() || '';
  const isEligible = planName.includes('plus') || planName.includes('ultra');
  if (!isEligible) {
    throw new AppError(
      'The dedicated Finance Role is only available on Plus and Ultra plans. Please upgrade your subscription.',
      403
    );
  }

  // 2. Check if this school already has a finance account
  const existing = await findFinanceUserBySchoolId(school_id);
  if (existing) {
    throw new AppError(
      'Each school is allowed exactly 1 dedicated finance manager account. Please edit the existing account or transfer it.',
      409
    );
  }

  // 3. Check if email is already taken by another user globally
  const emailInUse = await findFinanceUserByEmailGlobal(data.email);
  if (emailInUse) {
    throw new AppError('This email is already registered for a finance account.', 409);
  }

  // 4. Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10);

  // 5. Create finance user
  return await createFinanceUser(school_id, data, hashedPassword);
};

export const updateSchoolFinanceAccountService = async (
  school_id: number,
  data: IUpdateFinanceUser
) => {
  const existing = await findFinanceUserBySchoolId(school_id);
  if (!existing) {
    throw new AppError('Finance account not found for this school.', 404);
  }

  if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
    const emailInUse = await findFinanceUserByEmailGlobal(data.email);
    if (emailInUse && emailInUse.school_id !== school_id) {
      throw new AppError('This email is already registered to another account.', 409);
    }
  }

  let hashedPassword: string | undefined;
  if (data.password) {
    hashedPassword = await bcrypt.hash(data.password, 10);
  }

  return await updateFinanceUser(school_id, data, hashedPassword);
};

import { storeOTP, consumeOTP } from '../Repositories/otp.repository';
import { sendOTPEmail } from '../utils/emailService';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${'*'.repeat(Math.min(5, Math.max(2, local.length - 2)))}${local[local.length - 1]}@${domain}`;
}

export const requestRevokeFinanceOTPService = async (school_id: number) => {
  const existing = await findFinanceUserBySchoolId(school_id);
  if (!existing) {
    throw new AppError('Finance account not found for this school.', 404);
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await storeOTP(existing.email, otp, 'revoke_finance');
  await sendOTPEmail(existing.email, otp, 'revoke_finance');

  return {
    message: `Authorization code dispatched to ${maskEmail(existing.email)}`,
    masked_email: maskEmail(existing.email),
  };
};

export const deleteSchoolFinanceAccountService = async (school_id: number, otp?: string) => {
  const existing = await findFinanceUserBySchoolId(school_id);
  if (!existing) {
    throw new AppError('Finance account not found for this school.', 404);
  }

  if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
    throw new AppError('A valid 6-digit authorization code (OTP) is required to revoke access.', 400);
  }

  const isValid = await consumeOTP(existing.email, otp.trim(), 'revoke_finance');
  if (!isValid) {
    throw new AppError('Invalid or expired authorization code. Please request a new code.', 400);
  }

  return await deleteFinanceUser(school_id);
};

import { trackDeviceLoginService } from './security.service';
import { Request } from 'express';

export const loginFinanceService = async (
  credentials: { email: string; password: string },
  req?: Request
) => {
  const financeUser = await findFinanceUserByEmailGlobal(credentials.email);
  if (!financeUser) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (financeUser.status === 'inactive') {
    throw new AppError('Your finance account has been deactivated. Please contact your school administrator.', 403);
  }

  if (financeUser.school_account_status === 'blocked') {
    throw new AppError('Your school account is currently blocked. Please contact support.', 423);
  }

  // Plan gating check — Finance role requires Plus or Ultra plan
  const planName = financeUser.plan_name?.toLowerCase() || ''; 
  const isEligible = planName.includes('plus') || planName.includes('ultra');
  if (!isEligible) {
    throw new AppError(
      'Your school plan does not include Finance Role access. Please ask your administrator to upgrade to Plus or Ultra.',
      403
    );
  }

  if (!financeUser.password) {
    throw new AppError('Invalid email or password.', 401);
  }

  const isMatch = await bcrypt.compare(credentials.password, financeUser.password);
  if (!isMatch) {
    throw new AppError('Invalid email or password.', 401);
  }

  await updateFinanceLastLogin(financeUser.id);

  // Track device login for Finance user
  if (req) {
    await trackDeviceLoginService(req, financeUser.school_id, financeUser.id, 'finance', financeUser.email).catch((err) => {
      console.error('[Finance Device Tracker Error]', err.message);
    });
  }

  const payload: IJwtUserPayload = {
    id: financeUser.id,
    email: financeUser.email,
    role: 'finance',
    school_id: financeUser.school_id,
    school_name: financeUser.school_name,
    logo: financeUser.school_logo || undefined,
    timezone: financeUser.school_timezone,
    calendar_system: (financeUser.school_calendar_system as any) ?? 'AD',
    is_account: financeUser.school_account_status as any,
  };

  const token = generateToken(payload);
  const { password, ...safeUser } = financeUser;

  return {
    user: {
      ...safeUser,
      calendar_system: financeUser.school_calendar_system ?? 'AD',
      timezone: financeUser.school_timezone,
      logo: financeUser.school_logo,
    },
    token,
  };
};
