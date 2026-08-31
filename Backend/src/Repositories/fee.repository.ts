import pool from '../config/db';
import { PoolClient } from 'pg';
import AppError from '../utils/AppError';
import { getCache, setCache, deleteCachePattern } from '../utils/redisCache';
import {
  IFeeStructure, ICreateFeeStructure, IUpdateFeeStructure,
  IFeeCollection, ICreateFeeCollection, IUpdateFeeCollection,
  IFeePayment, ICreateFeePayment, FeeType
} from '../types/fee.types';

// ── FEE STRUCTURE QUERIES ──

export const createFeeStructure = async (
  school_id: number,
  data: ICreateFeeStructure
): Promise<IFeeStructure> => {
  try {
    const result = await pool.query(
      `INSERT INTO fee_structures
        (school_id, academic_year_id, class_id, fee_name, amount, frequency, due_date_type, due_day, description, billing_start_rule, scholarship_applies)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        school_id,
        data.academic_year_id,
        data.class_id,
        data.fee_name,
        data.amount,
        data.frequency,
        data.due_date_type,
        data.due_day || null,
        data.description || null,
        data.billing_start_rule || 'next_month',
        data.scholarship_applies !== false, // default true
      ]
    );
    await deleteCachePattern(`cache:fee_structures:${school_id}:*`);
    return result.rows[0];
  } catch (err: any) {
    // Translate unique-constraint DB errors into a friendly AppError with 409 status
    if (err?.code === '23505') {
      throw new AppError('Fee structure with this name already exists for the selected class and academic year.', 409);
    }
    throw err;
  }
};

export const getFeeStructuresByClass = async (
  class_id: number,
  school_id: number,
  academic_year_id: number
): Promise<IFeeStructure[]> => {
  const cacheKey = `cache:fee_structures:${school_id}:${academic_year_id}:${class_id}`;
  const cached = await getCache<IFeeStructure[]>(cacheKey);
  if (cached) return cached;

  const result = await pool.query(
    `SELECT * FROM fee_structures
     WHERE class_id = $1 AND school_id = $2 AND academic_year_id = $3
     ORDER BY fee_name ASC`,
    [class_id, school_id, academic_year_id]
  );
  if (result.rows) {
    await setCache(cacheKey, result.rows, 3600);
  }
  return result.rows;
};

export const getFeeStructureById = async (
  id: number,
  school_id: number
): Promise<IFeeStructure | null> => {
  const result = await pool.query(
    `SELECT * FROM fee_structures WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateFeeStructure = async (
  id: number,
  school_id: number,
  data: IUpdateFeeStructure
): Promise<IFeeStructure | null> => {
  const result = await pool.query(
    `UPDATE fee_structures SET
      fee_name            = COALESCE($1, fee_name),
      amount              = COALESCE($2, amount),
      frequency           = COALESCE($3, frequency),
      due_date_type       = COALESCE($4, due_date_type),
      due_day             = COALESCE($5, due_day),
      description         = COALESCE($6, description),
      billing_start_rule  = COALESCE($7, billing_start_rule),
      scholarship_applies = COALESCE($8, scholarship_applies),
      updated_at          = NOW()
     WHERE id = $9 AND school_id = $10
     RETURNING *`,
    [
      data.fee_name || null,
      data.amount || null,
      data.frequency || null,
      data.due_date_type || null,
      data.due_day || null,
      data.description || null,
      data.billing_start_rule || null,
      data.scholarship_applies !== undefined ? data.scholarship_applies : null,
      id,
      school_id,
    ]
  );
  await deleteCachePattern(`cache:fee_structures:${school_id}:*`);
  return result.rows[0] || null;
};

export const deleteFeeStructure = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM fee_structures WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  await deleteCachePattern(`cache:fee_structures:${school_id}:*`);
  return (result.rowCount ?? 0) > 0;
};

// ── FEE COLLECTION QUERIES ──

export const createFeeCollection = async (
  school_id:        number,
  created_by:       number,
  data:             ICreateFeeCollection,
  fee_name:         string,
  net_amount:       number,
  remaining_amount: number,
  fee_type:         FeeType = 'academic'
): Promise<IFeeCollection> => {
  const result = await pool.query(
    `INSERT INTO fee_collections
      (school_id, student_id, enrollment_id, fee_structure_id, academic_year_id,
       fee_name, fee_type, due_date, total_amount, discount_amount, discount_reason,
       fine_amount, fine_reason, net_amount, paid_amount, remaining_amount,
       status, created_by, billing_from_month, billing_to_month, months_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     RETURNING *`,
    [
      school_id,
      data.student_id,
      data.enrollment_id   ?? null,
      data.fee_structure_id ?? null,
      data.academic_year_id,
      fee_name,
      fee_type,
      data.due_date,
      data.total_amount,
      data.discount_amount || 0,
      data.discount_reason || null,
      data.fine_amount     || 0,
      data.fine_reason     || null,
      net_amount,
      0,
      remaining_amount,
      'unpaid',
      created_by,
      data.billing_from_month || null,
      data.billing_to_month   || null,
      data.months_count       || 1,
    ]
  );
  return result.rows[0];
};

export const getFeeCollectionsByStudent = async (
  student_id:       number,
  school_id:        number,
  academic_year_id?: number
): Promise<IFeeCollection[]> => {
  const params: any[] = [student_id, school_id];
  const yearFilter = academic_year_id
    ? `AND fc.academic_year_id = $${params.push(academic_year_id)}`
    : '';
  const result = await pool.query(
    `SELECT fc.*, s.full_name, s.admission_number,
            COALESCE(fc.fee_type, 'academic') AS fee_type
     FROM fee_collections fc
     INNER JOIN students s ON s.id = fc.student_id
     WHERE fc.student_id = $1 AND fc.school_id = $2
     ${yearFilter}
     ORDER BY fc.due_date DESC`,
    params
  );
  return result.rows;
};

export const waiveFeeCollection = async (
  id:        number,
  school_id: number,
  reason:    string
): Promise<IFeeCollection | null> => {
  // Store the waive reason in fine_reason (repurposed as a general admin note)
  // to avoid overwriting the scholarship discount_reason set at billing time.
  const result = await pool.query(
    `UPDATE fee_collections SET
      status           = 'waived',
      fine_reason      = $1,
      remaining_amount = 0,
      updated_at       = NOW()
     WHERE id = $2 AND school_id = $3 AND status != 'paid'
     RETURNING *`,
    [reason || 'Waived by admin', id, school_id]
  );
  return result.rows[0] || null;
};

export const getFeeCollectionsBySchool = async (
  school_id: number,
  academic_year_id: number,
  billing_month?: string,
  pending_only?: boolean,
): Promise<IFeeCollection[]> => {
  const params: Array<number | string> = [school_id, academic_year_id];
  let monthFilter = '';
  if (billing_month) {
    const idx = params.push(billing_month);
    monthFilter = `AND (
      to_char(fc.due_date, 'YYYY-MM') = $${idx}
      OR fc.billing_from_month = $${idx}
      OR fc.billing_to_month = $${idx}
      OR ($${idx} BETWEEN fc.billing_from_month AND fc.billing_to_month)
    )`;
  }
  const pendingFilter = pending_only
    ? `AND fc.status NOT IN ('paid', 'waived') AND COALESCE(fc.remaining_amount, fc.net_amount, fc.total_amount) > 0`
    : '';
  const result = await pool.query(
    `SELECT fc.*, s.full_name, s.admission_number,
            cl.id AS class_id, sec.id AS section_id,
            cl.name AS class_name, sec.name AS section_name,
            COALESCE(fc.fee_type, 'academic') AS fee_type
     FROM fee_collections fc
     INNER JOIN students s ON s.id = fc.student_id
     LEFT JOIN student_enrollments se ON se.student_id = fc.student_id
       AND se.school_id = fc.school_id AND se.academic_year_id = fc.academic_year_id AND se.status = 'active'
     LEFT JOIN classes cl ON cl.id = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     WHERE fc.school_id = $1 AND fc.academic_year_id = $2
     ${monthFilter}
     ${pendingFilter}
     ORDER BY fc.due_date DESC`,
    params
  );
  return result.rows;
};

export const getFeeCollectionById = async (
  id: number,
  school_id: number
): Promise<IFeeCollection | null> => {
  const result = await pool.query(
    `SELECT * FROM fee_collections WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateFeeCollection = async (
  id: number,
  school_id: number,
  data: IUpdateFeeCollection
): Promise<IFeeCollection | null> => {
  const result = await pool.query(
    `UPDATE fee_collections SET
      discount_amount  = COALESCE($1, discount_amount),
      discount_reason  = COALESCE($2, discount_reason),
      fine_amount      = COALESCE($3, fine_amount),
      fine_reason      = COALESCE($4, fine_reason),
      status           = COALESCE($5, status),
      net_amount       = total_amount
                         - COALESCE($1, discount_amount)
                         + COALESCE($3, fine_amount),
      remaining_amount = GREATEST(
                           0,
                           total_amount
                           - COALESCE($1, discount_amount)
                           + COALESCE($3, fine_amount)
                           - paid_amount
                         ),
      updated_at       = NOW()
     WHERE id = $6 AND school_id = $7
     RETURNING *`,
    [
      data.discount_amount ?? null,
      data.discount_reason || null,
      data.fine_amount     ?? null,
      data.fine_reason     || null,
      data.status          || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const updateCollectionPaidAmount = async (
  id: number,
  school_id: number,
  paid_amount: number,
  remaining_amount: number,
  status: string
): Promise<IFeeCollection | null> => {
  const result = await pool.query(
    `UPDATE fee_collections SET
      paid_amount      = $1,
      remaining_amount = $2,
      status           = $3,
      updated_at       = NOW()
     WHERE id = $4 AND school_id = $5
     RETURNING *`,
    [paid_amount, remaining_amount, status, id, school_id]
  );
  return result.rows[0] || null;
};

export const getYearlyFeeForAcademicYear = async (
  school_id:        number,
  student_id:       number,
  fee_structure_id: number,
  academic_year_id: number
): Promise<IFeeCollection | null> => {
  const result = await pool.query(
    `SELECT id FROM fee_collections
     WHERE school_id        = $1
       AND student_id       = $2
       AND fee_structure_id = $3
       AND academic_year_id = $4
     LIMIT 1`,
    [school_id, student_id, fee_structure_id, academic_year_id]
  );
  return result.rows[0] || null;
};

export const getAcademicFeeForPeriod = async (
  school_id:        number,
  student_id:       number,
  fee_structure_id: number,
  due_date:         string   // YYYY-MM-DD — we match on YYYY-MM (billing month) only
): Promise<IFeeCollection | null> => {
  // Match on billing month (YYYY-MM), not the exact due_date day.
  // This prevents double-billing if an admin changes the fee's due_day between
  // runs (e.g. from day 10 to day 15 — both map to the same billing month).
  const billing_month = due_date.slice(0, 7); // 'YYYY-MM'
  const result = await pool.query(
    `SELECT * FROM fee_collections
     WHERE school_id        = $1
       AND student_id       = $2
       AND fee_structure_id = $3
       AND to_char(due_date, 'YYYY-MM') = $4`,
    [school_id, student_id, fee_structure_id, billing_month]
  );
  return result.rows[0] || null;
};

export const getTransportFeeForPeriod = async (
  school_id:        number,
  student_id:       number,
  academic_year_id: number,
  due_date:         string   // YYYY-MM or YYYY-MM-DD
): Promise<IFeeCollection | null> => {
  const billing_month = due_date.slice(0, 7);
  const result = await pool.query(
    `SELECT * FROM fee_collections
     WHERE school_id              = $1
       AND student_id             = $2
       AND academic_year_id       = $3
       AND fee_type               = 'transport'
       AND (
         to_char(due_date, 'YYYY-MM') = $4
         OR billing_from_month = $4
         OR billing_to_month = $4
         OR ($4 BETWEEN billing_from_month AND billing_to_month)
       )`,
    [school_id, student_id, academic_year_id, billing_month]
  );
  return result.rows[0] || null;
};

export const getHostelFeeForPeriod = async (
  school_id:        number,
  student_id:       number,
  academic_year_id: number,
  due_date:         string   // YYYY-MM or YYYY-MM-DD
): Promise<IFeeCollection | null> => {
  const billing_month = due_date.slice(0, 7);
  const result = await pool.query(
    `SELECT * FROM fee_collections
     WHERE school_id              = $1
       AND student_id             = $2
       AND academic_year_id       = $3
       AND fee_type               = 'hostel'
       AND (
         to_char(due_date, 'YYYY-MM') = $4
         OR billing_from_month = $4
         OR billing_to_month = $4
         OR ($4 BETWEEN billing_from_month AND billing_to_month)
       )`,
    [school_id, student_id, academic_year_id, billing_month]
  );
  return result.rows[0] || null;
};

export const getTransportFeeSummary = async (
  school_id:        number,
  academic_year_id: number
): Promise<any> => {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'paid')    AS paid_count,
       COUNT(*) FILTER (WHERE status = 'unpaid')  AS unpaid_count,
       COUNT(*) FILTER (WHERE status = 'partial') AS partial_count,
       SUM(total_amount)                          AS total_billed,
       SUM(paid_amount)                           AS total_collected,
       SUM(remaining_amount)                      AS total_pending
     FROM fee_collections
     WHERE school_id        = $1
       AND academic_year_id = $2
       AND fee_type         = 'transport'`,
    [school_id, academic_year_id]
  );
  return result.rows[0];
};

export const getHostelFeeSummary = async (
  school_id:        number,
  academic_year_id: number
): Promise<any> => {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'paid')    AS paid_count,
       COUNT(*) FILTER (WHERE status = 'unpaid')  AS unpaid_count,
       COUNT(*) FILTER (WHERE status = 'partial') AS partial_count,
       SUM(total_amount)                          AS total_billed,
       SUM(paid_amount)                           AS total_collected,
       SUM(remaining_amount)                      AS total_pending
     FROM fee_collections
     WHERE school_id        = $1
       AND academic_year_id = $2
       AND fee_type         = 'hostel'`,
    [school_id, academic_year_id]
  );
  return result.rows[0];
};

// ── FEE PAYMENT QUERIES ──

export const createFeePayment = async (
  school_id:      number,
  collected_by:   number,
  receipt_number: string,
  data:           ICreateFeePayment
): Promise<IFeePayment> => {
  const result = await pool.query(
    `INSERT INTO fee_payments
      (school_id, collection_id, student_id, receipt_number, paid_amount,
       payment_date, payment_method, transaction_id, remarks, collected_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      school_id,
      data.collection_id,
      data.student_id,
      receipt_number,
      data.paid_amount,
      data.payment_date,
      data.payment_method,
      data.transaction_id || null,
      data.remarks        || null,
      collected_by,
    ]
  );
  return result.rows[0];
};

