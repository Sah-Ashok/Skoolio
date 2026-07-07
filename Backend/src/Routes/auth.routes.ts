import { Router } from 'express';
import {
  registerSchool, loginSchool, loginTeacher, loginStudent,
  logout, getMe, forgotPassword, verifyResetOTP, resetPassword, verify2FA,
} from '../Controllers/auth.controller';
import protect from '../middlewares/auth.middleware';

const router = Router();

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

export default router;
