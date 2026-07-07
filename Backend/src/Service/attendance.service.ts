import {
  createAttendance, getAttendanceBySection, getAttendanceByDate,
  getAttendanceById, updateAttendance, updateAttendanceCounts,
  createAttendanceDetails, getAttendanceDetails, updateAttendanceDetail,
  getStudentAttendanceSummary, getStudentMonthlyAttendance,
  getSectionAttendanceSummary,
  getClassAttendanceOverview, getAllClassesAttendanceOverview,
  createSectionTeacherHistory, getSectionTeacherHistory, updateSectionTeacherHistory,
  getAdminSectionSummary,
} from '../Repositories/attendance.repository';
import { calculateWorkingDays } from './calendar.service';
import {
  ICreateAttendance, IUpdateAttendance,
  IUpdateAttendanceDetail, ICreateSectionTeacherHistory,
  IAttendanceSummary,
} from '../types/attendance.types';
import { getSectionById } from '../Repositories/class.repository';
import AppError from '../utils/AppError';

// ── Helper: enforce section coordinator for faculty ──────────────────────────
const assertCoordinator = async (section_id: number, school_id: number, teacherId?: number) => {
  if (!teacherId) return; // admin — skip check
  const section = await getSectionById(section_id, school_id);
  if (!section) throw new AppError('Section not found.', 404);
  if (section.coordinator_id !== teacherId)
    throw new AppError('Access denied. You are not the coordinator of this section.', 403);
};

// ── Helper: reject future dates and too-old dates ────────────────────────────
const assertAttendanceDate = (date: string | Date) => {
  const d     = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // end of today

  if (d > today) {
    throw new AppError('Cannot mark attendance for a future date.', 400);
  }
};

// ── CREATE ATTENDANCE ─────────────────────────────────────────────────────────

export const createAttendanceService = async (
  school_id: number,
  data: ICreateAttendance,
  teacherId?: number
) => {
  if (!data.students || data.students.length === 0)
    throw new AppError('No students provided for attendance.', 400);

  // Reject future dates
  assertAttendanceDate(data.date);

  await assertCoordinator(data.section_id, school_id, teacherId);

  const existing = await getAttendanceByDate(data.section_id, school_id, String(data.date));
  if (existing) {
    throw new AppError('Attendance already marked for this section on this date.', 400);
  }

  const attendance = await createAttendance(school_id, data);

  const details = await createAttendanceDetails(
    school_id,
    attendance.id,
    data.students
  );

  const total_present = details.filter(d => d.status === 'present').length;
  const total_absent  = details.filter(d => d.status === 'absent').length;
  const total_late    = details.filter(d => d.status === 'late').length;
  const total_leave   = details.filter(d => d.status === 'leave').length;

  await updateAttendanceCounts(
    attendance.id, school_id,
    total_present, total_absent, total_late, total_leave
  );

  return { ...attendance, total_present, total_absent, total_late, total_leave, details };
};

// ── GET BY SECTION ────────────────────────────────────────────────────────────

export const getAttendanceBySectionService = async (
  section_id: number,
  school_id: number,
  academic_year_id: number,
  teacherId?: number
) => {
  await assertCoordinator(section_id, school_id, teacherId);
  return getAttendanceBySection(section_id, school_id, academic_year_id);
};

// ── GET BY ID ─────────────────────────────────────────────────────────────────

export const getAttendanceByIdService = async (
  id: number,
  school_id: number
) => {
  const attendance = await getAttendanceById(id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);
  const details = await getAttendanceDetails(id, school_id);
  return { ...attendance, details };
};

// ── UPDATE ATTENDANCE ─────────────────────────────────────────────────────────

export const updateAttendanceService = async (
  id: number,
  school_id: number,
  data: IUpdateAttendance
) => {
  const attendance = await getAttendanceById(id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);

  if (attendance.status === 'submitted') {
    throw new AppError('Cannot edit submitted attendance.', 400);
  }

  const updated = await updateAttendance(id, school_id, data);
  return updated;
};

// ── SUBMIT ATTENDANCE ─────────────────────────────────────────────────────────

export const submitAttendanceService = async (
  id: number,
  school_id: number
) => {
  const attendance = await getAttendanceById(id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);

  if (attendance.status === 'submitted') {
    throw new AppError('Attendance already submitted.', 400);
  }

  return updateAttendance(id, school_id, { status: 'submitted' });
};

