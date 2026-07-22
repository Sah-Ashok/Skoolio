// Enums
export type FeeFrequency = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'one_time';
export type DueDateType = 'fixed_day' | 'admission_date';
export type FeeCollectionStatus = 'unpaid' | 'partial' | 'paid' | 'waived';
export type FeePaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'online';
export type FeeType = 'academic' | 'transport' | 'hostel';
export type BillingStartRule = 'next_month' | 'skip_two_months' | 'academic_year';

// ── FEE STRUCTURE ──
export interface IFeeStructure {
  id: number;
  school_id: number;
  academic_year_id: number;
  class_id: number;
  fee_name: string;
  amount: number;
  frequency: FeeFrequency;
  due_date_type: DueDateType;
  due_day?: number;
  description?: string;
  billing_start_rule: BillingStartRule;
  scholarship_applies: boolean;  // whether scholarship discount applies to this fee
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type ICreateFeeStructure = Pick<
  IFeeStructure,
  | 'academic_year_id'
  | 'class_id'
  | 'fee_name'
  | 'amount'
  | 'frequency'
  | 'due_date_type'
> & {
  due_day?: number;
  description?: string;
  billing_start_rule?: BillingStartRule;
  scholarship_applies?: boolean;  // default true if not provided
};

export type IUpdateFeeStructure = Partial<ICreateFeeStructure>;

// ── FEE COLLECTION ──
export interface IFeeCollection {
  id: number;
  school_id: number;
  student_id: number;
  enrollment_id: number | null;
  fee_structure_id: number | null;
  academic_year_id: number;
  fee_name: string;
  fee_type: FeeType;
  due_date: Date;
  total_amount: number;
  discount_amount: number;
  discount_reason?: string;
  fine_amount: number;
  fine_reason?: string;
  net_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: FeeCollectionStatus;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export type ICreateFeeCollection = {
  student_id:       number;
  enrollment_id:    number | null;   // null for transport/hostel bills (no enrollment link needed)
  fee_structure_id: number | null;   // null for transport/hostel bills (no fee_structure row)
  academic_year_id: number;
  due_date:         Date | string;
  total_amount:     number;
  discount_amount?: number;
  discount_reason?: string;
  fine_amount?:     number;
  fine_reason?:     string;
};

export type IUpdateFeeCollection = Partial<Pick<
  IFeeCollection,
  | 'discount_amount'
  | 'discount_reason'
  | 'fine_amount'
  | 'fine_reason'
  | 'status'
>>;

// ── FEE PAYMENT ──
export interface IFeePayment {
  id: number;
  school_id: number;
  collection_id: number;
  student_id: number;
  receipt_number: string;
  paid_amount: number;
  payment_date: Date;
  payment_method: FeePaymentMethod;
  transaction_id?: string;
  remarks?: string;
  collected_by: number;
  created_at: Date;
}

export type ICreateFeePayment = Pick<
  IFeePayment,
  | 'collection_id'
  | 'student_id'
  | 'paid_amount'
  | 'payment_date'
  | 'payment_method'
> & {
  transaction_id?: string;
  remarks?: string;
};
