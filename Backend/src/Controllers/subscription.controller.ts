import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  getActivePlansService, getAllPlansService, createPlanService, updatePlanService,
  resolveCurrentPlanStatus, activateSubscriptionService,
  getSubscriptionHistoryService, getAllSchoolsWithSubscriptionsService,
} from '../Service/subscription.service';

// ── PLAN CONTROLLERS ──

// Public-ish — any logged in school admin can see available plans with pricing
// resolved for their own country. No price-selection logic needed on the frontend.
export const getActivePlans = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { country } = req.user as IJwtAdminPayload;
  const plans = await getActivePlansService(country);
  sendResponse(res, 200, true, 'Plans fetched successfully', plans);
});

// Super admin only — sees inactive plans too
export const getAllPlans = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const plans = await getAllPlansService();
  sendResponse(res, 200, true, 'All plans fetched successfully', plans);
});

export const createPlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const plan = await createPlanService(req.body);
  sendResponse(res, 201, true, 'Plan created successfully', plan);
});

export const updatePlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const plan = await updatePlanService(Number(req.params.id), req.body);
  sendResponse(res, 200, true, 'Plan updated successfully', plan);
});

// ── SCHOOL'S OWN PLAN STATUS (admin checking their own school) ──

export const getMyPlanStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const status = await resolveCurrentPlanStatus(school_id);
  sendResponse(res, 200, true, 'Plan status fetched successfully', status);
});

export const getMyPlanHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const history = await getSubscriptionHistoryService(school_id);
  sendResponse(res, 200, true, 'Subscription history fetched successfully', history);
});

// ── SUPER ADMIN CONTROLLERS ──

export const getSchoolPlanStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const status = await resolveCurrentPlanStatus(Number(req.params.schoolId));
  sendResponse(res, 200, true, 'School plan status fetched successfully', status);
});

export const activateSubscription = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: activated_by } = req.user as IJwtAdminPayload;
  const subscription = await activateSubscriptionService(activated_by, req.body);
  sendResponse(res, 201, true, 'Subscription activated successfully', subscription);
});

export const getSchoolSubscriptionHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const history = await getSubscriptionHistoryService(Number(req.params.schoolId));
  sendResponse(res, 200, true, 'Subscription history fetched successfully', history);
});

export const getAllSchoolsWithSubscriptions = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const schools = await getAllSchoolsWithSubscriptionsService();
  sendResponse(res, 200, true, 'Schools fetched successfully', schools);
});