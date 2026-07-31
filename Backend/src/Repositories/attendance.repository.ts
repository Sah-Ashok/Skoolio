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
       marked_by, is_holiday, remarks, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft')
     RETURNING id, school_id, academic_year_id, class_id, section_id,
       date::text, marked_by, total_present, total_absent,
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
       date::text, marked_by, total_present, total_absent,
       total_leave, status, is_holiday, remarks, created_at, updated_at
     FROM attendance
     WHERE section_id = $1 AND school_id = $2 AND academic_year_id = $3
     ORDER BY date DESC`,
    [section_id, school_id, academic_year_id]
  );
  return result.rows;
};

// ── REGISTER QUERY ──────────────────────────────────────────────────────────
export const getSectionRegister = async (
  section_id: number,
  school_id: number,
  academic_year_id: number,
  startDate: string,
  endDate: string
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       s.id                                                      AS student_id,
       s.full_name,
       se.roll_number,
       a.date::text                                              AS date,
       a.is_holiday,
       a.remarks                                                 AS suspension_reason,
       ad.status,
       yt.year_present,
       yt.year_absent,
       yt.year_leave,
       yt.year_total
     FROM student_enrollments se
     INNER JOIN students s ON s.id = se.student_id
     LEFT JOIN attendance a
       ON a.section_id        = $1
      AND a.school_id         = $2
      AND a.academic_year_id  = $3
      AND a.date BETWEEN $4 AND $5
     LEFT JOIN attendance_details ad
       ON ad.attendance_id = a.id
      AND ad.student_id    = s.id
      AND ad.school_id     = $2
     LEFT JOIN (
       SELECT
         ad2.student_id,
         COUNT(*) FILTER (WHERE ad2.status = 'present') AS year_present,
         COUNT(*) FILTER (WHERE ad2.status = 'absent')  AS year_absent,
         COUNT(*) FILTER (WHERE ad2.status = 'leave')   AS year_leave,
         COUNT(*)                                         AS year_total
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
     ORDER BY se.roll_number ASC NULLS LAST, s.full_name ASC, a.date ASC`,
    [section_id, school_id, academic_year_id, startDate, endDate]
  );
  return result.rows;
};

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
            total_leave, status, marked_by
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
       date::text, marked_by, total_present, total_absent,
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
       date::text, marked_by, total_present, total_absent,
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
       date::text, marked_by, total_present, total_absent,
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

export const deleteAttendanceById = async (id: number, school_id: number): Promise<void> => {
  // Delete details first (FK constraint), then header
  await pool.query(
    `DELETE FROM attendance_details WHERE attendance_id = $1 AND school_id = $2`,
    [id, school_id]
  );
  await pool.query(
    `DELETE FROM attendance WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
};

export const updateAttendanceCounts = async (
  id: number,
  school_id: number,
  total_present: number,
  total_absent: number,
  total_leave: number
): Promise<void> => {
  await pool.query(
    `UPDATE attendance SET
      total_present = $1,
      total_absent  = $2,
      total_leave   = $3,
      updated_at    = NOW()
     WHERE id = $4 AND school_id = $5`,
    [total_present, total_absent, total_leave, id, school_id]
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
    const base = i * 7;
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
  }).join(', ');

  const params = details.flatMap(d => [
    school_id,
    attendance_id,
    d.student_id,
    d.enrollment_id,
    d.status,
    d.check_in_time || null,
    d.remarks       || null,
  ]);

  const result = await pool.query(
    `INSERT INTO attendance_details
      (school_id, attendance_id, student_id, enrollment_id, status, check_in_time, remarks)
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
            s.photo,
            s.guardian_name,
            se.roll_number
     FROM attendance_details ad
     INNER JOIN students s ON s.id = ad.student_id
     LEFT JOIN student_enrollments se ON se.id = ad.enrollment_id
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
  const setClauses: string[] = [];
  const params: any[]        = [];
  let   idx = 1;

  if (data.status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    params.push(data.status);
  }
  if (data.check_in_time !== undefined) {
    setClauses.push(`check_in_time = $${idx++}`);
    params.push(data.check_in_time ?? null);
  }
  if (data.remarks !== undefined) {
    setClauses.push(`remarks = $${idx++}`);
    params.push(data.remarks ?? null);
  }

  if (setClauses.length === 0) {
    const cur = await pool.query(
      `SELECT * FROM attendance_details WHERE id = $1 AND school_id = $2`,
      [id, school_id]
    );
    return cur.rows[0] || null;
  }

  setClauses.push(`updated_at = NOW()`);
  params.push(id, school_id);

  const result = await pool.query(
    `UPDATE attendance_details
     SET ${setClauses.join(', ')}
     WHERE id = $${idx++} AND school_id = $${idx++}
     RETURNING *`,
    params
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
       COUNT(*)                                        AS total_marked
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

// 'suspended' is class-level (attendance.is_holiday = true) — not stored per student.
// Per-student statuses are: present | absent | leave only.
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
       COUNT(*) FILTER (WHERE ad.status = 'leave')   AS total_leave,
       COUNT(*)                                        AS total_marked
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
  month: number,
  academic_year_id?: number
): Promise<any[]> => {
  const params: any[] = [student_id, school_id, year, month];
  const yearFilter = academic_year_id
    ? `AND a.academic_year_id = $${params.push(academic_year_id)}`
    : '';

  const result = await pool.query(
    `SELECT ad.*, a.date::text, a.section_id, a.academic_year_id
     FROM attendance_details ad
     INNER JOIN attendance a ON a.id = ad.attendance_id
     WHERE ad.student_id = $1
       AND ad.school_id  = $2
       AND EXTRACT(YEAR  FROM a.date) = $3
       AND EXTRACT(MONTH FROM a.date) = $4
       AND a.status = 'submitted'
       ${yearFilter}
     ORDER BY a.date ASC`,
    params
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
       COUNT(*) FILTER (WHERE ad.status = 'present') AS total_present,
       COUNT(*) FILTER (WHERE ad.status = 'absent')  AS total_absent,
       COUNT(*) FILTER (WHERE ad.status = 'leave')   AS total_leave,
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
        WHERE EXTRACT(DOW FROM d)::int NOT IN (
            SELECT day_of_week FROM calendar_weekly_offs
            WHERE school_id = $1
          )
          AND d::date NOT IN (
            SELECT event_date::date FROM calendar_events
            WHERE school_id = $1 AND academic_year_id = $2 AND affects_attendance = true
          )
      ),
      prev_working AS (
        SELECT COUNT(*) AS days
        FROM generate_series($5::date, $6::date, '1 day'::interval) AS d
        WHERE EXTRACT(DOW FROM d)::int NOT IN (
            SELECT day_of_week FROM calendar_weekly_offs
            WHERE school_id = $1
          )
          AND d::date NOT IN (
            SELECT event_date::date FROM calendar_events
            WHERE school_id = $1 AND academic_year_id = $2 AND affects_attendance = true
          )
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
