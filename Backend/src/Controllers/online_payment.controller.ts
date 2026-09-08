// Controllers/online_payment.controller.ts

import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  getBankAccountsService,
  createBankAccountService,
  updateBankAccountService,
  deleteBankAccountService,
  getActiveBankAccountsService,
  submitPaymentRequestService,
  getMyPaymentRequestsService,
  getPaymentRequestsService,
  getPendingCountService,
  getPaymentRequestDetailService,
  verifyPaymentRequestService,
  rejectPaymentRequestService,
} from '../Service/online_payment.service';

const resolveSchoolId = (user: any): number =>
  (user && 'school_id' in user && user.school_id) ? Number(user.school_id) : Number(user?.id || 0);

// ── ADMIN: bank accounts ──────────────────────────────────────────────────────

export const getBankAccounts = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const result = await getBankAccountsService(school_id);
  sendResponse(res, 200, true, 'Bank accounts fetched', result);
});

export const createBankAccount = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const result = await createBankAccountService(school_id, req.body);
  sendResponse(res, 201, true, 'Bank account created', result);
});

export const updateBankAccount = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const result = await updateBankAccountService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Bank account updated', result);
});

export const deleteBankAccount = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  await deleteBankAccountService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Bank account deleted', null);
});

// ── ADMIN: payment request management ────────────────────────────────────────

export const getPaymentRequests = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const status = req.query.status as string | undefined;
  const result = await getPaymentRequestsService(school_id, status);
  sendResponse(res, 200, true, 'Payment requests fetched', result);
});

export const getPendingCount = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const count = await getPendingCountService(school_id);
  sendResponse(res, 200, true, 'Pending count fetched', { count });
});

export const getPaymentRequestDetail = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const result = await getPaymentRequestDetailService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Payment request fetched', result);
});

export const verifyPaymentRequest = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const admin_id = req.user?.id || school_id;
  // admin_id comes from the JWT — use school_id or user.id as identifier
  const { notes } = req.body;
  const result = await verifyPaymentRequestService(
    Number(req.params.id), school_id, admin_id, notes
  );
  sendResponse(res, 200, true, 'Payment verified and fee record updated', result);
});

export const rejectPaymentRequest = catchAsync(async (req: Request, res: Response) => {
  const school_id = resolveSchoolId(req.user);
  const admin_id = req.user?.id || school_id;
  const { rejection_reason } = req.body;
  if (!rejection_reason?.trim()) {
    return sendResponse(res, 400, false, 'rejection_reason is required', null);
  }
  const result = await rejectPaymentRequestService(
    Number(req.params.id), school_id, admin_id, rejection_reason
  );
  sendResponse(res, 200, true, 'Payment request rejected', result);
});

// ── STUDENT: bank accounts (read-only) ───────────────────────────────────────

export const getActiveBankAccounts = catchAsync(async (req: Request, res: Response) => {
  const { school_id } = req.user as IJwtUserPayload;
  const result = await getActiveBankAccountsService(school_id);
  sendResponse(res, 200, true, 'Bank accounts fetched', result);
});

// ── STUDENT: payment requests ─────────────────────────────────────────────────

export const submitPaymentRequest = catchAsync(async (req: Request, res: Response) => {
  const { id: student_id, school_id } = req.user as IJwtUserPayload;

  // Normalise field names: frontend sends fee_collection_id + notes
  // service/repo expect collection_id + remarks
  const body = req.body;
  const normalised = {
    collection_id:   body.fee_collection_id ?? body.collection_id,
    bank_account_id: body.bank_account_id,
    amount:          body.amount,
    payment_date:    body.payment_date,
    transaction_ref: body.transaction_ref,
    screenshot_url:  body.screenshot_url,
    remarks:         body.notes ?? body.remarks,  // frontend sends "notes"
  };

  const result = await submitPaymentRequestService(school_id, student_id, normalised);
  sendResponse(res, 201, true, 'Payment request submitted successfully', result);
});

export const getMyPaymentRequests = catchAsync(async (req: Request, res: Response) => {
  const { id: student_id, school_id } = req.user as IJwtUserPayload;
  const result = await getMyPaymentRequestsService(student_id, school_id);
  sendResponse(res, 200, true, 'Your payment requests fetched', result);
});
