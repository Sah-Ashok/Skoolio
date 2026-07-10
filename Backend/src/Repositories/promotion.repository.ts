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
  const client = await pool.connect();
  let promoted = 0;
  let skipped  = 0;
  const errors: string[] = [];

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      try {
        // Check if already enrolled in target year
        const existing = await client.query(
          `SELECT id FROM student_enrollments
           WHERE school_id = $1 AND student_id = $2 AND academic_year_id = $3
           LIMIT 1`,
          [school_id, row.student_id, target_academic_year_id]
        );

        if ((existing.rowCount ?? 0) > 0) {
          skipped++;
          continue;
        }

        // Fetch source enrollment for transport carry-forward
        const srcRes = await client.query(
          `SELECT transport_required, transport_route, pickup_location,
                  transport_fee, transport_fee_type
           FROM student_enrollments
           WHERE id = $1 AND school_id = $2`,
          [row.enrollment_id, school_id]
        );
        const src = srcRes.rows[0] || {};

        // Mark source enrollment as promoted
        await client.query(
          `UPDATE student_enrollments
           SET is_promoted          = true,
               promoted_to_class_id = $1,
               updated_at           = NOW()
           WHERE id = $2 AND school_id = $3`,
          [row.target_class_id, row.enrollment_id, school_id]
        );

        // Create new enrollment in target year
        await client.query(
          `INSERT INTO student_enrollments
             (school_id, student_id, academic_year_id, class_id, section_id,
              roll_number, stream,
              transport_required, transport_route, pickup_location,
              transport_fee, transport_fee_type,
              status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active')`,
          [
            school_id,
            row.student_id,
            target_academic_year_id,
            row.target_class_id,
            row.target_section_id,
            row.roll_number || null,
            row.stream || 'not_applicable',
            src.transport_required || false,
            src.transport_route    || null,
            src.pickup_location    || null,
            src.transport_fee      || null,
            src.transport_fee_type || null,
          ]
        );

        promoted++;
      } catch (err: any) {
        errors.push(`Student ${row.student_id}: ${err.message}`);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
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
