import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createTeacher, getTeachers, getTeacherById, updateTeacher, deleteTeacher,
  assignSubjectToTeacher, getTeacherSubjects, removeTeacherSubject,
  createSalary, getTeacherSalaries, updateSalary,
  getMyCoordinatorSections, getMySalaries, getMyAttendanceMonthly, getMyAttendanceYearly,
  bulkMarkTeacherAttendance, getTeacherAttendanceByDate,
  getSalarySummary, getAttendanceSummaryForSalary,
} from '../Controllers/teacher.controller';

const router = Router();

router.use(protect);

// ── Faculty-accessible routes ──
router.get('/me/sections',            restrictTo('faculty'), getMyCoordinatorSections);
router.get('/me/salary',              restrictTo('faculty'), getMySalaries);
router.get('/me/attendance/yearly',   restrictTo('faculty'), getMyAttendanceYearly);  // ?academic_year_id=
router.get('/me/attendance',          restrictTo('faculty'), getMyAttendanceMonthly); // ?year=&month=
router.get('/list',                   restrictTo('admin', 'super_admin', 'faculty', 'finance'), getTeachers);
router.get('/',                       restrictTo('admin', 'super_admin', 'faculty', 'finance'), getTeachers);

// ── SALARY SUMMARY + ATTENDANCE PRE-CALC ── (static before /:id)
router.get('/salary/summary',           restrictTo('admin', 'super_admin', 'finance'), getSalarySummary);
router.get('/salary/:id/attendance',    restrictTo('admin', 'super_admin', 'finance'), getAttendanceSummaryForSalary);

// ── SALARY ROUTES ──
router.post('/salary',          restrictTo('admin', 'super_admin', 'finance'), createSalary);
router.get('/:id/salary',       restrictTo('admin', 'super_admin', 'finance'), getTeacherSalaries);
router.patch('/salary/:id',     restrictTo('admin', 'super_admin', 'finance'), updateSalary);

// ── TEACHER PERSONAL ATTENDANCE ──
router.post('/attendance/bulk', restrictTo('admin', 'super_admin'), bulkMarkTeacherAttendance);
router.get ('/attendance',      restrictTo('admin', 'super_admin'), getTeacherAttendanceByDate);  // ?date=YYYY-MM-DD

// ── TEACHER ROUTES ──
router.post('/',                restrictTo('admin', 'super_admin'), createTeacher);
router.get('/:id',              restrictTo('admin', 'super_admin', 'finance'), getTeacherById);
router.patch('/:id',            restrictTo('admin', 'super_admin'), updateTeacher);
router.delete('/:id',           restrictTo('admin', 'super_admin'), deleteTeacher);

// ── TEACHER SUBJECT ROUTES ──
router.post('/assign-subject',  restrictTo('admin', 'super_admin'), assignSubjectToTeacher);
router.get('/:id/subjects',     restrictTo('admin', 'super_admin'), getTeacherSubjects);
router.delete('/remove-subject', restrictTo('admin', 'super_admin'), removeTeacherSubject);

export default router;
