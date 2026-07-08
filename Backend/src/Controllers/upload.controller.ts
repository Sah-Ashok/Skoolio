import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import AppError from '../utils/AppError';
import {
  uploadSchoolLogo,
  uploadTeacherPhoto,
  uploadStudentPhoto,
} from '../utils/azureStorage';
import { IJwtAdminPayload } from '../types/auth.types';

// DB update functions
import { updateSchoolSettingsRepo } from '../Repositories/auth.repository';
import { updateTeacher }             from '../Repositories/teacher.repository';
import { updateStudent }             from '../Repositories/student.repository';

// ── Helpers ───────────────────────────────────────────────────────────────────

const getSchoolId = (req: Request): number =>
  (req.user as IJwtAdminPayload).id;

const getExt = (mimeType: string): string => {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':  return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    default:           return 'jpg';
  }
};

const assertFile = (req: Request): Express.Multer.File => {
  if (!req.file) throw new AppError('No image file uploaded.', 400);
  return req.file;
};

// ── UPLOAD SCHOOL LOGO ────────────────────────────────────────────────────────

export const uploadLogoController = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const file      = assertFile(req);
    const school_id = getSchoolId(req);
    const ext       = getExt(file.mimetype);

    const url = await uploadSchoolLogo(school_id, file.buffer, file.mimetype, ext);

    // Persist URL to DB
    await updateSchoolSettingsRepo(school_id, { logo: url });

    sendResponse(res, 200, true, 'School logo uploaded successfully', { url });
  }
);

// ── UPLOAD TEACHER PHOTO ──────────────────────────────────────────────────────

export const uploadTeacherPhotoController = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const file       = assertFile(req);
    const school_id  = getSchoolId(req);
    const teacher_id = Number(req.params.id);
    const ext        = getExt(file.mimetype);

    if (!teacher_id || isNaN(teacher_id))
      throw new AppError('Invalid teacher ID.', 400);

    const url = await uploadTeacherPhoto(school_id, teacher_id, file.buffer, file.mimetype, ext);

    // Persist URL to DB
    await updateTeacher(teacher_id, school_id, { photo: url } as any);

    sendResponse(res, 200, true, 'Teacher photo uploaded successfully', { url });
  }
);

// ── UPLOAD STUDENT PHOTO ──────────────────────────────────────────────────────

export const uploadStudentPhotoController = catchAsync(
  async (req: Request, res: Response, _next: NextFunction) => {
    const file       = assertFile(req);
    const school_id  = getSchoolId(req);
    const student_id = Number(req.params.id);
    const ext        = getExt(file.mimetype);

    if (!student_id || isNaN(student_id))
      throw new AppError('Invalid student ID.', 400);

    const url = await uploadStudentPhoto(school_id, student_id, file.buffer, file.mimetype, ext);

    // Persist URL to DB
    await updateStudent(student_id, school_id, { photo: url } as any);

    sendResponse(res, 200, true, 'Student photo uploaded successfully', { url });
  }
);
