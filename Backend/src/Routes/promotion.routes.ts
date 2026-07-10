import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getStudentsForPromotion,
  bulkPromote,
  getSectionsForClass,
} from '../Controllers/promotion.controller';

const router = Router();

router.use(protect);
router.use(restrictTo('admin', 'super_admin'));

// GET  /api/promotion/students?academic_year_id=X&class_id=Y
router.get('/students', getStudentsForPromotion);

// GET  /api/promotion/sections?class_id=Y
router.get('/sections', getSectionsForClass);

// POST /api/promotion/bulk
router.post('/bulk', bulkPromote);

export default router;
