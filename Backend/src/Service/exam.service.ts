import {
  createExam, getExamsBySchool, getExamById, updateExam, deleteExam,
  createExamSchedule, getSchedulesByExam, getScheduleById, updateExamSchedule, deleteExamSchedule,
  createExamResult, getResultsByExamAndClass, getResultsByStudent, getStudentAllResults,
  getResultById, updateExamResult, publishExamResults,
  createGradeScale, getGradeScalesBySchool, getGradeByPercentage, updateGradeScale, deleteGradeScale,
  getStudentExamSchedules, publishExamSchedule, unpublishExamResults, hasPublishedResultsForExam,
  getExamClassRegisterData,
} from '../Repositories/exam.repository';
import {
  ICreateExam, IUpdateExam, ICreateExamSchedule, IUpdateExamSchedule,
  ICreateExamResult, IUpdateExamResult, ICreateGradeScale, IUpdateGradeScale,
} from '../types/exam.types';
import {
  isTeacherAssignedToSubjectInClass, getSectionById, getSectionsByCoordinator,
} from '../Repositories/class.repository';
import AppError from '../utils/AppError';

// ── EXAM SERVICES ──

export const createExamService = async (school_id: number, data: ICreateExam) => {
  if (new Date(data.start_date) > new Date(data.end_date)) {
    throw new AppError('Start date cannot be after end date.', 400);
  }
  const exam = await createExam(school_id, data);
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

  const isPublished = await hasPublishedResultsForExam(data.exam_id, school_id);
  if (isPublished) {
    throw new AppError('Cannot add schedule entries because results for this exam have already been published. Please unpublish results first if changes are required.', 400);
  }

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
  const existing = await getScheduleById(id, school_id);
  if (!existing) throw new AppError('Exam schedule not found.', 404);

  const isPublished = await hasPublishedResultsForExam(existing.exam_id, school_id);
  if (isPublished) {
    throw new AppError('Cannot edit schedule entries because results for this exam have already been published. Please unpublish results first if changes are required.', 400);
  }

  const schedule = await updateExamSchedule(id, school_id, data);
  if (!schedule) throw new AppError('Exam schedule not found.', 404);
  return schedule;
};

