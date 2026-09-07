import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createAttendance, getAttendanceBySection, getAttendanceById,
  updateAttendance, submitAttendance, deleteAttendance, updateAttendanceDetail,
  bulkUpdateAttendanceDetails,
  getStudentAttendanceSummary, getStudentMonthlyAttendance,
  assignSectionTeacher, getSectionTeacherHistory,
  getMyAttendanceSummary, getMyMonthlyAttendance,
  getClassAttendanceOverview, getAllClassesAttendanceOverview,
  getAdminSectionSummary, getSectionRegister,
} from '../Controllers/attendance.controller';

const router = Router();

router.use(protect);

// ── SELF-SERVICE (student's own) — MUST be before /:id ──
router.get('/me/summary', restrictTo('student'), getMyAttendanceSummary);
router.get('/me/monthly', restrictTo('student'), getMyMonthlyAttendance);

// ── ADMIN SECTION SUMMARY (read-only, no mark capability) ──
router.get('/summary/admin', restrictTo('admin', 'super_admin'), getAdminSectionSummary);

// ── ALL CLASSES OVERVIEW (admin home) — static, must be before /:id ──
router.get('/overview/all-classes', restrictTo('admin', 'super_admin'), getAllClassesAttendanceOverview);

// ── CLASS OVERVIEW (admin per-class detail) — before /section/:sectionId ──
router.get('/overview/class/:classId', restrictTo('admin', 'super_admin'), getClassAttendanceOverview);

// ── STUDENT LOOKUP (admin) — MUST be before /:id ──
router.get('/student/:id/summary', restrictTo('admin', 'super_admin', 'faculty'), getStudentAttendanceSummary);
router.get('/student/:id/monthly', restrictTo('admin', 'super_admin', 'faculty'), getStudentMonthlyAttendance);

// ── SECTION TEACHER — MUST be before /section/:sectionId ──
router.post('/section-teacher', restrictTo('admin', 'super_admin'), assignSectionTeacher);
router.get('/section/:sectionId/teacher-history', restrictTo('admin', 'super_admin', 'faculty'), getSectionTeacherHistory);

// ── SECTION ATTENDANCE ──
// Register endpoint MUST be before the generic section/:sectionId (static before dynamic).
// One-call register: returns all month data + year totals in a single SQL query.
router.get('/section/:sectionId/register', restrictTo('admin', 'super_admin', 'faculty'), getSectionRegister);
// Legacy full-year section list (still used by Mark Attendance page for header lookup)
router.get('/section/:sectionId', restrictTo('admin', 'super_admin', 'faculty'), getAttendanceBySection);

// ── ATTENDANCE DETAIL UPDATE — FACULTY ONLY (coordinator + date-lock enforced in service) ──
router.put ('/:id/details/bulk', restrictTo('faculty'), bulkUpdateAttendanceDetails);
router.patch('/:id/details/bulk', restrictTo('faculty'), bulkUpdateAttendanceDetails);
router.patch('/details/:id', restrictTo('faculty'), updateAttendanceDetail);

// ── MAIN ATTENDANCE CRUD — FACULTY ONLY (coordinator check enforced in service) ──
// Admin cannot mark, submit, or update attendance.
router.post  ('/',              restrictTo('faculty'), createAttendance);
router.get   ('/:id',          restrictTo('admin', 'super_admin', 'faculty'), getAttendanceById);
router.patch ('/:id',          restrictTo('faculty'), updateAttendance);
router.patch ('/:id/submit',   restrictTo('faculty'), submitAttendance);
router.delete('/:id',          restrictTo('faculty'), deleteAttendance);

export default router;
