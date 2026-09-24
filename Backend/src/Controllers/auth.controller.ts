import { Request, Response, NextFunction } from 'express';
import {
  registerSchoolService, loginSchoolService, loginTeacherService,
  loginStudentService, getMeService, forgotPasswordService,
  verifyResetOTPService, resetPasswordService, verify2FAService,
  blockUnblockSchoolService, verifySchoolService,
  changeTeacherPasswordService, changeStudentPasswordService,
  sendRegistrationOTPService, verifyRegistrationOTPService,
} from '../Service/auth.service';
import { IRegisterSchool, ILoginSchool, IJwtPayload } from '../types/auth.types';
import catchAsync  from '../utils/catchAsync';
import sendResponse from '../utils/response';

const setAuthCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure:   false,          // set to true only when HTTPS is enabled
    sameSite: 'lax',          // 'strict' blocks cookies through nginx proxy
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
};

// ── SEND REGISTRATION OTP ─────────────────────────────────────────────────────

export const sendRegistrationOTP = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw { message: 'Email is required.', statusCode: 400 };
  await sendRegistrationOTPService(email);
  sendResponse(res, 200, true, 'OTP sent to your email address', null);
});

// ── VERIFY REGISTRATION OTP ───────────────────────────────────────────────────

export const verifyRegistrationOTP = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw { message: 'Email and OTP are required.', statusCode: 400 };
  await verifyRegistrationOTPService(email, otp);
  sendResponse(res, 200, true, 'Email verified successfully', null);
});

// ── REGISTER ──────────────────────────────────────────────────────────────────

export const registerSchool = catchAsync(async (req: Request, res: Response) => {
  const { school, token } = await registerSchoolService(req.body as IRegisterSchool);
  setAuthCookie(res, token);
  sendResponse(res, 201, true, 'School registered successfully', { school, token });
});

// ── LOGIN (admin — handles 2FA redirect) ─────────────────────────────────────

export const loginSchool = catchAsync(async (req: Request, res: Response) => {
  const result = await loginSchoolService(req.body as ILoginSchool, req);

  if (result.type === 'requires_2fa') {
    sendResponse(res, 200, true, '2FA verification required', {
      requires_2fa:   true,
      twofa_type:     (result as any).twofa_type || 'totp',
      twofa_session:  result.twofa_session,
    });
    return;
  }

  setAuthCookie(res, result.token);
  sendResponse(res, 200, true, 'Login successful', { school: result.school, token: result.token });
});

// ── VERIFY 2FA ────────────────────────────────────────────────────────────────

export const verify2FA = catchAsync(async (req: Request, res: Response) => {
  const { twofa_session, otp_code } = req.body;

  if (!twofa_session || !otp_code)
    throw { message: 'Session token and OTP code are required.', statusCode: 400 };

  const { school, token } = await verify2FAService(twofa_session, otp_code, req);
  setAuthCookie(res, token);
  sendResponse(res, 200, true, 'Login successful', { school, token });
});

// ── TEACHER / STUDENT LOGIN ───────────────────────────────────────────────────

export const loginTeacher = catchAsync(async (req: Request, res: Response) => {
  const { user, token } = await loginTeacherService(req.body as ILoginSchool);
  setAuthCookie(res, token);
  sendResponse(res, 200, true, 'Login successful', { user, token });
});

export const loginStudent = catchAsync(async (req: Request, res: Response) => {
  const { user, token } = await loginStudentService(req.body as ILoginSchool);
  setAuthCookie(res, token);
  sendResponse(res, 200, true, 'Login successful', { user, token });
});

// ── LOGOUT ────────────────────────────────────────────────────────────────────

export const logout = catchAsync(async (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure:   false,
    sameSite: 'lax',
  });
  sendResponse(res, 200, true, 'Logged out successfully', null);
});

// ── ME ────────────────────────────────────────────────────────────────────────

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const me = await getMeService(req.user as IJwtPayload);
  sendResponse(res, 200, true, 'Profile fetched successfully', me);
});

// ── FORGOT PASSWORD ───────────────────────────────────────────────────────────

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw { message: 'Email is required.', statusCode: 400 };

  await forgotPasswordService(email);
  sendResponse(res, 200, true, 'OTP sent to your email address', null);
});

// ── VERIFY RESET OTP ──────────────────────────────────────────────────────────

export const verifyResetOTP = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  if (!email || !otp) throw { message: 'Email and OTP are required.', statusCode: 400 };

  const reset_token = await verifyResetOTPService(email, otp);
  sendResponse(res, 200, true, 'OTP verified. You may reset your password.', { reset_token });
});

// ── RESET PASSWORD ────────────────────────────────────────────────────────────

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { reset_token, new_password } = req.body;
  if (!reset_token || !new_password)
    throw { message: 'Reset token and new password are required.', statusCode: 400 };

  await resetPasswordService(reset_token, new_password);
  sendResponse(res, 200, true, 'Password reset successfully. Please log in.', null);
});

// ── SUPER ADMIN: BLOCK / UNBLOCK SCHOOL ─────────────────────────────────

// ── CHANGE PASSWORD (teacher self-service) ────────────────────────────────────

export const changeTeacherPassword = catchAsync(async (req: Request, res: Response) => {
  const { id, school_id } = req.user as any;
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    throw { message: 'current_password and new_password are required.', statusCode: 400 };
  await changeTeacherPasswordService(id, school_id, current_password, new_password);
  sendResponse(res, 200, true, 'Password changed successfully.', null);
});

// ── CHANGE PASSWORD (student self-service) ────────────────────────────────────

export const changeStudentPassword = catchAsync(async (req: Request, res: Response) => {
  const { id, school_id } = req.user as any;
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    throw { message: 'current_password and new_password are required.', statusCode: 400 };
  await changeStudentPasswordService(id, school_id, current_password, new_password);
  sendResponse(res, 200, true, 'Password changed successfully.', null);
});

// ── SUPER ADMIN: BLOCK / UNBLOCK SCHOOL ───────────────────────────────────

export const verifySchoolById = catchAsync(async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  await verifySchoolService(Number(schoolId));
  sendResponse(res, 200, true, 'School has been verified successfully.', null);
});

import { setSchoolBlockedState } from '../Service/redis.service';

export const blockSchool = catchAsync(async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  await blockUnblockSchoolService(Number(schoolId), 'block');
  await setSchoolBlockedState(Number(schoolId), true);
  sendResponse(res, 200, true, 'School account has been blocked.', null);
});

export const unblockSchool = catchAsync(async (req: Request, res: Response) => {
  const { schoolId } = req.params;
  await blockUnblockSchoolService(Number(schoolId), 'unblock');
  await setSchoolBlockedState(Number(schoolId), false);
  sendResponse(res, 200, true, 'School account has been unblocked.', null);
});
