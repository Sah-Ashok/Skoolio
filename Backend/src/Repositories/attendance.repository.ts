import pool from '../config/db';
import {
  IAttendance, ICreateAttendance, IUpdateAttendance,
  IAttendanceDetail, ICreateAttendanceDetail, IUpdateAttendanceDetail,
  ISectionTeacherHistory, ICreateSectionTeacherHistory,
} from '../types/attendance.types';

// ── ATTENDANCE QUERIES ──

export const createAttendance = async (
  school_id: number,
  data: ICreateAttendance
): Promise<IAttendance> => {
  const result = await pool.query(
    `INSERT INTO attendance
      (school_id, academic_year_id, class_id, section_id, date,
       marked_by, is_holiday, remarks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, school_id, academic_year_id, class_id, section_id,
       date::text, marked_by, total_present, total_absent, total_late,
       total_leave, status, is_holiday, remarks, created_at, updated_at`,
    [
      school_id,
      data.academic_year_id,
      data.class_id,
      data.section_id,
      data.date,
      data.marked_by,
      data.is_holiday || false,
      data.remarks || null,
    ]
  );
  return result.rows[0];
};

export const getAttendanceBySection = async (
  section_id: number,
  school_id: number,
  academic_year_id: number
): Promise<IAttendance[]> => {
  const result = await pool.query(
    `SELECT id, school_id, academic_year_id, class_id, section_id,
       date::text, marked_by, total_present, total_absent, total_late,
       total_leave, status, is_holiday, remarks, created_at, updated_at
     FROM attendance
     WHERE section_id = $1 AND school_id = $2 AND academic_year_id = $3
     ORDER BY date DESC`,
    [section_id, school_id, academic_year_id]
  );
  return result.rows;
};

// ── REGISTER QUERY — the core scalability fix ──────────────────────────────
//
// This replaces the N+1 pattern (1 call per day) with a SINGLE SQL query.
//
// What it does in one pass:
//   1. Joins attendance + attendance_details + students for the target month only
//   2. For each (student, day) pair, returns the status directly
//   3. Returns one row per student — the register-shaped output the frontend needs
//
// Performance characteristics:
//   - Filters by (section_id, school_id, academic_year_id, month) before any join
//   - The idx_attendance_details_student index (migration_attendance_index.sql)
//     covers the inner join on attendance_details
//   - Result set: at most (students_in_section × working_days_in_month) rows
//     e.g. 40 students × 22 days = 880 rows — trivially fast
//   - Year totals are computed in the SAME query via a second aggregation window
//     over all submitted attendance for the year — no second round-trip needed
//
// Response shape per row:
//   { student_id, full_name, admission_number,
//     date, status,                             ← one row per (student, day)
//     year_present, year_absent, year_late, year_leave, year_total }
//
// The frontend pivots these rows into a keyed object: dayMap[student_id][date] = status
// This is O(n) in JS — much cheaper than 22 API calls.
//
export const getSectionRegister = async (
  section_id: number,
  school_id: number,
  academic_year_id: number,
  year: number,
  month: number           // 1-indexed
): Promise<any[]> => {
  // Build the month boundary strings once — PostgreSQL BETWEEN is inclusive
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay    = new Date(year, month, 0).getDate();    // month is 1-indexed, so month+0 = last day of target month
  const monthEnd   = `${year}-${pad(month)}-${pad(lastDay)}`;

  const result = await pool.query(
    `SELECT
       s.id                                                      AS student_id,
       s.full_name,
       s.admission_number,
       -- Per-day status (one row per student per marked day this month)
       a.date::text                                              AS date,
       ad.status,
       -- Year totals aggregated in same query — no second round-trip
       yt.year_present,
       yt.year_absent,
       yt.year_late,
       yt.year_leave,
       yt.year_total
     FROM student_enrollments se
     -- Enrolled students for this section+year
     INNER JOIN students s ON s.id = se.student_id
     -- LEFT: students appear even on days where attendance wasn't marked
     LEFT JOIN attendance a
       ON a.section_id        = $1
      AND a.school_id         = $2
      AND a.academic_year_id  = $3
      AND a.date BETWEEN $4 AND $5
     LEFT JOIN attendance_details ad
       ON ad.attendance_id = a.id
      AND ad.student_id    = s.id
      AND ad.school_id     = $2
     -- Year totals CTE joined per student — computed once, reused across all their rows
     LEFT JOIN (
       SELECT
         ad2.student_id,
         COUNT(*) FILTER (WHERE ad2.status = 'present') AS year_present,
         COUNT(*) FILTER (WHERE ad2.status = 'absent')  AS year_absent,
         COUNT(*) FILTER (WHERE ad2.status = 'late')    AS year_late,
         COUNT(*) FILTER (WHERE ad2.status = 'leave')   AS year_leave,
         COUNT(*)                                        AS year_total
       FROM attendance_details ad2
       INNER JOIN attendance a2
         ON a2.id              = ad2.attendance_id
        AND a2.section_id      = $1
        AND a2.school_id       = $2
        AND a2.academic_year_id = $3
        AND a2.status          = 'submitted'
       WHERE ad2.school_id = $2
       GROUP BY ad2.student_id
     ) yt ON yt.student_id = s.id
     WHERE se.section_id        = $1
       AND se.school_id         = $2
       AND se.academic_year_id  = $3
       AND se.status            = 'active'
     ORDER BY s.full_name ASC, a.date ASC`,
    [section_id, school_id, academic_year_id, monthStart, monthEnd]
  );
  return result.rows;
};

