import pool from '../config/db';
import {
  ISchoolCalendar, ICreateCalendar, IUpdateCalendar,
  ICalendarEvent, ICreateCalendarEvent, IUpdateCalendarEvent,
  ICalendarWeeklyOff, ICreateWeeklyOff,
} from '../types/calendar.types';

// ── CALENDAR QUERIES ──

export const createCalendar = async (
  school_id: number,
  created_by: number,
  data: ICreateCalendar
): Promise<ISchoolCalendar> => {
  const result = await pool.query(
    `INSERT INTO school_calendars
      (school_id, academic_year_id, weekend_type)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [school_id, data.academic_year_id, data.weekend_type]
  );
  return result.rows[0];
};

export const getCalendarByAcademicYear = async (
  school_id: number,
  academic_year_id: number
): Promise<ISchoolCalendar | null> => {
  const result = await pool.query(
    `SELECT * FROM school_calendars
     WHERE school_id = $1 AND academic_year_id = $2`,
    [school_id, academic_year_id]
  );
  return result.rows[0] || null;
};

export const getCalendarById = async (
  id: number,
  school_id: number
): Promise<ISchoolCalendar | null> => {
  const result = await pool.query(
    `SELECT * FROM school_calendars WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateCalendar = async (
  id: number,
  school_id: number,
  data: IUpdateCalendar
): Promise<ISchoolCalendar | null> => {
  // Build SET clause dynamically — avoids ENUM type-casting issues that occur
  // with COALESCE($1, enum_col) when the pg driver sends a plain string param.
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: any[]        = [];

  if (data.weekend_type !== undefined) {
    values.push(data.weekend_type);
    setClauses.unshift(`weekend_type = $${values.length}`);
  }

  // Nothing to update
  if (values.length === 0) {
    return getCalendarById(id, school_id);
  }

  // Add WHERE clause params
  values.push(id, school_id);

  const result = await pool.query(
    `UPDATE school_calendars
     SET ${setClauses.join(', ')}
     WHERE id = $${values.length - 1} AND school_id = $${values.length}
     RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

// ── CALENDAR EVENT QUERIES ──

export const createCalendarEvent = async (
  school_id: number,
  created_by: number,
  data: ICreateCalendarEvent
): Promise<ICalendarEvent> => {
  const result = await pool.query(
    `INSERT INTO calendar_events
      (school_id, calendar_id, academic_year_id, title, event_date, end_date,
       event_type, affects_attendance, class_id, description, exam_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, school_id, calendar_id, academic_year_id, title,
       event_date::text, end_date::text, event_type, affects_attendance,
       class_id, description, exam_id, created_by, created_at, updated_at`,
    [
      school_id,
      data.calendar_id,
      data.academic_year_id,
      data.title,
      data.event_date,
      data.end_date || null,
      data.event_type,
      data.affects_attendance ?? true,
      data.class_id || null,
      data.description || null,
      data.exam_id || null,
      created_by,
    ]
  );
  return result.rows[0];
};

export const getEventsByCalendar = async (
  calendar_id: number,
  school_id: number
): Promise<ICalendarEvent[]> => {
  const result = await pool.query(
    `SELECT id, school_id, calendar_id, academic_year_id, title,
       event_date::text, end_date::text, event_type, affects_attendance,
       class_id, description, exam_id, created_by, created_at, updated_at
     FROM calendar_events
     WHERE calendar_id = $1 AND school_id = $2
     ORDER BY event_date ASC`,
    [calendar_id, school_id]
  );
  return result.rows;
};

export const getEventsByDateRange = async (
  school_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<ICalendarEvent[]> => {
  const result = await pool.query(
    `SELECT id, school_id, calendar_id, academic_year_id, title,
       event_date::text, end_date::text, event_type, affects_attendance,
       class_id, description, exam_id, created_by, created_at, updated_at
     FROM calendar_events
     WHERE school_id = $1
       AND academic_year_id = $2
       AND affects_attendance = true
       AND event_date >= $3
       AND COALESCE(end_date, event_date) <= $4
     ORDER BY event_date ASC`,
    [school_id, academic_year_id, start_date, end_date]
  );
  return result.rows;
};

export const getEventById = async (
  id: number,
  school_id: number
): Promise<ICalendarEvent | null> => {
  const result = await pool.query(
    `SELECT id, school_id, calendar_id, academic_year_id, title,
       event_date::text, end_date::text, event_type, affects_attendance,
       class_id, description, exam_id, created_by, created_at, updated_at
     FROM calendar_events WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

// ── EXAM-SYNC LOOKUP ──
// Used by the Exam module to find the calendar entry that was auto-created
// for a given exam, so it can be updated in place instead of duplicated.
export const getEventByExamId = async (
  exam_id: number,
  school_id: number
): Promise<ICalendarEvent | null> => {
  const result = await pool.query(
    `SELECT id, school_id, calendar_id, academic_year_id, title,
       event_date::text, end_date::text, event_type, affects_attendance,
       class_id, description, exam_id, created_by, created_at, updated_at
     FROM calendar_events WHERE exam_id = $1 AND school_id = $2`,
    [exam_id, school_id]
  );
  return result.rows[0] || null;
};

export const updateCalendarEvent = async (
  id: number,
  school_id: number,
  data: IUpdateCalendarEvent
): Promise<ICalendarEvent | null> => {
  const result = await pool.query(
    `UPDATE calendar_events SET
      title              = COALESCE($1, title),
      event_date         = COALESCE($2, event_date),
      end_date           = COALESCE($3, end_date),
      event_type         = COALESCE($4, event_type),
      affects_attendance = COALESCE($5, affects_attendance),
      class_id           = COALESCE($6, class_id),
      description        = COALESCE($7, description),
      updated_at         = NOW()
     WHERE id = $8 AND school_id = $9
     RETURNING id, school_id, calendar_id, academic_year_id, title,
       event_date::text, end_date::text, event_type, affects_attendance,
       class_id, description, exam_id, created_by, created_at, updated_at`,
    [
      data.title || null,
      data.event_date || null,
      data.end_date || null,
      data.event_type || null,
      data.affects_attendance ?? null,
      data.class_id || null,
      data.description || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

// ── EXAM-SYNC UPDATE ──
// Updates the calendar entry linked to an exam by exam_id directly, since the
// Exam module knows exam_id but not the calendar_event's own id.
export const updateCalendarEventByExamId = async (
  exam_id: number,
  school_id: number,
  data: { title?: string; event_date?: Date | string; end_date?: Date | string | null }
): Promise<ICalendarEvent | null> => {
  const result = await pool.query(
    `UPDATE calendar_events SET
      title      = COALESCE($1, title),
      event_date = COALESCE($2, event_date),
      end_date   = $3,
      updated_at = NOW()
     WHERE exam_id = $4 AND school_id = $5
     RETURNING id, school_id, calendar_id, academic_year_id, title,
       event_date::text, end_date::text, event_type, affects_attendance,
       class_id, description, exam_id, created_by, created_at, updated_at`,
    [
      data.title || null,
      data.event_date || null,
      data.end_date || null,
      exam_id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const deleteCalendarEvent = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM calendar_events WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── CALENDAR WEEKLY OFF QUERIES ──

export const getWeeklyOffsByCalendar = async (
  calendar_id: number,
  school_id: number
): Promise<ICalendarWeeklyOff[]> => {
  const result = await pool.query(
    `SELECT * FROM calendar_weekly_offs
     WHERE calendar_id = $1 AND school_id = $2
     ORDER BY day_of_week ASC, week_pattern ASC`,
    [calendar_id, school_id]
  );
  return result.rows;
};

// Replace-all: deletes the existing set and inserts the new one inside a
// transaction, so a school's weekly-off config is always fully consistent
// (no leftover rows from a previous save mixed with the new selection).
export const replaceWeeklyOffs = async (
  calendar_id: number,
  school_id: number,
  offs: ICreateWeeklyOff[]
): Promise<ICalendarWeeklyOff[]> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM calendar_weekly_offs WHERE calendar_id = $1 AND school_id = $2`,
      [calendar_id, school_id]
    );

    const inserted: ICalendarWeeklyOff[] = [];
    for (const off of offs) {
      const result = await client.query(
        `INSERT INTO calendar_weekly_offs (calendar_id, school_id, day_of_week, week_pattern)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [calendar_id, school_id, off.day_of_week, off.week_pattern || 'all']
      );
      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return inserted;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── WORKING DAYS CALCULATION ──
export const getHolidayDates = async (
  school_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<string[]> => {
  const result = await pool.query(
    `SELECT DISTINCT generate_series(
       event_date,
       COALESCE(end_date, event_date),
       '1 day'::interval
     )::date::text as holiday_date
     FROM calendar_events
     WHERE school_id = $1
       AND academic_year_id = $2
       AND affects_attendance = true
       AND event_date >= $3
       AND COALESCE(end_date, event_date) <= $4`,
    [school_id, academic_year_id, start_date, end_date]
  );
  return result.rows.map(r => r.holiday_date);
};
