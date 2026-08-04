import {
  getPayrollPolicy,
  upsertPayrollPolicy,
  IUpsertPayrollPolicy,
} from '../Repositories/payroll_policy.repository';
import AppError from '../utils/AppError';

/** Default policy returned when school hasn't saved one yet */
const DEFAULT_POLICY = {
  paid_leave_days_per_month: 0,
  half_day_pay_percent: 50,
  default_tax_percent: 0,
  default_pf_percent: 0,
  working_days_basis: 'manual' as const,
};

/**
 * Get the payroll policy for a school.
 * If no policy saved yet, returns the default values (not persisted).
 */
export const getPayrollPolicyService = async (school_id: number) => {
  const policy = await getPayrollPolicy(school_id);
  if (!policy) return { ...DEFAULT_POLICY, school_id, id: null, created_at: null, updated_at: null };
  return policy;
};

/** Save (create or update) the payroll policy for a school. */
export const upsertPayrollPolicyService = async (
  school_id: number,
  data: Partial<IUpsertPayrollPolicy>
) => {
  // Validate ranges
  if (data.half_day_pay_percent !== undefined) {
    if (data.half_day_pay_percent < 0 || data.half_day_pay_percent > 100) {
      throw new AppError('half_day_pay_percent must be between 0 and 100.', 400);
    }
  }
  if (data.paid_leave_days_per_month !== undefined && data.paid_leave_days_per_month < 0) {
    throw new AppError('paid_leave_days_per_month cannot be negative.', 400);
  }
  if (data.default_tax_percent !== undefined && (data.default_tax_percent < 0 || data.default_tax_percent > 100)) {
    throw new AppError('default_tax_percent must be between 0 and 100.', 400);
  }
  if (data.default_pf_percent !== undefined && (data.default_pf_percent < 0 || data.default_pf_percent > 100)) {
    throw new AppError('default_pf_percent must be between 0 and 100.', 400);
  }

  // Merge with existing or defaults before upsert
  const existing = await getPayrollPolicy(school_id);
  const base = existing ?? DEFAULT_POLICY;

  const payload: IUpsertPayrollPolicy = {
    paid_leave_days_per_month: data.paid_leave_days_per_month ?? base.paid_leave_days_per_month,
    half_day_pay_percent:      data.half_day_pay_percent      ?? base.half_day_pay_percent,
    default_tax_percent:       data.default_tax_percent       ?? base.default_tax_percent,
    default_pf_percent:        data.default_pf_percent        ?? base.default_pf_percent,
    working_days_basis:        data.working_days_basis        ?? base.working_days_basis,
  };

  return upsertPayrollPolicy(school_id, payload);
};
