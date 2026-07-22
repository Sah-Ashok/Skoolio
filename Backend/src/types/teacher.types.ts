export type Gender = 'male' | 'female' | 'other';
export type TeacherStatus = 'active' |'inactive';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque';
export type SalaryStatus = 'paid' | 'pending' | 'cancelled';


export interface ITeacher { 
    id: number ; 
    school_id : number ; 
    full_name: string;
    email: string; 
    phone: string; 
    password: string; 
    gender: Gender;
    date_of_birth?: Date;
    city?: string;
    state?: string;
    country?: string;
    qualification?: string;
    experience_years?: number;
    monthly_salary?: number;
    join_date: Date;
    status: TeacherStatus;
    photo?: string;
    role: string;
    created_at: Date;
    updated_at: Date;
}


export type ICreateTeacher = Pick<
ITeacher,
|'full_name'
|'email'
|'phone'
|'password'
|'gender'
|'join_date'
|'status'
>&{
    date_of_birth?: Date;
    city?: string;
    state?: string;
    country?: string;
    qualification?: string;
    experience_years?: string;
    monthly_salary?: number;
    photo?: string;
}


export type IUpdateTeacher = Partial<Omit<ICreateTeacher,'password'>>;

export interface ITeacherSubject { 
    id: number;
    school_id: number;
    teacher_id: number;
    subject_id: number;
    created_at: Date;
}


export interface ITeacherSalary {
  id: number;
  school_id: number;
  academic_year_id: number;
  teacher_id: number;
  basic_salary: number;
  bonus: number;
  deduction: number;           // total deduction = tax + pf + other + absent deduction
  tax_amount: number;          // income tax / TDS
  provident_fund: number;      // EPF / PF
  other_deduction: number;     // loan, advance, etc.
  deduction_remarks?: string;  // notes on deductions
  net_salary: number;          // GENERATED column
  month: number;
  year: number;
  // Attendance-based calculation fields
  working_days?: number;       // total working days in the month
  present_days?: number;       // days teacher was present
  absent_days?: number;        // days deducted (absent, not on leave)
  half_days?: number;          // half days (0.5 each)
  leave_days?: number;         // approved leave (not deducted)
  per_day_salary?: number;     // basic_salary / working_days
  payment_date?: Date;
  payment_method?: PaymentMethod;
  status: SalaryStatus;
  paid_by?: number;
  remarks?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateSalary = Pick<
  ITeacherSalary,
  | 'academic_year_id'
  | 'teacher_id'
  | 'basic_salary'
  | 'month'
  | 'year'
  | 'status'
> & {
  bonus?:             number;
  deduction?:         number;
  tax_amount?:        number;
  provident_fund?:    number;
  other_deduction?:   number;
  deduction_remarks?: string;
  // Attendance-based fields
  working_days?:      number;
  present_days?:      number;
  absent_days?:       number;
  half_days?:         number;
  leave_days?:        number;
  per_day_salary?:    number;
  payment_date?:      Date;
  payment_method?:    PaymentMethod;
  remarks?:           string;
};

export type IUpdateSalary = Partial<ICreateSalary>;