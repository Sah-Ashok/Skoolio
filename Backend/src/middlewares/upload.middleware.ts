import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES     = 4 * 1024 * 1024; // 4 MB per chunk

const fileFilter = (
  req:   Request,
  file:  Express.Multer.File,
  cb:    FileFilterCallback
) => {
  // For chunked uploads the browser may label each slice as
  // "application/octet-stream" even when the original file is image/png.
  // In that case we trust the x-mime-type header sent by the frontend,
  // which always carries the original File.type.
  const effectiveMime =
    file.mimetype === 'application/octet-stream'
      ? (req.headers['x-mime-type'] as string) || file.mimetype
      : file.mimetype;

  if (ALLOWED_MIME_TYPES.includes(effectiveMime)) {
    // Normalise so the controller sees the real type
    file.mimetype = effectiveMime;
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
