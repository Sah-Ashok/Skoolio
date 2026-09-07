import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createFeeStructureService, getFeeStructuresService,
  updateFeeStructureService, deleteFeeStructureService,
  createFeeCollectionService, createMiscFeeCollectionService,
  getFeeCollectionsService,
  getStudentFeeCollectionsService, updateFeeCollectionService,
  waiveFeeCollectionService,
  createFeePaymentService, getPaymentsByCollectionService,
  getStudentPaymentsService,
  generateMonthlyFeeBillsService,
  generateTransportBillsService, getTransportFeeSummaryService,
  generateHostelBillsService, getHostelFeeSummaryService,
  getSpecialFeeBillingPreviewService,
  getPaymentReceiptService,
  assignOneTimeFeesService,
  getMonthlyBillingStatusService,
  voidMonthBillingService,
  getStudentBillingTimelineService,
  getUnbilledStudentsService,
} from '../Service/fee.service';
import { getFeeStructureById } from '../Repositories/fee.repository';
import { addBillingJob, getBillingJobStatus } from '../queues/feeBilling.queue';
import { invalidateDashboardCache } from '../Repositories/dashboard.repository';

const resolveSchoolId = (user: IJwtAdminPayload | IJwtUserPayload): number =>
  'school_id' in user ? user.school_id : user.id;

// ── FEE STRUCTURE CONTROLLERS ──────────────────────────────────────────────

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
  const result = await getFeeStructuresService(Number(class_id), school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Fee structures fetched successfully', result);
});

export const getFeeStructureByIdController = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const structure = await getFeeStructureById(Number(req.params.id), school_id);
  if (!structure) return sendResponse(res, 404, false, 'Fee structure not found', null);
  sendResponse(res, 200, true, 'Fee structure fetched successfully', structure);
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

// ── FEE COLLECTION CONTROLLERS ─────────────────────────────────────────────

export const createFeeCollection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createFeeCollectionService(school_id, school_id, req.body);
  sendResponse(res, 201, true, 'Fee collection created successfully', result);
});

export const createMiscFeeCollection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { student_id, enrollment_id, academic_year_id, fee_name, due_date, total_amount, discount_amount, discount_reason } = req.body;
  if (!student_id || !academic_year_id || !fee_name || !due_date || !total_amount) {
    return sendResponse(res, 400, false, 'student_id, academic_year_id, fee_name, due_date and total_amount are required', null);
  }
  const result = await createMiscFeeCollectionService(school_id, school_id, {
    student_id:       Number(student_id),
    enrollment_id:    enrollment_id ? Number(enrollment_id) : null,
    academic_year_id: Number(academic_year_id),
    fee_name, due_date,
    total_amount:     Number(total_amount),
    discount_amount:  discount_amount ? Number(discount_amount) : undefined,
    discount_reason:  discount_reason || undefined,
  });
  sendResponse(res, 201, true, 'Miscellaneous fee collection created successfully', result);
});

export const getFeeCollections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month, pending_only } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  if (billing_month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(billing_month))) {
    return sendResponse(res, 400, false, 'billing_month must use YYYY-MM format', null);
  }
  const result = await getFeeCollectionsService(
    school_id, Number(academic_year_id),
    billing_month ? String(billing_month) : undefined,
    pending_only === 'true',
  );
  sendResponse(res, 200, true, 'Fee collections fetched successfully', result);
});

export const getStudentFeeCollections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  const result = await getStudentFeeCollectionsService(
    Number(req.params.id), school_id,
    academic_year_id ? Number(academic_year_id) : undefined
  );
  sendResponse(res, 200, true, 'Student fee collections fetched successfully', result);
});

export const waiveFeeCollection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { reason } = req.body;
  const result = await waiveFeeCollectionService(Number(req.params.id), school_id, reason || 'Waived by admin');
  invalidateDashboardCache(school_id);
  sendResponse(res, 200, true, 'Fee collection waived successfully', result);
});

export const updateFeeCollection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateFeeCollectionService(Number(req.params.id), school_id, req.body);
  invalidateDashboardCache(school_id);
  sendResponse(res, 200, true, 'Fee collection updated successfully', result);
});

// ── FEE PAYMENT CONTROLLERS ────────────────────────────────────────────────

export const createFeePayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createFeePaymentService(school_id, school_id, req.body);
  invalidateDashboardCache(school_id);
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

// ── SELF-SERVICE CONTROLLERS (STUDENT) ────────────────────────────────────

