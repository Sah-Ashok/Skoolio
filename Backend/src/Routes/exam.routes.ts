import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createExam, getExams, getExamById, updateExam, deleteExam,
  createExamSchedule, getExamSchedules, updateExamSchedule, deleteExamSchedule,
  createExamResult, getClassResults, getStudentExamResults, getStudentAllResults,
  updateExamResult, publishExamResults,
  createGradeScale, getGradeScales, updateGradeScale, deleteGradeScale,
  getMyResults,
} from '../Controllers/exam.controller';

const router = Router();

router.use(protect);

// ── SELF-SERVICE ROUTES (student's own results) ──
router.get('/me/results', restrictTo('student'), getMyResults);

// ── EXAM ROUTES (ADMIN creates, FACULTY can view) ──
router.post('/', restrictTo('admin', 'super_admin'), createExam);
router.get('/', restrictTo('admin', 'super_admin', 'faculty'), getExams);
router.get('/:id', restrictTo('admin', 'super_admin', 'faculty'), getExamById);
router.patch('/:id', restrictTo('admin', 'super_admin'), updateExam);
router.delete('/:id', restrictTo('admin', 'super_admin'), deleteExam);

// ── EXAM SCHEDULE ROUTES ──
router.post('/schedules', restrictTo('admin', 'super_admin'), createExamSchedule);
router.get('/:examId/schedules', restrictTo('admin', 'super_admin', 'faculty'), getExamSchedules);
router.patch('/schedules/:id', restrictTo('admin', 'super_admin'), updateExamSchedule);
router.delete('/schedules/:id', restrictTo('admin', 'super_admin'), deleteExamSchedule);

// ── EXAM RESULT ROUTES (FACULTY enters marks for their subjects, ADMIN can do everything) ──
router.post('/results', restrictTo('admin', 'super_admin', 'faculty'), createExamResult);
router.get('/:examId/class/:classId/results', restrictTo('admin', 'super_admin', 'faculty'), getClassResults);
router.get('/:examId/student/:studentId/results', restrictTo('admin', 'super_admin', 'faculty'), getStudentExamResults);
router.get('/student/:id/all-results', restrictTo('admin', 'super_admin'), getStudentAllResults);
router.patch('/results/:id', restrictTo('admin', 'super_admin', 'faculty'), updateExamResult);
router.post('/results/publish', restrictTo('admin', 'super_admin'), publishExamResults);

// ── GRADE SCALE ROUTES ──
router.post('/grade-scales', restrictTo('admin', 'super_admin'), createGradeScale);
router.get('/grade-scales', restrictTo('admin', 'super_admin', 'faculty'), getGradeScales);
router.patch('/grade-scales/:id', restrictTo('admin', 'super_admin'), updateGradeScale);
router.delete('/grade-scales/:id', restrictTo('admin', 'super_admin'), deleteGradeScale);

export default router;
