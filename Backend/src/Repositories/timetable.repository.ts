import pool from '../config/db';
import {
  ITimetableSlot,
  ICreateTimetableSlot,
  DayOfWeek,
} from '../types/timetable.types';

const TIMETABLE_SELECT = `
  st.id,
  st.school_id,
  st.academic_year_id,
  st.class_id,
  st.section_id,
  st.day_of_week,
  st.period_number,
  st.start_time::text AS start_time,
  st.end_time::text   AS end_time,
  st.subject_id,
  st.teacher_id,
  st.is_break,
  st.title,
  st.room_no,
  st.created_by_teacher_id,
  st.created_at,
  st.updated_at,
  s.name       AS subject_name,
  s.code       AS subject_code,
  t.full_name  AS teacher_name,
  c.name       AS class_name,
  sec.name     AS section_name
`;

const ORDER_BY_DAY_PERIOD = `
  ORDER BY
    CASE st.day_of_week
      WHEN 'sunday'    THEN 1
      WHEN 'monday'    THEN 2
      WHEN 'tuesday'   THEN 3
      WHEN 'wednesday' THEN 4
      WHEN 'thursday'  THEN 5
      WHEN 'friday'    THEN 6
      WHEN 'saturday'  THEN 7
      ELSE 8
    END,
    st.period_number ASC,
    st.start_time ASC
`;

export const getTimetableBySection = async (
  school_id: number,
  academic_year_id: number,
  section_id: number
): Promise<ITimetableSlot[]> => {
  const result = await pool.query(
    `SELECT ${TIMETABLE_SELECT}
     FROM section_timetables st
     LEFT JOIN subjects s ON s.id = st.subject_id
     LEFT JOIN teachers t ON t.id = st.teacher_id
     LEFT JOIN classes  c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.school_id = $1 AND st.academic_year_id = $2 AND st.section_id = $3
     ${ORDER_BY_DAY_PERIOD}`,
    [school_id, academic_year_id, section_id]
  );
  return result.rows;
};

export const getTeacherWeeklySchedule = async (
  school_id: number,
  academic_year_id: number,
  teacher_id: number
): Promise<ITimetableSlot[]> => {
  const result = await pool.query(
    `SELECT ${TIMETABLE_SELECT}
     FROM section_timetables st
     LEFT JOIN subjects s ON s.id = st.subject_id
     LEFT JOIN teachers t ON t.id = st.teacher_id
     LEFT JOIN classes  c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.school_id = $1 AND st.academic_year_id = $2 AND st.teacher_id = $3
     ${ORDER_BY_DAY_PERIOD}`,
    [school_id, academic_year_id, teacher_id]
  );
  return result.rows;
};

export const checkTeacherConflict = async (
  school_id: number,
  academic_year_id: number,
  teacher_id: number,
  day_of_week: DayOfWeek,
  start_time: string,
  end_time: string,
  exclude_section_id?: number,
  exclude_slot_id?: number
): Promise<ITimetableSlot | null> => {
  const params: any[] = [school_id, academic_year_id, teacher_id, day_of_week, start_time, end_time];
  let extraFilters = '';

  if (exclude_section_id) {
    params.push(exclude_section_id);
    extraFilters += ` AND st.section_id != $${params.length}`;
  }
  if (exclude_slot_id) {
    params.push(exclude_slot_id);
    extraFilters += ` AND st.id != $${params.length}`;
  }

  // Conflict occurs if time intervals overlap: (start_time < other_end_time AND end_time > other_start_time)
  const result = await pool.query(
    `SELECT ${TIMETABLE_SELECT}
     FROM section_timetables st
     LEFT JOIN subjects s ON s.id = st.subject_id
     LEFT JOIN teachers t ON t.id = st.teacher_id
     LEFT JOIN classes  c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.school_id = $1
       AND st.academic_year_id = $2
       AND st.teacher_id = $3
       AND st.day_of_week = $4
       AND (st.start_time < $6::time AND st.end_time > $5::time)
       ${extraFilters}
     LIMIT 1`,
    params
  );
  return result.rows[0] || null;
};

