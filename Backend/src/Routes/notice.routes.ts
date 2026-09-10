import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createNoticeAdmin,
  createNoticeTeacher,
  getNoticesAdmin,
  getNoticesTeacher,
  getNoticesStudent,
  updateNotice,
  deleteNotice,
} from '../Controllers/notice.controller';

const router = Router();

// ── Admin & Finance routes ────────────────────────────────────
// Admin & Finance: create school-wide notice
router.post('/admin',  protect, restrictTo('admin', 'super_admin', 'finance'), createNoticeAdmin);

// Admin & Finance: get all notices for the school
router.get('/admin',   protect, restrictTo('admin', 'super_admin', 'finance'), getNoticesAdmin);

// ── Teacher routes ────────────────────────────────────────────
// Teacher: create section-scoped notice
router.post('/teacher',  protect, restrictTo('faculty'), createNoticeTeacher);

// Teacher: get notices visible to them
router.get('/teacher',   protect, restrictTo('faculty'), getNoticesTeacher);

// ── Student routes ────────────────────────────────────────────
// Student: get notices visible to them (school-wide + own section)
router.get('/student',   protect, restrictTo('student'), getNoticesStudent);

// ── Shared routes (admin, teacher, or finance, with ownership check) ────
router.patch('/:id',  protect, restrictTo('admin', 'super_admin', 'faculty', 'finance'), updateNotice);
router.delete('/:id', protect, restrictTo('admin', 'super_admin', 'faculty', 'finance'), deleteNotice);

export default router;
