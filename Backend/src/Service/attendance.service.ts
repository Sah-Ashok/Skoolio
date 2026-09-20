import {
  createAttendance, getAttendanceBySection, getAttendanceByDate,
  getAttendanceById, updateAttendance, updateAttendanceCounts,
  createAttendanceDetails, getAttendanceDetails, updateAttendanceDetail,
  getStudentAttendanceSummary, getStudentMonthlyAttendance,
  getSectionAttendanceSummary, getSectionRegister,
  getClassAttendanceOverview, getAllClassesAttendanceOverview,
  createSectionTeacherHistory, getSectionTeacherHistory, updateSectionTeacherHistory,
  getAdminSectionSummary, deleteAttendanceById, bulkUpdateAttendanceDetails,
} from '../Repositories/attendance.repository';
import { calculateWorkingDays, isWorkingDayService } from './calendar.service';
import {
  ICreateAttendance, IUpdateAttendance,
  IUpdateAttendanceDetail, ICreateSectionTeacherHistory,
  IAttendanceSummary,
} from '../types/attendance.types';
import { getSectionById } from '../Repositories/class.repository';
import { getStudentById } from '../Repositories/student.repository';
import { getAcademicYearById, getActiveAcademicYear } from '../Repositories/academic.repository';
import AppError from '../utils/AppError';

// ── Helper: get today's date in the school's local timezone ─────────────────
const getTodayInTimezone = (timezone: string): string => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone }); // 'en-CA' gives YYYY-MM-DD
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

// ── Helper: enforce section coordinator for faculty ──────────────────────────
const assertCoordinator = async (section_id: number, school_id: number, teacherId?: number) => {
  if (!teacherId) return;
  const section = await getSectionById(section_id, school_id);
  if (!section) throw new AppError('Section not found.', 404);
  if (section.coordinator_id !== teacherId)
    throw new AppError('Access denied. You are not the coordinator of this section.', 403);
};

// ── Helper: reject future dates ──────────────────────────────────────────────
const assertAttendanceDate = (date: string | Date) => {
  const d     = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) throw new AppError('Cannot mark attendance for a future date.', 400);
};

// ── Helper: normalise date to 'YYYY-MM-DD' ──────────────────────────────────
const toDateString = (date: string | Date): string =>
  typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);

// ── CREATE ATTENDANCE ────────────────────────────────────────────────────────
//
// Two modes:
//   1. Class suspension  → { is_holiday: true, remarks: "reason", students: [] }
//      Sets attendance.is_holiday = true, no per-student rows, auto-submitted immediately.
//      This records that the section had no class that day (teacher-declared, not a calendar holiday).
//
//   2. Normal attendance → { is_holiday: false/undefined, students: [...] }
//      Creates per-student rows with status: 'present' | 'absent' | 'leave'.
//      Stays as 'draft' until teacher manually submits.
// ─────────────────────────────────────────────────────────────────────────────
export const createAttendanceService = async (
  school_id: number,
  data: ICreateAttendance,
  teacherId?: number
) => {
  if (!data.academic_year_id) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (activeYear) data.academic_year_id = activeYear.id;
  }

  if (!data.class_id && data.section_id) {
    const section = await getSectionById(data.section_id, school_id);
    if (section) data.class_id = section.class_id;
  }

  const isClassSuspension = data.is_holiday === true;

  // Validate: normal attendance must have students
  if (!isClassSuspension && (!data.students || data.students.length === 0))
    throw new AppError('No students provided for attendance.', 400);

  // Validate: suspension must NOT have student rows
  if (isClassSuspension && data.students && data.students.length > 0)
    throw new AppError('A class suspension cannot contain individual student attendance.', 400);

  assertAttendanceDate(data.date);

  const dateStr = toDateString(data.date);
  const { isWorking, reason } = await isWorkingDayService(school_id, data.academic_year_id, dateStr);
  if (!isWorking) {
    throw new AppError(
      reason === 'weekly_off'
        ? `Cannot mark attendance on a weekly off day (${dateStr}).`
        : `Cannot mark attendance on a holiday (${dateStr}).`,
      400
    );
  }

  await assertCoordinator(data.section_id, school_id, teacherId);

  const existing = await getAttendanceByDate(data.section_id, school_id, dateStr);
  if (existing) throw new AppError('Attendance already marked for this section on this date.', 400);

  // Create the header row
  const attendance = await createAttendance(school_id, data);

  // Class suspension: no student rows, auto-submit immediately
  if (isClassSuspension) {
    const submitted = await updateAttendance(attendance.id, school_id, { status: 'submitted' });
    return { ...submitted, total_present: 0, total_absent: 0, total_leave: 0, details: [] };
  }

  // Normal attendance: create per-student rows and cache counts
  const details       = await createAttendanceDetails(school_id, attendance.id, data.students);
  const total_present = details.filter(d => d.status === 'present').length;
  const total_absent  = details.filter(d => d.status === 'absent').length;
  const total_leave   = details.filter(d => d.status === 'leave').length;

  await updateAttendanceCounts(attendance.id, school_id, total_present, total_absent, total_leave);

  return { ...attendance, total_present, total_absent, total_leave, details };
};

