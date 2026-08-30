import { Request, Response } from 'express';
import catchAsync   from '../utils/catchAsync';
import sendResponse  from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  getSchoolSettingsService,
  updateSchoolSettingsService,
  changePasswordService,
  toggleTwoFAService,
} from '../Service/auth.service';

// ── GET SETTINGS ──────────────────────────────────────────────────────────────

export const getSettings = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const school  = await getSchoolSettingsService(id);
  sendResponse(res, 200, true, 'Settings fetched', school);
});

// ── UPDATE SETTINGS ───────────────────────────────────────────────────────────

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const updated = await updateSchoolSettingsService(id, req.body);
  sendResponse(res, 200, true, 'Settings updated successfully', updated);
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    throw { message: 'Current password and new password are required.', statusCode: 400 };

  await changePasswordService(id, current_password, new_password);
  sendResponse(res, 200, true, 'Password changed successfully', null);
});

// ── TOGGLE 2FA (school admin for own school) ──────────────────────────────────

export const toggleMyTwoFA = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean')
    throw { message: '`enabled` (boolean) is required.', statusCode: 400 };

  await toggleTwoFAService(id, enabled);
  sendResponse(
    res, 200, true,
    `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} successfully`,
    { schoolId: id, two_fa_enabled: enabled }
  );
});

// ── TOGGLE 2FA (super admin for any school) ───────────────────────────────────

export const toggleTwoFA = catchAsync(async (req: Request, res: Response) => {
  const schoolId = Number(req.params.schoolId);
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean')
    throw { message: '`enabled` (boolean) is required.', statusCode: 400 };

  await toggleTwoFAService(schoolId, enabled);
  sendResponse(
    res, 200, true,
    `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} for school`,
    { schoolId, two_fa_enabled: enabled }
  );
});
