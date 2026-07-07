import {
  createExam, getExamsBySchool, getExamById, updateExam, deleteExam,
  createExamSchedule, getSchedulesByExam, getScheduleById, updateExamSchedule, deleteExamSchedule,
  createExamResult, getResultsByExamAndClass, getResultsByStudent, getStudentAllResults,
  getResultById, updateExamResult, publishExamResults,
  createGradeScale, getGradeScalesBySchool, getGradeByPercentage, updateGradeScale, deleteGradeScale,
} from '../Repositories/exam.repository';
import {
  ICreateExam, IUpdateExam, ICreateExamSchedule, IUpdateExamSchedule,
  ICreateExamResult, IUpdateExamResult, ICreateGradeScale, IUpdateGradeScale,
} from '../types/exam.types';
import { syncExamCalendarEventService } from './calendar.service';
import { isTeacherAssignedToSubjectInClass } from '../Repositories/class.repository';
import AppError from '../utils/AppError';

// ── EXAM SERVICES ──

export const createExamService = async (school_id: number, data: ICreateExam) => {
  if (new Date(data.start_date) > new Date(data.end_date)) {
    throw new AppError('Start date cannot be after end date.', 400);
  }
  const exam = await createExam(school_id, data);

  // Auto-sync to the school calendar so exam dates show up there without
  // the admin having to re-enter them manually on the Calendar page.
  await syncExamCalendarEventService(school_id, exam);

  return exam;
};

export const getExamsService = async (school_id: number, academic_year_id: number) => {
  const exams = await getExamsBySchool(school_id, academic_year_id);
  return exams;
};

export const getExamByIdService = async (id: number, school_id: number) => {
  const exam = await getExamById(id, school_id);
  if (!exam) throw new AppError('Exam not found.', 404);
  return exam;
};

export const updateExamService = async (id: number, school_id: number, data: IUpdateExam) => {
  const exam = await updateExam(id, school_id, data);
  if (!exam) throw new AppError('Exam not found.', 404);

  // Keep the linked calendar entry in sync with any date/name changes
  await syncExamCalendarEventService(school_id, exam);

  return exam;
};

export const deleteExamService = async (id: number, school_id: number) => {
  const exam = await getExamById(id, school_id);
  if (!exam) throw new AppError('Exam not found.', 404);

  const deleted = await deleteExam(id, school_id);
  if (!deleted) throw new AppError('Failed to delete exam.', 500);
};

// ── EXAM SCHEDULE SERVICES ──

export const createExamScheduleService = async (
  school_id: number,
  data: ICreateExamSchedule
) => {
  const exam = await getExamById(data.exam_id, school_id);
  if (!exam) throw new AppError('Exam not found.', 404);

  if (data.pass_marks > data.max_marks) {
    throw new AppError('Pass marks cannot be greater than max marks.', 400);
  }

  const schedule = await createExamSchedule(school_id, data);
  return schedule;
};

export const getExamSchedulesService = async (exam_id: number, school_id: number) => {
  const schedules = await getSchedulesByExam(exam_id, school_id);
  return schedules;
};

export const updateExamScheduleService = async (
  id: number,
  school_id: number,
  data: IUpdateExamSchedule
) => {
  const schedule = await updateExamSchedule(id, school_id, data);
  if (!schedule) throw new AppError('Exam schedule not found.', 404);
  return schedule;
};

export const deleteExamScheduleService = async (id: number, school_id: number) => {
  const schedule = await getScheduleById(id, school_id);
  if (!schedule) throw new AppError('Exam schedule not found.', 404);

  const deleted = await deleteExamSchedule(id, school_id);
  if (!deleted) throw new AppError('Failed to delete exam schedule.', 500);
};

// ── GRADE CALCULATION HELPER ──

const calculateGradeDetails = async (
  school_id: number,
  marks_obtained: number | undefined,
  max_marks: number,
  pass_marks: number,
  is_absent: boolean
) => {
  if (is_absent || marks_obtained === undefined) {
    return { percentage: null, grade: null, gpa: null, is_passed: false };
  }

  const percentage = Math.round((marks_obtained / max_marks) * 100 * 100) / 100;
  const is_passed = marks_obtained >= pass_marks;

  const gradeScale = await getGradeByPercentage(school_id, percentage);
  const grade = gradeScale?.grade || null;
  const gpa = gradeScale?.gpa || null;

  return { percentage, grade, gpa, is_passed };
};

// ── EXAM RESULT SERVICES ──

