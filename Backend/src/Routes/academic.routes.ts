import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createAcademicYear,
  getAcademicYears,
  getAcademicYearById,
  getActiveAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
} from '../Controllers/academic.controller';

const router = Router();

// GET /active — needed by teacher + student portals for academic_year_id context
// Must be declared BEFORE the admin-only middleware below
router.get('/active', protect,  getActiveAcademicYear);

// All other routes
router.use(protect);

router.post('/',   restrictTo('admin', 'super_admin'), createAcademicYear);
router.get('/',    restrictTo('admin', 'super_admin', 'finance'), getAcademicYears);
router.get('/:id', restrictTo('admin', 'super_admin', 'finance'), getAcademicYearById);
router.patch('/:id', restrictTo('admin', 'super_admin'), updateAcademicYear);
router.delete('/:id', restrictTo('admin', 'super_admin'), deleteAcademicYear);

export default router;