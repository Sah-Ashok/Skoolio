import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getHistory,
  getHistoryModules,
  getHistoryForSchool,
  purgeSchoolHistory,
  purgeAllHistory,
} from '../Controllers/history.controller';

const router = Router();
router.use(protect);

// ── SCHOOL ADMIN — own school's logs ──
router.get('/',        restrictTo('admin'), getHistory);
router.get('/modules', restrictTo('admin'), getHistoryModules);

// ── SUPER ADMIN — any school's logs + purge ──
router.get   ('/school/:school_id',        restrictTo('super_admin'), getHistoryForSchool);
router.delete('/school/:school_id/purge',  restrictTo('super_admin'), purgeSchoolHistory);
router.delete('/purge-all',                restrictTo('super_admin'), purgeAllHistory);

export default router;
