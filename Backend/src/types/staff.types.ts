// ── Staff Types ────────────────────────────────────────────────────────────────

export type StaffGender        = 'male' | 'female' | 'other';
export type StaffStatus        = 'active' | 'on_leave' | 'terminated';
export type StaffPaymentMethod = 'cash' | 'bank_transfer' | 'cheque';
export type SalaryPaymentStatus = 'paid' | 'pending' | 'cancelled';
export type AttendanceStatus   = 'present' | 'absent' | 'leave' | 'half_day';
export type DeductionType      = 'absent' | 'advance' | 'tax' | 'provident_fund' | 'other';

// ── Staff Role ────────────────────────────────────────────────────────────────

export interface IStaffRole {
  id: number;
  school_id: number;
  role_name: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateStaffRole = Pick<IStaffRole, 'role_name'>;
export type IUpdateStaffRole = Partial<ICreateStaffRole>;

// ── Staff Member ──────────────────────────────────────────────────────────────

export interface IStaff {
  id: number;
  school_id: number;
  staff_role_id: number;
  full_name: string;
  phone?: string;
  address?: string;
  gender?: StaffGender;
  date_of_birth?: Date;
  joined_date: Date;
  status: StaffStatus;
  photo?: string;
  citizen_id?: string;
  license_number?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateStaff = Pick<IStaff, 'staff_role_id' | 'full_name' | 'joined_date'> & {
  phone?: string;
  address?: string;
  gender?: StaffGender;
  date_of_birth?: string;
  status?: StaffStatus;
  photo?: string;
  citizen_id?: string;
  license_number?: string;
};

export type IUpdateStaff = Partial<Omit<ICreateStaff, 'staff_role_id'> & { staff_role_id?: number }>;

// ── Salary Structure ──────────────────────────────────────────────────────────

export interface IStaffSalaryStructure {
  id: number;
  school_id: number;
  staff_id: number;
  basic_salary: number;
  effective_from: Date;
  created_at: Date;
  updated_at: Date;
}

export type ICreateSalaryStructure = {
  staff_id: number;
  basic_salary: number;
  effective_from?: string;
};

export type IUpdateSalaryStructure = Partial<Pick<ICreateSalaryStructure, 'basic_salary' | 'effective_from'>>;

// ── Salary Payment ────────────────────────────────────────────────────────────

export interface IStaffSalaryPayment {
  id: number;
  school_id: number;
  staff_id: number;
  salary_month: Date;
  gross_amount: number;
  total_deductions: number;
  net_amount: number;
  payment_method?: StaffPaymentMethod;
  paid_on?: Date;
  status: SalaryPaymentStatus;
  remarks?: string;
  // attendance-based fields (set at payment creation)
  working_days?:   number;
  present_days?:   number;
  absent_days?:    number;
  half_days?:      number;
  leave_days?:     number;
  per_day_salary?: number;
  created_at: Date;
  updated_at: Date;
}

export type ICreateSalaryPayment = {
  staff_id: number;
  salary_month: string;          // "YYYY-MM"
  gross_amount: number;
  total_deductions?: number;
  payment_method?: StaffPaymentMethod;
  paid_on?: string;
  status?: SalaryPaymentStatus;
  remarks?: string;
  deductions?: ICreateDeduction[];
  // attendance snapshot
  working_days?:   number;
  present_days?:   number;
  absent_days?:    number;
  half_days?:      number;
  leave_days?:     number;
  per_day_salary?: number;
};

export type IUpdateSalaryPayment = Partial<
  Pick<ICreateSalaryPayment,
    'gross_amount' | 'total_deductions' | 'payment_method' | 'paid_on' | 'status' | 'remarks'
  >
>;

// ── Salary Deduction ──────────────────────────────────────────────────────────

export interface IStaffSalaryDeduction {
  id: number;
  school_id: number;
  salary_payment_id: number;
  deduction_type: DeductionType;
  amount: number;
  note?: string;
  created_at: Date;
}

export type ICreateDeduction = {
  deduction_type: DeductionType;
  amount: number;
  note?: string;
};

// ── Staff Attendance ──────────────────────────────────────────────────────────

export interface IStaffAttendance {
  id: number;
  school_id: number;
  staff_id: number;
  date: Date;
  status: AttendanceStatus;
  check_in?: string;
  check_out?: string;
  note?: string;
  created_at: Date;
}

export type ICreateAttendance = {
  staff_id: number;
  date: string;
  status: AttendanceStatus;
  check_in?: string;
  check_out?: string;
  note?: string;
};

export type IUpdateAttendance = Partial<Omit<ICreateAttendance, 'staff_id' | 'date'>>;
