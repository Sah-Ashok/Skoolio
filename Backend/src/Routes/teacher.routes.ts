import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createTeacher, getTeachers, getTeacherById, updateTeacher, deleteTeacher,
  assignSubjectToTeacher, getTeacherSubjects, removeTeacherSubject,
  createSalary, getTeacherSalaries, updateSalary,
  getMyCoordinatorSections, getMySalaries,
  bulkMarkTeacherAttendance, getTeacherAttendanceByDate,
} from '../Controllers/teacher.controller';

const router = Router();

// ── Faculty-accessible routes (before admin-only middleware) ──
router.get('/me/sections', protect, restrictTo('faculty'), getMyCoordinatorSections);
router.get('/me/salary',   protect, restrictTo('faculty'), getMySalaries);

router.use(protect, restrictTo('admin', 'super_admin'));

// ── TEACHER PERSONAL ATTENDANCE ── (static before /:id)
router.post('/attendance/bulk', bulkMarkTeacherAttendance);
router.get ('/attendance',      getTeacherAttendanceByDate);  // ?date=YYYY-MM-DD

// ── TEACHER ROUTES ──
router.post('/', createTeacher);
router.get('/', getTeachers);
router.get('/:id', getTeacherById);
router.patch('/:id', updateTeacher);
router.delete('/:id', deleteTeacher);

// ── TEACHER SUBJECT ROUTES ──
router.post('/assign-subject', assignSubjectToTeacher);
router.get('/:id/subjects', getTeacherSubjects);
router.delete('/remove-subject', removeTeacherSubject);

// ── SALARY ROUTES ──
router.post('/salary', createSalary);
router.get('/:id/salary', getTeacherSalaries);
router.patch('/salary/:id', updateSalary);

export default router;