// Enums
export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'expelled' | 'transferred';
export type EnrollmentStatus = 'active' | 'inactive' | 'transferred' | 'graduated';
export type Stream = 'science' | 'commerce' | 'arts' | 'not_applicable';
export type TransportFeeType = 'monthly' | 'six_monthly' | 'yearly';
export type ScholarshipType = 'merit' | 'need_based' | 'sports' | 'staff_child' | 'government' | 'custom' | null;

// ── STUDENT ──
export interface IStudent {
  id: number;
  school_id: number;
  admission_number: string;
  full_name: string;
  email?: string;
  phone?: string;
  password: string;
  gender: 'male' | 'female' | 'other';
  date_of_birth: Date;
  blood_group?: string;
  photo?: string;
  nationality?: string;
  religion?: string;
  ethnicity?: string;
  city?: string;
  state?: string;
  country?: string;
  previous_school?: string;
  admission_date: Date;
  disability: boolean;
  disability_description?: string;
  scholarship_type?: ScholarshipType;
  scholarship_percent?: number;
  scholarship_remarks?: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email?: string;
  guardian_relation: string;
  guardian_occupation?: string;
  guardian_address?: string;
  status: StudentStatus;
  created_at: Date;
  updated_at: Date;
}

export type ICreateStudent = Pick<
  IStudent,
  | 'admission_number'
  | 'full_name'
  | 'password'
  | 'gender'
  | 'date_of_birth'
  | 'admission_date'
  | 'guardian_name'
  | 'guardian_phone'
  | 'guardian_relation'
  | 'status'
> & {
  email?: string;
  phone?: string;
  blood_group?: string;
  photo?: string;
  nationality?: string;
  religion?: string;
  ethnicity?: string;
  city?: string;
  state?: string;
  country?: string;
  previous_school?: string;
  disability?: boolean;
  disability_description?: string;
  scholarship_type?: ScholarshipType;
  scholarship_percent?: number;
  scholarship_remarks?: string;
  guardian_email?: string;
  guardian_occupation?: string;
  guardian_address?: string;
};

export type IUpdateStudent = Partial<Omit<ICreateStudent, 'password'>>;

// ── STUDENT ENROLLMENT ──
export interface IStudentEnrollment {
  id: number;
  school_id: number;
  student_id: number;
  academic_year_id: number;
  class_id: number;
  section_id: number;
  roll_number?: string;
  stream: Stream;
  registration_number?: string;
  symbol_number?: string;
  exam_roll_number?: string;
  board_name?: string;
  is_promoted: boolean;
  promoted_to_class_id?: number;
  transport_required: boolean;
  transport_route?: string;
  pickup_location?: string;
  transport_fee?: number;
  transport_fee_type?: TransportFeeType;
  remarks?: string;
  status: EnrollmentStatus;
  created_at: Date;
  updated_at: Date;
}

export type ICreateEnrollment = Pick<
  IStudentEnrollment,
  | 'student_id'
  | 'academic_year_id'
  | 'class_id'
  | 'section_id'
  | 'stream'
  | 'status'
> & {
  roll_number?: string;
  registration_number?: string;
  symbol_number?: string;
  exam_roll_number?: string;
  board_name?: string;
  transport_required?: boolean;
  transport_route?: string;
  pickup_location?: string;
  transport_fee?: number;
  transport_fee_type?: TransportFeeType;
  remarks?: string;
  billing_start_choice?: 'admission_month' | 'session_start';
};

export type IUpdateEnrollment = Partial<ICreateEnrollment> & {
  is_promoted?: boolean;
  promoted_to_class_id?: number;
};

// Extended type returned by getEnrollmentsBySchool — includes joined student fields
export interface IStudentEnrollmentWithStudent extends IStudentEnrollment {
  full_name:           string;
  admission_number:    string;
  photo?:              string;
  gender:              string;
  admission_date:      string;   // ::text cast from DB
  scholarship_type?:   ScholarshipType;
  scholarship_percent?: number;
  class_name:          string;
  section_name:        string;
}