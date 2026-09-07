import pool from '../config/db';
import {
  IExam, ICreateExam, IUpdateExam,
  IExamSchedule, ICreateExamSchedule, IUpdateExamSchedule,
  IExamResult, ICreateExamResult, IUpdateExamResult,
  IGradeScale, ICreateGradeScale, IUpdateGradeScale,
} from '../types/exam.types';

// ── EXAM QUERIES ──

export const createExam = async (
  school_id: number,
  data: ICreateExam
): Promise<IExam> => {
  const result = await pool.query(
    `INSERT INTO exams
      (school_id, academic_year_id, name, exam_type, start_date, end_date, status, is_schedule_published, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, school_id, academic_year_id, name, exam_type,
       start_date::text, end_date::text, status, COALESCE(is_schedule_published, false) as is_schedule_published, description, created_at, updated_at`,
    [
      school_id,
      data.academic_year_id,
      data.name,
      data.exam_type,
      data.start_date,
      data.end_date,
      data.status || 'upcoming',
      data.is_schedule_published ?? false,
      data.description || null,
    ]
  );
  return result.rows[0];
};

export const getExamsBySchool = async (
  school_id: number,
  academic_year_id: number
): Promise<IExam[]> => {
  const result = await pool.query(
    `SELECT id, school_id, academic_year_id, name, exam_type,
       start_date::text, end_date::text, status, COALESCE(is_schedule_published, false) as is_schedule_published, description, created_at, updated_at
     FROM exams WHERE school_id = $1 AND academic_year_id = $2
     ORDER BY start_date DESC`,
    [school_id, academic_year_id]
  );
  return result.rows;
};