export const createExamResultService = async (
  school_id: number,
  data: ICreateExamResult,
  requester_teacher_id?: number  // undefined = admin (bypass), number = faculty (enforce)
) => {
  const schedule = await getScheduleById(data.schedule_id, school_id);
  if (!schedule) throw new AppError('Exam schedule not found.', 404);

  // P1: Faculty may only enter marks for subjects they are assigned to teach in this class.
  if (requester_teacher_id !== undefined) {
    const assigned = await isTeacherAssignedToSubjectInClass(
      requester_teacher_id,
      schedule.class_id,
      schedule.subject_id,
      school_id
    );
    if (!assigned) {
      throw new AppError(
        'You are not assigned to teach this subject in this class and cannot enter results for it.',
        403
      );
    }
  }

  if (!data.is_absent && data.marks_obtained !== undefined) {
    if (data.marks_obtained > data.max_marks) {
      throw new AppError(`Marks obtained cannot exceed max marks of ${data.max_marks}.`, 400);
    }
    if (data.marks_obtained < 0) {
      throw new AppError('Marks obtained cannot be negative.', 400);
    }
  }

  const { percentage, grade, gpa, is_passed } = await calculateGradeDetails(
    school_id,
    data.marks_obtained,
    data.max_marks,
    data.pass_marks,
    data.is_absent || false
  );

  const result = await createExamResult(school_id, data, percentage, grade, gpa, is_passed);
  return result;
};

export const getClassResultsService = async (
  exam_id: number,
  class_id: number,
  school_id: number
) => {
  const results = await getResultsByExamAndClass(exam_id, class_id, school_id);
  return results;
};

export const getStudentExamResultsService = async (
  student_id: number,
  exam_id: number,
  school_id: number
) => {
  const results = await getResultsByStudent(student_id, exam_id, school_id);
  return results;
};

export const getStudentAllResultsService = async (
  student_id: number,
  school_id: number,
  academic_year_id: number
) => {
  const results = await getStudentAllResults(student_id, school_id, academic_year_id);
  return results;
};

export const updateExamResultService = async (
  id: number,
  school_id: number,
  data: IUpdateExamResult,
  requester_teacher_id?: number  // undefined = admin (bypass), number = faculty (enforce)
) => {
  const existing = await getResultById(id, school_id);
  if (!existing) throw new AppError('Exam result not found.', 404);

  if (existing.status === 'published') {
    throw new AppError('Cannot edit a published result.', 400);
  }

  // P1: Faculty may only update marks for subjects they are assigned to teach.
  if (requester_teacher_id !== undefined) {
    // Derive class_id from the linked schedule
    const schedule = await getScheduleById(existing.schedule_id, school_id);
    if (schedule) {
      const assigned = await isTeacherAssignedToSubjectInClass(
        requester_teacher_id,
        schedule.class_id,
        existing.subject_id,
        school_id
      );
      if (!assigned) {
        throw new AppError(
          'You are not assigned to teach this subject in this class and cannot edit results for it.',
          403
        );
      }
    }
  }

  const marks = data.marks_obtained ?? existing.marks_obtained;
  const is_absent = data.is_absent ?? existing.is_absent;

  if (!is_absent && marks !== undefined && marks > existing.max_marks) {
    throw new AppError(`Marks obtained cannot exceed max marks of ${existing.max_marks}.`, 400);
  }

  const { percentage, grade, gpa, is_passed } = await calculateGradeDetails(
    school_id,
    marks,
    existing.max_marks,
    existing.pass_marks,
    is_absent
  );

  const result = await updateExamResult(id, school_id, data, percentage, grade, gpa, is_passed);
  return result;
};

export const publishExamResultsService = async (
  exam_id: number,
  class_id: number,
  school_id: number
) => {
  const exam = await getExamById(exam_id, school_id);
  if (!exam) throw new AppError('Exam not found.', 404);

  const count = await publishExamResults(exam_id, class_id, school_id);
  if (count === 0) throw new AppError('No results found to publish.', 404);

  return { published_count: count };
};

// ── GRADE SCALE SERVICES ──

export const createGradeScaleService = async (
  school_id: number,
  data: ICreateGradeScale
) => {
  if (data.min_percentage > data.max_percentage) {
    throw new AppError('Min percentage cannot be greater than max percentage.', 400);
  }
  const scale = await createGradeScale(school_id, data);
  return scale;
};

export const getGradeScalesService = async (school_id: number) => {
  const scales = await getGradeScalesBySchool(school_id);
  return scales;
};

export const updateGradeScaleService = async (
  id: number,
  school_id: number,
  data: IUpdateGradeScale
) => {
  const scale = await updateGradeScale(id, school_id, data);
  if (!scale) throw new AppError('Grade scale not found.', 404);
  return scale;
};

export const deleteGradeScaleService = async (id: number, school_id: number) => {
  const deleted = await deleteGradeScale(id, school_id);
  if (!deleted) throw new AppError('Grade scale not found.', 404);
};