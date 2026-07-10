import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createNoticeAdmin,
  createNoticeTeacher,
  getNoticesAdmin,
  getNoticesTeacher,
  updateNotice,
  deleteNotice,
} from '../Controllers/notice.controller';

const router = Router();

// ── Admin routes ──────────────────────────────────────────────
// Admin: create school-wide notice
router.post('/admin',  protect, restrictTo('admin', 'super_admin'), createNoticeAdmin);

// Admin: get all notices for the school
router.get('/admin',   protect, restrictTo('admin', 'super_admin'), getNoticesAdmin);

// ── Teacher routes ────────────────────────────────────────────
// Teacher: create section-scoped notice
router.post('/teacher',  protect, restrictTo('faculty'), createNoticeTeacher);

// Teacher: get notices visible to them
router.get('/teacher',   protect, restrictTo('faculty'), getNoticesTeacher);

// ── Shared routes (admin or teacher, with ownership check) ────
router.patch('/:id',  protect, restrictTo('admin', 'super_admin', 'faculty'), updateNotice);
router.delete('/:id', protect, restrictTo('admin', 'super_admin', 'faculty'), deleteNotice);

export default router;
