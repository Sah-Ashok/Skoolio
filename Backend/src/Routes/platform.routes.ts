import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import { getPlatformSettings, updatePlatformSettings } from '../Controllers/platform.controller';

const router = Router();

router.use(protect, restrictTo('super_admin'));

router.get('/', getPlatformSettings);
router.patch('/', updatePlatformSettings);

export default router;
