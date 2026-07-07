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
  deduction: number;
  month: number;
  year: number;
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
  bonus?: number;
  deduction?: number;
  payment_date?: Date;
  payment_method?: PaymentMethod;
  remarks?: string;
};

export type IUpdateSalary = Partial<ICreateSalary>;