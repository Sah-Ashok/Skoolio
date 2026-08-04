export type BillingStartFrom  = 'academic_year' | 'join_date';
export type MonthlyBillWindow = 'bill_current'  | 'bill_past_due';

export interface IFeeBillingPolicy {
  id:                  number;
  school_id:           number;
  billing_start_from:  BillingStartFrom;
  monthly_bill_window: MonthlyBillWindow;
  overdue_grace_days:  number;
  created_at:          Date;
  updated_at:          Date;
}

export type IUpsertFeeBillingPolicy = Omit<IFeeBillingPolicy, 'id' | 'school_id' | 'created_at' | 'updated_at'>;

// Defaults returned when no policy row exists yet
export const FEE_BILLING_POLICY_DEFAULTS: Omit<IFeeBillingPolicy, 'id' | 'school_id' | 'created_at' | 'updated_at'> = {
  billing_start_from:  'academic_year',
  monthly_bill_window: 'bill_current',
  overdue_grace_days:  0,
};
