import pool from '../config/db';
import { PoolClient } from 'pg';
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
  const result = await pool.query(
    `INSERT INTO fee_structures
      (school_id, academic_year_id, class_id, fee_name, amount, frequency, due_date_type, due_day, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
    ]
  );
  return result.rows[0];
};

export const getFeeStructuresByClass = async (
  class_id: number,
  school_id: number,
  academic_year_id: number
): Promise<IFeeStructure[]> => {
  const result = await pool.query(
    `SELECT * FROM fee_structures
     WHERE class_id = $1 AND school_id = $2 AND academic_year_id = $3
     ORDER BY fee_name ASC`,
    [class_id, school_id, academic_year_id]
  );
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
      fee_name      = COALESCE($1, fee_name),
      amount        = COALESCE($2, amount),
      frequency     = COALESCE($3, frequency),
      due_date_type = COALESCE($4, due_date_type),
      due_day       = COALESCE($5, due_day),
      description   = COALESCE($6, description),
      updated_at    = NOW()
     WHERE id = $7 AND school_id = $8
     RETURNING *`,
    [
      data.fee_name || null,
      data.amount || null,
      data.frequency || null,
      data.due_date_type || null,
      data.due_day || null,
      data.description || null,
      id,
      school_id,
    ]
  );
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
  // fee_structure_id and enrollment_id may legitimately be null for
  // transport / hostel collections (no fee_structure row exists for them).
  // The DB column was migrated to allow NULL — always pass null, never 0.
  const result = await pool.query(
    `INSERT INTO fee_collections
      (school_id, student_id, enrollment_id, fee_structure_id, academic_year_id,
       fee_name, fee_type, due_date, total_amount, discount_amount, discount_reason,
       fine_amount, fine_reason, net_amount, paid_amount, remaining_amount,
       status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      school_id,
      data.student_id,
      data.enrollment_id   ?? null,   // null for transport/hostel
      data.fee_structure_id ?? null,  // null for transport/hostel
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
      0,                              // paid_amount starts at 0
      remaining_amount,
      'unpaid',
      created_by,
    ]
  );
  return result.rows[0];
};

export const getFeeCollectionsByStudent = async (
  student_id: number,
  school_id: number
): Promise<IFeeCollection[]> => {
  const result = await pool.query(
    `SELECT fc.*, s.full_name, s.admission_number,
            COALESCE(fc.fee_type, 'academic') AS fee_type
     FROM fee_collections fc
     INNER JOIN students s ON s.id = fc.student_id
     WHERE fc.student_id = $1 AND fc.school_id = $2
     ORDER BY fc.due_date DESC`,
    [student_id, school_id]
  );
  return result.rows;
};

export const getFeeCollectionsBySchool = async (
  school_id: number,
  academic_year_id: number
): Promise<IFeeCollection[]> => {
  const result = await pool.query(
    `SELECT fc.*, s.full_name, s.admission_number,
            COALESCE(fc.fee_type, 'academic') AS fee_type
     FROM fee_collections fc
     INNER JOIN students s ON s.id = fc.student_id
     WHERE fc.school_id = $1 AND fc.academic_year_id = $2
     ORDER BY fc.due_date DESC`,
    [school_id, academic_year_id]
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

// ── TRANSPORT FEE DUPLICATE CHECK ──
export const getTransportFeeForPeriod = async (
  school_id:        number,
  student_id:       number,
  academic_year_id: number,
  due_date:         string
): Promise<IFeeCollection | null> => {
  const result = await pool.query(
    `SELECT * FROM fee_collections
     WHERE school_id        = $1
       AND student_id       = $2
       AND academic_year_id = $3
       AND fee_type         = 'transport'
       AND due_date         = $4::date`,
    [school_id, student_id, academic_year_id, due_date]
  );
  return result.rows[0] || null;
};

// ── HOSTEL FEE DUPLICATE CHECK ──
export const getHostelFeeForPeriod = async (
  school_id:        number,
  student_id:       number,
  academic_year_id: number,
  due_date:         string
): Promise<IFeeCollection | null> => {
  const result = await pool.query(
    `SELECT * FROM fee_collections
     WHERE school_id        = $1
       AND student_id       = $2
       AND academic_year_id = $3
       AND fee_type         = 'hostel'
       AND due_date         = $4::date`,
    [school_id, student_id, academic_year_id, due_date]
  );
  return result.rows[0] || null;
};

// ── TRANSPORT FEE SUMMARY ──
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

// ── HOSTEL FEE SUMMARY ──
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

// ── ATOMIC PAYMENT TRANSACTION ──
// Generates a receipt number and records the payment + collection update
// inside a single transaction with SELECT ... FOR UPDATE to prevent
// duplicate RCP numbers under concurrent requests.
export const createFeePaymentAtomic = async (
  school_id:    number,
  collected_by: number,
  data:         ICreateFeePayment,
  collection: {
    id:               number;
    paid_amount:      number;
    net_amount:       number;
    remaining_amount: number;
  }
): Promise<{ payment: IFeePayment; receipt_number: string }> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the most-recent receipt row for this school so concurrent
    // transactions queue here and can't both read the same last number.
    const lockResult = await client.query(
      `SELECT receipt_number FROM fee_payments
       WHERE school_id = $1
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [school_id]
    );

    const last: string | undefined = lockResult.rows[0]?.receipt_number;
    let receipt_number: string;
    if (!last) {
      receipt_number = 'RCP-000001';
    } else {
      // Parse the numeric portion after 'RCP-' — supports any width
      const lastNum = parseInt(last.replace('RCP-', ''), 10);
      receipt_number = `RCP-${String(lastNum + 1).padStart(6, '0')}`;
    }

    // Insert payment record
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

    // Update collection totals atomically in the same transaction
    const new_paid      = Number(collection.paid_amount) + Number(data.paid_amount);
    const new_remaining = Number(collection.net_amount)  - new_paid;
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
