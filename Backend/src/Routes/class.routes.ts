import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createClass, getClasses, getClassById, updateClass, deleteClass,
  addSection, getSections, updateSection, deleteSection,
  createSubject, getSubjects, updateSubject, deleteSubject,
  assignSubject, getClassSubjects, removeSubject,
  assignSubjectTeacher, removeSubjectTeacher,
  getSubjectTeachers, getMySubjectClasses, getMyCoordinatedSections,
} from '../Controllers/class.controller';

const router = Router();

// ── FACULTY self-service routes (must be before admin-only middleware) ──
// GET /classes/me/subject-classes — subjects this teacher is assigned to teach
router.get(
  '/me/subject-classes',
  protect,
  restrictTo('faculty'),
  getMySubjectClasses
);

// GET /classes/me/coordinated-sections — sections where this teacher is coordinator
router.get(
  '/me/coordinated-sections',
  protect,
  restrictTo('faculty'),
  getMyCoordinatedSections
);

// Apply protect guard to everything below
router.use(protect);

// ── SUBJECT ROUTES (before /:id to avoid path collision) ──
router.post  ('/subjects',    restrictTo('admin', 'super_admin'), createSubject);
router.get   ('/subjects',    restrictTo('admin', 'super_admin'), getSubjects);
router.patch ('/subjects/:id', restrictTo('admin', 'super_admin'), updateSubject);
router.delete('/subjects/:id', restrictTo('admin', 'super_admin'), deleteSubject);

// ── SUBJECT-TEACHER ASSIGNMENT ──
// Assign / remove teacher to a subject+class combination
router.post  ('/assign-subject-teacher', restrictTo('admin', 'super_admin'), assignSubjectTeacher);
router.delete('/remove-subject-teacher', restrictTo('admin', 'super_admin'), removeSubjectTeacher);

// ── CLASS-LEVEL SUBJECT ASSIGNMENT (bulk, used by AddClassForm) ──
router.post  ('/assign-subject',  restrictTo('admin', 'super_admin'), assignSubject);
router.delete('/remove-subject',  restrictTo('admin', 'super_admin'), removeSubject);

// ── CLASS CRUD ──
router.post('/',   restrictTo('admin', 'super_admin'), createClass);
router.get ('/',   restrictTo('admin', 'super_admin', 'finance'), getClasses);
router.get ('/:id', restrictTo('admin', 'super_admin', 'finance'), getClassById);
router.patch('/:id', restrictTo('admin', 'super_admin'), updateClass);
router.delete('/:id', restrictTo('admin', 'super_admin'), deleteClass);

// ── SECTION ROUTES (under /:classId) ──
router.post('/:classId/sections',  restrictTo('admin', 'super_admin'), addSection);
router.get ('/:classId/sections',  restrictTo('admin', 'super_admin', 'finance'), getSections);
router.patch('/sections/:id',      restrictTo('admin', 'super_admin'), updateSection);
router.delete('/sections/:id',     restrictTo('admin', 'super_admin'), deleteSection);

// ── CLASS SUBJECTS (read) ──
router.get('/:classId/subjects',         restrictTo('admin', 'super_admin'), getClassSubjects);
router.get('/:classId/subject-teachers', restrictTo('admin', 'super_admin'), getSubjectTeachers);

export default router;
