import pool from '../config/db';
import {
  IClass, ICreateClass, IUpdateClass,
  ISection, ICreateSection, IUpdateSection,
  ISubject, ICreateSubject, IUpdateSubject,
  IClassSubject, IClassSubjectTeacher, IAssignSubjectTeacher,
} from '../types/class.types';

// ── CLASS ──────────────────────────────────────────────────────────────────────

export const createClass = async (school_id: number, data: ICreateClass): Promise<IClass> => {
  const result = await pool.query(
    `INSERT INTO classes (school_id, academic_year_id, name, stream, room_no, status, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [school_id, data.academic_year_id, data.name, data.stream || null,
     data.room_no || null, data.status || 'active', data.description || null]
  );
  return result.rows[0];
};

export const getClassesBySchool = async (school_id: number, academic_year_id: number): Promise<IClass[]> => {
  const result = await pool.query(
    `SELECT * FROM classes WHERE school_id = $1 AND academic_year_id = $2 ORDER BY name ASC`,
    [school_id, academic_year_id]
  );
  return result.rows;
};

export const getClassById = async (id: number, school_id: number): Promise<IClass | null> => {
  const result = await pool.query(
    `SELECT * FROM classes WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateClass = async (id: number, school_id: number, data: IUpdateClass): Promise<IClass | null> => {
  const result = await pool.query(
    `UPDATE classes SET
       name        = COALESCE($1, name),
       stream      = COALESCE($2, stream),
       room_no     = COALESCE($3, room_no),
       status      = COALESCE($4, status),
       description = COALESCE($5, description),
       updated_at  = NOW()
     WHERE id = $6 AND school_id = $7 RETURNING *`,
    [data.name || null, data.stream || null, data.room_no || null,
     data.status || null, data.description || null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteClass = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM classes WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── SECTION ────────────────────────────────────────────────────────────────────

export const createSection = async (school_id: number, class_id: number, data: ICreateSection): Promise<ISection> => {
  const result = await pool.query(
    `INSERT INTO sections (school_id, class_id, name, room_no, capacity, coordinator_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [school_id, class_id, data.name, data.room_no || null,
     data.capacity || 40, data.coordinator_id || null, data.status || 'active']
  );
  return result.rows[0];
};

export const getSectionsByClass = async (class_id: number, school_id: number): Promise<ISection[]> => {
  const result = await pool.query(
    `SELECT s.*, t.full_name AS coordinator_name
     FROM sections s
     LEFT JOIN teachers t ON t.id = s.coordinator_id
     WHERE s.class_id = $1 AND s.school_id = $2
     ORDER BY s.name ASC`,
    [class_id, school_id]
  );
  return result.rows;
};

export const getSectionById = async (id: number, school_id: number): Promise<ISection | null> => {
  const result = await pool.query(
    `SELECT s.*, t.full_name AS coordinator_name
     FROM sections s
     LEFT JOIN teachers t ON t.id = s.coordinator_id
     WHERE s.id = $1 AND s.school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

// Get all sections where a teacher is the coordinator (for faculty role)
export const getSectionsByCoordinator = async (teacher_id: number, school_id: number): Promise<ISection[]> => {
  const result = await pool.query(
    `SELECT s.*, c.name AS class_name, t.full_name AS coordinator_name
     FROM sections s
     INNER JOIN classes  c ON c.id = s.class_id
     LEFT  JOIN teachers t ON t.id = s.coordinator_id
     WHERE s.coordinator_id = $1 AND s.school_id = $2 AND s.status = 'active'
     ORDER BY c.name ASC, s.name ASC`,
    [teacher_id, school_id]
  );
  return result.rows;
};

export const updateSection = async (id: number, school_id: number, data: IUpdateSection): Promise<ISection | null> => {
  const result = await pool.query(
    `UPDATE sections SET
       name           = COALESCE($1, name),
       room_no        = COALESCE($2, room_no),
       capacity       = COALESCE($3, capacity),
       coordinator_id = COALESCE($4, coordinator_id),
       status         = COALESCE($5, status),
       updated_at     = NOW()
     WHERE id = $6 AND school_id = $7 RETURNING *`,
    [data.name || null, data.room_no || null, data.capacity || null,
     data.coordinator_id || null, data.status || null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteSection = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM sections WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── SUBJECT ────────────────────────────────────────────────────────────────────

export const createSubject = async (school_id: number, data: ICreateSubject): Promise<ISubject> => {
  const result = await pool.query(
    `INSERT INTO subjects (school_id, name, code) VALUES ($1, $2, $3) RETURNING *`,
    [school_id, data.name, data.code || null]
  );
  return result.rows[0];
};

export const getSubjectsBySchool = async (school_id: number): Promise<ISubject[]> => {
  const result = await pool.query(
    `SELECT * FROM subjects WHERE school_id = $1 ORDER BY name ASC`, [school_id]
  );
  return result.rows;
};

export const getSubjectById = async (id: number, school_id: number): Promise<ISubject | null> => {
  const result = await pool.query(
    `SELECT * FROM subjects WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateSubject = async (id: number, school_id: number, data: IUpdateSubject): Promise<ISubject | null> => {
  const result = await pool.query(
    `UPDATE subjects SET
       name = COALESCE($1, name), code = COALESCE($2, code), updated_at = NOW()
     WHERE id = $3 AND school_id = $4 RETURNING *`,
    [data.name || null, data.code || null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteSubject = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM subjects WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── CLASS SUBJECTS ─────────────────────────────────────────────────────────────

export const assignSubjectToClass = async (school_id: number, class_id: number, subject_id: number): Promise<IClassSubject> => {
  const result = await pool.query(
    `INSERT INTO class_subjects (school_id, class_id, subject_id) VALUES ($1, $2, $3) RETURNING *`,
    [school_id, class_id, subject_id]
  );
  return result.rows[0];
};

export const getSubjectsByClass = async (class_id: number, school_id: number): Promise<any[]> => {
  const result = await pool.query(
    `SELECT s.*,
       cst.teacher_id,
       t.full_name AS teacher_name
     FROM subjects s
     INNER JOIN class_subjects cs   ON cs.subject_id = s.id AND cs.class_id = $1
     LEFT  JOIN class_subject_teachers cst
            ON cst.subject_id = s.id AND cst.class_id = $1 AND cst.school_id = $2
     LEFT  JOIN teachers t ON t.id = cst.teacher_id
     WHERE cs.school_id = $2
     ORDER BY s.name ASC`,
    [class_id, school_id]
  );
  return result.rows;
};

export const removeSubjectFromClass = async (class_id: number, subject_id: number, school_id: number): Promise<boolean> => {
  // Also remove teacher assignment for this subject
  await pool.query(
    `DELETE FROM class_subject_teachers WHERE class_id = $1 AND subject_id = $2 AND school_id = $3`,
    [class_id, subject_id, school_id]
  );
  const result = await pool.query(
    `DELETE FROM class_subjects WHERE class_id = $1 AND subject_id = $2 AND school_id = $3`,
    [class_id, subject_id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── CLASS SUBJECT TEACHERS ──────────────────────────────────────────────────────

export const assignTeacherToSubject = async (
  school_id: number,
  data: IAssignSubjectTeacher
): Promise<IClassSubjectTeacher> => {
  const result = await pool.query(
    `INSERT INTO class_subject_teachers
       (school_id, class_id, subject_id, teacher_id, academic_year_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (school_id, class_id, subject_id, academic_year_id)
     DO UPDATE SET teacher_id = EXCLUDED.teacher_id, updated_at = NOW()
     RETURNING *`,
    [school_id, data.class_id, data.subject_id, data.teacher_id, data.academic_year_id]
  );
  return result.rows[0];
};

export const removeTeacherFromSubject = async (
  school_id: number,
  class_id: number,
  subject_id: number,
  academic_year_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM class_subject_teachers
     WHERE school_id = $1 AND class_id = $2 AND subject_id = $3 AND academic_year_id = $4`,
    [school_id, class_id, subject_id, academic_year_id]
  );
  return (result.rowCount ?? 0) > 0;
};

export const getSubjectTeachersByClass = async (class_id: number, school_id: number): Promise<IClassSubjectTeacher[]> => {
  const result = await pool.query(
    `SELECT cst.*,
       t.full_name AS teacher_name,
       s.name      AS subject_name
     FROM class_subject_teachers cst
     INNER JOIN teachers t ON t.id   = cst.teacher_id
     INNER JOIN subjects s ON s.id   = cst.subject_id
     WHERE cst.class_id = $1 AND cst.school_id = $2
     ORDER BY s.name ASC`,
    [class_id, school_id]
  );
  return result.rows;
};

// What subjects does a teacher teach (across all classes)?
export const getTeacherSubjectClasses = async (teacher_id: number, school_id: number): Promise<any[]> => {
  const result = await pool.query(
    `SELECT cst.*,
       s.name  AS subject_name,
       s.code  AS subject_code,
       c.name  AS class_name
     FROM class_subject_teachers cst
     INNER JOIN subjects s ON s.id = cst.subject_id
     INNER JOIN classes  c ON c.id = cst.class_id
     WHERE cst.teacher_id = $1 AND cst.school_id = $2
     ORDER BY c.name ASC, s.name ASC`,
    [teacher_id, school_id]
  );
  return result.rows;
};

// P1 guard: check if a specific teacher is assigned to a subject in a class for any year.
// Returns true if the assignment exists (teacher can enter marks), false otherwise.
export const isTeacherAssignedToSubjectInClass = async (
  teacher_id: number,
  class_id: number,
  subject_id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `SELECT 1 FROM class_subject_teachers
     WHERE teacher_id = $1 AND class_id = $2 AND subject_id = $3 AND school_id = $4
     LIMIT 1`,
    [teacher_id, class_id, subject_id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};
