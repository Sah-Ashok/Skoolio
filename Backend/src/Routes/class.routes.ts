import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createClass, getClasses, getClassById, updateClass, deleteClass,
  addSection, getSections, updateSection, deleteSection,
  createSubject, getSubjects, updateSubject, deleteSubject,
  assignSubject, getClassSubjects, removeSubject,
  assignSubjectTeacher, removeSubjectTeacher,
  getSubjectTeachers, getMySubjectClasses,
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

// Apply admin guard to everything below
router.use(protect, restrictTo('admin', 'super_admin'));

// ── SUBJECT ROUTES (before /:id to avoid path collision) ──
router.post  ('/subjects',    createSubject);
router.get   ('/subjects',    getSubjects);
router.patch ('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

// ── SUBJECT-TEACHER ASSIGNMENT ──
// Assign / remove teacher to a subject+class combination
router.post  ('/assign-subject-teacher', assignSubjectTeacher);
router.delete('/remove-subject-teacher', removeSubjectTeacher);

// ── CLASS-LEVEL SUBJECT ASSIGNMENT (bulk, used by AddClassForm) ──
router.post  ('/assign-subject',  assignSubject);
router.delete('/remove-subject',  removeSubject);

// ── CLASS CRUD ──
router.post('/', createClass);
router.get ('/', getClasses);
router.get ('/:id', getClassById);
router.patch('/:id', updateClass);
router.delete('/:id', deleteClass);

// ── SECTION ROUTES (under /:classId) ──
router.post('/:classId/sections', addSection);
router.get ('/:classId/sections', getSections);
router.patch('/sections/:id',     updateSection);
router.delete('/sections/:id',    deleteSection);

// ── CLASS SUBJECTS (read) ──
router.get('/:classId/subjects',         getClassSubjects);
router.get('/:classId/subject-teachers', getSubjectTeachers);

export default router;
