import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import {
  getPayrollPolicyService,
  upsertPayrollPolicyService,
} from '../Service/payroll_policy.service';

/** GET /api/payroll-policy  — returns current policy (or defaults) */
export const getPolicy = catchAsync(async (req: Request, res: Response) => {
  const school_id = (req.user as any).id; // admin JWT: id = school_id
  const policy = await getPayrollPolicyService(school_id);
  sendResponse(res, 200, true, 'Payroll policy fetched.', policy);
});

/** PUT /api/payroll-policy  — create or update policy */
export const upsertPolicy = catchAsync(async (req: Request, res: Response) => {
  const school_id = (req.user as any).id;
  const {
    paid_leave_days_per_month,
    half_day_pay_percent,
    default_tax_percent,
    default_pf_percent,
    working_days_basis,
  } = req.body;

  const policy = await upsertPayrollPolicyService(school_id, {
    paid_leave_days_per_month:
      paid_leave_days_per_month !== undefined ? Number(paid_leave_days_per_month) : undefined,
    half_day_pay_percent:
      half_day_pay_percent !== undefined ? Number(half_day_pay_percent) : undefined,
    default_tax_percent:
      default_tax_percent !== undefined ? Number(default_tax_percent) : undefined,
    default_pf_percent:
      default_pf_percent !== undefined ? Number(default_pf_percent) : undefined,
    working_days_basis,
  });
  sendResponse(res, 200, true, 'Payroll policy saved successfully.', policy);
});
