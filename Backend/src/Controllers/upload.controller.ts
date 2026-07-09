import { Request, Response, NextFunction } from 'express';
import path from 'path';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { uploadToAzure, getLogoBlob, getTeacherBlob, getStudentBlob } from '../utils/azureStorage';
import { IJwtAdminPayload } from '../types/auth.types';
import pool from '../config/db';

const LOGOS_CONTAINER    = process.env.AZURE_LOGOS_CONTAINER    || 'skoolio-logos';
const PROFILES_CONTAINER = process.env.AZURE_PROFILES_CONTAINER || 'skoolio-profiles';

// ── helper: extract file extension from mimetype ──────────────────────────────
const extFromMime = (mime: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
  };
  return map[mime] ?? 'jpg';
};

// ── POST /upload/logo ────────────────────────────────────────────────────────
// Uploads to skoolio-logos/{school_id}.{ext}
// Updates schools.logo with the blob URL.
export const uploadLogo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No image file provided.', null);
  }

  const { id: school_id } = req.user as IJwtAdminPayload;
  const ext      = extFromMime(req.file.mimetype);
  const blobName = getLogoBlob(school_id, ext);

  const url = await uploadToAzure(
    LOGOS_CONTAINER,
    blobName,
    req.file.buffer,
    req.file.mimetype
  );

  // Update schools.logo
  await pool.query(
    `UPDATE schools SET logo = $1, updated_at = NOW() WHERE id = $2`,
    [url, school_id]
  );

  sendResponse(res, 200, true, 'Logo uploaded successfully.', { url });
});

// ── POST /upload/teacher-photo/:id ─────────────────────────────────────────
// Uploads to skoolio-profiles/teachers/{school_id}/{teacher_id}.{ext}
// Updates teachers.photo with the blob URL.
export const uploadTeacherPhoto = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No image file provided.', null);
  }

  const { id: school_id } = req.user as IJwtAdminPayload;
  const teacher_id        = Number(req.params.id);

  if (!teacher_id) {
    return sendResponse(res, 400, false, 'Invalid teacher id.', null);
  }

  // Verify teacher belongs to this school
  const check = await pool.query(
    `SELECT id FROM teachers WHERE id = $1 AND school_id = $2`,
    [teacher_id, school_id]
  );
  if (!check.rows.length) {
    return sendResponse(res, 404, false, 'Teacher not found.', null);
  }

  const ext      = extFromMime(req.file.mimetype);
  const blobName = getTeacherBlob(school_id, teacher_id, ext);

  const url = await uploadToAzure(
    PROFILES_CONTAINER,
    blobName,
    req.file.buffer,
    req.file.mimetype
  );

  await pool.query(
    `UPDATE teachers SET photo = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
    [url, teacher_id, school_id]
  );

  sendResponse(res, 200, true, 'Teacher photo uploaded successfully.', { url });
});

// ── POST /upload/student-photo/:id ─────────────────────────────────────────
// Uploads to skoolio-profiles/students/{school_id}/{student_id}.{ext}
// Updates students.photo with the blob URL.
export const uploadStudentPhoto = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No image file provided.', null);
  }

  const { id: school_id } = req.user as IJwtAdminPayload;
  const student_id        = Number(req.params.id);

  if (!student_id) {
    return sendResponse(res, 400, false, 'Invalid student id.', null);
  }

  // Verify student belongs to this school
  const check = await pool.query(
    `SELECT id FROM students WHERE id = $1 AND school_id = $2`,
    [student_id, school_id]
  );
  if (!check.rows.length) {
    return sendResponse(res, 404, false, 'Student not found.', null);
  }

  const ext      = extFromMime(req.file.mimetype);
  const blobName = getStudentBlob(school_id, student_id, ext);

  const url = await uploadToAzure(
    PROFILES_CONTAINER,
    blobName,
    req.file.buffer,
    req.file.mimetype
  );

  await pool.query(
    `UPDATE students SET photo = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
    [url, student_id, school_id]
  );

  sendResponse(res, 200, true, 'Student photo uploaded successfully.', { url });
});
