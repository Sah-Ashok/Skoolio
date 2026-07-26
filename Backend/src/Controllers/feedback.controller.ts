import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import {
  submitFeedbackService, getSchoolFeedbackService, getMyFeedbackService,
  getAllFeedbackService, updateFeedbackService, deleteFeedbackService,
  getFeedbackStatsService,
} from '../Service/feedback.service';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';

export const adminSubmitFeedback = catchAsync(async (req: Request, res: Response) => {
  const admin = req.user as IJwtAdminPayload;
  const fb = await submitFeedbackService(
    admin.id, admin.id, 'admin',
    admin.school_name ?? 'Admin', req.body
  );
  sendResponse(res, 201, true, 'Feedback submitted successfully', fb);
});

export const teacherSubmitFeedback = catchAsync(async (req: Request, res: Response) => {
  const t = req.user as IJwtUserPayload & { name?: string };
  const fb = await submitFeedbackService(
    t.school_id, t.id, 'faculty',
    (t as any).full_name ?? t.name ?? t.email ?? 'Teacher', req.body
  );
  sendResponse(res, 201, true, 'Feedback submitted successfully', fb);
});

export const adminGetFeedback = catchAsync(async (req: Request, res: Response) => {
  const admin = req.user as IJwtAdminPayload;
  const { status, category, role } = req.query as Record<string, string>;
  const list = await getSchoolFeedbackService(admin.id, { status, category, role });
  sendResponse(res, 200, true, 'Feedback fetched', list);
});

export const teacherGetMyFeedback = catchAsync(async (req: Request, res: Response) => {
  const t = req.user as IJwtUserPayload;
  const list = await getMyFeedbackService(t.school_id, t.id);
  sendResponse(res, 200, true, 'Your feedback fetched', list);
});

export const superAdminGetAllFeedback = catchAsync(async (req: Request, res: Response) => {
  const { status, category } = req.query as Record<string, string>;
  const list = await getAllFeedbackService({ status, category });
  sendResponse(res, 200, true, 'All feedback fetched', list);
});

export const superAdminGetStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await getFeedbackStatsService();
  sendResponse(res, 200, true, 'Feedback stats fetched', stats);
});

export const superAdminUpdateFeedback = catchAsync(async (req: Request, res: Response) => {
  const updated = await updateFeedbackService(Number(req.params.id), req.body);
  sendResponse(res, 200, true, 'Feedback updated', updated);
});

export const deleteFeedbackCtrl = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any;
  const is_super_admin = user.role === 'super_admin';
  const school_id      = is_super_admin ? Number(req.query.school_id ?? 0) : (user.school_id ?? user.id);
  await deleteFeedbackService(Number(req.params.id), school_id, user.id, is_super_admin);
  sendResponse(res, 200, true, 'Feedback deleted', null);
});