// ── Month headers only (lightweight — for the records table at bottom of register) ──
// Returns header rows for a specific month — no details.
// Used separately from getSectionRegister so the register itself doesn't
// need the status column on headers (those come from the register query above).
export const getAttendanceBySectionAndMonth = async (
  section_id: number,
  school_id: number,
  academic_year_id: number,
  year: number,
  month: number
): Promise<IAttendance[]> => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const monthStart = `${year}-${pad(month)}-01`;
  const lastDay    = new Date(year, month, 0).getDate();
  const monthEnd   = `${year}-${pad(month)}-${pad(lastDay)}`;

  const result = await pool.query(
    `SELECT id, section_id, date::text, total_present, total_absent,
            total_late, total_leave, status, marked_by
     FROM attendance
     WHERE section_id = $1 AND school_id = $2 AND academic_year_id = $3
       AND date BETWEEN $4 AND $5
     ORDER BY date ASC`,
    [section_id, school_id, academic_year_id, monthStart, monthEnd]
  );
  return result.rows;
};

export const getAttendanceByDate = async (
  section_id: number,
  school_id: number,
  date: string
): Promise<IAttendance | null> => {
  const result = await pool.query(
    `SELECT id, school_id, academic_year_id, class_id, section_id,
       date::text, marked_by, total_present, total_absent, total_late,
       total_leave, status, is_holiday, remarks, created_at, updated_at
     FROM attendance
     WHERE section_id = $1 AND school_id = $2 AND date = $3`,
    [section_id, school_id, date]
  );
  return result.rows[0] || null;
};