export const getPaymentsByCollection = async (
  collection_id: number,
  school_id:     number
): Promise<IFeePayment[]> => {
  const result = await pool.query(
    `SELECT * FROM fee_payments
     WHERE collection_id = $1 AND school_id = $2
     ORDER BY payment_date DESC`,
    [collection_id, school_id]
  );
  return result.rows;
};

export const getPaymentsByStudent = async (
  student_id: number,
  school_id:  number
): Promise<IFeePayment[]> => {
  const result = await pool.query(
    `SELECT fp.*, fc.fee_name, fc.due_date, fc.fee_type
     FROM fee_payments fp
     INNER JOIN fee_collections fc ON fc.id = fp.collection_id
     WHERE fp.student_id = $1 AND fp.school_id = $2
     ORDER BY fp.payment_date DESC`,
    [student_id, school_id]
  );
  return result.rows;
};

export const getLastReceiptNumber = async (
  school_id: number
): Promise<string | null> => {
  const result = await pool.query(
    `SELECT receipt_number FROM fee_payments
     WHERE school_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [school_id]
  );
  return result.rows[0]?.receipt_number || null;
};

// ── PAYMENT WITH FULL DETAIL (for receipt printing) ──
// FIX: added JOIN to sections table (sec) — student_enrollments has no 'name' column
export const getPaymentWithDetails = async (
  payment_id: number,
  school_id:  number
): Promise<any | null> => {
  const result = await pool.query(
    `SELECT
       fp.id              AS payment_id,
       fp.receipt_number,
       fp.paid_amount,
       fp.payment_date::text,
       fp.payment_method,
       fp.transaction_id,
       fp.remarks         AS payment_remarks,
       fp.created_at,

       fc.id              AS collection_id,
       fc.fee_name,
       fc.fee_type,
       fc.total_amount,
       fc.discount_amount,
       fc.discount_reason,
       fc.fine_amount,
       fc.fine_reason,
       fc.net_amount,
       fc.due_date::text,
       fc.academic_year_id,

       s.id               AS student_id,
       s.full_name        AS student_name,
       s.admission_number,

       ay.year_name,

       sc.school_name,
       sc.email           AS school_email,
       sc.phone           AS school_phone,
       sc.city            AS school_city,
       sc.logo            AS school_logo,

       cl.name            AS class_name,
       sec.name           AS section_name

     FROM fee_payments fp
     INNER JOIN fee_collections fc   ON fc.id  = fp.collection_id
     INNER JOIN students s           ON s.id   = fp.student_id
     INNER JOIN schools sc           ON sc.id  = fp.school_id
     LEFT  JOIN academic_years ay    ON ay.id  = fc.academic_year_id
     LEFT  JOIN student_enrollments se
       ON se.student_id      = fp.student_id
      AND se.school_id       = fp.school_id
      AND se.academic_year_id = fc.academic_year_id
      AND se.status          = 'active'
     LEFT  JOIN classes cl   ON cl.id  = se.class_id
     LEFT  JOIN sections sec ON sec.id = se.section_id
     WHERE fp.id = $1 AND fp.school_id = $2
     LIMIT 1`,
    [payment_id, school_id]
  );
  return result.rows[0] || null;
};

// ── ATOMIC PAYMENT TRANSACTION ──
export const createFeePaymentAtomic = async (
  school_id:    number,
  collected_by: number,
  data:         ICreateFeePayment
): Promise<{ payment: IFeePayment; receipt_number: string }> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serialize receipt-number allocation for this school, including its first
    // payment (where a row-level lock would otherwise lock nothing).
    await client.query('SELECT pg_advisory_xact_lock($1)', [school_id]);

    // Re-read the collection under lock. The pre-flight service check is useful
    // for a friendly error, but this is the authoritative balance check.
    const collectionResult = await client.query(
      `SELECT id, student_id, paid_amount, net_amount, remaining_amount, status
       FROM fee_collections
       WHERE id = $1 AND school_id = $2
       FOR UPDATE`,
      [data.collection_id, school_id]
    );
    const collection = collectionResult.rows[0];
    if (!collection) throw new Error('Fee collection not found.');
    if (Number(collection.student_id) !== Number(data.student_id)) {
      throw new Error('Payment student does not match the fee collection.');
    }
    if (collection.status === 'paid' || collection.status === 'waived') {
      throw new Error('This fee cannot accept a payment.');
    }
    if (Number(data.paid_amount) <= 0 || Number(data.paid_amount) > Number(collection.remaining_amount)) {
      throw new Error('Payment amount must be greater than zero and cannot exceed the remaining amount.');
    }

    const lockResult = await client.query(
      `SELECT receipt_number FROM fee_payments
       WHERE school_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [school_id]
    );

    const last: string | undefined = lockResult.rows[0]?.receipt_number;
    let receipt_number: string;
    if (!last) {
      receipt_number = 'RCP-000001';
    } else {
      const lastNum = parseInt(last.replace('RCP-', ''), 10);
      receipt_number = `RCP-${String(lastNum + 1).padStart(6, '0')}`;
    }

    const paymentResult = await client.query(
      `INSERT INTO fee_payments
        (school_id, collection_id, student_id, receipt_number, paid_amount,
         payment_date, payment_method, transaction_id, remarks, collected_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        school_id,
        data.collection_id,
        data.student_id,
        receipt_number,
        data.paid_amount,
        data.payment_date,
        data.payment_method,
        data.transaction_id || null,
        data.remarks        || null,
        collected_by,
      ]
    );
    const payment: IFeePayment = paymentResult.rows[0];

    const new_paid      = Number(collection.paid_amount) + Number(data.paid_amount);
    const new_remaining = Math.max(0, Number(collection.net_amount) - new_paid);
    const new_status    = new_remaining <= 0 ? 'paid' : 'partial';

    await client.query(
      `UPDATE fee_collections SET
        paid_amount      = $1,
        remaining_amount = $2,
        status           = $3,
        updated_at       = NOW()
       WHERE id = $4 AND school_id = $5`,
      [new_paid, new_remaining, new_status, collection.id, school_id]
    );

    await client.query('COMMIT');
    return { payment, receipt_number };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── ASSIGN ONE-TIME / YEARLY FEES AT ENROLLMENT ─────────────────────────────
// Called immediately after a student is enrolled to create fee_collection rows
// for all one_time + yearly structures in their class. Idempotent.
export const assignOneTimeFees = async (
  school_id:           number,
  created_by:          number,
  student_id:          number,
  enrollment_id:       number,
  academic_year_id:    number,
  class_id:            number,
  scholarship_percent: number,
  scholarship_type:    string,
  admission_date:      string
): Promise<{ created: number; skipped: number; fees: string[] }> => {
  // Fetch all active one_time + yearly structures for this class
  const structRes = await pool.query(
    `SELECT * FROM fee_structures
     WHERE school_id        = $1
       AND academic_year_id = $2
       AND class_id         = $3
       AND is_active        = true
       AND frequency IN ('one_time', 'yearly')
     ORDER BY fee_name ASC`,
    [school_id, academic_year_id, class_id]
  );
  const structures = structRes.rows as IFeeStructure[];

  let created = 0;
  let skipped = 0;
  const fees: string[] = [];

  for (const structure of structures) {
    // Idempotency: skip if already assigned for this academic year
    const existing = await pool.query(
      `SELECT id FROM fee_collections
       WHERE school_id        = $1
         AND student_id       = $2
         AND fee_structure_id = $3
         AND academic_year_id = $4
       LIMIT 1`,
      [school_id, student_id, structure.id, academic_year_id]
    );
    if (existing.rows.length > 0) { skipped++; continue; }

    const amount = Number(structure.amount);
    const scholarshipApplies = (structure as any).scholarship_applies !== false;
    const discount = scholarshipApplies && scholarship_percent > 0
      ? Math.round(amount * (scholarship_percent / 100) * 100) / 100
      : 0;
    const discount_reason = discount > 0
      ? `${scholarship_type || 'Scholarship'}: ${scholarship_percent}% discount`
      : undefined;
    const net_amount = amount - discount;
    const due_date = admission_date.slice(0, 10);

    await pool.query(
      `INSERT INTO fee_collections
        (school_id, student_id, enrollment_id, fee_structure_id, academic_year_id,
         fee_name, fee_type, due_date, total_amount, discount_amount, discount_reason,
         fine_amount, fine_reason, net_amount, paid_amount, remaining_amount,
         status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        school_id, student_id, enrollment_id, structure.id, academic_year_id,
        structure.fee_name, 'academic', due_date,
        amount, discount, discount_reason || null,
        0, null, net_amount, 0, net_amount,
        'unpaid', created_by,
      ]
    );
    created++;
    fees.push(structure.fee_name);
  }

  return { created, skipped, fees };
};

