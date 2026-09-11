import { Request, Response, NextFunction } from 'express';
import path from 'path';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import {
  uploadToAzure,
  SCHOOL_DATA_CONTAINER,
  resolveSchoolStorageFolder,
  getLogoBlob,
  getTeacherBlob,
  getStudentBlob,
  getPaymentScreenshotBlob,
  getQrCodeBlob,
} from '../utils/azureStorage';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import pool from '../config/db';

// ── In-memory chunk store (keyed by uploadId) ─────────────────────────────────
const chunkStore = new Map<string, {
  chunks:     Buffer[];
  totalChunks: number;
  mimeType:   string;
  received:   number;
}>();

const CHUNK_TTL_MS = 10 * 60 * 1000;
function scheduleCleanup(uploadId: string) {
  setTimeout(() => chunkStore.delete(uploadId), CHUNK_TTL_MS);
}

const extFromMime = (mime: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/webp': 'webp',
  };
  return map[mime] ?? 'jpg';
};

// ── POST /upload/logo ────────────────────────────────────────────────────────
export const uploadLogo = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const file = req.file || (req.files as any)?.logo?.[0] || (req.files as any)?.photo?.[0];
  if (!file) {
    return sendResponse(res, 400, false, 'No image file provided.', null);
  }

  const user     = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const folder   = user.storage_folder || await resolveSchoolStorageFolder(school_id);
  const ext      = extFromMime(file.mimetype);
  const blobName = getLogoBlob(folder, ext);

  const url = await uploadToAzure(SCHOOL_DATA_CONTAINER, blobName, file.buffer, file.mimetype);

  await pool.query(
    `UPDATE schools SET logo = $1, updated_at = NOW() WHERE id = $2`,
    [url, school_id]
  );

  sendResponse(res, 200, true, 'Logo uploaded successfully.', { url });
});

// ── POST /upload/teacher-photo/:id ─────────────────────────────────────────
export const uploadTeacherPhoto = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No image file provided.', null);
  }

  const { id: school_id } = req.user as IJwtAdminPayload;
  const teacher_id        = Number(req.params.id);

  if (!teacher_id) {
    return sendResponse(res, 400, false, 'Invalid teacher id.', null);
  }

  const check = await pool.query(
    `SELECT id FROM teachers WHERE id = $1 AND school_id = $2`,
    [teacher_id, school_id]
  );
  if (!check.rows.length) {
    return sendResponse(res, 404, false, 'Teacher not found.', null);
  }

  const ext      = extFromMime(req.file.mimetype);
  const folder   = (req.user as IJwtAdminPayload).storage_folder || await resolveSchoolStorageFolder(school_id);
  const blobName = getTeacherBlob(folder, teacher_id, ext);
  const url      = await uploadToAzure(SCHOOL_DATA_CONTAINER, blobName, req.file.buffer, req.file.mimetype);

  await pool.query(
    `UPDATE teachers SET photo = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
    [url, teacher_id, school_id]
  );

  sendResponse(res, 200, true, 'Teacher photo uploaded successfully.', { url });
});

// ── POST /upload/student-photo/:id ─────────────────────────────────────────
export const uploadStudentPhoto = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No image file provided.', null);
  }

  const { id: school_id } = req.user as IJwtAdminPayload;
  const student_id        = Number(req.params.id);

  if (!student_id) {
    return sendResponse(res, 400, false, 'Invalid student id.', null);
  }

  const check = await pool.query(
    `SELECT id FROM students WHERE id = $1 AND school_id = $2`,
    [student_id, school_id]
  );
  if (!check.rows.length) {
    return sendResponse(res, 404, false, 'Student not found.', null);
  }

  const ext      = extFromMime(req.file.mimetype);
  const folder   = (req.user as IJwtAdminPayload).storage_folder || await resolveSchoolStorageFolder(school_id);
  const blobName = getStudentBlob(folder, student_id, ext);
  const url      = await uploadToAzure(SCHOOL_DATA_CONTAINER, blobName, req.file.buffer, req.file.mimetype);

  await pool.query(
    `UPDATE students SET photo = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
    [url, student_id, school_id]
  );

  sendResponse(res, 200, true, 'Student photo uploaded successfully.', { url });
});

