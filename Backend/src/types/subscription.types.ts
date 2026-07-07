// Enums
export type BillingCycle = 'monthly' | 'yearly' | 'free';
export type Currency = 'NPR' | 'INR';
export type SubscriptionStatus = 'active' | 'expired' | 'grace_period' | 'cancelled';

// ── SUBSCRIPTION PLAN ──
export interface ISubscriptionPlan {
  id: number;
  name: string;
  max_students: number | null;
  max_teachers: number | null;
  fee_management_enabled: boolean;
  price_npr_monthly: number;
  price_npr_yearly: number;
  price_inr_monthly: number;
  price_inr_yearly: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type ICreatePlan = Pick<
  ISubscriptionPlan,
  | 'name'
  | 'max_students'
  | 'max_teachers'
  | 'fee_management_enabled'
  | 'price_npr_monthly'
  | 'price_npr_yearly'
  | 'price_inr_monthly'
  | 'price_inr_yearly'
>;

export type IUpdatePlan = Partial<ICreatePlan> & { is_active?: boolean };

// ── SCHOOL SUBSCRIPTION ──
export interface ISchoolSubscription {
  id: number;
  school_id: number;
  plan_id: number;
  billing_cycle: BillingCycle;
  amount_paid: number;
  currency?: Currency;
  start_date: Date;
  end_date?: Date;
  status: SubscriptionStatus;
  payment_method?: string;
  payment_reference?: string;
  activated_by?: number;
  notes?: string;
  created_at: Date;
}

// Used when super_admin manually activates/renews a school's plan
export type IActivateSubscription = Pick<
  ISchoolSubscription,
  | 'school_id'
  | 'plan_id'
  | 'billing_cycle'
> & {
  amount_paid?: number;
  currency?: Currency;
  start_date?: string;   // defaults to today if not given
  end_date?: string;     // required unless billing_cycle is 'free'
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
};

// What a school's "current plan status" looks like once resolved
export interface ICurrentPlanStatus {
  subscription: ISchoolSubscription;
  plan: ISubscriptionPlan;
  is_in_grace_period: boolean;
  days_until_lock: number | null; // null if not in grace period / not expiring
  student_count: number;
  teacher_count: number;
  can_add_student: boolean;
  can_add_teacher: boolean;
}