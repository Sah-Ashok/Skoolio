import pool from '../config/db';
import AppError from '../utils/AppError';
import { getActiveAcademicYear } from '../Repositories/academic.repository';
import { getSectionById } from '../Repositories/class.repository';
import { getStudentById } from '../Repositories/student.repository';
import {
  ITimetableSlot,
  ICreateTimetableSlot,
  IBulkSaveTimetable,
  DayOfWeek,
  ITimetableConflict,
} from '../types/timetable.types';
import {
  getTimetableBySection,
  getTeacherWeeklySchedule,
  checkTeacherConflict,
  saveBulkSectionTimetable,
  createOrUpdateSlot,
  deleteTimetableSlot,
  deleteSectionDayTimetable,
  deleteSectionAllTimetable,
} from '../Repositories/timetable.repository';

export const getSectionTimetableService = async (
  school_id: number,
  section_id: number,
  academic_year_id?: number
): Promise<{
  section: any;
  academic_year_id: number;
  slots: ITimetableSlot[];
  schedule_by_day: Record<DayOfWeek, ITimetableSlot[]>;
}> => {
  const section = await getSectionById(section_id, school_id);
  if (!section) {
    throw new AppError('Section not found.', 404);
  }

  let yearId = academic_year_id;
  if (!yearId) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (!activeYear) {
      throw new AppError('No active academic year found for this school.', 400);
    }
    yearId = activeYear.id;
  }

  const validYearId: number = yearId;
  const slots = await getTimetableBySection(school_id, validYearId, section_id);

  const schedule_by_day: Record<DayOfWeek, ITimetableSlot[]> = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };

  for (const s of slots) {
    const day = s.day_of_week.toLowerCase() as DayOfWeek;
    if (schedule_by_day[day]) {
      schedule_by_day[day].push(s);
    }
  }

  return {
    section,
    academic_year_id: validYearId,
    slots,
    schedule_by_day,
  };
};

export const saveBulkSectionTimetableService = async (
  school_id: number,
  user_role: string,
  user_id: number,
  data: IBulkSaveTimetable
): Promise<ITimetableSlot[]> => {
  const section = await getSectionById(data.section_id, school_id);
  if (!section) {
    throw new AppError('Section not found.', 404);
  }

  let yearId = data.academic_year_id;
  if (!yearId) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (!activeYear) {
      throw new AppError('No active academic year found for this school.', 400);
    }
    yearId = activeYear.id;
  }

  const validYearId: number = yearId;
  const class_id = data.class_id || section.class_id;
  const teacherId = user_role === 'faculty' ? user_id : null;

  // Validate teacher conflicts for each non-break slot
  if (data.slots && data.slots.length > 0) {
    for (const slot of data.slots) {
      if (!slot.is_break && slot.teacher_id) {
        const conflict = await checkTeacherConflict(
          school_id,
          validYearId,
          slot.teacher_id,
          slot.day_of_week,
          slot.start_time,
          slot.end_time,
          data.section_id
        );
        if (conflict) {
          const conflictTeacher = conflict.teacher_name || 'Assigned teacher';
          const conflictClass = `${conflict.class_name ?? ''} ${conflict.section_name ?? ''}`.trim();
          throw new AppError(
            `Schedule Conflict: ${conflictTeacher} is already assigned to ${conflictClass} on ${slot.day_of_week.toUpperCase()} from ${conflict.start_time.slice(0,5)} to ${conflict.end_time.slice(0,5)}.`,
            400
          );
        }
      }
    }
  }

  return saveBulkSectionTimetable(
    school_id,
    validYearId,
    class_id,
    data.section_id,
    data.slots,
    teacherId
  );
};

export const saveSingleSlotService = async (
  school_id: number,
  user_role: string,
  user_id: number,
  data: ICreateTimetableSlot & { section_id: number; class_id?: number }
): Promise<ITimetableSlot> => {
  const section = await getSectionById(data.section_id, school_id);
  if (!section) {
    throw new AppError('Section not found.', 404);
  }

  let yearId = data.academic_year_id;
  if (!yearId) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (!activeYear) {
      throw new AppError('No active academic year found.', 400);
    }
    yearId = activeYear.id;
  }

  const validYearId: number = yearId;
  const class_id = data.class_id || section.class_id;
  const teacherId = user_role === 'faculty' ? user_id : null;

  if (!data.is_break && data.teacher_id) {
    const conflict = await checkTeacherConflict(
      school_id,
      validYearId,
      data.teacher_id,
      data.day_of_week,
      data.start_time,
      data.end_time,
      data.section_id
    );
    if (conflict) {
      const conflictTeacher = conflict.teacher_name || 'Teacher';
      const conflictClass = `${conflict.class_name ?? ''} ${conflict.section_name ?? ''}`.trim();
      throw new AppError(
        `Schedule Conflict: ${conflictTeacher} is already assigned to ${conflictClass} on ${data.day_of_week.toUpperCase()} (${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)}).`,
        400
      );
    }
  }

  return createOrUpdateSlot(
    school_id,
    validYearId,
    class_id,
    data.section_id,
    data,
    teacherId
  );
};

