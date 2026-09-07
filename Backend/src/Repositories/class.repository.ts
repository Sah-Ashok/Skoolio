import pool from '../config/db';
import { getCache, setCache, deleteCachePattern } from '../utils/redisCache';
import {
  IClass, ICreateClass, IUpdateClass,
  ISection, ICreateSection, IUpdateSection,
  ISubject, ICreateSubject, IUpdateSubject,
  IClassSubject, IClassSubjectTeacher, IAssignSubjectTeacher,
} from '../types/class.types';

// ── CLASS ──────────────────────────────────────────────────────────────────────

export const createClass = async (school_id: number, data: ICreateClass): Promise<IClass> => {
  const result = await pool.query(
    `INSERT INTO classes (school_id, academic_year_id, name, stream, status, description)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [school_id, data.academic_year_id, data.name, data.stream || null,
     data.status || 'active', data.description || null]
  );
  await deleteCachePattern(`cache:classes:${school_id}:*`);
  return result.rows[0];
};

export const getClassesBySchool = async (school_id: number, academic_year_id: number): Promise<IClass[]> => {
  const cacheKey = `cache:classes:${school_id}:${academic_year_id}`;
  const cached = await getCache<IClass[]>(cacheKey);
  if (cached) return cached;

  const result = await pool.query(
    `SELECT * FROM classes WHERE school_id = $1 AND academic_year_id = $2 ORDER BY name ASC`,
    [school_id, academic_year_id]
  );
  if (result.rows) {
    await setCache(cacheKey, result.rows, 3600);
  }
  return result.rows;
};

export const getClassById = async (id: number, school_id: number): Promise<IClass | null> => {
  const result = await pool.query(
    `SELECT * FROM classes WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  return result.rows[0] || null;
};

/**
 * updateClass — explicit SET for every field so that nullable fields
 * (stream, description) can actually be cleared to NULL.
 *
 * Using COALESCE($n, col) would silently keep the old value when the client
 * sends null intentionally (e.g. selecting "Not Applicable" for stream).
 * We only fall back to the existing column value when the key is literally
 * absent from the payload (undefined), not when it is null.
 */
export const updateClass = async (id: number, school_id: number, data: IUpdateClass): Promise<IClass | null> => {
  // Build SET clause dynamically — only update fields that were sent
  const fields: string[] = [];
  const values: any[]    = [];
  let   idx              = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  // stream and description can be explicitly set to null (to clear them)
  if ('stream' in data) {
    fields.push(`stream = $${idx++}`);
    values.push(data.stream ?? null);
  }
  if ('status' in data && data.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(data.status);
  }
  if ('description' in data) {
    fields.push(`description = $${idx++}`);
    values.push(data.description ?? null);
  }

  if (fields.length === 0) {
    // Nothing to update — return the current record
    return getClassById(id, school_id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id, school_id);

  const result = await pool.query(
    `UPDATE classes SET ${fields.join(', ')}
     WHERE id = $${idx++} AND school_id = $${idx++}
     RETURNING *`,
    values
  );
  await deleteCachePattern(`cache:classes:${school_id}:*`);
  return result.rows[0] || null;
};

export const deleteClass = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM classes WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  await deleteCachePattern(`cache:classes:${school_id}:*`);
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
  await deleteCachePattern(`cache:sections:${school_id}:*`);
  return result.rows[0];
};

export const getSectionsByClass = async (class_id: number, school_id: number): Promise<ISection[]> => {
  const cacheKey = `cache:sections:${school_id}:${class_id}`;
  const cached = await getCache<ISection[]>(cacheKey);
  if (cached) return cached;

  const result = await pool.query(
    `SELECT s.*, t.full_name AS coordinator_name
     FROM sections s
     LEFT JOIN teachers t ON t.id = s.coordinator_id
     WHERE s.class_id = $1 AND s.school_id = $2
     ORDER BY s.name ASC`,
    [class_id, school_id]
  );
  if (result.rows) {
    await setCache(cacheKey, result.rows, 86400); // 24 hours TTL
  }
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

/**
 * updateSection — same explicit-field pattern as updateClass.
 * coordinator_id can be cleared to NULL (unassign coordinator).
 * room_no can be cleared to NULL.
 */
export const updateSection = async (id: number, school_id: number, data: IUpdateSection): Promise<ISection | null> => {
  const fields: string[] = [];
  const values: any[]    = [];
  let   idx              = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if ('room_no' in data) {
    fields.push(`room_no = $${idx++}`);
    values.push(data.room_no ?? null);
  }
  if (data.capacity !== undefined) {
    fields.push(`capacity = $${idx++}`);
    values.push(data.capacity);
  }
  if ('coordinator_id' in data) {
    fields.push(`coordinator_id = $${idx++}`);
    values.push(data.coordinator_id ?? null);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(data.status);
  }

  if (fields.length === 0) return getSectionById(id, school_id);

  fields.push(`updated_at = NOW()`);
  values.push(id, school_id);

  const result = await pool.query(
    `UPDATE sections SET ${fields.join(', ')}
     WHERE id = $${idx++} AND school_id = $${idx++}
     RETURNING *`,
    values
  );
  await deleteCachePattern(`cache:sections:${school_id}:*`);
  return result.rows[0] || null;
};

export const deleteSection = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM sections WHERE id = $1 AND school_id = $2`, [id, school_id]
  );
  await deleteCachePattern(`cache:sections:${school_id}:*`);
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
       name = COALESCE($1, name),
       code = COALESCE($2, code),
       updated_at = NOW()
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
  // Check first — avoids relying on a UNIQUE constraint that may not exist yet.
  // Run migration/add_class_subjects_unique.sql to add the constraint.
  const existing = await pool.query(
    `SELECT * FROM class_subjects
     WHERE school_id = $1 AND class_id = $2 AND subject_id = $3`,
    [school_id, class_id, subject_id]
  );
  if (existing.rows[0]) return existing.rows[0];

  const result = await pool.query(
    `INSERT INTO class_subjects (school_id, class_id, subject_id)
     VALUES ($1, $2, $3) RETURNING *`,
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
     INNER JOIN class_subjects cs   ON cs.subject_id = s.id AND cs.class_id = $1 AND cs.school_id = $2
     LEFT  JOIN class_subject_teachers cst
            ON cst.subject_id = s.id AND cst.class_id = $1 AND cst.school_id = $2
     LEFT  JOIN teachers t ON t.id = cst.teacher_id
     WHERE s.school_id = $2
     ORDER BY s.name ASC`,
    [class_id, school_id]
  );
  return result.rows;
};

export const removeSubjectFromClass = async (class_id: number, subject_id: number, school_id: number): Promise<boolean> => {
  // Also remove all teacher assignments for this subject in this class
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
     INNER JOIN teachers t ON t.id = cst.teacher_id
     INNER JOIN subjects s ON s.id = cst.subject_id
     WHERE cst.class_id = $1 AND cst.school_id = $2
     ORDER BY s.name ASC`,
    [class_id, school_id]
  );
  return result.rows;
};

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
