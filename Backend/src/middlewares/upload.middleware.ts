import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES     = 2 * 1024 * 1024; // 2 MB

const fileFilter = (
  _req:  Request,
  file:  Express.Multer.File,
  cb:    FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WebP images are allowed.'));
  }
};

/**
 * Multer middleware — memory storage, 2 MB cap, images only.
 * Accepts a single file in the `photo` field.
 */
const upload = multer({
  storage:  multer.memoryStorage(),
  limits:   { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

export const uploadSingle = upload.single('photo');
