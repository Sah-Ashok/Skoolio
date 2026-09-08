import { Router } from 'express';
import {
  registerSchool, loginSchool, loginTeacher, loginStudent,
  logout, getMe, forgotPassword, verifyResetOTP, resetPassword, verify2FA,
  changeTeacherPassword, changeStudentPassword,
  sendRegistrationOTP, verifyRegistrationOTP,
} from '../Controllers/auth.controller';
import protect     from '../middlewares/auth.middleware';
import restrictTo  from '../middlewares/role.middleware';
import { strictAuthLimiter } from '../middlewares/rateLimiter.middleware';

import { loginFinance } from '../Controllers/finance.controller';

const router = Router();

router.post('/register/send-otp',  strictAuthLimiter, sendRegistrationOTP);
router.post('/register/verify-otp', strictAuthLimiter, verifyRegistrationOTP);
router.post('/register',           registerSchool);
router.post('/login',              strictAuthLimiter, loginSchool);
router.post('/login/teacher',      strictAuthLimiter, loginTeacher);
router.post('/login/student',      strictAuthLimiter, loginStudent);
router.post('/login/finance',      strictAuthLimiter, loginFinance);
router.post('/logout',             logout);
router.get ('/me',    protect,     getMe);

// ── Forgot password (3-step) ──
router.post('/forgot-password',    strictAuthLimiter, forgotPassword);
router.post('/verify-reset-otp',   strictAuthLimiter, verifyResetOTP);
router.post('/reset-password',     strictAuthLimiter, resetPassword);

// ── 2FA verification (after admin login with 2FA enabled) ──
router.post('/verify-2fa',         strictAuthLimiter, verify2FA);

// ── Self-service password change (teacher / student) ──
router.post('/change-password/teacher', protect, restrictTo('faculty'), changeTeacherPassword);
router.post('/change-password/student', protect, restrictTo('student'), changeStudentPassword);

export default router;
