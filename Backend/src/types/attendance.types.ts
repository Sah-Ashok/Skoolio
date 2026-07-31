// Enums
export type AttendanceStatus = 'draft' | 'submitted';
// 'suspended' is a SECTION-LEVEL flag (attendance.is_holiday = true + remarks = 'suspended')
// NOT a per-student status. Per-student only has: present | absent | leave
export type StudentAttendanceStatus = 'present' | 'absent' | 'leave';

// ── ATTENDANCE ──
export interface IAttendance {
  id: number;
  school_id: number;
  academic_year_id: number;
  class_id: number;
  section_id: number;
  date: string;
  marked_by: number;
  total_present: number;
  total_absent: number;
  total_leave: number;
  status: AttendanceStatus;
  is_holiday: boolean;   // true = class suspended / holiday (no per-student rows)
  remarks?: string;      // e.g. "Class suspended due to flooding"
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
  // Empty array when is_holiday = true (class suspended — no per-student rows)
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
  remarks?:       string | null;
};

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
  total_marked_days:     number;
  total_remaining:       number;
  total_present:         number;
  total_absent:          number;
  total_leave:           number;
  attendance_percentage: number;
}
