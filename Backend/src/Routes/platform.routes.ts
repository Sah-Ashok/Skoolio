import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getPlatformSettings,
  updatePlatformSettings,
  getSystemLogs,
  downloadSystemLogs,
  clearSystemLogs,
  getPlatformVersion,
} from '../Controllers/platform.controller';

const router = Router();

router.get('/version', getPlatformVersion);

router.use(protect, restrictTo('super_admin'));

router.get('/', getPlatformSettings);
router.patch('/', updatePlatformSettings);

router.get('/logs',          getSystemLogs);
router.get('/system-logs',   getSystemLogs);
router.get('/logs/download', downloadSystemLogs);
router.delete('/logs',       clearSystemLogs);

export default router;
