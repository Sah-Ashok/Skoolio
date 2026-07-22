import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createStudentService, getStudentsService, getStudentByIdService,
  updateStudentService, deleteStudentService,
  createEnrollmentService, getEnrollmentsService,
  getStudentEnrollmentsService, updateEnrollmentService,
  searchStudentsService,
} from '../Service/student.service';

// ── STUDENT CONTROLLERS (ADMIN) ──

export const createStudent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const student = await createStudentService(school_id, req.body);
  sendResponse(res, 201, true, 'Student created successfully', student);
});

export const getStudents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const students = await getStudentsService(school_id);
  sendResponse(res, 200, true, 'Students fetched successfully', students);
});

export const searchStudents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) return sendResponse(res, 400, false, 'Query must be at least 2 characters', null);
  const results = await searchStudentsService(school_id, q);
  sendResponse(res, 200, true, 'Students found', results);
});

export const getStudentById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const student = await getStudentByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Student fetched successfully', student);
});

export const updateStudent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const student = await updateStudentService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Student updated successfully', student);
});

export const deleteStudent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteStudentService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Student deleted successfully', null);
});

// ── ENROLLMENT CONTROLLERS (ADMIN) ──

export const createEnrollment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const enrollment = await createEnrollmentService(school_id, req.body);
  sendResponse(res, 201, true, 'Student enrolled successfully', enrollment);
});

export const getEnrollments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const { academic_year_id, section_id } = req.query;

  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }

  const enrollments = await getEnrollmentsService(
    school_id,
    Number(academic_year_id),
    section_id ? Number(section_id) : undefined
  );
  sendResponse(res, 200, true, 'Enrollments fetched successfully', enrollments);
});

export const getStudentEnrollments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const enrollments = await getStudentEnrollmentsService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Student enrollments fetched successfully', enrollments);
});

export const updateEnrollment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const enrollment = await updateEnrollmentService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Enrollment updated successfully', enrollment);
});

// ── SELF-SERVICE CONTROLLERS (STUDENT'S OWN DATA) ──

export const getMyProfile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const student = await getStudentByIdService(id, school_id);
  sendResponse(res, 200, true, 'Profile fetched successfully', student);
});

export const getMyEnrollments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const enrollments = await getStudentEnrollmentsService(id, school_id);
  sendResponse(res, 200, true, 'Enrollments fetched successfully', enrollments);
});
