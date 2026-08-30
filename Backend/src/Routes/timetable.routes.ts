import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getSectionTimetable,
  saveBulkSectionTimetable,
  saveSlot,
  deleteSlot,
  getMyTeacherSchedule,
  getTeacherScheduleById,
  getMyStudentSchedule,
  checkConflict,
} from '../Controllers/timetable.controller';

const router = Router();

router.use(protect);

// Student personal schedule
router.get('/student/my-schedule', restrictTo('student'), getMyStudentSchedule);

// Teacher/Faculty personal schedule
router.get('/teacher/my-schedule', restrictTo('faculty'), getMyTeacherSchedule);
router.get('/teacher/:teacherId', restrictTo('admin', 'super_admin', 'faculty'), getTeacherScheduleById);

// Live conflict check
router.get('/check-conflict', restrictTo('admin', 'super_admin', 'faculty'), checkConflict);

// Section Timetable (Read: admin, faculty, student; Write: admin, faculty)
router.get('/section/:sectionId', restrictTo('admin', 'super_admin', 'faculty', 'student'), getSectionTimetable);
router.post('/section/:sectionId/bulk', restrictTo('admin', 'super_admin', 'faculty'), saveBulkSectionTimetable);
router.post('/slot', restrictTo('admin', 'super_admin', 'faculty'), saveSlot);
router.delete('/slot/:id', restrictTo('admin', 'super_admin', 'faculty'), deleteSlot);

export default router;
