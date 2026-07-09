import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES     = 2 * 1024 * 1024; // 2 MB

const fileFilter = (
  _req:  Request,
  file:  Express.Multer.File,
  cb:    FileFilterCallback
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG or WebP images are allowed.'));
  }
};

// Memory storage — buffer is available as req.file.buffer
const upload = multer({
  storage:   multer.memoryStorage(),
  limits:    { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

export default upload;
