import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createTeacherService, getTeachersService, getTeacherByIdService,
  updateTeacherService, deleteTeacherService,
  assignSubjectToTeacherService, getTeacherSubjectsService, removeTeacherSubjectService,
  createSalaryService, getTeacherSalariesService, updateSalaryService,
  getSalarySummaryService, getAttendanceSummaryForSalaryService,
  getMyCoordinatorSectionsService,
  bulkMarkTeacherAttendanceService, getTeacherAttendanceByDateService,
} from '../Service/teacher.service';

// ── TEACHER CONTROLLERS ──

export const createTeacher = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const teacher = await createTeacherService(school_id, req.body);
  sendResponse(res, 201, true, 'Teacher created successfully', teacher);
});

export const getTeachers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const teachers = await getTeachersService(school_id);
  sendResponse(res, 200, true, 'Teachers fetched successfully', teachers);
});

export const getTeacherById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const teacher = await getTeacherByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Teacher fetched successfully', teacher);
});

export const updateTeacher = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const teacher = await updateTeacherService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Teacher updated successfully', teacher);
});

export const deleteTeacher = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteTeacherService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Teacher deleted successfully', null);
});

// ── TEACHER SUBJECT CONTROLLERS ──

export const assignSubjectToTeacher = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { teacher_id, subject_id } = req.body;
  const result = await assignSubjectToTeacherService(school_id, teacher_id, subject_id);
  sendResponse(res, 201, true, 'Subject assigned to teacher successfully', result);
});

export const getTeacherSubjects = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const subjects = await getTeacherSubjectsService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Teacher subjects fetched successfully', subjects);
});

export const removeTeacherSubject = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { teacher_id, subject_id } = req.body;
  await removeTeacherSubjectService(teacher_id, subject_id, school_id);
  sendResponse(res, 200, true, 'Subject removed from teacher successfully', null);
});

// ── SALARY CONTROLLERS ──

export const createSalary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const salary = await createSalaryService(school_id, school_id, req.body);
  sendResponse(res, 201, true, 'Salary created successfully', salary);
});

export const getTeacherSalaries = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const salaries = await getTeacherSalariesService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Salaries fetched successfully', salaries);
});

export const updateSalary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const salary = await updateSalaryService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Salary updated successfully', salary);
});

// ── FACULTY SELF-SERVICE ──

export const getMyCoordinatorSections = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: teacher_id, school_id } = req.user as IJwtUserPayload;
  const sections = await getMyCoordinatorSectionsService(teacher_id, school_id);
  sendResponse(res, 200, true, 'Coordinator sections fetched successfully', sections);
});

// ── TEACHER PERSONAL ATTENDANCE ──

export const bulkMarkTeacherAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { date, records } = req.body;
  const results = await bulkMarkTeacherAttendanceService(school_id, date, records);
  sendResponse(res, 200, true, 'Teacher attendance marked successfully', results);
});

export const getTeacherAttendanceByDate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const records = await getTeacherAttendanceByDateService(school_id, date);
  sendResponse(res, 200, true, 'Teacher attendance fetched successfully', records);
});

export const getMySalaries = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: teacher_id, school_id } = req.user as IJwtUserPayload;
  const salaries = await getTeacherSalariesService(teacher_id, school_id);
  sendResponse(res, 200, true, 'Your salary records fetched successfully', salaries);
});

export const getSalarySummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const summary = await getSalarySummaryService(school_id);
  sendResponse(res, 200, true, 'Salary summary fetched successfully', summary);
});

export const getAttendanceSummaryForSalary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const teacher_id = Number(req.params.id);
  const year  = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new Error('year and month query params required');
  const data = await getAttendanceSummaryForSalaryService(school_id, teacher_id, year, month);
  sendResponse(res, 200, true, 'Attendance summary fetched successfully', data);
});