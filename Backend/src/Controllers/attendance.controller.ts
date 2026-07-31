import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createAttendanceService, getAttendanceBySectionService,
  getAttendanceByIdService, updateAttendanceService, submitAttendanceService,
  deleteAttendanceService,
  updateAttendanceDetailService, getStudentAttendanceSummaryService,
  getStudentMonthlyAttendanceService, assignSectionTeacherService,
  getSectionTeacherHistoryService,
  getClassAttendanceOverviewService, getAllClassesAttendanceOverviewService,
  getAdminSectionSummaryService,
  getSectionRegisterService,
} from '../Service/attendance.service';

// ── ATTENDANCE CONTROLLERS (ADMIN / FACULTY) ──

export const createAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const teacherId = 'school_id' in user ? (user as IJwtUserPayload).id : undefined;
  req.body.marked_by = user.id;
  const result = await createAttendanceService(school_id, req.body, teacherId);
  sendResponse(res, 201, true, 'Attendance marked successfully', result);
});

export const getAttendanceBySection = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const teacherId = 'school_id' in user ? (user as IJwtUserPayload).id : undefined;
  const { academic_year_id } = req.query;
  if (!academic_year_id) return sendResponse(res, 400, false, 'academic_year_id is required', null);
  const result = await getAttendanceBySectionService(
    Number(req.params.sectionId), school_id, Number(academic_year_id), teacherId
  );
  sendResponse(res, 200, true, 'Attendance fetched successfully', result);
});

export const getAttendanceById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const result = await getAttendanceByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Attendance fetched successfully', result);
});

export const updateAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const result = await updateAttendanceService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Attendance updated successfully', result);
});

export const submitAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const result = await submitAttendanceService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Attendance submitted successfully', result);
});

// ── DELETE ATTENDANCE (faculty only — for unsuspending a class) ──
// Only allows deletion of is_holiday=true (suspension) records.
// Submitted normal attendance cannot be deleted by teacher — admin only.
export const deleteAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const teacherId = 'school_id' in user ? (user as IJwtUserPayload).id : undefined;
  await deleteAttendanceService(Number(req.params.id), school_id, teacherId);
  sendResponse(res, 200, true, 'Attendance record deleted successfully', null);
});

export const updateAttendanceDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const { attendance_id } = req.body;
  if (!attendance_id || isNaN(Number(attendance_id))) {
    return sendResponse(res, 400, false, 'attendance_id is required and must be a valid number', null);
  }
  const result = await updateAttendanceDetailService(
    Number(req.params.id), school_id, req.body, Number(attendance_id)
  );
  sendResponse(res, 200, true, 'Attendance detail updated successfully', result);
});

// ── STUDENT ATTENDANCE SUMMARY (ADMIN + FACULTY) ──
export const getStudentAttendanceSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const timezone  = user.timezone ?? 'UTC';
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getStudentAttendanceSummaryService(
    Number(req.params.id), school_id, Number(academic_year_id), timezone,
  );
  sendResponse(res, 200, true, 'Attendance summary fetched successfully', result);
});

export const getStudentMonthlyAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const { year, month, academic_year_id } = req.query;
  if (!year || !month) {
    return sendResponse(res, 400, false, 'year and month are required', null);
  }
  const result = await getStudentMonthlyAttendanceService(
    Number(req.params.id), school_id, Number(year), Number(month),
    academic_year_id ? Number(academic_year_id) : undefined
  );
  sendResponse(res, 200, true, 'Monthly attendance fetched successfully', result);
});

// ── CLASS ATTENDANCE OVERVIEW (ADMIN) ──

export const getClassAttendanceOverview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, start_date, end_date } = req.query;
  if (!academic_year_id || !start_date || !end_date) {
    return sendResponse(res, 400, false, 'academic_year_id, start_date and end_date are required', null);
  }
  const result = await getClassAttendanceOverviewService(
    school_id, Number(req.params.classId), Number(academic_year_id),
    String(start_date), String(end_date)
  );
  sendResponse(res, 200, true, 'Class attendance overview fetched successfully', result);
});

export const getAllClassesAttendanceOverview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getAllClassesAttendanceOverviewService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'All classes attendance overview fetched successfully', result);
});

// ── SECTION TEACHER HISTORY (ADMIN) ──

export const assignSectionTeacher = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await assignSectionTeacherService(school_id, req.body);
  sendResponse(res, 201, true, 'Section teacher assigned successfully', result);
});

export const getSectionTeacherHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const result = await getSectionTeacherHistoryService(
    Number(req.params.sectionId), school_id
  );
  sendResponse(res, 200, true, 'Section teacher history fetched successfully', result);
});

// ── SELF-SERVICE (STUDENT'S OWN ATTENDANCE) ──
//
// GET /attendance/me/summary?academic_year_id=X
//   Returns full academic-year summary (working days, present, absent, %).
//   Dates are computed server-side from admission_date and academic year bounds.
//
// GET /attendance/me/summary?academic_year_id=X&start_date=Y&end_date=Z
//   Returns date-range summary — used by dashboard period tabs (this_month / last_month).
//   When start_date + end_date are provided they OVERRIDE the server-computed bounds.
export const getMyAttendanceSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id, timezone } = req.user as IJwtUserPayload;
  const { academic_year_id, start_date, end_date } = req.query;

  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }

  const result = await getStudentAttendanceSummaryService(
    id, school_id, Number(academic_year_id), timezone,
    // Pass optional date overrides — service will use them when provided
    start_date ? String(start_date) : undefined,
    end_date   ? String(end_date)   : undefined,
  );
  sendResponse(res, 200, true, 'Your attendance summary fetched successfully', result);
});

export const getMyMonthlyAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const { year, month, academic_year_id } = req.query;
  if (!year || !month) {
    return sendResponse(res, 400, false, 'year and month are required', null);
  }
  const result = await getStudentMonthlyAttendanceService(
    id, school_id, Number(year), Number(month),
    academic_year_id ? Number(academic_year_id) : undefined
  );
  sendResponse(res, 200, true, 'Your monthly attendance fetched successfully', result);
});

// ── ADMIN SECTION SUMMARY (read-only) ──

export const getAdminSectionSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getAdminSectionSummaryService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Section attendance summary fetched successfully', result);
});

// ── SECTION REGISTER ──
export const getSectionRegister = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const teacherId = 'school_id' in user ? (user as IJwtUserPayload).id : undefined;
  const { year, month, academic_year_id, start_date, end_date } = req.query;
  const hasDateRange = Boolean(start_date && end_date);
  if (!academic_year_id || (!hasDateRange && (!year || !month))) {
    return sendResponse(res, 400, false, 'academic_year_id plus either start_date/end_date or year/month are required', null);
  }
  const fallbackYear = Number(year);
  const fallbackMonth = Number(month);
  const startDate = hasDateRange
    ? String(start_date)
    : `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-01`;
  const endDate = hasDateRange
    ? String(end_date)
    : `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-${String(new Date(fallbackYear, fallbackMonth, 0).getDate()).padStart(2, '0')}`;
  const result = await getSectionRegisterService(
    Number(req.params.sectionId), school_id, Number(academic_year_id),
    startDate, endDate, teacherId
  );
  sendResponse(res, 200, true, 'Section register fetched successfully', result);
});
