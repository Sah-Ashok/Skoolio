// Enums
export type ExamType = 'unit_test' | 'mid_term' | 'final' | 'practice';
export type ExamStatus = 'upcoming' | 'ongoing' | 'completed';
export type ResultStatus = 'draft' | 'published';

// ── EXAM ──
export interface IExam {
  id: number;
  school_id: number;
  academic_year_id: number;
  name: string;
  exam_type: ExamType;
  start_date: Date;
  end_date: Date;
  status: ExamStatus;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateExam = Pick<
  IExam,
  | 'academic_year_id'
  | 'name'
  | 'exam_type'
  | 'start_date'
  | 'end_date'
  | 'status'
> & {
  description?: string;
};

export type IUpdateExam = Partial<ICreateExam>;

// ── EXAM SCHEDULE ──
export interface IExamSchedule {
  id: number;
  school_id: number;
  exam_id: number;
  class_id: number;
  subject_id: number;
  exam_date: Date;
  start_time?: string;
  end_time?: string;
  max_marks: number;
  pass_marks: number;
  weightage?: number;
  venue?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateExamSchedule = Pick<
  IExamSchedule,
  | 'exam_id'
  | 'class_id'
  | 'subject_id'
  | 'exam_date'
  | 'max_marks'
  | 'pass_marks'
> & {
  start_time?: string;
  end_time?: string;
  weightage?: number;
  venue?: string;
};

export type IUpdateExamSchedule = Partial<ICreateExamSchedule>;

// ── EXAM RESULT ──
export interface IExamResult {
  id: number;
  school_id: number;
  exam_id: number;
  schedule_id: number;
  student_id: number;
  enrollment_id: number;
  subject_id: number;
  marks_obtained?: number;
  max_marks: number;
  pass_marks: number;
  percentage?: number;
  grade?: string;
  gpa?: number;
  is_passed?: boolean;
  is_absent: boolean;
  remarks?: string;
  entered_by?: number;
  status: ResultStatus;
  created_at: Date;
  updated_at: Date;
}

export type ICreateExamResult = Pick<
  IExamResult,
  | 'exam_id'
  | 'schedule_id'
  | 'student_id'
  | 'enrollment_id'
  | 'subject_id'
  | 'max_marks'
  | 'pass_marks'
> & {
  marks_obtained?: number;
  is_absent?: boolean;
  remarks?: string;
  entered_by?: number;
};

export type IUpdateExamResult = Partial<ICreateExamResult>;

// ── GRADE SCALE ──
export interface IGradeScale {
  id: number;
  school_id: number;
  grade: string;
  min_percentage: number;
  max_percentage: number;
  gpa: number;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateGradeScale = Pick<
  IGradeScale,
  | 'grade'
  | 'min_percentage'
  | 'max_percentage'
  | 'gpa'
> & {
  description?: string;
};

export type IUpdateGradeScale = Partial<ICreateGradeScale>;

// ── STUDENT RESULT SUMMARY ──
export interface IStudentResultSummary {
  student_id: number;
  student_name: string;
  total_subjects: number;
  subjects_passed: number;
  subjects_failed: number;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  grade: string;
  gpa: number;
  rank?: number;
  is_passed: boolean;
}