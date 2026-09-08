import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import { getPolicy, upsertPolicy } from '../Controllers/payroll_policy.controller';

const router = Router();

// Admin and Finance
router.use(protect, restrictTo('admin', 'super_admin', 'finance'));

router.get('/',  getPolicy);
router.put('/',  upsertPolicy);

export default router;
