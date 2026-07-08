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

// All other routes — admin only
router.use(protect, restrictTo('admin', 'super_admin'));

router.post('/', createAcademicYear);
router.get('/', getAcademicYears);
router.get('/:id', getAcademicYearById);
router.patch('/:id', updateAcademicYear);
router.delete('/:id', deleteAcademicYear);

export default router;