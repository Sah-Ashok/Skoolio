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
      (school_id, academic_year_id, name, exam_type, start_date, end_date, status, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, school_id, academic_year_id, name, exam_type,
       start_date::text, end_date::text, status, description, created_at, updated_at`,
    [
      school_id,
      data.academic_year_id,
      data.name,
      data.exam_type,
      data.start_date,
      data.end_date,
      data.status || 'upcoming',
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
       start_date::text, end_date::text, status, description, created_at, updated_at
     FROM exams WHERE school_id = $1 AND academic_year_id = $2
     ORDER BY start_date DESC`,
    [school_id, academic_year_id]
  );
  return result.rows;
};

export const getExamById = async (
  id: number,
  school_id: number
): Promise<IExam | null> => {
  const result = await pool.query(
    `SELECT id, school_id, academic_year_id, name, exam_type,
       start_date::text, end_date::text, status, description, created_at, updated_at
     FROM exams WHERE id = $1 AND school_id = $2`,
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
      name        = COALESCE($1, name),
      exam_type   = COALESCE($2, exam_type),
      start_date  = COALESCE($3, start_date),
      end_date    = COALESCE($4, end_date),
      status      = COALESCE($5, status),
      description = COALESCE($6, description),
      updated_at  = NOW()
     WHERE id = $7 AND school_id = $8
     RETURNING id, school_id, academic_year_id, name, exam_type,
       start_date::text, end_date::text, status, description, created_at, updated_at`,
    [
      data.name || null,
      data.exam_type || null,
      data.start_date || null,
      data.end_date || null,
      data.status || null,
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
    `SELECT es.*, s.name as subject_name, c.name as class_name
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
): Promise<IExamResult[]> => {
  const result = await pool.query(
    `SELECT er.*, sub.name as subject_name, ex.name as exam_name, ex.exam_type
     FROM exam_results er
     INNER JOIN subjects sub ON sub.id = er.subject_id
     INNER JOIN exams ex ON ex.id = er.exam_id
     WHERE er.student_id = $1 AND er.school_id = $2
       AND ex.academic_year_id = $3 AND er.status = 'published'
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