export const getAttendanceById = async (
  id: number,
  school_id: number
): Promise<IAttendance | null> => {
  const result = await pool.query(
    `SELECT id, school_id, academic_year_id, class_id, section_id,
       date::text, marked_by, total_present, total_absent, total_late,
       total_leave, status, is_holiday, remarks, created_at, updated_at
     FROM attendance WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateAttendance = async (
  id: number,
  school_id: number,
  data: IUpdateAttendance
): Promise<IAttendance | null> => {
  const result = await pool.query(
    `UPDATE attendance SET
      remarks    = COALESCE($1, remarks),
      status     = COALESCE($2, status),
      is_holiday = COALESCE($3, is_holiday),
      updated_at = NOW()
     WHERE id = $4 AND school_id = $5
     RETURNING id, school_id, academic_year_id, class_id, section_id,
       date::text, marked_by, total_present, total_absent, total_late,
       total_leave, status, is_holiday, remarks, created_at, updated_at`,
    [
      data.remarks ?? null,
      data.status  ?? null,
      data.is_holiday ?? null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const updateAttendanceCounts = async (
  id: number,
  school_id: number,
  total_present: number,
  total_absent: number,
  total_late: number,
  total_leave: number
): Promise<void> => {
  await pool.query(
    `UPDATE attendance SET
      total_present = $1,
      total_absent  = $2,
      total_late    = $3,
      total_leave   = $4,
      updated_at    = NOW()
     WHERE id = $5 AND school_id = $6`,
    [total_present, total_absent, total_late, total_leave, id, school_id]
  );
};

// ── ATTENDANCE DETAIL QUERIES ──

export const createAttendanceDetails = async (
  school_id: number,
  attendance_id: number,
  details: ICreateAttendanceDetail[]
): Promise<IAttendanceDetail[]> => {
  if (!details || details.length === 0) return [];

  const values = details.map((_, i) => {
    const base = i * 6;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
  }).join(', ');

  const params = details.flatMap(d => [
    school_id,
    attendance_id,
    d.student_id,
    d.enrollment_id,
    d.status,
    d.check_in_time || null,
  ]);

  const result = await pool.query(
    `INSERT INTO attendance_details
      (school_id, attendance_id, student_id, enrollment_id, status, check_in_time)
     VALUES ${values}
     RETURNING *`,
    params
  );
  return result.rows;
};

export const getAttendanceDetails = async (
  attendance_id: number,
  school_id: number
): Promise<IAttendanceDetail[]> => {
  const result = await pool.query(
    `SELECT ad.*,
            s.full_name,
            s.admission_number,
            s.photo
     FROM attendance_details ad
     INNER JOIN students s ON s.id = ad.student_id
     WHERE ad.attendance_id = $1 AND ad.school_id = $2
     ORDER BY s.full_name ASC`,
    [attendance_id, school_id]
  );
  return result.rows;
};

export const updateAttendanceDetail = async (
  id: number,
  school_id: number,
  data: IUpdateAttendanceDetail
): Promise<IAttendanceDetail | null> => {
  const result = await pool.query(
    `UPDATE attendance_details SET
      status        = COALESCE($1, status),
      check_in_time = COALESCE($2, check_in_time),
      remarks       = COALESCE($3, remarks),
      updated_at    = NOW()
     WHERE id = $4 AND school_id = $5
     RETURNING *`,
    [
      data.status        ?? null,
      data.check_in_time ?? null,
      data.remarks       ?? null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

// ── SECTION ATTENDANCE SUMMARY ──

export const getSectionAttendanceSummary = async (
  section_id: number,
  school_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       ad.student_id,
       COUNT(*) FILTER (WHERE ad.status = 'present') AS total_present,
       COUNT(*) FILTER (WHERE ad.status = 'absent')  AS total_absent,
       COUNT(*) FILTER (WHERE ad.status = 'leave')   AS total_leave,
       COUNT(*)                                       AS total_marked
     FROM attendance_details ad
     INNER JOIN attendance a ON a.id = ad.attendance_id
     WHERE a.section_id       = $1
       AND ad.school_id       = $2
       AND a.academic_year_id = $3
       AND a.status           = 'submitted'
       AND a.date BETWEEN $4 AND $5
     GROUP BY ad.student_id`,
    [section_id, school_id, academic_year_id, start_date, end_date]
  );
  return result.rows;
};

// ── STUDENT ATTENDANCE SUMMARY ──

export const getStudentAttendanceSummary = async (
  student_id: number,
  school_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<any> => {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE ad.status = 'present') AS total_present,
       COUNT(*) FILTER (WHERE ad.status = 'absent')  AS total_absent,
       COUNT(*) FILTER (WHERE ad.status = 'late')    AS total_late,
       COUNT(*) FILTER (WHERE ad.status = 'leave')   AS total_leave,
       COUNT(*)                                       AS total_marked
     FROM attendance_details ad
     INNER JOIN attendance a ON a.id = ad.attendance_id
     WHERE ad.student_id      = $1
       AND ad.school_id       = $2
       AND a.academic_year_id = $3
       AND a.status           = 'submitted'
       AND a.date BETWEEN $4 AND $5`,
    [student_id, school_id, academic_year_id, start_date, end_date]
  );
  return result.rows[0];
};

export const getStudentMonthlyAttendance = async (
  student_id: number,
  school_id: number,
  year: number,
  month: number
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT ad.*, a.date::text, a.section_id
     FROM attendance_details ad
     INNER JOIN attendance a ON a.id = ad.attendance_id
     WHERE ad.student_id = $1
       AND ad.school_id  = $2
       AND EXTRACT(YEAR  FROM a.date) = $3
       AND EXTRACT(MONTH FROM a.date) = $4
     ORDER BY a.date ASC`,
    [student_id, school_id, year, month]
  );
  return result.rows;
};

// ── CLASS ATTENDANCE OVERVIEW (admin dashboard) ──