export const getMyFeeCollections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const { academic_year_id } = req.query;
  const result = await getStudentFeeCollectionsService(
    id, school_id,
    academic_year_id ? Number(academic_year_id) : undefined
  );
  sendResponse(res, 200, true, 'Your fee collections fetched successfully', result);
});

export const getMyPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const result = await getStudentPaymentsService(id, school_id);
  sendResponse(res, 200, true, 'Your payments fetched successfully', result);
});

// ── MONTHLY BILLING ────────────────────────────────────────────────────────

export const generateMonthlyFeeBills = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month, custom_due_date, from_month, to_month, class_id, section_id } = req.body;
  const targetMonth = to_month || billing_month || from_month;
  if (!academic_year_id || !targetMonth) {
    return sendResponse(res, 400, false, 'academic_year_id and billing_month (or from_month and to_month) are required', null);
  }
  const result = await generateMonthlyFeeBillsService(
    school_id,
    school_id,
    Number(academic_year_id),
    targetMonth,
    custom_due_date,
    from_month,
    to_month,
    class_id ? Number(class_id) : null,
    section_id ? Number(section_id) : null
  );
  sendResponse(res, 201, true, `Bills generated: ${result.created} created, ${result.skipped} skipped`, result);
});

export const generateMonthlyFeeBillsQueue = catchAsync(async (req: Request, res: Response) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month, custom_due_date, from_month, to_month, class_id, section_id, fee_type } = req.body;
  const targetMonth = to_month || billing_month || from_month;
  if (!academic_year_id || !targetMonth) {
    return sendResponse(res, 400, false, 'academic_year_id and billing_month (or from_month and to_month) are required', null);
  }
  const job = await addBillingJob({
    school_id,
    created_by: school_id,
    academic_year_id: Number(academic_year_id),
    billing_month: targetMonth,
    from_month,
    to_month,
    custom_due_date,
    class_id: class_id ? Number(class_id) : null,
    section_id: section_id ? Number(section_id) : null,
    fee_type: fee_type || 'academic',
  });
  sendResponse(res, 202, true, 'Bill generation started in background', job);
});

export const getMonthlyFeeBillsQueueStatus = catchAsync(async (req: Request, res: Response) => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  if (!jobId) {
    return sendResponse(res, 400, false, 'jobId is required', null);
  }
  const status = await getBillingJobStatus(jobId);
  if (!status) {
    return sendResponse(res, 404, false, 'Billing job not found', null);
  }
  sendResponse(res, 200, true, 'Job status retrieved', status);
});

// ── MONTHLY BILLING STATUS ─────────────────────────────────────────────────

export const getMonthlyBillingStatusController = catchAsync(async (req: Request, res: Response) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month } = req.query;
  if (!academic_year_id || !billing_month) {
    return sendResponse(res, 400, false, 'academic_year_id and billing_month (YYYY-MM) are required', null);
  }
  const result = await getMonthlyBillingStatusService(
    school_id, Number(academic_year_id), String(billing_month)
  );
  sendResponse(res, 200, true, 'Monthly billing status fetched', result);
});

// ── STUDENT BILLING TIMELINE ───────────────────────────────────────────────

export const getStudentBillingTimelineController = catchAsync(async (req: Request, res: Response) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month } = req.query;
  if (!academic_year_id || !billing_month) {
    return sendResponse(res, 400, false, 'academic_year_id and billing_month (YYYY-MM) are required', null);
  }
  const result = await getStudentBillingTimelineService(
    school_id, Number(academic_year_id), String(billing_month)
  );
  sendResponse(res, 200, true, 'Billing timeline fetched', result);
});

// ── TRANSPORT BILLING ──────────────────────────────────────────────────────

export const generateTransportBills = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month, due_day, due_date, student_ids } = req.body;
  if (!academic_year_id || !billing_month || !Array.isArray(student_ids) || !student_ids.length) {
    return sendResponse(res, 400, false, 'academic_year_id, billing_month (YYYY-MM), and selected student_ids are required', null);
  }
  const result = await generateTransportBillsService(
    school_id, school_id, Number(academic_year_id), billing_month,
    due_day ? Math.min(Math.max(Number(due_day), 1), 28) : 10, student_ids.map(Number), due_date
  );
  sendResponse(res, 201, true, `Transport bills: ${result.created} created, ${result.skipped} skipped`, result);
});

export const getTransportFeeSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) return sendResponse(res, 400, false, 'academic_year_id is required', null);
  const result = await getTransportFeeSummaryService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Transport fee summary fetched', result);
});

