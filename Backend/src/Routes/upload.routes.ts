import { Router } from 'express';
import protect    from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import upload     from '../middlewares/upload.middleware';
import {
  uploadLogo,
  uploadTeacherPhoto,
  uploadStudentPhoto,
  uploadStudentPhotoChunk,
  uploadTeacherPhotoChunk,
} from '../Controllers/upload.controller';

const router = Router();

// All upload routes require admin authentication
router.use(protect, restrictTo('admin', 'super_admin'));

// POST /api/upload/logo
// Body: multipart/form-data  field name: "logo"
router.post('/logo',                upload.single('logo'),  uploadLogo);

// POST /api/upload/teacher-photo/:id
// Body: multipart/form-data  field name: "photo"
router.post('/teacher-photo/:id',   upload.single('photo'), uploadTeacherPhoto);

// POST /api/upload/student-photo/:id
// Body: multipart/form-data  field name: "photo"
router.post('/student-photo/:id',         upload.single('photo'), uploadStudentPhoto);

// POST /api/upload/student-photo/:id/chunk
// Chunked upload — one 512 KB slice at a time, field name: "chunk"
// Headers: x-upload-id, x-chunk-index, x-total-chunks, x-mime-type
router.post('/student-photo/:id/chunk',   upload.single('chunk'), uploadStudentPhotoChunk);

// POST /api/upload/teacher-photo/:id/chunk
router.post('/teacher-photo/:id/chunk',   upload.single('chunk'), uploadTeacherPhotoChunk);

export default router;