// ── POST /upload/student-photo/:id/chunk ────────────────────────────────
export const uploadStudentPhotoChunk = catchAsync(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No chunk provided.', null);
  }

  const uploadId    = req.headers['x-upload-id']    as string;
  const chunkIndex  = Number(req.headers['x-chunk-index']);
  const totalChunks = Number(req.headers['x-total-chunks']);
  const mimeType    = req.headers['x-mime-type']    as string || req.file.mimetype;

  if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks < 1) {
    return sendResponse(res, 400, false, 'Missing or invalid chunk headers.', null);
  }

  if (!chunkStore.has(uploadId)) {
    chunkStore.set(uploadId, { chunks: new Array(totalChunks), totalChunks, mimeType, received: 0 });
    scheduleCleanup(uploadId);
  }

  const entry = chunkStore.get(uploadId)!;
  entry.chunks[chunkIndex] = req.file.buffer;
  entry.received += 1;

  if (entry.received < entry.totalChunks) {
    return sendResponse(res, 200, true, 'Chunk received.', { received: entry.received, total: entry.totalChunks });
  }

  const fullBuffer = Buffer.concat(entry.chunks);
  chunkStore.delete(uploadId);

  const { id: school_id } = req.user as IJwtAdminPayload;
  const student_id        = Number(req.params.id);

  if (!student_id) {
    return sendResponse(res, 400, false, 'Invalid student id.', null);
  }

  const check = await pool.query(
    `SELECT id FROM students WHERE id = $1 AND school_id = $2`,
    [student_id, school_id]
  );
  if (!check.rows.length) {
    return sendResponse(res, 404, false, 'Student not found.', null);
  }

  const ext      = extFromMime(entry.mimeType);
  const folder   = (req.user as IJwtAdminPayload).storage_folder || await resolveSchoolStorageFolder(school_id);
  const blobName = getStudentBlob(folder, student_id, ext);
  const url      = await uploadToAzure(SCHOOL_DATA_CONTAINER, blobName, fullBuffer, entry.mimeType);

  await pool.query(
    `UPDATE students SET photo = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
    [url, student_id, school_id]
  );

  sendResponse(res, 200, true, 'Student photo uploaded successfully.', { url });
});

// ── POST /upload/teacher-photo/:id/chunk ───────────────────────────────
export const uploadTeacherPhotoChunk = catchAsync(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No chunk provided.', null);
  }

  const uploadId    = req.headers['x-upload-id']    as string;
  const chunkIndex  = Number(req.headers['x-chunk-index']);
  const totalChunks = Number(req.headers['x-total-chunks']);
  const mimeType    = req.headers['x-mime-type']    as string || req.file.mimetype;

  if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || totalChunks < 1) {
    return sendResponse(res, 400, false, 'Missing or invalid chunk headers.', null);
  }

  if (!chunkStore.has(uploadId)) {
    chunkStore.set(uploadId, { chunks: new Array(totalChunks), totalChunks, mimeType, received: 0 });
    scheduleCleanup(uploadId);
  }

  const entry = chunkStore.get(uploadId)!;
  entry.chunks[chunkIndex] = req.file.buffer;
  entry.received += 1;

  if (entry.received < entry.totalChunks) {
    return sendResponse(res, 200, true, 'Chunk received.', { received: entry.received, total: entry.totalChunks });
  }

  const fullBuffer = Buffer.concat(entry.chunks);
  chunkStore.delete(uploadId);

  const { id: school_id } = req.user as IJwtAdminPayload;
  const teacher_id        = Number(req.params.id);

  if (!teacher_id) {
    return sendResponse(res, 400, false, 'Invalid teacher id.', null);
  }

  const check = await pool.query(
    `SELECT id FROM teachers WHERE id = $1 AND school_id = $2`,
    [teacher_id, school_id]
  );
  if (!check.rows.length) {
    return sendResponse(res, 404, false, 'Teacher not found.', null);
  }

  const ext      = extFromMime(entry.mimeType);
  const folder   = (req.user as IJwtAdminPayload).storage_folder || await resolveSchoolStorageFolder(school_id);
  const blobName = getTeacherBlob(folder, teacher_id, ext);
  const url      = await uploadToAzure(SCHOOL_DATA_CONTAINER, blobName, fullBuffer, entry.mimeType);

  await pool.query(
    `UPDATE teachers SET photo = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
    [url, teacher_id, school_id]
  );

  sendResponse(res, 200, true, 'Teacher photo uploaded successfully.', { url });
});

// ── POST /upload/payment-screenshot ─────────────────────────────────────────
// Student uploads a payment screenshot. Returns the Azure URL.
// The URL is then included in the payment request body.
export const uploadPaymentScreenshot = catchAsync(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return sendResponse(res, 400, false, 'No screenshot file provided.', null);
  }

  const { id: student_id, school_id } = req.user as IJwtUserPayload;
  const folder    = (req.user as IJwtUserPayload).storage_folder || await resolveSchoolStorageFolder(school_id);
  const ext       = extFromMime(req.file.mimetype);
  const timestamp = Date.now();
  const blobName  = getPaymentScreenshotBlob(folder, student_id, timestamp, ext);

  const url = await uploadToAzure(SCHOOL_DATA_CONTAINER, blobName, req.file.buffer, req.file.mimetype);

  sendResponse(res, 200, true, 'Screenshot uploaded successfully.', { url });
});

// ── POST /upload/qr-code/:account_id ────────────────────────────────────────
// Admin/Finance uploads a QR code image for a specific bank account.
// Returns the Azure URL to be saved in the bank account record.
export const uploadQrCode = catchAsync(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const file = req.file || (req.files as any)?.qr?.[0] || (req.files as any)?.photo?.[0];
  if (!file) {
    return sendResponse(res, 400, false, 'No QR code image provided.', null);
  }

  const user      = req.user as IJwtAdminPayload | IJwtUserPayload;
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const account_id = Number(req.params.account_id);

  if (!account_id) {
    return sendResponse(res, 400, false, 'Invalid bank account id.', null);
  }

  // Verify the bank account belongs to this school
  const check = await pool.query(
    `SELECT id FROM school_bank_accounts WHERE id = $1 AND school_id = $2`,
    [account_id, school_id]
  );
  if (!check.rows.length) {
    return sendResponse(res, 404, false, 'Bank account not found.', null);
  }

  const ext      = extFromMime(file.mimetype);
  const folder   = user.storage_folder || await resolveSchoolStorageFolder(school_id);
  const blobName = getQrCodeBlob(folder, account_id, ext);
  const url      = await uploadToAzure(SCHOOL_DATA_CONTAINER, blobName, file.buffer, file.mimetype);

  // Persist the URL back into the bank account row
  await pool.query(
    `UPDATE school_bank_accounts SET qr_image_url = $1, updated_at = NOW() WHERE id = $2 AND school_id = $3`,
    [url, account_id, school_id]
  );

  sendResponse(res, 200, true, 'QR code uploaded successfully.', { url });
});