export const getClassAttendanceOverview = async (
  school_id: number,
  class_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       sec.id                                                            AS section_id,
       sec.name                                                          AS section_name,
       COUNT(DISTINCT ad.student_id)                                     AS total_students,
       COUNT(DISTINCT a.id)                                              AS days_marked,
       COUNT(*) FILTER (WHERE ad.status = 'present')                    AS total_present,
       COUNT(*) FILTER (WHERE ad.status = 'absent')                     AS total_absent,
       COUNT(*) FILTER (WHERE ad.status = 'late')                       AS total_late,
       COUNT(*) FILTER (WHERE ad.status = 'leave')                      AS total_leave,
       ROUND(
         COUNT(*) FILTER (WHERE ad.status = 'present')::numeric /
         NULLIF(COUNT(*)::numeric, 0) * 100,
         1
       )                                                                 AS avg_attendance_pct
     FROM sections sec
     LEFT JOIN attendance a
       ON a.section_id       = sec.id
      AND a.school_id        = sec.school_id
      AND a.academic_year_id = $3
      AND a.status           = 'submitted'
      AND a.date BETWEEN $4 AND $5
     LEFT JOIN attendance_details ad
       ON ad.attendance_id = a.id
      AND ad.school_id     = sec.school_id
     WHERE sec.class_id  = $2
       AND sec.school_id = $1
     GROUP BY sec.id, sec.name
     ORDER BY sec.name ASC`,
    [school_id, class_id, academic_year_id, start_date, end_date]
  );
  return result.rows;
};

// ── ALL-CLASSES OVERVIEW ──

export const getAllClassesAttendanceOverview = async (
  school_id: number,
  academic_year_id: number,
  current_start: string,
  current_end: string,
  prev_start: string,
  prev_end: string
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       c.id                                                             AS class_id,
       c.name                                                           AS class_name,
       COUNT(DISTINCT CASE WHEN a_cur.id IS NOT NULL THEN ad_cur.student_id END)  AS current_students,
       ROUND(
         COUNT(*) FILTER (WHERE ad_cur.status = 'present' AND a_cur.date BETWEEN $3 AND $4)::numeric /
         NULLIF(COUNT(*) FILTER (WHERE a_cur.date BETWEEN $3 AND $4)::numeric, 0) * 100, 1
       )                                                                AS current_avg_pct,
       ROUND(
         COUNT(*) FILTER (WHERE ad_prev.status = 'present' AND a_prev.date BETWEEN $5 AND $6)::numeric /
         NULLIF(COUNT(*) FILTER (WHERE a_prev.date BETWEEN $5 AND $6)::numeric, 0) * 100, 1
       )                                                                AS prev_avg_pct
     FROM classes c
     LEFT JOIN attendance a_cur
       ON a_cur.class_id        = c.id
      AND a_cur.school_id       = c.school_id
      AND a_cur.academic_year_id = $2
      AND a_cur.status          = 'submitted'
     LEFT JOIN attendance_details ad_cur
       ON ad_cur.attendance_id = a_cur.id
      AND ad_cur.school_id     = c.school_id
     LEFT JOIN attendance a_prev
       ON a_prev.class_id        = c.id
      AND a_prev.school_id       = c.school_id
      AND a_prev.academic_year_id = $2
      AND a_prev.status          = 'submitted'
     LEFT JOIN attendance_details ad_prev
       ON ad_prev.attendance_id = a_prev.id
      AND ad_prev.school_id     = c.school_id
     WHERE c.school_id        = $1
       AND c.academic_year_id = $2
     GROUP BY c.id, c.name
     ORDER BY c.name ASC`,
    [school_id, academic_year_id, current_start, current_end, prev_start, prev_end]
  );
  return result.rows;
};

// ── SECTION TEACHER HISTORY ──

