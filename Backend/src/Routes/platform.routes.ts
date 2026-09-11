import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getPlatformSettings,
  updatePlatformSettings,
  getSystemLogs,
  downloadSystemLogs,
  clearSystemLogs,
} from '../Controllers/platform.controller';

const router = Router();

router.use(protect, restrictTo('super_admin'));

router.get('/', getPlatformSettings);
router.patch('/', updatePlatformSettings);

// ── System Log Routes (Super Admin Only) ──
router.get('/logs',          getSystemLogs);
router.get('/system-logs',   getSystemLogs);
router.get('/logs/download', downloadSystemLogs);
router.delete('/logs',       clearSystemLogs);

export default router;
