import { Router } from 'express';
import protect    from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  adminSubmitFeedback, teacherSubmitFeedback,
  adminGetFeedback, teacherGetMyFeedback,
  superAdminGetAllFeedback, superAdminGetStats,
  superAdminUpdateFeedback, deleteFeedbackCtrl,
} from '../Controllers/feedback.controller';

const router = Router();

// ── Super admin ───────────────────────────────────────────────
router.get   ('/super/all',    protect, restrictTo('super_admin'), superAdminGetAllFeedback);
router.get   ('/super/stats',  protect, restrictTo('super_admin'), superAdminGetStats);
router.patch ('/super/:id',    protect, restrictTo('super_admin'), superAdminUpdateFeedback);

// ── Admin ─────────────────────────────────────────────────────
router.post  ('/admin',        protect, restrictTo('admin', 'super_admin'), adminSubmitFeedback);
router.get   ('/admin',        protect, restrictTo('admin', 'super_admin'), adminGetFeedback);

// ── Teacher ───────────────────────────────────────────────────
router.post  ('/teacher',      protect, restrictTo('faculty'),              teacherSubmitFeedback);
router.get   ('/teacher/mine', protect, restrictTo('faculty'),              teacherGetMyFeedback);

// ── Shared delete ─────────────────────────────────────────────
router.delete('/:id',          protect, restrictTo('admin', 'faculty', 'super_admin'), deleteFeedbackCtrl);

export default router;
