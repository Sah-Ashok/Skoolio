import { Router } from 'express';
import {
  registerSchool, loginSchool, loginTeacher, loginStudent,
  logout, getMe, forgotPassword, verifyResetOTP, resetPassword, verify2FA,
  changeTeacherPassword, changeStudentPassword,
  sendRegistrationOTP, verifyRegistrationOTP,
} from '../Controllers/auth.controller';
import protect     from '../middlewares/auth.middleware';
import restrictTo  from '../middlewares/role.middleware';

const router = Router();

router.post('/register/send-otp',  sendRegistrationOTP);
router.post('/register/verify-otp', verifyRegistrationOTP);
router.post('/register',           registerSchool);
router.post('/login',              loginSchool);
router.post('/login/teacher',      loginTeacher);
router.post('/login/student',      loginStudent);
router.post('/logout',             logout);
router.get ('/me',    protect,     getMe);

// ── Forgot password (3-step) ──
router.post('/forgot-password',    forgotPassword);
router.post('/verify-reset-otp',   verifyResetOTP);
router.post('/reset-password',     resetPassword);

// ── 2FA verification (after admin login with 2FA enabled) ──
router.post('/verify-2fa',         verify2FA);

// ── Self-service password change (teacher / student) ──
router.post('/change-password/teacher', protect, restrictTo('faculty'), changeTeacherPassword);
router.post('/change-password/student', protect, restrictTo('student'), changeStudentPassword);

export default router;
