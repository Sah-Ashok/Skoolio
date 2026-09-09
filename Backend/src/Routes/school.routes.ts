import { Router } from 'express';
import protect     from '../middlewares/auth.middleware';
import restrictTo  from '../middlewares/role.middleware';
import {
  getSettings, updateSettings, changePassword, toggleTwoFA, toggleMyTwoFA,
  getSuperAdminSchoolDetails,
} from '../Controllers/school.controller';
import {
  blockSchool, unblockSchool, verifySchoolById,
} from '../Controllers/auth.controller';

import {
  getFinanceAccount,
  createFinanceAccount,
  updateFinanceAccount,
  deleteFinanceAccount,
  requestRevokeFinanceOTP,
} from '../Controllers/finance.controller';

const router = Router();

// School admin — own school settings
router.get   ('/settings',         protect, restrictTo('admin'), getSettings);
router.put   ('/settings',         protect, restrictTo('admin'), updateSettings);
router.patch ('/settings',         protect, restrictTo('admin'), updateSettings);
router.patch ('/change-password',   protect, restrictTo('admin'), changePassword);
router.patch ('/toggle-2fa',        protect, restrictTo('admin'), toggleMyTwoFA);

// School admin — manage single finance account
router.get   ('/finance-account',            protect, restrictTo('admin', 'super_admin'), getFinanceAccount);
router.post  ('/finance-account',            protect, restrictTo('admin', 'super_admin'), createFinanceAccount);
router.put   ('/finance-account',            protect, restrictTo('admin', 'super_admin'), updateFinanceAccount);
router.post  ('/finance-account/revoke-otp', protect, restrictTo('admin', 'super_admin'), requestRevokeFinanceOTP);
router.delete('/finance-account',            protect, restrictTo('admin', 'super_admin'), deleteFinanceAccount);

// Super admin — manage any school
router.get  ('/:schoolId/details',   protect, restrictTo('super_admin'), getSuperAdminSchoolDetails);
router.patch('/:schoolId/verify',    protect, restrictTo('super_admin'), verifySchoolById);
router.patch('/:schoolId/toggle-2fa', protect, restrictTo('super_admin'), toggleTwoFA);
router.patch('/:schoolId/block',      protect, restrictTo('super_admin'), blockSchool);
router.patch('/:schoolId/unblock',    protect, restrictTo('super_admin'), unblockSchool);

export default router;
