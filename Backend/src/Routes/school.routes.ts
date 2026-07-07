import { Router } from 'express';
import protect     from '../middlewares/auth.middleware';
import restrictTo  from '../middlewares/role.middleware';
import {
  getSettings, updateSettings, changePassword, toggleTwoFA,
} from '../Controllers/school.controller';
import {
  blockSchool, unblockSchool,
} from '../Controllers/auth.controller';

const router = Router();

// School admin — own school settings
router.get ('/settings',         protect, restrictTo('admin'),             getSettings);
router.patch('/settings',        protect, restrictTo('admin'),             updateSettings);
router.patch('/change-password', protect, restrictTo('admin'),             changePassword);

// Super admin — manage any school
router.patch('/:schoolId/toggle-2fa', protect, restrictTo('super_admin'), toggleTwoFA);
router.patch('/:schoolId/block',      protect, restrictTo('super_admin'), blockSchool);
router.patch('/:schoolId/unblock',    protect, restrictTo('super_admin'), unblockSchool);

export default router;
