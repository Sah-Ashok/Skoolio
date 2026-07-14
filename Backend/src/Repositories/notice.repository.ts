import pool from '../config/db';
import { INotice, ICreateNotice, IUpdateNotice } from '../types/notice.types';

// ── SELECT fragment shared across queries ──────────────────────
const SELECT_COLS = `
  n.id, n.school_id, n.created_by_role, n.created_by_id, n.created_by_name,
  n.title, n.content, n.target_type, n.target_section_id, n.is_pinned,
  n.expires_at::text, n.status, n.created_at, n.updated_at,
  sec.name AS section_name,
  cls.name AS class_name
`;

const JOIN_FRAGMENT = `
  FROM notices n
  LEFT JOIN sections sec ON sec.id = n.target_section_id
  LEFT JOIN classes  cls ON cls.id = sec.class_id
`;

// ── CREATE ─────────────────────────────────────────────────────

export const createNotice = async (
  school_id: number,
  created_by_role: 'admin' | 'faculty',
  created_by_id: number,
  created_by_name: string,
  data: ICreateNotice
): Promise<INotice> => {
  const result = await pool.query(
    `INSERT INTO notices
       (school_id, created_by_role, created_by_id, created_by_name,
        title, content, target_type, target_section_id, is_pinned, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING
       id, school_id, created_by_role, created_by_id, created_by_name,
       title, content, target_type, target_section_id, is_pinned,
       expires_at::text, status, created_at, updated_at`,
    [
      school_id,
      created_by_role,
      created_by_id,
      created_by_name,
      data.title,
      data.content,
      data.target_type ?? null,
      data.target_section_id ?? null,
      data.is_pinned ?? false,
      data.expires_at ?? null,
    ]
  );
  return result.rows[0];
};

// ── GET ALL (admin view — all notices for the school) ──────────

export const getAllNoticesForSchool = async (school_id: number): Promise<INotice[]> => {
  const result = await pool.query(
    `SELECT ${SELECT_COLS}
     ${JOIN_FRAGMENT}
     WHERE n.school_id = $1
     ORDER BY n.is_pinned DESC, n.created_at DESC`,
    [school_id]
  );
  return result.rows;
};

// ── GET FOR TEACHER (their own + school-wide, filtered by section) ──

export const getNoticesForTeacher = async (
  school_id: number,
  teacher_id: number,
  section_ids: number[]   // sections this teacher coordinates
): Promise<INotice[]> => {
  // Returns:
  //   1. School-wide notices (target_type IS NULL) created by admin
  //   2. Notices targeting sections the teacher coordinates
  //   3. Notices created by the teacher themselves
  // Excludes expired notices.
  const result = await pool.query(
    `SELECT ${SELECT_COLS}
     ${JOIN_FRAGMENT}
     WHERE n.school_id = $1
       AND n.status = 'active'
       AND (n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)
       AND (
         n.target_type IS NULL
         OR n.target_section_id = ANY($2::int[])
         OR (n.created_by_role = 'faculty' AND n.created_by_id = $3)
       )
     ORDER BY n.is_pinned DESC, n.created_at DESC`,
    [school_id, section_ids, teacher_id]
  );
  return result.rows;
};

// ── GET FOR STUDENT (school-wide + their enrolled section) ──

export const getNoticesForStudent = async (
  school_id: number,
  section_id: number | null
): Promise<INotice[]> => {
  const result = await pool.query(
    `SELECT ${SELECT_COLS}
     ${JOIN_FRAGMENT}
     WHERE n.school_id = $1
       AND n.status = 'active'
       AND (n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)
       AND (
         n.target_type IS NULL
         OR ($2::int IS NOT NULL AND n.target_section_id = $2)
       )
     ORDER BY n.is_pinned DESC, n.created_at DESC`,
    [school_id, section_id]
  );
  return result.rows;
};

// Get student's active section_id from enrollments
export const getStudentActiveSectionId = async (
  student_id: number,
  school_id: number
): Promise<number | null> => {
  const result = await pool.query(
    `SELECT section_id
     FROM student_enrollments
     WHERE student_id = $1
       AND school_id  = $2
       AND status     = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [student_id, school_id]
  );
  return result.rows[0]?.section_id ?? null;
};


export const getNoticeById = async (id: number, school_id: number): Promise<INotice | null> => {
  const result = await pool.query(
    `SELECT ${SELECT_COLS}
     ${JOIN_FRAGMENT}
     WHERE n.id = $1 AND n.school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

// ── UPDATE ────────────────────────────────────────────────────

export const updateNotice = async (
  id: number,
  school_id: number,
  data: IUpdateNotice
): Promise<INotice | null> => {
  const setClauses: string[] = ['updated_at = NOW()'];
  const values: any[]        = [];

  const push = (col: string, val: any) => {
    values.push(val);
    setClauses.unshift(`${col} = $${values.length}`);
  };

  if (data.title             !== undefined) push('title',             data.title);
  if (data.content           !== undefined) push('content',           data.content);
  if (data.target_type       !== undefined) push('target_type',       data.target_type);
  if (data.target_section_id !== undefined) push('target_section_id', data.target_section_id);
  if (data.is_pinned         !== undefined) push('is_pinned',         data.is_pinned);
  if (data.expires_at        !== undefined) push('expires_at',        data.expires_at);
  if (data.status            !== undefined) push('status',            data.status);

  if (values.length === 0) return getNoticeById(id, school_id);

  values.push(id, school_id);
  const result = await pool.query(
    `UPDATE notices
     SET ${setClauses.join(', ')}
     WHERE id = $${values.length - 1} AND school_id = $${values.length}
     RETURNING
       id, school_id, created_by_role, created_by_id, created_by_name,
       title, content, target_type, target_section_id, is_pinned,
       expires_at::text, status, created_at, updated_at`,
    values
  );
  return result.rows[0] || null;
};

// ── DELETE ────────────────────────────────────────────────────

export const deleteNotice = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM notices WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── TEACHER SECTION IDS helper ────────────────────────────────
// Fetch section IDs where this teacher is the coordinator

export const getTeacherSectionIds = async (
  teacher_id: number,
  school_id: number
): Promise<number[]> => {
  const result = await pool.query(
    `SELECT id FROM sections WHERE coordinator_id = $1 AND school_id = $2`,
    [teacher_id, school_id]
  );
  return result.rows.map(r => r.id);
};
