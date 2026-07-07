import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createFeeStructureService, getFeeStructuresService,
  updateFeeStructureService, deleteFeeStructureService,
  createFeeCollectionService, getFeeCollectionsService,
  getStudentFeeCollectionsService, updateFeeCollectionService,
  createFeePaymentService, getPaymentsByCollectionService,
  getStudentPaymentsService,
  generateTransportBillsService, getTransportFeeSummaryService,
  generateHostelBillsService, getHostelFeeSummaryService,
} from '../Service/fee.service';

// ── FEE STRUCTURE CONTROLLERS (ADMIN) ──

export const createFeeStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createFeeStructureService(school_id, req.body);
  sendResponse(res, 201, true, 'Fee structure created successfully', result);
});

export const getFeeStructures = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { class_id, academic_year_id } = req.query;

  if (!class_id || !academic_year_id) {
    return sendResponse(res, 400, false, 'class_id and academic_year_id are required', null);
  }

  const result = await getFeeStructuresService(
    Number(class_id),
    school_id,
    Number(academic_year_id)
  );
  sendResponse(res, 200, true, 'Fee structures fetched successfully', result);
});

export const updateFeeStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateFeeStructureService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Fee structure updated successfully', result);
});

export const deleteFeeStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteFeeStructureService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Fee structure deleted successfully', null);
});

// ── FEE COLLECTION CONTROLLERS (ADMIN) ──

export const createFeeCollection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createFeeCollectionService(school_id, school_id, req.body);
  sendResponse(res, 201, true, 'Fee collection created successfully', result);
});

export const getFeeCollections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;

  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }

  const result = await getFeeCollectionsService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Fee collections fetched successfully', result);
});

export const getStudentFeeCollections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await getStudentFeeCollectionsService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Student fee collections fetched successfully', result);
});

export const updateFeeCollection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateFeeCollectionService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Fee collection updated successfully', result);
});

// ── FEE PAYMENT CONTROLLERS (ADMIN) ──

export const createFeePayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createFeePaymentService(school_id, school_id, req.body);
  sendResponse(res, 201, true, 'Payment recorded successfully', result);
});

export const getPaymentsByCollection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await getPaymentsByCollectionService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Payments fetched successfully', result);
});

export const getStudentPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await getStudentPaymentsService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Student payments fetched successfully', result);
});

// ── SELF-SERVICE CONTROLLERS (STUDENT'S OWN FEES) ──

export const getMyFeeCollections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const result = await getStudentFeeCollectionsService(id, school_id);
  sendResponse(res, 200, true, 'Your fee collections fetched successfully', result);
});

export const getMyPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const result = await getStudentPaymentsService(id, school_id);
  sendResponse(res, 200, true, 'Your payments fetched successfully', result);
});

// ── TRANSPORT BILLING CONTROLLERS (ADMIN) ──

export const generateTransportBills = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month } = req.body;

  if (!academic_year_id || !billing_month) {
    return sendResponse(res, 400, false, 'academic_year_id and billing_month (YYYY-MM) are required', null);
  }

  const result = await generateTransportBillsService(
    school_id, school_id, Number(academic_year_id), billing_month
  );
  sendResponse(res, 201, true,
    `Transport bills generated: ${result.created} created, ${result.skipped} skipped`,
    result
  );
});

export const getTransportFeeSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;

  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }

  const result = await getTransportFeeSummaryService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Transport fee summary fetched', result);
});

// ── HOSTEL BILLING CONTROLLERS (ADMIN) ──

export const generateHostelBills = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month } = req.body;

  if (!academic_year_id || !billing_month) {
    return sendResponse(res, 400, false, 'academic_year_id and billing_month (YYYY-MM) are required', null);
  }

  const result = await generateHostelBillsService(
    school_id, school_id, Number(academic_year_id), billing_month
  );
  sendResponse(res, 201, true,
    `Hostel bills generated: ${result.created} created, ${result.skipped} skipped`,
    result
  );
});

export const getHostelFeeSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;

  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }

  const result = await getHostelFeeSummaryService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Hostel fee summary fetched', result);
});