export const createSectionTeacherHistory = async (
  school_id: number,
  data: ICreateSectionTeacherHistory
): Promise<ISectionTeacherHistory> => {
  const result = await pool.query(
    `INSERT INTO section_teacher_history
      (school_id, section_id, teacher_id, academic_year_id, from_date, to_date, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [school_id, data.section_id, data.teacher_id, data.academic_year_id,
     data.from_date, data.to_date || null, data.reason || null]
  );
  return result.rows[0];
};

export const getSectionTeacherHistory = async (
  section_id: number,
  school_id: number
): Promise<ISectionTeacherHistory[]> => {
  const result = await pool.query(
    `SELECT sth.*, t.full_name AS teacher_name
     FROM section_teacher_history sth
     INNER JOIN teachers t ON t.id = sth.teacher_id
     WHERE sth.section_id = $1 AND sth.school_id = $2
     ORDER BY sth.from_date DESC`,
    [section_id, school_id]
  );
  return result.rows;
};

export const updateSectionTeacherHistory = async (
  id: number,
  school_id: number,
  to_date: string
): Promise<ISectionTeacherHistory | null> => {
  const result = await pool.query(
    `UPDATE section_teacher_history SET to_date = $1
     WHERE id = $2 AND school_id = $3 RETURNING *`,
    [to_date, id, school_id]
  );
  return result.rows[0] || null;
};

// ── ADMIN SECTION ATTENDANCE SUMMARY ──

export const getAdminSectionSummary = async (
  school_id: number,
  academic_year_id: number,
  current_start: string,
  current_end: string,
  prev_start: string,
  prev_end: string
): Promise<any[]> => {
  const result = await pool.query(
    `WITH
      cur_working AS (
        SELECT COUNT(*) AS days
        FROM generate_series($3::date, $4::date, '1 day'::interval) AS d
        WHERE EXTRACT(DOW FROM d) NOT IN (
            SELECT CASE day
              WHEN 'sunday' THEN 0 WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2
              WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4
              WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 END
            FROM calendar_weekly_offs WHERE school_id = $1 AND academic_year_id = $2)
          AND d::date NOT IN (
            SELECT event_date::date FROM calendar_events
            WHERE school_id = $1 AND academic_year_id = $2 AND affects_attendance = true)
      ),
      prev_working AS (
        SELECT COUNT(*) AS days
        FROM generate_series($5::date, $6::date, '1 day'::interval) AS d
        WHERE EXTRACT(DOW FROM d) NOT IN (
            SELECT CASE day
              WHEN 'sunday' THEN 0 WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2
              WHEN 'wednesday' THEN 3 WHEN 'thursday' THEN 4
              WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6 END
            FROM calendar_weekly_offs WHERE school_id = $1 AND academic_year_id = $2)
          AND d::date NOT IN (
            SELECT event_date::date FROM calendar_events
            WHERE school_id = $1 AND academic_year_id = $2 AND affects_attendance = true)
      ),
      cur_present AS (
        SELECT a.section_id, SUM(a.total_present) AS total_present
        FROM attendance a
        WHERE a.school_id = $1 AND a.academic_year_id = $2
          AND a.date BETWEEN $3 AND $4 AND a.status = 'submitted'
        GROUP BY a.section_id
      ),
      prev_present AS (
        SELECT a.section_id, SUM(a.total_present) AS total_present
        FROM attendance a
        WHERE a.school_id = $1 AND a.academic_year_id = $2
          AND a.date BETWEEN $5 AND $6 AND a.status = 'submitted'
        GROUP BY a.section_id
      ),
      all_present AS (
        SELECT a.section_id, SUM(a.total_present) AS total_present
        FROM attendance a
        WHERE a.school_id = $1 AND a.academic_year_id = $2 AND a.status = 'submitted'
        GROUP BY a.section_id
      )
    SELECT
      sec.id AS section_id, sec.name AS section_name,
      c.id AS class_id, c.name AS class_name,
      COALESCE(t.full_name, 'Unassigned') AS coordinator_name,
      sec.coordinator_id,
      COALESCE(cp.total_present, 0) AS current_month_present,
      (SELECT days FROM cur_working) AS current_working_days,
      COALESCE(pp.total_present, 0) AS prev_month_present,
      (SELECT days FROM prev_working) AS prev_working_days,
      COALESCE(ap.total_present, 0) AS total_present_all_time
    FROM sections sec
    INNER JOIN classes c ON c.id = sec.class_id
    LEFT JOIN teachers t ON t.id = sec.coordinator_id
    LEFT JOIN cur_present  cp ON cp.section_id = sec.id
    LEFT JOIN prev_present pp ON pp.section_id = sec.id
    LEFT JOIN all_present  ap ON ap.section_id = sec.id
    WHERE sec.school_id = $1 AND c.academic_year_id = $2
    ORDER BY c.name ASC, sec.name ASC`,
    [school_id, academic_year_id, current_start, current_end, prev_start, prev_end]
  );
  return result.rows;
};
