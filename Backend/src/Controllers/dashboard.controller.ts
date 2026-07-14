import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import { getDashboardSummary } from '../Repositories/dashboard.repository';

export const getAdminDashboard = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const admin = req.user as IJwtAdminPayload;
    const data = await getDashboardSummary(admin.id);
    sendResponse(res, 200, true, 'Dashboard data fetched successfully', data);
  }
);