export const deleteExamScheduleService = async (id: number, school_id: number) => {
  const schedule = await getScheduleById(id, school_id);
  if (!schedule) throw new AppError('Exam schedule not found.', 404);

  const isPublished = await hasPublishedResultsForExam(schedule.exam_id, school_id);
  if (isPublished) {
    throw new AppError('Cannot delete schedule entries because results for this exam have already been published. Please unpublish results first if changes are required.', 400);
  }

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

export const unpublishExamResultsService = async (
  exam_id: number,
  class_id: number,
  school_id: number
) => {
  const exam = await getExamById(exam_id, school_id);
  if (!exam) throw new AppError('Exam not found.', 404);

  const count = await unpublishExamResults(exam_id, class_id, school_id);
  if (count === 0) throw new AppError('No published results found to unpublish.', 404);

  return { unpublished_count: count };
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

export const getStudentExamSchedulesService = async (
  student_id: number,
  school_id: number,
  academic_year_id?: number
) => {
  return await getStudentExamSchedules(student_id, school_id, academic_year_id);
};

export const publishExamScheduleService = async (
  exam_id: number,
  school_id: number,
  is_published: boolean = true
) => {
  const exam = await getExamById(exam_id, school_id);
  if (!exam) throw new AppError('Exam not found.', 404);
  const updated = await publishExamSchedule(exam_id, school_id, is_published);
  return updated;
};

export const getClassExamRegisterService = async (
  exam_id: number,
  class_id: number,
  section_id: number | null,
  school_id: number,
  requester_teacher_id?: number
) => {
  // If requester is faculty, verify coordinator permission
  if (requester_teacher_id !== undefined) {
    if (section_id) {
      const section = await getSectionById(section_id, school_id);
      if (!section || section.coordinator_id !== requester_teacher_id) {
        throw new AppError('You are not assigned as the coordinator for this section and cannot view the full class register.', 403);
      }
    } else {
      const coordinated = await getSectionsByCoordinator(requester_teacher_id, school_id);
      const isCoordinatingThisClass = coordinated.some((s: any) => s.class_id === class_id);
      if (!isCoordinatingThisClass) {
        throw new AppError('You are not assigned as the coordinator for this class and cannot view the full class register.', 403);
      }
    }
  }

  const rawData = await getExamClassRegisterData(exam_id, class_id, section_id, school_id);
  if (!rawData.exam) throw new AppError('Exam not found.', 404);

  const { exam, classInfo, sectionInfo, subjects, students, results } = rawData;

  // Build results lookup map
  const resultsByStudent = new Map<number, Map<number, any>>();
  results.forEach((r: any) => {
    if (!resultsByStudent.has(r.student_id)) {
      resultsByStudent.set(r.student_id, new Map());
    }
    resultsByStudent.get(r.student_id)!.set(r.subject_id, r);
  });

  // Calculate student rows
  const studentRows = students.map((stu: any) => {
    const studentResults = resultsByStudent.get(stu.student_id) || new Map();
    const marks: Record<string, any> = {};
    let totalObtained = 0;
    let totalMax = 0;
    let passedSubjectsCount = 0;
    let failedSubjectsCount = 0;
    let absentSubjectsCount = 0;
    let totalGpaSum = 0;
    let subjectsWithGpaCount = 0;
    let marksEnteredCount = 0;

    subjects.forEach((sub: any) => {
      const res = studentResults.get(sub.subject_id);
      if (res) {
        marks[sub.subject_id] = res;
        totalMax += Number(res.max_marks || sub.max_marks || 100);
        if (res.is_absent) {
          absentSubjectsCount++;
          failedSubjectsCount++;
        } else if (res.marks_obtained !== null && res.marks_obtained !== undefined) {
          marksEnteredCount++;
          totalObtained += Number(res.marks_obtained);
          if (res.is_passed) passedSubjectsCount++;
          else failedSubjectsCount++;

          if (res.gpa !== null && res.gpa !== undefined) {
            totalGpaSum += Number(res.gpa);
            subjectsWithGpaCount++;
          }
        }
      } else {
        totalMax += Number(sub.max_marks || 100);
        marks[sub.subject_id] = null;
      }
    });

    const hasMarks = marksEnteredCount > 0 || absentSubjectsCount > 0;
    const overallPercentage = totalMax > 0 && hasMarks ? Math.round((totalObtained / totalMax) * 10000) / 100 : null;
    const overallGpa = subjectsWithGpaCount > 0 ? Math.round((totalGpaSum / subjectsWithGpaCount) * 100) / 100 : null;
    const isPassedAll = subjects.length > 0 && passedSubjectsCount === subjects.length;

    return {
      student_id: stu.student_id,
      enrollment_id: stu.enrollment_id,
      admission_number: stu.admission_number,
      full_name: stu.full_name,
      roll_number: stu.roll_number,
      photo: stu.photo,
      gender: stu.gender,
      section_name: stu.section_name,
      marks,
      has_marks: hasMarks,
      total_obtained: totalObtained,
      total_max: totalMax,
      overall_percentage: overallPercentage,
      overall_gpa: overallGpa,
      passed_subjects_count: passedSubjectsCount,
      failed_subjects_count: failedSubjectsCount,
      absent_subjects_count: absentSubjectsCount,
      is_passed_all: isPassedAll,
      status: !hasMarks ? 'pending' : (isPassedAll ? 'passed' : 'failed'),
    };
  });

  // Calculate Ranks among students who appeared
  const appearedStudents = studentRows.filter(s => s.has_marks);
  appearedStudents.sort((a, b) => {
    if ((b.overall_percentage ?? 0) !== (a.overall_percentage ?? 0)) {
      return (b.overall_percentage ?? 0) - (a.overall_percentage ?? 0);
    }
    return b.total_obtained - a.total_obtained;
  });

  let currentRank = 0;
  let lastScore: number | null = null;
  appearedStudents.forEach((stu, index) => {
    if (stu.overall_percentage !== lastScore) {
      currentRank = index + 1;
      lastScore = stu.overall_percentage;
    }
    (stu as any).rank = currentRank;
    (stu as any).is_topper = currentRank === 1;
  });

  const rankMap = new Map<number, { rank: number; is_topper: boolean }>();
  appearedStudents.forEach(stu => rankMap.set(stu.student_id, { rank: (stu as any).rank, is_topper: (stu as any).is_topper }));

  const finalStudents = studentRows.map(stu => ({
    ...stu,
    rank: rankMap.get(stu.student_id)?.rank ?? null,
    is_topper: rankMap.get(stu.student_id)?.is_topper ?? false,
  }));

  // Statistics
  const totalStudents = finalStudents.length;
  const appearedCount = appearedStudents.length;
  const passedAllCount = finalStudents.filter(s => s.is_passed_all).length;
  const failedCount = appearedCount - passedAllCount;
  const passRatePct = appearedCount > 0 ? Math.round((passedAllCount / appearedCount) * 1000) / 10 : 0;
  
  const avgPercentage = appearedCount > 0
    ? Math.round((appearedStudents.reduce((sum, s) => sum + (s.overall_percentage || 0), 0) / appearedCount) * 10) / 10
    : 0;

  const topper = appearedStudents.length > 0 && appearedStudents[0].overall_percentage !== null ? {
    student_name: appearedStudents[0].full_name,
    roll_number: appearedStudents[0].roll_number,
    admission_number: appearedStudents[0].admission_number,
    percentage: appearedStudents[0].overall_percentage,
    total_obtained: appearedStudents[0].total_obtained,
    total_max: appearedStudents[0].total_max,
  } : null;

  // Subject performance stats
  const subjectStats = subjects.map((sub: any) => {
    const subResults = results.filter((r: any) => r.subject_id === sub.subject_id);
    const entered = subResults.filter((r: any) => !r.is_absent && r.marks_obtained !== null && r.marks_obtained !== undefined);
    const passed = entered.filter((r: any) => r.is_passed);
    const absents = subResults.filter((r: any) => r.is_absent);
    
    const marksArr = entered.map((r: any) => Number(r.marks_obtained));
    const highestMarks = marksArr.length > 0 ? Math.max(...marksArr) : null;
    const lowestMarks = marksArr.length > 0 ? Math.min(...marksArr) : null;
    const avgMarks = marksArr.length > 0 ? Math.round((marksArr.reduce((a, b) => a + b, 0) / marksArr.length) * 10) / 10 : null;

    return {
      subject_id: sub.subject_id,
      subject_name: sub.subject_name,
      max_marks: sub.max_marks,
      pass_marks: sub.pass_marks,
      entered_count: entered.length,
      passed_count: passed.length,
      failed_count: entered.length - passed.length,
      absent_count: absents.length,
      highest_marks: highestMarks,
      lowest_marks: lowestMarks,
      avg_marks: avgMarks,
      pass_rate_pct: entered.length > 0 ? Math.round((passed.length / entered.length) * 1000) / 10 : 0,
    };
  });

  return {
    exam,
    class_info: classInfo,
    section_info: sectionInfo,
    subjects,
    students: finalStudents,
    stats: {
      total_students: totalStudents,
      appeared_count: appearedCount,
      passed_count: passedAllCount,
      failed_count: failedCount,
      pass_rate_pct: passRatePct,
      class_avg_percentage: avgPercentage,
      topper,
      subject_stats: subjectStats,
    },
  };
};