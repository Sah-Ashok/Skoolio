import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import { getAdminDashboard } from '../Controllers/dashboard.controller';

const router = Router();

router.get('/', protect, restrictTo('admin', 'super_admin'), getAdminDashboard);

export default router;