// ── GET BY SECTION ───────────────────────────────────────────────────────────
export const getAttendanceBySectionService = async (
  section_id: number,
  school_id: number,
  academic_year_id: number,
  teacherId?: number,
  date?: string
) => {
  await assertCoordinator(section_id, school_id, teacherId);
  if (date) {
    const single = await getAttendanceByDate(section_id, school_id, date);
    return single ? [single] : [];
  }
  return getAttendanceBySection(section_id, school_id, academic_year_id);
};

// ── GET BY ID ────────────────────────────────────────────────────────────────
export const getAttendanceByIdService = async (id: number, school_id: number) => {
  const attendance = await getAttendanceById(id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);
  // For class suspension, there are no detail rows — return empty array
  const details = attendance.is_holiday ? [] : await getAttendanceDetails(id, school_id);
  return { ...attendance, details };
};

// ── UPDATE ATTENDANCE ────────────────────────────────────────────────────────
export const updateAttendanceService = async (id: number, school_id: number, data: IUpdateAttendance) => {
  const attendance = await getAttendanceById(id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);
  if (attendance.status === 'submitted') throw new AppError('Cannot edit submitted attendance.', 400);
  return updateAttendance(id, school_id, data);
};

// ── DELETE ATTENDANCE ────────────────────────────────────────────────────────
// Faculty can only delete is_holiday=true (class suspension) records they own.
// Normal submitted attendance cannot be deleted by a teacher.
export const deleteAttendanceService = async (
  id: number,
  school_id: number,
  teacherId?: number
) => {
  const attendance = await getAttendanceById(id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);

  if (!attendance.is_holiday) {
    throw new AppError('Only class suspension records can be deleted by a teacher. Contact admin to remove submitted attendance.', 403);
  }

  // Coordinator check — only the section coordinator can unsuspend
  await assertCoordinator(attendance.section_id, school_id, teacherId);

  await deleteAttendanceById(id, school_id);
};

export const submitAttendanceService = async (id: number, school_id: number) => {
  const attendance = await getAttendanceById(id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);
  if (attendance.status === 'submitted') throw new AppError('Attendance already submitted.', 400);
  return updateAttendance(id, school_id, { status: 'submitted' });
};

// ── UPDATE DETAIL ────────────────────────────────────────────────────────────
export const updateAttendanceDetailService = async (
  id: number,
  school_id: number,
  data: IUpdateAttendanceDetail,
  attendance_id: number
) => {
  const attendance = await getAttendanceById(attendance_id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);
  if (attendance.status === 'submitted') throw new AppError('Cannot edit a submitted attendance record.', 400);

  // Class suspension records have no per-student rows
  if (attendance.is_holiday)
    throw new AppError('Cannot edit individual student details on a suspended class day.', 400);

  const recordDate = new Date(attendance.date);
  const now        = new Date();
  const prevMonth1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  prevMonth1.setHours(0, 0, 0, 0);
  if (recordDate < prevMonth1) {
    throw new AppError(
      `Cannot edit attendance older than ${prevMonth1.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} 1st.`,
      403
    );
  }

  const detail = await updateAttendanceDetail(id, school_id, data);
  if (!detail) throw new AppError('Attendance detail not found.', 404);

  const allDetails    = await getAttendanceDetails(attendance_id, school_id);
  const total_present = allDetails.filter(d => d.status === 'present').length;
  const total_absent  = allDetails.filter(d => d.status === 'absent').length;
  const total_leave   = allDetails.filter(d => d.status === 'leave').length;
  await updateAttendanceCounts(attendance_id, school_id, total_present, total_absent, total_leave);

  return detail;
};