export const getExamById = async (
  id: number,
  school_id: number
): Promise<(IExam & { has_published_results?: boolean }) | null> => {
  const result = await pool.query(
    `SELECT e.id, e.school_id, e.academic_year_id, e.name, e.exam_type,
       e.start_date::text, e.end_date::text, e.status, 
       COALESCE(e.is_schedule_published, false) as is_schedule_published, 
       e.description, e.created_at, e.updated_at,
       EXISTS(
         SELECT 1 FROM exam_results er 
         WHERE er.exam_id = e.id AND er.school_id = e.school_id AND er.status = 'published'
       ) as has_published_results
     FROM exams e WHERE e.id = $1 AND e.school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateExam = async (
  id: number,
  school_id: number,
  data: IUpdateExam
): Promise<IExam | null> => {
  const result = await pool.query(
    `UPDATE exams SET
      name                  = COALESCE($1, name),
      exam_type             = COALESCE($2, exam_type),
      start_date            = COALESCE($3, start_date),
      end_date              = COALESCE($4, end_date),
      status                = COALESCE($5, status),
      is_schedule_published = COALESCE($6, is_schedule_published),
      description           = COALESCE($7, description),
      updated_at            = NOW()
     WHERE id = $8 AND school_id = $9
     RETURNING id, school_id, academic_year_id, name, exam_type,
       start_date::text, end_date::text, status, COALESCE(is_schedule_published, false) as is_schedule_published, description, created_at, updated_at`,
    [
      data.name || null,
      data.exam_type || null,
      data.start_date || null,
      data.end_date || null,
      data.status || null,
      data.is_schedule_published !== undefined ? data.is_schedule_published : null,
      data.description || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const deleteExam = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM exams WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── EXAM SCHEDULE QUERIES ──

export const createExamSchedule = async (
  school_id: number,
  data: ICreateExamSchedule
): Promise<IExamSchedule> => {
  const result = await pool.query(
    `INSERT INTO exam_schedules
      (school_id, exam_id, class_id, subject_id, exam_date, start_time, end_time, max_marks, pass_marks, weightage, venue)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, school_id, exam_id, class_id, subject_id,
       exam_date::text, start_time, end_time, max_marks, pass_marks, weightage, venue,
       created_at, updated_at`,
    [
      school_id,
      data.exam_id,
      data.class_id,
      data.subject_id,
      data.exam_date,
      data.start_time || null,
      data.end_time || null,
      data.max_marks,
      data.pass_marks,
      data.weightage || null,
      data.venue || null,
    ]
  );
  return result.rows[0];
};

export const getSchedulesByExam = async (
  exam_id: number,
  school_id: number
): Promise<IExamSchedule[]> => {
  const result = await pool.query(
    `SELECT es.id, es.school_id, es.exam_id, es.class_id, es.subject_id,
       es.exam_date::text, es.start_time, es.end_time, es.max_marks, es.pass_marks,
       es.weightage, es.venue, es.created_at, es.updated_at,
       s.name as subject_name, c.name as class_name
     FROM exam_schedules es
     INNER JOIN subjects s ON s.id = es.subject_id
     INNER JOIN classes c ON c.id = es.class_id
     WHERE es.exam_id = $1 AND es.school_id = $2
     ORDER BY es.exam_date ASC`,
    [exam_id, school_id]
  );
  return result.rows;
};

export const getScheduleById = async (
  id: number,
  school_id: number
): Promise<IExamSchedule | null> => {
  const result = await pool.query(
    `SELECT * FROM exam_schedules WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateExamSchedule = async (
  id: number,
  school_id: number,
  data: IUpdateExamSchedule
): Promise<IExamSchedule | null> => {
  const result = await pool.query(
    `UPDATE exam_schedules SET
      exam_date  = COALESCE($1, exam_date),
      start_time = COALESCE($2, start_time),
      end_time   = COALESCE($3, end_time),
      max_marks  = COALESCE($4, max_marks),
      pass_marks = COALESCE($5, pass_marks),
      weightage  = COALESCE($6, weightage),
      venue      = COALESCE($7, venue),
      updated_at = NOW()
     WHERE id = $8 AND school_id = $9
     RETURNING *`,
    [
      data.exam_date || null,
      data.start_time || null,
      data.end_time || null,
      data.max_marks || null,
      data.pass_marks || null,
      data.weightage || null,
      data.venue || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const deleteExamSchedule = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM exam_schedules WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── EXAM RESULT QUERIES ──

export const createExamResult = async (
  school_id: number,
  data: ICreateExamResult,
  percentage: number | null,
  grade: string | null,
  gpa: number | null,
  is_passed: boolean | null
): Promise<IExamResult> => {
  const result = await pool.query(
    `INSERT INTO exam_results
      (school_id, exam_id, schedule_id, student_id, enrollment_id, subject_id,
       marks_obtained, max_marks, pass_marks, percentage, grade, gpa, is_passed,
       is_absent, remarks, entered_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      school_id,
      data.exam_id,
      data.schedule_id,
      data.student_id,
      data.enrollment_id,
      data.subject_id,
      data.marks_obtained ?? null,
      data.max_marks,
      data.pass_marks,
      percentage,
      grade,
      gpa,
      is_passed,
      data.is_absent || false,
      data.remarks || null,
      data.entered_by || null,
      'draft',
    ]
  );
  return result.rows[0];
};

export const getResultsByExamAndClass = async (
  exam_id: number,
  class_id: number,
  school_id: number
): Promise<IExamResult[]> => {
  const result = await pool.query(
    `SELECT er.*, s.full_name as student_name, s.admission_number, sub.name as subject_name
     FROM exam_results er
     INNER JOIN students s ON s.id = er.student_id
     INNER JOIN subjects sub ON sub.id = er.subject_id
     INNER JOIN student_enrollments se ON se.id = er.enrollment_id
     WHERE er.exam_id = $1 AND se.class_id = $2 AND er.school_id = $3
     ORDER BY s.full_name ASC`,
    [exam_id, class_id, school_id]
  );
  return result.rows;
};

export const getResultsByStudent = async (
  student_id: number,
  exam_id: number,
  school_id: number
): Promise<IExamResult[]> => {
  const result = await pool.query(
    `SELECT er.*, sub.name as subject_name
     FROM exam_results er
     INNER JOIN subjects sub ON sub.id = er.subject_id
     WHERE er.student_id = $1 AND er.exam_id = $2 AND er.school_id = $3
     ORDER BY sub.name ASC`,
    [student_id, exam_id, school_id]
  );
  return result.rows;
};

export const getStudentAllResults = async (
  student_id: number,
  school_id: number,
  academic_year_id: number
): Promise<any[]> => {
  const result = await pool.query(
    `WITH student_exam_totals AS (
      SELECT 
        er.exam_id,
        er.student_id,
        se.class_id,
        se.section_id,
        SUM(COALESCE(er.marks_obtained, 0)) AS total_obtained,
        SUM(er.max_marks) AS total_max,
        ROUND(SUM(COALESCE(er.marks_obtained, 0)) * 100.0 / NULLIF(SUM(er.max_marks), 0), 2) AS overall_percentage
      FROM exam_results er
      INNER JOIN student_enrollments se ON se.id = er.enrollment_id
      WHERE er.school_id = $2 AND er.status = 'published'
      GROUP BY er.exam_id, er.student_id, se.class_id, se.section_id
    ),
    ranked_totals AS (
      SELECT 
        st.exam_id,
        st.student_id,
        st.class_id,
        st.section_id,
        st.total_obtained,
        st.total_max,
        st.overall_percentage,
        DENSE_RANK() OVER (
          PARTITION BY st.exam_id, st.class_id 
          ORDER BY st.overall_percentage DESC, st.total_obtained DESC
        ) AS class_rank,
        COUNT(*) OVER (
          PARTITION BY st.exam_id, st.class_id
        ) AS total_students_in_class,
        DENSE_RANK() OVER (
          PARTITION BY st.exam_id, st.section_id 
          ORDER BY st.overall_percentage DESC, st.total_obtained DESC
        ) AS section_rank,
        COUNT(*) OVER (
          PARTITION BY st.exam_id, st.section_id
        ) AS total_students_in_section
      FROM student_exam_totals st
    )
    SELECT 
      er.*,
      sub.name as subject_name,
      ex.name as exam_name,
      ex.exam_type,
      c.name as class_name,
      sec.name as section_name,
      COALESCE(sc.section_count, 1) as class_section_count,
      rt.class_rank,
      rt.total_students_in_class,
      rt.section_rank,
      rt.total_students_in_section,
      rt.overall_percentage as exam_overall_percentage,
      rt.total_obtained as exam_total_obtained,
      rt.total_max as exam_total_max
    FROM exam_results er
    INNER JOIN subjects sub ON sub.id = er.subject_id
    INNER JOIN exams ex ON ex.id = er.exam_id
    INNER JOIN student_enrollments se ON se.id = er.enrollment_id
    LEFT JOIN classes c ON c.id = se.class_id
    LEFT JOIN sections sec ON sec.id = se.section_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as section_count 
      FROM sections s 
      WHERE s.class_id = se.class_id AND s.school_id = $2 AND s.status = 'active'
    ) sc ON true
    LEFT JOIN ranked_totals rt ON rt.exam_id = er.exam_id AND rt.student_id = er.student_id
    WHERE er.student_id = $1 
      AND er.school_id = $2
      AND ex.academic_year_id = $3 
      AND er.status = 'published'
    ORDER BY ex.start_date DESC, sub.name ASC`,
    [student_id, school_id, academic_year_id]
  );
  return result.rows;
};

export const getResultById = async (
  id: number,
  school_id: number
): Promise<IExamResult | null> => {
  const result = await pool.query(
    `SELECT * FROM exam_results WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateExamResult = async (
  id: number,
  school_id: number,
  data: IUpdateExamResult,
  percentage: number | null,
  grade: string | null,
  gpa: number | null,
  is_passed: boolean | null
): Promise<IExamResult | null> => {
  const result = await pool.query(
    `UPDATE exam_results SET
      marks_obtained = COALESCE($1, marks_obtained),
      percentage     = COALESCE($2, percentage),
      grade          = COALESCE($3, grade),
      gpa            = COALESCE($4, gpa),
      is_passed      = COALESCE($5, is_passed),
      is_absent      = COALESCE($6, is_absent),
      remarks        = COALESCE($7, remarks),
      updated_at     = NOW()
     WHERE id = $8 AND school_id = $9
     RETURNING *`,
    [
      data.marks_obtained ?? null,
      percentage,
      grade,
      gpa,
      is_passed,
      data.is_absent ?? null,
      data.remarks || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const publishExamResults = async (
  exam_id: number,
  class_id: number,
  school_id: number
): Promise<number> => {
  const result = await pool.query(
    `UPDATE exam_results er SET status = 'published', updated_at = NOW()
     FROM student_enrollments se
     WHERE er.enrollment_id = se.id
       AND er.exam_id = $1 AND se.class_id = $2 AND er.school_id = $3
     RETURNING er.id`,
    [exam_id, class_id, school_id]
  );
  return result.rowCount ?? 0;
};

export const unpublishExamResults = async (
  exam_id: number,
  class_id: number,
  school_id: number
): Promise<number> => {
  const result = await pool.query(
    `UPDATE exam_results er SET status = 'draft', updated_at = NOW()
     FROM student_enrollments se
     WHERE er.enrollment_id = se.id
       AND er.exam_id = $1 AND se.class_id = $2 AND er.school_id = $3
     RETURNING er.id`,
    [exam_id, class_id, school_id]
  );
  return result.rowCount ?? 0;
};

export const hasPublishedResultsForExam = async (
  exam_id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `SELECT 1 FROM exam_results WHERE exam_id = $1 AND school_id = $2 AND status = 'published' LIMIT 1`,
    [exam_id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── GRADE SCALE QUERIES ──

export const createGradeScale = async (
  school_id: number,
  data: ICreateGradeScale
): Promise<IGradeScale> => {
  const result = await pool.query(
    `INSERT INTO grade_scales
      (school_id, grade, min_percentage, max_percentage, gpa, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      school_id,
      data.grade,
      data.min_percentage,
      data.max_percentage,
      data.gpa,
      data.description || null,
    ]
  );
  return result.rows[0];
};

export const getGradeScalesBySchool = async (
  school_id: number
): Promise<IGradeScale[]> => {
  const result = await pool.query(
    `SELECT * FROM grade_scales WHERE school_id = $1 ORDER BY min_percentage DESC`,
    [school_id]
  );
  return result.rows;
};

export const getGradeByPercentage = async (
  school_id: number,
  percentage: number
): Promise<IGradeScale | null> => {
  const result = await pool.query(
    `SELECT * FROM grade_scales
     WHERE school_id = $1 AND $2 >= min_percentage AND $2 <= max_percentage
     LIMIT 1`,
    [school_id, percentage]
  );
  return result.rows[0] || null;
};

export const updateGradeScale = async (
  id: number,
  school_id: number,
  data: IUpdateGradeScale
): Promise<IGradeScale | null> => {
  const result = await pool.query(
    `UPDATE grade_scales SET
      grade          = COALESCE($1, grade),
      min_percentage = COALESCE($2, min_percentage),
      max_percentage = COALESCE($3, max_percentage),
      gpa            = COALESCE($4, gpa),
      description    = COALESCE($5, description),
      updated_at     = NOW()
     WHERE id = $6 AND school_id = $7
     RETURNING *`,
    [
      data.grade || null,
      data.min_percentage || null,
      data.max_percentage || null,
      data.gpa || null,
      data.description || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const deleteGradeScale = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM grade_scales WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

export const publishExamSchedule = async (
  exam_id: number,
  school_id: number,
  is_published: boolean = true
): Promise<IExam | null> => {
  const result = await pool.query(
    `UPDATE exams SET
      is_schedule_published = $1,
      updated_at = NOW()
     WHERE id = $2 AND school_id = $3
     RETURNING id, school_id, academic_year_id, name, exam_type,
       start_date::text, end_date::text, status, COALESCE(is_schedule_published, false) as is_schedule_published, description, created_at, updated_at`,
    [is_published, exam_id, school_id]
  );
  return result.rows[0] || null;
};

export const getStudentExamSchedules = async (
  student_id: number,
  school_id: number,
  academic_year_id?: number
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT es.id, es.school_id, es.exam_id, es.class_id, es.subject_id,
       es.exam_date::text, es.start_time, es.end_time, es.max_marks, es.pass_marks,
       es.weightage, es.venue, es.created_at, es.updated_at,
       e.name as exam_name, e.exam_type, e.start_date::text as exam_start_date,
       e.end_date::text as exam_end_date, e.status as exam_status,
       s.name as subject_name, c.name as class_name
     FROM exam_schedules es
     INNER JOIN exams e ON e.id = es.exam_id
     INNER JOIN subjects s ON s.id = es.subject_id
     INNER JOIN classes c ON c.id = es.class_id
     INNER JOIN student_enrollments en ON en.student_id = $1 AND en.class_id = es.class_id AND en.school_id = $2
     WHERE es.school_id = $2
       AND COALESCE(e.is_schedule_published, false) = true
       AND ($3::int IS NULL OR e.academic_year_id = $3)
     ORDER BY es.exam_date ASC, es.start_time ASC`,
    [student_id, school_id, academic_year_id || null]
  );
  return result.rows;
};

export const getExamClassRegisterData = async (
  exam_id: number,
  class_id: number,
  section_id: number | null,
  school_id: number
) => {
  // 1. Exam metadata
  const examRes = await pool.query(
    `SELECT id, name, exam_type, start_date::text, end_date::text, status,
            COALESCE(is_schedule_published, false) as is_schedule_published
     FROM exams WHERE id = $1 AND school_id = $2`,
    [exam_id, school_id]
  );
  const exam = examRes.rows[0] || null;

  // 2. Class & Section info
  const classRes = await pool.query(
    `SELECT c.id, c.name as class_name,
            (SELECT COUNT(*)::int FROM sections WHERE class_id = c.id AND school_id = $2 AND status = 'active') as section_count
     FROM classes c WHERE c.id = $1 AND c.school_id = $2`,
    [class_id, school_id]
  );
  const classInfo = classRes.rows[0] || null;

  let sectionInfo = null;
  if (section_id) {
    const secRes = await pool.query(
      `SELECT s.id, s.name as section_name, s.coordinator_id, t.full_name as coordinator_name
       FROM sections s
       LEFT JOIN teachers t ON t.id = s.coordinator_id
       WHERE s.id = $1 AND s.school_id = $2`,
      [section_id, school_id]
    );
    sectionInfo = secRes.rows[0] || null;
  }

  // 3. Scheduled subjects
  const subjectsRes = await pool.query(
    `SELECT es.id as schedule_id, es.subject_id, s.name as subject_name, s.code as subject_code,
            es.exam_date::text, es.start_time, es.end_time, es.max_marks, es.pass_marks
     FROM exam_schedules es
     INNER JOIN subjects s ON s.id = es.subject_id
     WHERE es.exam_id = $1 AND es.class_id = $2 AND es.school_id = $3
     ORDER BY es.exam_date ASC, s.name ASC`,
    [exam_id, class_id, school_id]
  );

  // 4. Students
  const studentsRes = await pool.query(
    `SELECT se.id as enrollment_id, se.student_id, se.roll_number, se.section_id,
            st.admission_number, st.full_name, st.gender, st.photo, sec.name as section_name
     FROM student_enrollments se
     INNER JOIN students st ON st.id = se.student_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     WHERE se.class_id = $1 AND se.school_id = $2
       AND ($3::int IS NULL OR se.section_id = $3)
       AND se.status = 'active'
     ORDER BY LPAD(COALESCE(se.roll_number, '999999'), 6, '0') ASC, st.full_name ASC`,
    [class_id, school_id, section_id || null]
  );

  // 5. Results
  const resultsRes = await pool.query(
    `SELECT er.id, er.student_id, er.enrollment_id, er.subject_id, er.schedule_id,
            er.marks_obtained, er.max_marks, er.pass_marks, er.percentage,
            er.grade, er.gpa, er.is_passed, er.is_absent, er.remarks, er.status
     FROM exam_results er
     WHERE er.exam_id = $1 AND er.school_id = $2
       AND er.enrollment_id IN (
         SELECT id FROM student_enrollments
         WHERE class_id = $3 AND ($4::int IS NULL OR section_id = $4) AND school_id = $2
       )`,
    [exam_id, school_id, class_id, section_id || null]
  );

  return {
    exam,
    classInfo,
    sectionInfo,
    subjects: subjectsRes.rows,
    students: studentsRes.rows,
    results: resultsRes.rows,
  };
};

export const upsertSingleExamResult = async (
  client: any,
  school_id: number,
  data: ICreateExamResult,
  percentage: number | null,
  grade: string | null,
  gpa: number | null,
  is_passed: boolean | null
): Promise<IExamResult> => {
  const existing = await client.query(
    `SELECT id FROM exam_results
     WHERE school_id = $1 AND schedule_id = $2 AND student_id = $3
     LIMIT 1`,
    [school_id, data.schedule_id, data.student_id]
  );

  if (existing.rows.length > 0) {
    const res = await client.query(
      `UPDATE exam_results SET
        marks_obtained = $1,
        max_marks      = $2,
        pass_marks     = $3,
        percentage     = $4,
        grade          = $5,
        gpa            = $6,
        is_passed      = $7,
        is_absent      = $8,
        remarks        = COALESCE($9, remarks),
        updated_at     = NOW()
       WHERE id = $10 AND school_id = $11
       RETURNING *`,
      [
        data.marks_obtained ?? null,
        data.max_marks,
        data.pass_marks,
        percentage,
        grade,
        gpa,
        is_passed,
        data.is_absent || false,
        data.remarks || null,
        existing.rows[0].id,
        school_id,
      ]
    );
    return res.rows[0];
  } else {
    const res = await client.query(
      `INSERT INTO exam_results
        (school_id, exam_id, schedule_id, student_id, enrollment_id, subject_id,
         marks_obtained, max_marks, pass_marks, percentage, grade, gpa, is_passed,
         is_absent, remarks, entered_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        school_id,
        data.exam_id,
        data.schedule_id,
        data.student_id,
        data.enrollment_id,
        data.subject_id,
        data.marks_obtained ?? null,
        data.max_marks,
        data.pass_marks,
        percentage,
        grade,
        gpa,
        is_passed,
        data.is_absent || false,
        data.remarks || null,
        data.entered_by || null,
        'draft',
      ]
    );
    return res.rows[0];
  }
};