export const deleteSlotService = async (
  school_id: number,
  slot_id: number
): Promise<void> => {
  const deleted = await deleteTimetableSlot(slot_id, school_id);
  if (!deleted) {
    throw new AppError('Timetable slot not found.', 404);
  }
};

export const deleteSectionDayScheduleService = async (
  school_id: number,
  section_id: number,
  day_of_week: string,
  academic_year_id?: number
): Promise<{ deleted_count: number }> => {
  const section = await getSectionById(section_id, school_id);
  if (!section) {
    throw new AppError('Section not found.', 404);
  }

  let yearId = academic_year_id;
  if (!yearId) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (!activeYear) {
      throw new AppError('No active academic year found.', 400);
    }
    yearId = activeYear.id;
  }

  const deleted_count = await deleteSectionDayTimetable(
    school_id,
    yearId,
    section_id,
    day_of_week
  );
  return { deleted_count };
};

export const deleteSectionAllScheduleService = async (
  school_id: number,
  section_id: number,
  academic_year_id?: number
): Promise<{ deleted_count: number }> => {
  const section = await getSectionById(section_id, school_id);
  if (!section) {
    throw new AppError('Section not found.', 404);
  }

  let yearId = academic_year_id;
  if (!yearId) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (!activeYear) {
      throw new AppError('No active academic year found.', 400);
    }
    yearId = activeYear.id;
  }

  const deleted_count = await deleteSectionAllTimetable(
    school_id,
    yearId,
    section_id
  );
  return { deleted_count };
};

export const getTeacherScheduleService = async (
  school_id: number,
  teacher_id: number,
  academic_year_id?: number
): Promise<{
  academic_year_id: number;
  slots: ITimetableSlot[];
  schedule_by_day: Record<DayOfWeek, ITimetableSlot[]>;
}> => {
  let yearId = academic_year_id;
  if (!yearId) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (!activeYear) {
      throw new AppError('No active academic year found.', 400);
    }
    yearId = activeYear.id;
  }

  const validYearId: number = yearId;
  const slots = await getTeacherWeeklySchedule(school_id, validYearId, teacher_id);

  const schedule_by_day: Record<DayOfWeek, ITimetableSlot[]> = {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };

  for (const s of slots) {
    const day = s.day_of_week.toLowerCase() as DayOfWeek;
    if (schedule_by_day[day]) {
      schedule_by_day[day].push(s);
    }
  }

  return {
    academic_year_id: validYearId,
    slots,
    schedule_by_day,
  };
};

export const getStudentScheduleService = async (
  school_id: number,
  student_id: number
) => {
  const student = await getStudentById(student_id, school_id);
  if (!student) {
    throw new AppError('Student not found.', 404);
  }

  // Look up student active enrollment to get their section_id and academic_year_id
  const enrollRes = await pool.query(
    `SELECT section_id, academic_year_id
     FROM student_enrollments
     WHERE student_id = $1 AND school_id = $2
     ORDER BY (status = 'active') DESC, created_at DESC
     LIMIT 1`,
    [student_id, school_id]
  );

  const enroll = enrollRes.rows[0];
  if (!enroll || !enroll.section_id) {
    throw new AppError('Student is not assigned to any section.', 400);
  }

  return getSectionTimetableService(school_id, enroll.section_id, enroll.academic_year_id);
};

export const checkConflictService = async (
  school_id: number,
  teacher_id: number,
  day_of_week: DayOfWeek,
  start_time: string,
  end_time: string,
  academic_year_id?: number,
  exclude_section_id?: number,
  exclude_slot_id?: number
): Promise<ITimetableConflict> => {
  let yearId = academic_year_id;
  if (!yearId) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (!activeYear) {
      return { has_conflict: false };
    }
    yearId = activeYear.id;
  }

  const validYearId: number = yearId;
  const conflict = await checkTeacherConflict(
    school_id,
    validYearId,
    teacher_id,
    day_of_week,
    start_time,
    end_time,
    exclude_section_id,
    exclude_slot_id
  );

  if (conflict) {
    const conflictClass = `${conflict.class_name ?? ''} ${conflict.section_name ?? ''}`.trim();
    return {
      has_conflict: true,
      conflict_slot: conflict,
      message: `Teacher ${conflict.teacher_name || ''} already has a period in ${conflictClass} (${conflict.start_time.slice(0,5)} - ${conflict.end_time.slice(0,5)}).`,
    };
  }

  return { has_conflict: false };
};
