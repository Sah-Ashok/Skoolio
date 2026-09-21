import pool from '../config/db';

// ── PROMOTION REPOSITORY ────────────────────────────────────────────────────

/**
 * Fetch all active enrollments for a given class + academic year,
 * joined with student names so the frontend can display them.
 */
export const getEnrollmentsForPromotion = async (
  school_id: number,
  academic_year_id: number,
  class_id: number
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       se.id              AS enrollment_id,
       se.student_id,
       se.class_id,
       se.section_id,
       se.roll_number,
       se.stream,
       se.transport_required,
       se.transport_route,
       se.pickup_location,
       se.transport_fee,
       se.transport_fee_type,
       se.is_promoted,
       se.promoted_to_class_id,
       se.status          AS enrollment_status,
       s.full_name,
       s.admission_number,
       s.photo,
       s.gender,
       s.status           AS student_status,
       c.name             AS class_name,
       sec.name           AS section_name
     FROM student_enrollments se
     INNER JOIN students  s   ON s.id   = se.student_id
     INNER JOIN classes   c   ON c.id   = se.class_id
     INNER JOIN sections  sec ON sec.id = se.section_id
     WHERE se.school_id       = $1
       AND se.academic_year_id = $2
       AND se.class_id         = $3
       AND se.status           = 'active'
     ORDER BY sec.name ASC, se.roll_number ASC NULLS LAST, s.full_name ASC`,
    [school_id, academic_year_id, class_id]
  );
  return result.rows;
};

export interface PromotionRow {
  enrollment_id: number;
  student_id: number;
  target_class_id: number;
  target_section_id: number;
  stream?: string;
  roll_number?: string;
}

/**
 * Bulk-promote students inside a single DB transaction:
 * 1. Mark source enrollment as is_promoted = true, promoted_to_class_id = target
 * 2. Insert new enrollment in target academic year
 * Returns { promoted: number; skipped: number; errors: string[] }
 */
export const bulkPromoteStudents = async (
  school_id: number,
  source_academic_year_id: number,
  target_academic_year_id: number,
  rows: PromotionRow[]
): Promise<{ promoted: number; skipped: number; errors: string[] }> => {
  if (!rows || rows.length === 0) {
    return { promoted: 0, skipped: 0, errors: [] };
  }

  const client = await pool.connect();
  let promoted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    await client.query('BEGIN');

    const studentIds = rows.map(r => r.student_id);
    const existingRes = await client.query(
      `SELECT student_id FROM student_enrollments
       WHERE school_id = $1 AND academic_year_id = $2 AND student_id = ANY($3::int[])`,
      [school_id, target_academic_year_id, studentIds]
    );

    const existingSet = new Set(existingRes.rows.map(r => Number(r.student_id)));
    const validRows = rows.filter(r => {
      if (existingSet.has(r.student_id)) {
        skipped++;
        return false;
      }
      return true;
    });

    if (validRows.length > 0) {
      const enrollmentIds = validRows.map(r => r.enrollment_id);
      const srcRes = await client.query(
        `SELECT id, transport_required, transport_route, pickup_location, transport_fee, transport_fee_type
         FROM student_enrollments
         WHERE id = ANY($1::int[]) AND school_id = $2`,
        [enrollmentIds, school_id]
      );
      const srcMap = new Map(srcRes.rows.map(r => [r.id, r]));

      await client.query(
        `UPDATE student_enrollments
         SET is_promoted = true, updated_at = NOW()
         WHERE id = ANY($1::int[]) AND school_id = $2`,
        [enrollmentIds, school_id]
      );

      const valuePlaceholders = validRows.map((_, i) => {
        const b = i * 12;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, 'active')`;
      }).join(', ');

      const params = validRows.flatMap(r => {
        const src = srcMap.get(r.enrollment_id) || {};
        return [
          school_id,
          r.student_id,
          target_academic_year_id,
          r.target_class_id,
          r.target_section_id,
          r.roll_number || null,
          r.stream || 'not_applicable',
          src.transport_required || false,
          src.transport_route || null,
          src.pickup_location || null,
          src.transport_fee || null,
          src.transport_fee_type || null,
        ];
      });

      await client.query(
        `INSERT INTO student_enrollments
           (school_id, student_id, academic_year_id, class_id, section_id,
            roll_number, stream, transport_required, transport_route,
            pickup_location, transport_fee, transport_fee_type, status)
         VALUES ${valuePlaceholders}`,
        params
      );

      promoted = validRows.length;
    }

    await client.query('COMMIT');
  } catch (err: any) {
    await client.query('ROLLBACK');
    errors.push(err.message || 'Bulk promotion failed');
  } finally {
    client.release();
  }

  return { promoted, skipped, errors };
};

/**
 * Get a quick summary of promotion status for a given class + academic year:
 * total enrolled, already promoted count, pending count.
 */
export const getPromotionSummary = async (
  school_id: number,
  academic_year_id: number,
  class_id: number
): Promise<{ total: number; promoted: number; pending: number }> => {
  const result = await pool.query(
    `SELECT
       COUNT(*)                                   AS total,
       COUNT(*) FILTER (WHERE is_promoted = true) AS promoted
     FROM student_enrollments
     WHERE school_id        = $1
       AND academic_year_id = $2
       AND class_id         = $3
       AND status           = 'active'`,
    [school_id, academic_year_id, class_id]
  );
  const row   = result.rows[0];
  const total = parseInt(row.total,    10);
  const prom  = parseInt(row.promoted, 10);
  return { total, promoted: prom, pending: total - prom };
};
