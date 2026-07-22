// ── Controllers/receipt.controller.ts ────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import { generateReceiptPDFService, getReceiptStatusService } from '../Service/receipt.service';
import { getPaymentReceiptService } from '../Service/fee.service';
import AppError from '../utils/AppError';

const resolveSchoolId = (u: IJwtAdminPayload | IJwtUserPayload): number =>
  'school_id' in u ? u.school_id : u.id;

const resolveUserId = (u: IJwtAdminPayload | IJwtUserPayload): number =>
  'school_id' in u ? u.id : u.id;

const assertReceiptAccess = async (
  user: IJwtAdminPayload | IJwtUserPayload,
  payment_id: number,
  school_id: number
) => {
  if (user.role !== 'student') return;
  const receipt = await getPaymentReceiptService(payment_id, school_id);
  if (receipt.student_id !== user.id) {
    throw new AppError('You do not have access to this receipt.', 403);
  }
};


export const generateReceipt = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  console.log("Came to generate bill")
  const user       = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id  = resolveSchoolId(user);
  const payment_id = Number(req.params.id);

  await assertReceiptAccess(user, payment_id, school_id);

  const result = await generateReceiptPDFService(payment_id, school_id);

  if (result.cached || result.status === 'ready') {
    return sendResponse(res, 200, true, 'Receipt ready', {
      status: 'ready',
      url:    result.url,
      cached: result.cached,
    });
  }

  // 202 Accepted — worker is running, poll for status
  return res.status(202).json({
    success: true,
    message: 'Receipt generation started',
    data:    { status: 'generating', url: null },
  });
});

/**
 * GET /fees/payments/:id/receipt-status
 *
 * Lightweight poll — returns { status, url } without re-triggering generation.
 * Frontend polls every 1.5 s until status === 'ready', then opens the URL.
 */
export const getReceiptStatus = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user       = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id  = resolveSchoolId(user);
  const payment_id = Number(req.params.id);

  await assertReceiptAccess(user, payment_id, school_id);

  const result = await getReceiptStatusService(payment_id, school_id);
  sendResponse(res, 200, true, 'Receipt status', result);
});