export const bulkUpdateAttendanceDetailsService = async (
  attendance_id: number,
  school_id: number,
  students: Array<{ student_id: number; status: string; remarks?: string | null }>,
  submitImmediately?: boolean,
  teacherId?: number
) => {
  const attendance = await getAttendanceById(attendance_id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);
  if (attendance.status === 'submitted') throw new AppError('Cannot edit a submitted attendance record.', 400);
  if (attendance.is_holiday) throw new AppError('Cannot edit individual student details on a suspended class day.', 400);

  await assertCoordinator(attendance.section_id, school_id, teacherId);

  const recordDate = new Date(attendance.date);
  const now        = new Date();
  const prevMonth1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  prevMonth1.setHours(0, 0, 0, 0);
  if (recordDate < prevMonth1) {
    throw new AppError(
      `Cannot edit attendance older than ${prevMonth1.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} 1st.`,
      403
    );
  }

  await bulkUpdateAttendanceDetails(school_id, attendance_id, students);

  if (submitImmediately) {
    await updateAttendance(attendance_id, school_id, { status: 'submitted' });
  }

  return { success: true };
};

// ── STUDENT ATTENDANCE SUMMARY ────────────────────────────────────────────────
//
// LOGIC:
//   • start_date  = max(student.admission_date, academic_year.start_date)
//   • end_date    = min(today, academic_year.end_date)
//   • working_days = calendar working days in [start, end]
//   • marked_days  = submitted attendance days in [start, end]
//   • remaining   = working_days - marked_days  (teacher hasn't filled yet → neutral)
//   • effective   = present + absent            (leave & suspended days excluded from both sides)
//   • percentage  = present / effective * 100
//                   → 100% when effective = 0 (nothing marked or all on leave)
//
//  present  → counts ✅ (increases %)
//  absent   → decreases ❌
//  leave    → neutral ➖ (excluded from both sides)
//  suspended class day → no student rows exist, not counted for any student
//  remaining → neutral ➖ (teacher not yet filled → excluded)
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentAttendanceSummaryService = async (
  student_id:       number,
  school_id:        number,
  academic_year_id: number,
  timezone:         string = 'UTC',
  override_start?:  string,
  override_end?:    string,
): Promise<IAttendanceSummary> => {

  const [student, academicYear] = await Promise.all([
    getStudentById(student_id, school_id),
    getAcademicYearById(academic_year_id, school_id),
  ]);

  if (!student)      throw new AppError('Student not found.', 404);
  if (!academicYear) throw new AppError('Academic year not found.', 404);

  const yearStart = String(academicYear.start_date).slice(0, 10);
  const yearEnd   = String(academicYear.end_date).slice(0, 10);
  const admDate   = student.admission_date
    ? String(student.admission_date).slice(0, 10)
    : yearStart;

  // Use school timezone so "today" matches Nepal/India local date, not UTC
  const today = getTodayInTimezone(timezone);

  const computedStart = admDate > yearStart ? admDate : yearStart;
  const computedEnd   = today < yearEnd ? today : yearEnd;

  const start_date = override_start
    ? (override_start > computedStart ? override_start : computedStart)
    : computedStart;

  const end_date = override_end
    ? (override_end < computedEnd ? override_end : computedEnd)
    : computedEnd;

  // Student admitted after today or year hasn't started yet → 100%
  if (start_date > end_date) {
    return {
      total_working_days:    0,
      total_marked_days:     0,
      total_remaining:       0,
      total_present:         0,
      total_absent:          0,
      total_leave:           0,
      attendance_percentage: 100,
    };
  }

  const [summary, workingDaysResult] = await Promise.all([
    getStudentAttendanceSummary(student_id, school_id, academic_year_id, start_date, end_date),
    calculateWorkingDays(school_id, academic_year_id, start_date, end_date),
  ]);

  const total_present = Number(summary.total_present || 0);
  const total_absent  = Number(summary.total_absent  || 0);
  const total_leave   = Number(summary.total_leave   || 0);
  const total_marked  = Number(summary.total_marked  || 0);

  const total_working_days = workingDaysResult.working_days;
  const total_remaining    = Math.max(0, total_working_days - total_marked);

  // Effective = present + absent only (leave is neutral; suspended class days have no rows)
  const effective = total_present + total_absent;
  const attendance_percentage = effective > 0
    ? Math.round((total_present / effective) * 10000) / 100
    : 100;

  return {
    total_working_days,
    total_marked_days: total_marked,
    total_remaining,
    total_present,
    total_absent,
    total_leave,
    attendance_percentage,
  };
};

export const getStudentMonthlyAttendanceService = async (
  student_id:       number,
  school_id:        number,
  year:             number,
  month:            number,
  academic_year_id?: number
) => {
  return getStudentMonthlyAttendance(student_id, school_id, year, month, academic_year_id);
};

