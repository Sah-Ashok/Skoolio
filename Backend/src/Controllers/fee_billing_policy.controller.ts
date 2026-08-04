import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { getFeeBillingPolicyService, upsertFeeBillingPolicyService } from '../Service/fee_billing_policy.service';

export const getFeeBillingPolicy = catchAsync(async (req: Request, res: Response) => {
  const school_id = (req.user as any).id;
  const policy = await getFeeBillingPolicyService(school_id);
  sendResponse(res, 200, true, 'Fee billing policy fetched.', policy);
});

export const upsertFeeBillingPolicy = catchAsync(async (req: Request, res: Response) => {
  const school_id = (req.user as any).id;
  const { billing_start_from, monthly_bill_window, overdue_grace_days = 0 } = req.body;
  const policy = await upsertFeeBillingPolicyService(school_id, {
    billing_start_from,
    monthly_bill_window,
    overdue_grace_days: Number(overdue_grace_days),
  });
  sendResponse(res, 200, true, 'Fee billing policy updated.', policy);
});
