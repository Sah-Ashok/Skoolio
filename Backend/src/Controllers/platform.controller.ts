import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import { getPlatformSettingsService, updatePlatformSettingsService } from '../Service/platform.service';

export const getPlatformSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const settings = await getPlatformSettingsService();
  sendResponse(res, 200, true, 'Platform settings fetched successfully', settings);
});

export const updatePlatformSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: updated_by } = req.user as IJwtAdminPayload;
  const settings = await updatePlatformSettingsService(updated_by, req.body);
  sendResponse(res, 200, true, 'Platform settings updated successfully', settings);
});
