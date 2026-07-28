// Enums
export type AttendanceStatus = 'draft' | 'submitted';
export type StudentAttendanceStatus = 'present' | 'absent' | 'late' | 'leave';

// ── ATTENDANCE ──
export interface IAttendance {
  id: number;
  school_id: number;
  academic_year_id: number;
  class_id: number;
  section_id: number;
  date: string;          // BUG-12 FIX: req.body sends a string; DB returns date::text
  marked_by: number;
  total_present: number;
  total_absent: number;
  total_late: number;
  total_leave: number;
  status: AttendanceStatus;
  is_holiday: boolean;
  remarks?: string;
  created_at: Date;
  updated_at: Date;
}

export type ICreateAttendance = Pick<
  IAttendance,
  | 'academic_year_id'
  | 'class_id'
  | 'section_id'
  | 'date'
  | 'marked_by'
> & {
  is_holiday?: boolean;
  remarks?: string;
  // A class suspension is recorded at section level and intentionally has no
  // per-student rows.
  students: ICreateAttendanceDetail[];
};

export type IUpdateAttendance = Partial<Pick<
  IAttendance,
  'remarks' | 'status' | 'is_holiday'
>>;

// ── ATTENDANCE DETAIL ──
export interface IAttendanceDetail {
  id: number;
  school_id: number;
  attendance_id: number;
  student_id: number;
  enrollment_id: number;
  status: StudentAttendanceStatus;
  check_in_time?: string | null;
  remarks?: string | null;
  created_at: Date;
  updated_at: Date;
}

export type ICreateAttendanceDetail = Pick<
  IAttendanceDetail,
  'student_id' | 'enrollment_id' | 'status'
> & {
  check_in_time?: string | null;
  remarks?: string | null;
};

// BUG-08 FIX: fields typed as `T | null | undefined` so the repository
// can distinguish "not sent" (undefined = skip) from "clear it" (null = set NULL).
export type IUpdateAttendanceDetail = {
  status?:        StudentAttendanceStatus | undefined;
  check_in_time?: string | null | undefined;
  remarks?:       string | null | undefined;
};

// ── SECTION TEACHER HISTORY ──
export interface ISectionTeacherHistory {
  id: number;
  school_id: number;
  section_id: number;
  teacher_id: number;
  academic_year_id: number;
  from_date: string;
  to_date?: string;
  reason?: string;
  created_at: Date;
}

export type ICreateSectionTeacherHistory = Pick<
  ISectionTeacherHistory,
  | 'section_id'
  | 'teacher_id'
  | 'academic_year_id'
  | 'from_date'
> & {
  to_date?: string;
  reason?: string;
};

// ── ATTENDANCE SUMMARY ──
export interface IAttendanceSummary {
  total_working_days:    number;
  total_marked_days:     number;   // days teacher has submitted attendance
  total_remaining:       number;   // working days teacher hasn't filled yet
  total_present:         number;
  total_absent:          number;
  total_late:            number;
  total_leave:           number;
  attendance_percentage: number;
}
