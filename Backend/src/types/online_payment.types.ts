// types/online_payment.types.ts

export interface ISchoolBankAccount {
  id:             number;
  school_id:      number;
  bank_name:      string;
  account_name:   string;
  account_number: string;
  branch?:        string;
  ifsc_code?:     string;
  qr_image_url?:  string;
  upi_id?:        string;
  notes?:         string;
  is_active:      boolean;
  created_at:     Date;
  updated_at:     Date;
}

export interface ICreateBankAccount {
  bank_name:      string;
  account_name:   string;
  account_number: string;
  branch?:        string;
  ifsc_code?:     string;
  qr_image_url?:  string;
  upi_id?:        string;
  notes?:         string;
}

export interface IOnlinePaymentRequest {
  id:               number;
  school_id:        number;
  student_id:       number;
  collection_id:    number;
  bank_account_id?: number;
  amount:           number;
  transaction_ref?: string;
  payment_date:     string;
  screenshot_url?:  string;
  remarks?:         string;
  status:           'pending' | 'verified' | 'rejected';
  rejection_reason?: string;
  verified_by?:     number;
  verified_at?:     Date;
  fee_payment_id?:  number;
  created_at:       Date;
  updated_at:       Date;
}

export interface ICreatePaymentRequest {
  collection_id:    number;
  bank_account_id?: number;
  amount:           number;
  transaction_ref?: string;
  payment_date:     string;
  screenshot_url?:  string;
  remarks?:         string;
}