// ── UPDATE DETAIL ─────────────────────────────────────────────────────────────

export const updateAttendanceDetailService = async (
  id: number,
  school_id: number,
  data: IUpdateAttendanceDetail,
  attendance_id: number
) => {
  const attendance = await getAttendanceById(attendance_id, school_id);
  if (!attendance) throw new AppError('Attendance record not found.', 404);

  if (attendance.status === 'submitted') {
    throw new AppError('Cannot edit a submitted attendance record.', 400);
  }

  // ── Date lock: cannot edit attendance before the 1st of the previous month ──
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
  const total_late    = allDetails.filter(d => d.status === 'late').length;
  const total_leave   = allDetails.filter(d => d.status === 'leave').length;

  await updateAttendanceCounts(
    attendance_id, school_id,
    total_present, total_absent, total_late, total_leave
  );

  return detail;
};

// ── STUDENT ATTENDANCE SUMMARY ────────────────────────────────────────────────

export const getStudentAttendanceSummaryService = async (
  student_id: number,
  school_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<IAttendanceSummary> => {
  const [summary, workingDays] = await Promise.all([
    getStudentAttendanceSummary(student_id, school_id, academic_year_id, start_date, end_date),
    calculateWorkingDays(school_id, academic_year_id, start_date, end_date),
  ]);

  const total_present = Number(summary.total_present || 0);
  const total_absent  = Number(summary.total_absent  || 0);
  const total_late    = Number(summary.total_late    || 0);
  const total_leave   = Number(summary.total_leave   || 0);

  const attendance_percentage = workingDays.working_days > 0
    ? Math.min(100, Math.round((total_present / workingDays.working_days) * 10000) / 100)
    : 100;

  return {
    total_working_days: workingDays.working_days,
    total_present,
    total_absent,
    total_late,
    total_leave,
    attendance_percentage,
  };
};

export const getStudentMonthlyAttendanceService = async (
  student_id: number,
  school_id: number,
  year: number,
  month: number
) => {
  return getStudentMonthlyAttendance(student_id, school_id, year, month);
};

// ── CLASS ATTENDANCE OVERVIEW ─────────────────────────────────────────────────

export const getClassAttendanceOverviewService = async (
  school_id: number,
  class_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
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
      total_late:     Number(sec.total_late   || 0),
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

// ── ALL-CLASSES OVERVIEW ──────────────────────────────────────────────────────

export const getAllClassesAttendanceOverviewService = async (
  school_id: number,
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
    getAllClassesAttendanceOverview(
      school_id, academic_year_id,
      current_start, current_end,
      prev_start, prev_end
    ),
    calculateWorkingDays(school_id, academic_year_id, current_start, current_end),
    calculateWorkingDays(school_id, academic_year_id, prev_start,    prev_end),
  ]);

  return {
    classes,
    current_month: { start: current_start, end: current_end, working_days: currentWD.working_days },
    prev_month:    { start: prev_start,    end: prev_end,    working_days: prevWD.working_days    },
  };
};

// ── SECTION TEACHER HISTORY ───────────────────────────────────────────────────

export const assignSectionTeacherService = async (
  school_id: number,
  data: ICreateSectionTeacherHistory
) => {
  const history = await getSectionTeacherHistory(data.section_id, school_id);
  const current = history.find(h => !h.to_date);

  if (current) {
    const today = new Date().toISOString().split('T')[0];
    await updateSectionTeacherHistory(current.id, school_id, today);
  }

  return createSectionTeacherHistory(school_id, data);
};

export const getSectionTeacherHistoryService = async (
  section_id: number,
  school_id: number
) => {
  return getSectionTeacherHistory(section_id, school_id);
};

// ── ADMIN SECTION SUMMARY ─────────────────────────────────────────────────────

export const getAdminSectionSummaryService = async (
  school_id: number,
  academic_year_id: number
) => {
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

  const sections = await getAdminSectionSummary(
    school_id, academic_year_id,
    cur_start, cur_end,
    prev_start, prev_end
  );

  return {
    sections,
    current_month: { label: cur_start.slice(0, 7), start: cur_start, end: cur_end  },
    prev_month:    { label: prev_start.slice(0, 7), start: prev_start, end: prev_end },
  };
};