export const saveBulkSectionTimetable = async (
  school_id: number,
  academic_year_id: number,
  class_id: number,
  section_id: number,
  slots: ICreateTimetableSlot[],
  created_by_teacher_id?: number | null
): Promise<ITimetableSlot[]> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Clear existing schedule for this section in the current academic year
    await client.query(
      `DELETE FROM section_timetables
       WHERE school_id = $1 AND academic_year_id = $2 AND section_id = $3`,
      [school_id, academic_year_id, section_id]
    );

    // 2. Insert new slots if provided
    if (slots && slots.length > 0) {
      for (const slot of slots) {
        await client.query(
          `INSERT INTO section_timetables (
             school_id, academic_year_id, class_id, section_id,
             day_of_week, period_number, start_time, end_time,
             subject_id, teacher_id, is_break, title, room_no,
             created_by_teacher_id, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7::time, $8::time, $9, $10, $11, $12, $13, $14, NOW())
           ON CONFLICT (school_id, academic_year_id, section_id, day_of_week, period_number)
           DO UPDATE SET
             start_time = EXCLUDED.start_time,
             end_time = EXCLUDED.end_time,
             subject_id = EXCLUDED.subject_id,
             teacher_id = EXCLUDED.teacher_id,
             is_break = EXCLUDED.is_break,
             title = EXCLUDED.title,
             room_no = EXCLUDED.room_no,
             created_by_teacher_id = EXCLUDED.created_by_teacher_id,
             updated_at = NOW()`,
          [
            school_id,
            academic_year_id,
            class_id,
            section_id,
            slot.day_of_week.toLowerCase(),
            slot.period_number,
            slot.start_time,
            slot.end_time,
            slot.subject_id || null,
            slot.teacher_id || null,
            Boolean(slot.is_break),
            slot.title || null,
            slot.room_no || null,
            created_by_teacher_id || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getTimetableBySection(school_id, academic_year_id, section_id);
};

export const createOrUpdateSlot = async (
  school_id: number,
  academic_year_id: number,
  class_id: number,
  section_id: number,
  slot: ICreateTimetableSlot,
  created_by_teacher_id?: number | null
): Promise<ITimetableSlot> => {
  const result = await pool.query(
    `INSERT INTO section_timetables (
       school_id, academic_year_id, class_id, section_id,
       day_of_week, period_number, start_time, end_time,
       subject_id, teacher_id, is_break, title, room_no,
       created_by_teacher_id, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::time, $8::time, $9, $10, $11, $12, $13, $14, NOW())
     ON CONFLICT (school_id, academic_year_id, section_id, day_of_week, period_number)
     DO UPDATE SET
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       subject_id = EXCLUDED.subject_id,
       teacher_id = EXCLUDED.teacher_id,
       is_break = EXCLUDED.is_break,
       title = EXCLUDED.title,
       room_no = EXCLUDED.room_no,
       created_by_teacher_id = EXCLUDED.created_by_teacher_id,
       updated_at = NOW()
     RETURNING id`,
    [
      school_id,
      academic_year_id,
      class_id,
      section_id,
      slot.day_of_week.toLowerCase(),
      slot.period_number,
      slot.start_time,
      slot.end_time,
      slot.subject_id || null,
      slot.teacher_id || null,
      Boolean(slot.is_break),
      slot.title || null,
      slot.room_no || null,
      created_by_teacher_id || null,
    ]
  );

  const slotId = result.rows[0].id;
  const single = await pool.query(
    `SELECT ${TIMETABLE_SELECT}
     FROM section_timetables st
     LEFT JOIN subjects s ON s.id = st.subject_id
     LEFT JOIN teachers t ON t.id = st.teacher_id
     LEFT JOIN classes  c ON c.id = st.class_id
     LEFT JOIN sections sec ON sec.id = st.section_id
     WHERE st.id = $1 AND st.school_id = $2`,
    [slotId, school_id]
  );
  return single.rows[0];
};

export const deleteTimetableSlot = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM section_timetables WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

export const deleteSectionDayTimetable = async (
  school_id: number,
  academic_year_id: number,
  section_id: number,
  day_of_week: string
): Promise<number> => {
  const result = await pool.query(
    `DELETE FROM section_timetables
     WHERE school_id = $1 AND academic_year_id = $2 AND section_id = $3 AND LOWER(day_of_week) = LOWER($4)`,
    [school_id, academic_year_id, section_id, day_of_week]
  );
  return result.rowCount ?? 0;
};

export const deleteSectionAllTimetable = async (
  school_id: number,
  academic_year_id: number,
  section_id: number
): Promise<number> => {
  const result = await pool.query(
    `DELETE FROM section_timetables
     WHERE school_id = $1 AND academic_year_id = $2 AND section_id = $3`,
    [school_id, academic_year_id, section_id]
  );
  return result.rowCount ?? 0;
};
