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
  uploadPaymentScreenshot,
  uploadQrCode,
} from '../Controllers/upload.controller';

const router = Router();

router.use(protect);

// ── Admin uploads ────────────────────────────────────────────────────────────
router.post('/logo',                      restrictTo('admin', 'super_admin'), upload.single('logo'),       uploadLogo);
router.post('/teacher-photo/:id',         restrictTo('admin', 'super_admin'), upload.single('photo'),      uploadTeacherPhoto);
router.post('/student-photo/:id',         restrictTo('admin', 'super_admin'), upload.single('photo'),      uploadStudentPhoto);
router.post('/student-photo/:id/chunk',   restrictTo('admin', 'super_admin'), upload.single('chunk'),      uploadStudentPhotoChunk);
router.post('/teacher-photo/:id/chunk',   restrictTo('admin', 'super_admin'), upload.single('chunk'),      uploadTeacherPhotoChunk);
router.post('/qr-code/:account_id',       restrictTo('admin', 'super_admin'), upload.single('qr'),         uploadQrCode);

// ── Student: payment screenshot upload ──────────────────────────────────────
// Student uploads screenshot first, gets back URL, then includes URL in the payment request body
router.post('/payment-screenshot', restrictTo('student'), upload.single('screenshot'), uploadPaymentScreenshot);

export default router;
