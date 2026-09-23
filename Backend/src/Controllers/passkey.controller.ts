import { Request, Response } from 'express';
import {
  getPasskeyRegistrationOptionsService,
  verifyPasskeyRegistrationService,
  listUserPasskeysService,
  deletePasskeyService,
  getPasskeyLoginOptionsService,
  verifyPasskeyLoginService,
} from '../Service/passkey.service';
import sendResponse from '../utils/response';
import catchAsync from '../utils/catchAsync';

const setAuthCookie = (res: Response, token: string) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// ── GET REGISTRATION CHALLENGE / OPTIONS ──
export const getPasskeyRegistrationOptions = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const options = await getPasskeyRegistrationOptionsService(req, {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.school_name || user.full_name,
  });
  return sendResponse(res, 200, true, 'Passkey registration options generated', options);
});

// ── VERIFY AND SAVE PASSKEY REGISTRATION ──
export const verifyPasskeyRegistration = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { response, device_name } = req.body;
  const saved = await verifyPasskeyRegistrationService(req, user, response, device_name);
  return sendResponse(res, 201, true, 'Passkey registered successfully', saved);
});

// ── LIST USER PASSKEYS ──
export const listUserPasskeys = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const passkeys = await listUserPasskeysService(user.id, user.role);
  return sendResponse(res, 200, true, 'User passkeys retrieved', passkeys);
});

// ── DELETE PASSKEY ──
export const deletePasskey = catchAsync(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const passkeyId = Number(req.params.id);
  await deletePasskeyService(passkeyId, user.id, user.role);
  return sendResponse(res, 200, true, 'Passkey deleted successfully', null);
});

// ── GET LOGIN CHALLENGE / OPTIONS ──
export const getPasskeyLoginOptions = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await getPasskeyLoginOptionsService(req, email);
  return sendResponse(res, 200, true, 'Passkey login options generated', result);
});

// ── VERIFY PASSKEY LOGIN ──
export const verifyPasskeyLogin = catchAsync(async (req: Request, res: Response) => {
  const { response, challenge_key } = req.body;
  const result = await verifyPasskeyLoginService(req, response, challenge_key);
  setAuthCookie(res, result.token);
  return sendResponse(res, 200, true, 'Logged in successfully with Passkey', result);
});
