import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createNoticeAdminService,
  createNoticeTeacherService,
  getNoticesAdminService,
  getNoticesTeacherService,
  getNoticesStudentService,
  updateNoticeService,
  deleteNoticeService,
} from '../Service/notice.service';

// ── Helpers ───────────────────────────────────────────────────

const getSchoolId = (user: any): number =>
  'school_id' in user ? user.school_id : user.id;

// ── ADMIN: Create school-wide notice ─────────────────────────

export const createNoticeAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const admin = req.user as IJwtAdminPayload;
  const notice = await createNoticeAdminService(admin.id, admin.school_name, req.body);
  sendResponse(res, 201, true, 'Notice created successfully', notice);
});

// ── TEACHER: Create section-scoped notice ────────────────────

export const createNoticeTeacher = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const teacher = req.user as IJwtUserPayload;
  const notice = await createNoticeTeacherService(
    teacher.school_id,
    teacher.id,
    req.body
  );
  sendResponse(res, 201, true, 'Notice created successfully', notice);
});

// ── ADMIN: Get all school notices ────────────────────────────

export const getNoticesAdmin = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const admin = req.user as IJwtAdminPayload;
  const notices = await getNoticesAdminService(admin.id);
  sendResponse(res, 200, true, 'Notices fetched successfully', notices);
});

// ── TEACHER: Get visible notices ─────────────────────────────

export const getNoticesTeacher = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const teacher = req.user as IJwtUserPayload;
  const notices = await getNoticesTeacherService(teacher.school_id, teacher.id);
  sendResponse(res, 200, true, 'Notices fetched successfully', notices);
});

// ── UPDATE notice ────────────────────────────────────────────

export const updateNotice = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const school_id = getSchoolId(user);
  const role: 'admin' | 'faculty' = user.role === 'faculty' ? 'faculty' : 'admin';
  const requester_id = role === 'admin' ? school_id : user.id;

  const notice = await updateNoticeService(
    Number(req.params.id),
    school_id,
    role,
    requester_id,
    req.body
  );
  sendResponse(res, 200, true, 'Notice updated successfully', notice);
});

// ── DELETE notice ────────────────────────────────────────────

export const deleteNotice = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const school_id = getSchoolId(user);
  const role: 'admin' | 'faculty' = user.role === 'faculty' ? 'faculty' : 'admin';
  const requester_id = role === 'admin' ? school_id : user.id;

  await deleteNoticeService(Number(req.params.id), school_id, role, requester_id);
  sendResponse(res, 200, true, 'Notice deleted successfully', null);
});

// ── STUDENT: Get visible notices ──────────────────────────────

export const getNoticesStudent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const student = req.user as IJwtUserPayload;
  const notices = await getNoticesStudentService(student.school_id, student.id);
  sendResponse(res, 200, true, 'Notices fetched successfully', notices);
});
