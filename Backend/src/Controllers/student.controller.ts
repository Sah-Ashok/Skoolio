import { Request, Response, NextFunction } from 'express';
import pool from '../config/db';
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
import { getEnrollmentById, updateEnrollment as updateEnrollmentRepo } from '../Repositories/student.repository';
import { getSectionsByCoordinator } from '../Repositories/teacher.repository';
import AppError from '../utils/AppError';

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
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const student_id = Number(req.params.id);

  // Faculty: verify student is in one of their coordinated sections
  if (user.role === 'faculty') {
    const teacher_id = (user as IJwtUserPayload).id;
    const mySections = await getSectionsByCoordinator(teacher_id, school_id);
    const sectionIds = mySections.map((s: any) => s.id);
    if (sectionIds.length === 0) throw new AppError('You are not assigned as coordinator of any section.', 403);

    const result = await pool.query(
      `SELECT 1 FROM student_enrollments
       WHERE school_id = $1
         AND student_id = $2
         AND section_id = ANY($3::int[])
         AND status = 'active'
       LIMIT 1`,
      [school_id, student_id, sectionIds]
    );
    if (!result.rows.length) throw new AppError('This student is not in your section.', 403);
  }

  const student = await getStudentByIdService(student_id, school_id);
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
  const enrollment = await createEnrollmentService(school_id, { ...req.body, created_by: school_id });
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

// PATCH /students/enrollments/:id/roll — Faculty only
// Teacher can update roll_number and remarks for students in their own sections only.
export const updateEnrollmentRoll = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: teacher_id, school_id } = req.user as IJwtUserPayload;
  const enrollment_id = Number(req.params.id);
  const { roll_number, remarks } = req.body;

  // 1. Fetch the enrollment
  const enrollment = await getEnrollmentById(enrollment_id, school_id);
  if (!enrollment) throw new AppError('Enrollment not found.', 404);

  // 2. Verify this teacher coordinates the section
  const mySections = await getSectionsByCoordinator(teacher_id, school_id);
  const allowed = mySections.some(s => s.id === enrollment.section_id);
  if (!allowed) throw new AppError('You are not the coordinator of this section.', 403);

  // 3. Only allow roll_number and remarks to be changed
  const updated = await updateEnrollmentRepo(enrollment_id, school_id, {
    roll_number: roll_number ?? undefined,
    remarks:     remarks     ?? undefined,
  });

  sendResponse(res, 200, true, 'Roll number updated successfully', updated);
});
