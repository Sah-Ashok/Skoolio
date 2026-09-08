import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createStudent, getStudents, getStudentById, updateStudent, deleteStudent,
  createEnrollment, getEnrollments, getStudentEnrollments, updateEnrollment,
  updateEnrollmentRoll,
  getMyProfile, getMyEnrollments, searchStudents,
} from '../Controllers/student.controller';

const router = Router();

router.use(protect);

// ── SELF-SERVICE (student's own data) — MUST be before /:id ──
router.get('/me/profile',     restrictTo('student'),                          getMyProfile);
router.get('/me/enrollments', restrictTo('student'),                          getMyEnrollments);

// ── ENROLLMENT ROUTES — MUST be before /:id ──
router.post('/enrollments',           restrictTo('admin', 'super_admin'),                    createEnrollment);
router.get('/enrollments',            restrictTo('admin', 'super_admin', 'faculty', 'finance'), getEnrollments);
router.patch('/enrollments/:id',      restrictTo('admin', 'super_admin'),                    updateEnrollment);
router.patch('/enrollments/:id/roll', restrictTo('faculty'),                                 updateEnrollmentRoll);

// ── STUDENT CRUD ──
router.post('/',              restrictTo('admin', 'super_admin'),                             createStudent);
router.get('/',               restrictTo('admin', 'super_admin', 'finance'),                  getStudents);
router.get('/search',         restrictTo('admin', 'super_admin', 'finance'),                  searchStudents);
router.get('/:id',            restrictTo('admin', 'super_admin', 'faculty', 'finance'),          getStudentById);  // faculty: section-scoped in controller
router.patch('/:id',          restrictTo('admin', 'super_admin'),                             updateStudent);
router.delete('/:id',         restrictTo('admin', 'super_admin'),                             deleteStudent);

// ── STUDENT ENROLLMENT HISTORY ──
router.get('/:id/enrollments', restrictTo('admin', 'super_admin', 'finance'),                   getStudentEnrollments);

export default router;
