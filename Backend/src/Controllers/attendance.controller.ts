import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createAttendanceService, getAttendanceBySectionService,
  getAttendanceByIdService, updateAttendanceService, submitAttendanceService,
  updateAttendanceDetailService, getStudentAttendanceSummaryService,
  getStudentMonthlyAttendanceService, assignSectionTeacherService,
  getSectionTeacherHistoryService,
  getClassAttendanceOverviewService, getAllClassesAttendanceOverviewService,
  getAdminSectionSummaryService,
} from '../Service/attendance.service';

// ── ATTENDANCE CONTROLLERS (ADMIN / FACULTY) ──

export const createAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const teacherId = 'school_id' in user ? (user as IJwtUserPayload).id : undefined;

  // Block future-date attendance marking
  const today = new Date().toISOString().split('T')[0];
  if (req.body.date && String(req.body.date) > today) {
    return sendResponse(res, 400, false, 'Cannot mark attendance for a future date.', null);
  }

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

export const updateAttendanceDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const { attendance_id } = req.body;
  const result = await updateAttendanceDetailService(
    Number(req.params.id),
    school_id,
    req.body,
    Number(attendance_id)
  );
  sendResponse(res, 200, true, 'Attendance detail updated successfully', result);
});

// ── STUDENT ATTENDANCE SUMMARY (ADMIN) ──

export const getStudentAttendanceSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id, start_date, end_date } = req.query;

  if (!academic_year_id || !start_date || !end_date) {
    return sendResponse(res, 400, false, 'academic_year_id, start_date and end_date are required', null);
  }

  const result = await getStudentAttendanceSummaryService(
    Number(req.params.id),
    school_id,
    Number(academic_year_id),
    String(start_date),
    String(end_date)
  );
  sendResponse(res, 200, true, 'Attendance summary fetched successfully', result);
});

export const getStudentMonthlyAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { year, month } = req.query;

  if (!year || !month) {
    return sendResponse(res, 400, false, 'year and month are required', null);
  }

  const result = await getStudentMonthlyAttendanceService(
    Number(req.params.id),
    school_id,
    Number(year),
    Number(month)
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
    school_id,
    Number(req.params.classId),
    Number(academic_year_id),
    String(start_date),
    String(end_date)
  );
  sendResponse(res, 200, true, 'Class attendance overview fetched successfully', result);
});

export const getAllClassesAttendanceOverview = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;

  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }

  const result = await getAllClassesAttendanceOverviewService(
    school_id,
    Number(academic_year_id)
  );
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
    Number(req.params.sectionId),
    school_id
  );
  sendResponse(res, 200, true, 'Section teacher history fetched successfully', result);
});

// ── SELF-SERVICE CONTROLLERS (STUDENT'S OWN ATTENDANCE) ──

export const getMyAttendanceSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const { academic_year_id, start_date, end_date } = req.query;

  if (!academic_year_id || !start_date || !end_date) {
    return sendResponse(res, 400, false, 'academic_year_id, start_date and end_date are required', null);
  }

  const result = await getStudentAttendanceSummaryService(
    id,
    school_id,
    Number(academic_year_id),
    String(start_date),
    String(end_date)
  );
  sendResponse(res, 200, true, 'Your attendance summary fetched successfully', result);
});

export const getMyMonthlyAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const { year, month } = req.query;

  if (!year || !month) {
    return sendResponse(res, 400, false, 'year and month are required', null);
  }

  const result = await getStudentMonthlyAttendanceService(
    id,
    school_id,
    Number(year),
    Number(month)
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
