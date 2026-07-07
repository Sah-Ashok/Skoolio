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

// All routes protected — admin only
router.use(protect, restrictTo('admin', 'super_admin'));

router.post('/', createAcademicYear);
router.get('/', getAcademicYears);
router.get('/active', getActiveAcademicYear);
router.get('/:id', getAcademicYearById);
router.patch('/:id', updateAcademicYear);
router.delete('/:id', deleteAcademicYear);

export default router;