export const getTransportBillingPreview = catchAsync(async (req: Request, res: Response) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month } = req.query;
  if (!academic_year_id || !billing_month) return sendResponse(res, 400, false, 'academic_year_id and billing_month are required', null);
  const result = await getSpecialFeeBillingPreviewService(school_id, Number(academic_year_id), String(billing_month), 'transport');
  sendResponse(res, 200, true, 'Transport billing preview fetched', result);
});

// ── HOSTEL BILLING ─────────────────────────────────────────────────────────

export const generateHostelBills = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month, due_day, due_date, student_ids } = req.body;
  if (!academic_year_id || !billing_month || !Array.isArray(student_ids) || !student_ids.length) {
    return sendResponse(res, 400, false, 'academic_year_id, billing_month (YYYY-MM), and selected student_ids are required', null);
  }
  const result = await generateHostelBillsService(
    school_id, school_id, Number(academic_year_id), billing_month,
    due_day ? Math.min(Math.max(Number(due_day), 1), 28) : 10, student_ids.map(Number), due_date
  );
  sendResponse(res, 201, true, `Hostel bills: ${result.created} created, ${result.skipped} skipped`, result);
});

export const getHostelFeeSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) return sendResponse(res, 400, false, 'academic_year_id is required', null);
  const result = await getHostelFeeSummaryService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Hostel fee summary fetched', result);
});

export const getHostelBillingPreview = catchAsync(async (req: Request, res: Response) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month } = req.query;
  if (!academic_year_id || !billing_month) return sendResponse(res, 400, false, 'academic_year_id and billing_month are required', null);
  const result = await getSpecialFeeBillingPreviewService(school_id, Number(academic_year_id), String(billing_month), 'hostel');
  sendResponse(res, 200, true, 'Hostel billing preview fetched', result);
});

// ── PAYMENT RECEIPT ────────────────────────────────────────────────────────

export const getPaymentReceipt = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user       = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id  = resolveSchoolId(user);
  const payment_id = Number(req.params.id);
  const result     = await getPaymentReceiptService(payment_id, school_id);
  if ('school_id' in user && result.student_id !== user.id) {
    return sendResponse(res, 403, false, 'You do not have access to this receipt.', null);
  }
  sendResponse(res, 200, true, 'Payment receipt fetched', result);
});

// ── ASSIGN ONE-TIME FEES AT ENROLLMENT ────────────────────────────────────

export const assignOneTimeFeesController = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { student_id, enrollment_id, academic_year_id, class_id, scholarship_percent, scholarship_type, admission_date } = req.body;
  if (!student_id || !enrollment_id || !academic_year_id || !class_id || !admission_date) {
    return sendResponse(res, 400, false,
      'student_id, enrollment_id, academic_year_id, class_id and admission_date are required', null);
  }
  const result = await assignOneTimeFeesService(
    school_id, school_id,
    Number(student_id), Number(enrollment_id), Number(academic_year_id), Number(class_id),
    scholarship_percent ? Number(scholarship_percent) : 0,
    scholarship_type    || '',
    admission_date
  );
  sendResponse(res, 201, true,
    `One-time fees assigned: ${result.created} created, ${result.skipped} already existed.`, result);
});

// ── VOID (UNDO) MONTHLY BILLING ───────────────────────────────────────────

export const voidMonthBillingController = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_month, fee_type } = req.body;
  if (!academic_year_id || !billing_month || !fee_type) {
    return sendResponse(res, 400, false,
      'academic_year_id, billing_month (YYYY-MM) and fee_type are required', null);
  }
  const result = await voidMonthBillingService(
    school_id, Number(academic_year_id), String(billing_month), String(fee_type)
  );
  sendResponse(res, 200, true, result.message, result);
});

// ── UNBILLED STUDENTS ──────────────────────────────────────────────────────
// GET /fees/monthly/unbilled?academic_year_id=&billing_months=2083-01,2083-02&fee_type=academic
export const getUnbilledStudentsController = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, billing_months, fee_type } = req.query;
  if (!academic_year_id || !billing_months || !fee_type) {
    return sendResponse(res, 400, false,
      'academic_year_id, billing_months (comma-separated YYYY-MM), and fee_type are required', null);
  }
  const months = String(billing_months).split(',').map(s => s.trim()).filter(Boolean);
  const result = await getUnbilledStudentsService(
    school_id, Number(academic_year_id), months, String(fee_type)
  );
  sendResponse(res, 200, true, 'Unbilled students fetched', result);
});
