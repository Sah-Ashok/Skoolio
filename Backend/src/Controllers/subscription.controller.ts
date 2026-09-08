import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  getActivePlansService, getAllPlansService, getPlanByIdService,
  createPlanService, updatePlanService,
  resolveCurrentPlanStatus, activateSubscriptionService,
  getSubscriptionHistoryService, getAllSchoolsWithSubscriptionsService,
  getActiveOffersService, getAllOffersService, createOfferService,
  updateOfferService, deleteOfferService,
} from '../Service/subscription.service';

// ── PLAN CONTROLLERS ──────────────────────────────────────────────────────────

// Public: For landing page pricing (unauthenticated)
export const getPublicPlans = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const country = (req.query.country as string) || undefined;
  const plans = await getActivePlansService(country);
  sendResponse(res, 200, true, 'Public plans fetched successfully', plans);
});

export const getActivePlans = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { country } = req.user as IJwtAdminPayload;
  const plans = await getActivePlansService(country);
  sendResponse(res, 200, true, 'Plans fetched successfully', plans);
});

export const getAllPlans = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const plans = await getAllPlansService();
  sendResponse(res, 200, true, 'All plans fetched successfully', plans);
});

export const getPlanById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const plan = await getPlanByIdService(Number(req.params.id));
  sendResponse(res, 200, true, 'Plan fetched successfully', plan);
});

export const createPlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const plan = await createPlanService(req.body);
  sendResponse(res, 201, true, 'Plan created successfully', plan);
});

export const updatePlan = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const plan = await updatePlanService(Number(req.params.id), req.body);
  sendResponse(res, 200, true, 'Plan updated successfully', plan);
});

// ── OFFER CONTROLLERS ─────────────────────────────────────────────────────────

// School admin: see only active public offers
export const getActiveOffers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const offers = await getActiveOffersService();
  sendResponse(res, 200, true, 'Offers fetched successfully', offers);
});

// Super admin: see all offers
export const getAllOffers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const offers = await getAllOffersService();
  sendResponse(res, 200, true, 'All offers fetched successfully', offers);
});

export const createOffer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const offer = await createOfferService(req.body);
  sendResponse(res, 201, true, 'Offer created successfully', offer);
});

export const updateOffer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const offer = await updateOfferService(Number(req.params.id), req.body);
  sendResponse(res, 200, true, 'Offer updated successfully', offer);
});

export const deleteOffer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  await deleteOfferService(Number(req.params.id));
  sendResponse(res, 200, true, 'Offer deleted successfully', null);
});

// ── SCHOOL'S OWN PLAN STATUS ──────────────────────────────────────────────────

export const getMyPlanStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = 'school_id' in (req.user as any) ? (req.user as any).school_id : (req.user as any).id;
  const status = await resolveCurrentPlanStatus(school_id);
  sendResponse(res, 200, true, 'Plan status fetched successfully', status);
});

export const getMyPlanHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = 'school_id' in (req.user as any) ? (req.user as any).school_id : (req.user as any).id;
  const history = await getSubscriptionHistoryService(school_id);
  sendResponse(res, 200, true, 'Subscription history fetched successfully', history);
});

// ── SUPER ADMIN CONTROLLERS ───────────────────────────────────────────────────

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
