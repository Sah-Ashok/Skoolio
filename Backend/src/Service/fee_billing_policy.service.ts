import { getFeeBillingPolicy as getRepo, upsertFeeBillingPolicy as upsertRepo } from '../Repositories/fee_billing_policy.repository';
import { IUpsertFeeBillingPolicy, FEE_BILLING_POLICY_DEFAULTS } from '../types/fee_billing_policy.types';
import AppError from '../utils/AppError';

export const getFeeBillingPolicyService = async (school_id: number) => {
  return await getRepo(school_id);
};

export const upsertFeeBillingPolicyService = async (
  school_id: number,
  data: IUpsertFeeBillingPolicy
) => {
  const validStartFrom  = ['academic_year', 'join_date'];
  const validBillWindow = ['bill_current', 'bill_past_due'];

  if (!validStartFrom.includes(data.billing_start_from)) {
    throw new AppError(`billing_start_from must be one of: ${validStartFrom.join(', ')}.`, 400);
  }
  if (!validBillWindow.includes(data.monthly_bill_window)) {
    throw new AppError(`monthly_bill_window must be one of: ${validBillWindow.join(', ')}.`, 400);
  }
  if (!Number.isInteger(Number(data.overdue_grace_days)) ||
      Number(data.overdue_grace_days) < 0 ||
      Number(data.overdue_grace_days) > 90) {
    throw new AppError('overdue_grace_days must be an integer between 0 and 90.', 400);
  }

  return await upsertRepo(school_id, {
    billing_start_from:          data.billing_start_from,
    monthly_bill_window:         data.monthly_bill_window,
    overdue_grace_days:          Number(data.overdue_grace_days),
    show_pending_popup_on_login: data.show_pending_popup_on_login !== undefined ? Boolean(data.show_pending_popup_on_login) : true,
  });
};
