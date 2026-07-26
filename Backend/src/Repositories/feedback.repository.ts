import pool from '../config/db';
import { IFeedback, ICreateFeedback, IUpdateFeedbackStatus, FeedbackRole } from '../types/feedback.types';

export const createFeedback = async (
  school_id: number, submitted_by: number, role: FeedbackRole,
  submitter_name: string, data: ICreateFeedback
): Promise<IFeedback> => {
  const result = await pool.query(
    `INSERT INTO feedback
       (school_id, submitted_by, role, submitter_name,
        category, title, description, rating, priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [school_id, submitted_by, role, submitter_name,
     data.category, data.title, data.description,
     data.rating ?? null, data.priority ?? 'medium']
  );
  return result.rows[0];
};

export const getFeedbackBySchool = async (
  school_id: number,
  filters: { status?: string; category?: string; role?: string } = {}
): Promise<IFeedback[]> => {
  const conditions = ['f.school_id = $1'];
  const params: any[] = [school_id];
  let i = 2;
  if (filters.status)   { conditions.push(`f.status   = $${i++}`); params.push(filters.status); }
  if (filters.category) { conditions.push(`f.category = $${i++}`); params.push(filters.category); }
  if (filters.role)     { conditions.push(`f.role     = $${i++}`); params.push(filters.role); }
  const result = await pool.query(
    `SELECT f.*, s.school_name FROM feedback f
     LEFT JOIN schools s ON s.id = f.school_id
     WHERE ${conditions.join(' AND ')} ORDER BY f.created_at DESC`,
    params
  );
  return result.rows;
};

export const getFeedbackByTeacher = async (
  school_id: number, teacher_id: number
): Promise<IFeedback[]> => {
  const result = await pool.query(
    `SELECT * FROM feedback
     WHERE school_id = $1 AND submitted_by = $2 AND role = 'faculty'
     ORDER BY created_at DESC`,
    [school_id, teacher_id]
  );
  return result.rows;
};

export const getFeedbackById = async (
  id: number, school_id: number
): Promise<IFeedback | null> => {
  const result = await pool.query(
    `SELECT f.*, s.school_name FROM feedback f
     LEFT JOIN schools s ON s.id = f.school_id
     WHERE f.id = $1 AND f.school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const getAllFeedbackSuperAdmin = async (
  filters: { status?: string; category?: string } = {}
): Promise<IFeedback[]> => {
  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (filters.status)   { conditions.push(`f.status   = $${i++}`); params.push(filters.status); }
  if (filters.category) { conditions.push(`f.category = $${i++}`); params.push(filters.category); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT f.*, s.school_name FROM feedback f
     LEFT JOIN schools s ON s.id = f.school_id
     ${where} ORDER BY f.created_at DESC`,
    params
  );
  return result.rows;
};

export const updateFeedbackStatus = async (
  id: number, data: IUpdateFeedbackStatus
): Promise<IFeedback | null> => {
  const result = await pool.query(
    `UPDATE feedback SET
       status         = COALESCE($1, status),
       priority       = COALESCE($2, priority),
       admin_response = COALESCE($3, admin_response),
       responded_at   = CASE WHEN $3 IS NOT NULL THEN NOW() ELSE responded_at END,
       updated_at     = NOW()
     WHERE id = $4 RETURNING *`,
    [data.status || null, data.priority || null, data.admin_response || null, id]
  );
  return result.rows[0] || null;
};

export const deleteFeedback = async (id: number): Promise<boolean> => {
  const result = await pool.query(`DELETE FROM feedback WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
};

export const getFeedbackStats = async () => {
  const result = await pool.query(
    `SELECT
       COUNT(*)                                               AS total,
       SUM(CASE WHEN status = 'open'      THEN 1 ELSE 0 END) AS open,
       SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) AS in_review,
       SUM(CASE WHEN status = 'resolved'  THEN 1 ELSE 0 END) AS resolved,
       ROUND(AVG(rating)::NUMERIC, 1)                         AS avg_rating
     FROM feedback`
  );
  const r = result.rows[0];
  return {
    total:     parseInt(r.total     ?? '0', 10),
    open:      parseInt(r.open      ?? '0', 10),
    in_review: parseInt(r.in_review ?? '0', 10),
    resolved:  parseInt(r.resolved  ?? '0', 10),
    avg_rating: parseFloat(r.avg_rating ?? '0'),
  };
};