// ── MONTHLY BILLING STATUS REPORT ──────────────────────────────────────────
// Returns per-student fee status for a given billing month.
// ── VOID (UNDO) BILLING FOR A MONTH ────────────────────────────────────────
// Deletes ONLY unpaid bills with zero payments for the given billing_month + fee_type.
// Bills that are paid or partial (any payment received) are NEVER touched.
export const voidMonthBilling = async (
  school_id:        number,
  academic_year_id: number,
  billing_month:    string,
  fee_type:         string
): Promise<{ voided: number; protected_paid: number; protected_partial: number }> => {
  const protectedRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'paid')    AS protected_paid,
       COUNT(*) FILTER (WHERE status = 'partial') AS protected_partial
     FROM fee_collections
     WHERE school_id        = $1
       AND academic_year_id = $2
       AND COALESCE(fee_type, 'academic') = $4
       AND (
         to_char(due_date, 'YYYY-MM') = $3
         OR billing_from_month = $3
         OR billing_to_month = $3
         OR (billing_from_month IS NOT NULL AND billing_to_month IS NOT NULL
             AND $3 >= billing_from_month AND $3 <= billing_to_month)
       )
       AND status IN ('paid', 'partial')`,
    [school_id, academic_year_id, billing_month, fee_type]
  );
  const protected_paid    = Number(protectedRes.rows[0]?.protected_paid    || 0);
  const protected_partial = Number(protectedRes.rows[0]?.protected_partial || 0);

  const deleteRes = await pool.query(
    `DELETE FROM fee_collections
     WHERE school_id        = $1
       AND academic_year_id = $2
       AND COALESCE(fee_type, 'academic') = $4
       AND (
         to_char(due_date, 'YYYY-MM') = $3
         OR billing_from_month = $3
         OR billing_to_month = $3
         OR (billing_from_month IS NOT NULL AND billing_to_month IS NOT NULL
             AND $3 >= billing_from_month AND $3 <= billing_to_month)
       )
       AND status = 'unpaid'
       AND paid_amount = 0
     RETURNING id`,
    [school_id, academic_year_id, billing_month, fee_type]
  );
  const voided = deleteRes.rowCount ?? 0;
  return { voided, protected_paid, protected_partial };
};

// ── UNBILLED STUDENTS ──────────────────────────────────────────────────────
// Returns active enrolled students who have NO bill for ANY of the given months
// for the given fee_type. For transport/hostel, also filters to only those with
// an active assignment.
export const getUnbilledStudents = async (
  school_id:        number,
  academic_year_id: number,
  billing_months:   string[],   // array of YYYY-MM strings
  fee_type:         string      // 'academic' | 'transport' | 'hostel'
): Promise<any[]> => {
  if (!billing_months.length) return [];

  // Build $4, $5, … placeholders for the billing_months array
  const monthParams = billing_months.map((_, i) => `$${i + 4}`).join(', ');

  let joinClause = '';
  if (fee_type === 'transport') {
    joinClause = `
      INNER JOIN transport_assignments ta
        ON ta.student_id       = s.id
       AND ta.school_id        = $1
       AND ta.academic_year_id = $2
       AND ta.status           = 'active'`;
  } else if (fee_type === 'hostel') {
    joinClause = `
      INNER JOIN hostel_assignments ha
        ON ha.student_id       = s.id
       AND ha.school_id        = $1
       AND ha.academic_year_id = $2
       AND ha.status           = 'active'`;
  }

  const result = await pool.query(
    `SELECT DISTINCT
       s.id               AS student_id,
       s.full_name,
       s.admission_number,
       cl.name            AS class_name,
       sec.name           AS section_name
     FROM students s
     INNER JOIN student_enrollments se
       ON se.student_id       = s.id
      AND se.school_id        = $1
      AND se.academic_year_id = $2
      AND se.status           = 'active'
     LEFT JOIN classes  cl  ON cl.id  = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     ${joinClause}
     WHERE s.school_id = $1
       AND s.status    = 'active'
       -- exclude any student who has AT LEAST ONE bill in ANY of the months
       AND NOT EXISTS (
         SELECT 1 FROM fee_collections fc
         WHERE fc.school_id        = $1
           AND fc.academic_year_id = $2
           AND fc.student_id       = s.id
           AND COALESCE(fc.fee_type, 'academic') = $3
           AND (
             to_char(fc.due_date, 'YYYY-MM') IN (${monthParams})
             OR fc.billing_from_month IN (${monthParams})
             OR fc.billing_to_month IN (${monthParams})
             OR EXISTS (
               SELECT 1 FROM unnest(ARRAY[${monthParams}]::text[]) bm
               WHERE fc.billing_from_month IS NOT NULL AND fc.billing_to_month IS NOT NULL
                 AND bm >= fc.billing_from_month AND bm <= fc.billing_to_month
             )
           )
       )
     ORDER BY s.full_name ASC`,
    [school_id, academic_year_id, fee_type, ...billing_months]
  );
  return result.rows;
};

export const getMonthlyBillingStatus = async (
  school_id:        number,
  academic_year_id: number,
  billing_month:    string   // YYYY-MM
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       s.id           AS student_id,
       s.full_name,
       s.admission_number,
       cl.name        AS class_name,
       sec.name       AS section_name,
       fc.id          AS collection_id,
       fc.fee_name,
       fc.fee_type,
       fc.total_amount,
       fc.discount_amount,
       fc.net_amount,
       fc.paid_amount,
       fc.remaining_amount,
       fc.status,
       fc.due_date::text,
       fc.billing_from_month,
       fc.billing_to_month
     FROM fee_collections fc
     INNER JOIN students s ON s.id = fc.student_id
     LEFT JOIN student_enrollments se
       ON se.student_id       = fc.student_id
      AND se.school_id        = fc.school_id
      AND se.academic_year_id = fc.academic_year_id
      AND se.status           = 'active'
     LEFT JOIN classes  cl  ON cl.id  = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     WHERE fc.school_id        = $1
       AND fc.academic_year_id = $2
       AND (
         to_char(fc.due_date, 'YYYY-MM') = $3
         OR fc.billing_from_month = $3
         OR fc.billing_to_month = $3
         OR (fc.billing_from_month IS NOT NULL AND fc.billing_to_month IS NOT NULL AND $3 >= fc.billing_from_month AND $3 <= fc.billing_to_month)
       )
     ORDER BY s.full_name ASC, fc.fee_type ASC, fc.fee_name ASC`,
    [school_id, academic_year_id, billing_month]
  );
  return result.rows;
};
