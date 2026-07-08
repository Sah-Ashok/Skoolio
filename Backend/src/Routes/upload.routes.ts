import { Router }   from 'express';
import protect     from '../middlewares/auth.middleware';
import restrictTo  from '../middlewares/role.middleware';
import { uploadSingle }                     from '../middlewares/upload.middleware';
import {
  uploadLogoController,
  uploadTeacherPhotoController,
  uploadStudentPhotoController,
} from '../Controllers/upload.controller';

const router = Router();

// All upload endpoints are admin-only
router.use(protect, restrictTo('admin', 'super_admin'));

// POST /api/upload/logo
// multipart/form-data  field: photo
router.post('/logo',                    uploadSingle, uploadLogoController);

// POST /api/upload/teacher-photo/:id
// multipart/form-data  field: photo
router.post('/teacher-photo/:id',       uploadSingle, uploadTeacherPhotoController);

// POST /api/upload/student-photo/:id
// multipart/form-data  field: photo
router.post('/student-photo/:id',       uploadSingle, uploadStudentPhotoController);

export default router;
