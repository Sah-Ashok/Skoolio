// Enums
export type BillingCycle = 'monthly' | 'yearly' | 'trial';
export type Currency = 'NPR' | 'INR' | 'USD';
export type SubscriptionStatus = 'active' | 'expired' | 'grace_period' | 'cancelled';
export type DiscountType = 'percent' | 'fixed' | 'free_months';

// ── SUBSCRIPTION PLAN ──
export interface ISubscriptionPlan {
  id: number;
  name: string;
  max_students: number | null;
  max_teachers: number | null;
  fee_management_enabled:    boolean;
  online_payment_enabled:    boolean;
  price_npr_monthly: number;
  price_npr_yearly:  number;
  price_inr_monthly: number;
  price_inr_yearly:  number;
  price_usd_monthly: number;
  price_usd_yearly:  number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IResolvedPricing {
  currency:      Currency;
  symbol:        string;
  price_monthly: number;
  price_yearly:  number;
  price_key:     string;
  yearly_saving?: number;        // how much saved per year vs monthly×12
  yearly_saving_pct?: number;    // saving as % (e.g. 20)
}

export interface ISubscriptionPlanResolved extends ISubscriptionPlan {
  resolved_pricing: IResolvedPricing;
}

export type ICreatePlan = Pick<
  ISubscriptionPlan,
  | 'name'
  | 'max_students'
  | 'max_teachers'
  | 'fee_management_enabled'
  | 'online_payment_enabled'
  | 'price_npr_monthly'
  | 'price_npr_yearly'
  | 'price_inr_monthly'
  | 'price_inr_yearly'
  | 'price_usd_monthly'
  | 'price_usd_yearly'
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

export type IActivateSubscription = Pick<
  ISchoolSubscription,
  | 'school_id'
  | 'plan_id'
  | 'billing_cycle'
> & {
  /** Optional promotion code. The server validates and prices it; clients never set a discounted amount. */
  offer_code?: string;
  amount_paid?: number;
  currency?: Currency;
  start_date?: string;
  end_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
};

export interface ICurrentPlanStatus {
  subscription: ISchoolSubscription;
  plan: ISubscriptionPlan;
  is_in_grace_period: boolean;
  days_until_lock: number | null;
  student_count: number;
  teacher_count: number;
  can_add_student: boolean;
  can_add_teacher: boolean;
}

// ── SUBSCRIPTION OFFER ──
export interface ISubscriptionOffer {
  id:                     number;
  code:                   string;
  title:                  string;
  description?:           string;
  plan_name?:             string;           // NULL = any plan
  discount_type:          DiscountType;
  discount_value:         number;           // % | fixed amount | free months count
  billing_cycle?:         string;           // kept for backward compat
  applies_to_billing?:    string;           // 'monthly' | 'yearly' | null = both
  min_months?:            number;
  saving_text?:           string;           // auto-computed or manual override
  currency_applies_to?:   string;           // 'NPR' | 'INR' | 'USD' | null = all
  max_uses?:              number;
  uses_count:             number;
  valid_from:             string;
  valid_until?:           string;
  is_active:              boolean;
  created_at:             string;
  updated_at:             string;
}

export type ICreateOffer = Pick<
  ISubscriptionOffer,
  | 'code'
  | 'title'
  | 'discount_type'
  | 'discount_value'
> & {
  description?:          string;
  plan_name?:            string;
  applies_to_billing?:   string;
  min_months?:           number;
  saving_text?:          string;
  currency_applies_to?:  string;
  max_uses?:             number;
  valid_from?:           string;
  valid_until?:          string;
  is_active?:            boolean;
};

export type IUpdateOffer = Partial<ICreateOffer> & { is_active?: boolean };