// ── CLASS ATTENDANCE OVERVIEW ────────────────────────────────────────────────
export const getClassAttendanceOverviewService = async (
  school_id:        number,
  class_id:         number,
  academic_year_id: number,
  start_date:       string,
  end_date:         string
) => {
  const [sections, workingDays] = await Promise.all([
    getClassAttendanceOverview(school_id, class_id, academic_year_id, start_date, end_date),
    calculateWorkingDays(school_id, academic_year_id, start_date, end_date),
  ]);

  const enriched = sections.map((sec: any) => {
    const present       = Number(sec.total_present || 0);
    const wDays         = workingDays.working_days;
    const totalStudents = Number(sec.total_students || 0);

    const pct = wDays > 0 && totalStudents > 0
      ? Math.min(100, Math.round((present / (wDays * totalStudents)) * 10000) / 100)
      : (wDays === 0 ? 100 : 0);

    return {
      ...sec,
      total_present:  present,
      total_absent:   Number(sec.total_absent || 0),
      total_leave:    Number(sec.total_leave  || 0),
      total_students: totalStudents,
      days_marked:    Number(sec.days_marked  || 0),
      attendance_pct: pct,
      working_days:   wDays,
    };
  });

  return {
    sections: enriched,
    working_days: workingDays.working_days,
    total_days:   workingDays.total_days,
  };
};

// ── ALL-CLASSES OVERVIEW ─────────────────────────────────────────────────────
export const getAllClassesAttendanceOverviewService = async (
  school_id:        number,
  academic_year_id: number
) => {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const current_start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay       = new Date(year, month + 1, 0).getDate();
  const current_end   = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const prevDate   = new Date(year, month - 1, 1);
  const prevYear   = prevDate.getFullYear();
  const prevMonth  = prevDate.getMonth();
  const prev_start = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const prevLast   = new Date(prevYear, prevMonth + 1, 0).getDate();
  const prev_end   = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevLast).padStart(2, '0')}`;

  const [classes, currentWD, prevWD] = await Promise.all([
    getAllClassesAttendanceOverview(school_id, academic_year_id, current_start, current_end, prev_start, prev_end),
    calculateWorkingDays(school_id, academic_year_id, current_start, current_end),
    calculateWorkingDays(school_id, academic_year_id, prev_start, prev_end),
  ]);

  return {
    classes,
    current_month: { start: current_start, end: current_end, working_days: currentWD.working_days },
    prev_month:    { start: prev_start,    end: prev_end,    working_days: prevWD.working_days    },
  };
};

// ── SECTION TEACHER HISTORY ──────────────────────────────────────────────────
export const assignSectionTeacherService = async (school_id: number, data: ICreateSectionTeacherHistory) => {
  const history = await getSectionTeacherHistory(data.section_id, school_id);
  const current = history.find(h => !h.to_date);
  if (current) {
    const today = new Date().toISOString().split('T')[0];
    await updateSectionTeacherHistory(current.id, school_id, today);
  }
  return createSectionTeacherHistory(school_id, data);
};

export const getSectionTeacherHistoryService = async (section_id: number, school_id: number) =>
  getSectionTeacherHistory(section_id, school_id);

// ── ADMIN SECTION SUMMARY ────────────────────────────────────────────────────
export const getAdminSectionSummaryService = async (school_id: number, academic_year_id: number) => {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();

  const cur_start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const curLast   = new Date(year, month + 1, 0).getDate();
  const cur_end   = `${year}-${String(month + 1).padStart(2, '0')}-${String(curLast).padStart(2, '0')}`;

  const prevDate   = new Date(year, month - 1, 1);
  const prevYear   = prevDate.getFullYear();
  const prevMonth  = prevDate.getMonth();
  const prev_start = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const prevLast   = new Date(prevYear, prevMonth + 1, 0).getDate();
  const prev_end   = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(prevLast).padStart(2, '0')}`;

  const sections = await getAdminSectionSummary(school_id, academic_year_id, cur_start, cur_end, prev_start, prev_end);

  return {
    sections,
    current_month: { label: cur_start.slice(0, 7), start: cur_start, end: cur_end  },
    prev_month:    { label: prev_start.slice(0, 7), start: prev_start, end: prev_end },
  };
};

// ── SECTION REGISTER ─────────────────────────────────────────────────────────
export const getSectionRegisterService = async (
  section_id:       number,
  school_id:        number,
  academic_year_id: number,
  startDate:        string,
  endDate:          string,
  teacherId?:       number
) => {
  await assertCoordinator(section_id, school_id, teacherId);
  return getSectionRegister(section_id, school_id, academic_year_id, startDate, endDate);
};
