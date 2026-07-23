// Repositories/online_payment.repository.ts

import pool from '../config/db';
import { ICreateBankAccount, ICreatePaymentRequest } from '../types/online_payment.types';

// ── BANK ACCOUNTS ────────────────────────────────────────────────────────────

export const getBankAccountsBySchool = async (school_id: number) => {
  const { rows } = await pool.query(
    `SELECT * FROM school_bank_accounts WHERE school_id = $1 ORDER BY is_active DESC, created_at ASC`,
    [school_id]
  );
  return rows;
};

export const getActiveBankAccounts = async (school_id: number) => {
  const { rows } = await pool.query(
    `SELECT * FROM school_bank_accounts WHERE school_id = $1 AND is_active = true ORDER BY created_at ASC`,
    [school_id]
  );
  return rows;
};

export const createBankAccount = async (school_id: number, data: ICreateBankAccount) => {
  const { rows } = await pool.query(
    `INSERT INTO school_bank_accounts
       (school_id, bank_name, account_name, account_number,
        branch, ifsc_code, qr_image_url, upi_id, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      school_id,
      data.bank_name,
      data.account_name,
      data.account_number,
      data.branch       || null,
      data.ifsc_code    || null,
      data.qr_image_url || null,
      data.upi_id       || null,
      data.notes        || null,
    ]
  );
  return rows[0];
};


export const updateBankAccount = async (
  id:        number,
  school_id: number,
  data:      Partial<ICreateBankAccount & { is_active: boolean }>
) => {
  const fields: string[] = [];
  const vals:   any[]    = [];
  let   idx              = 1;

  const setField = (col: string, val: any) => {
    if (val !== undefined) { fields.push(`${col} = $${idx++}`); vals.push(val); }
  };

  setField('bank_name',      data.bank_name);
  setField('account_name',   data.account_name);
  setField('account_number', data.account_number);
  setField('branch',         data.branch);
  setField('ifsc_code',      data.ifsc_code);
  setField('qr_image_url',   data.qr_image_url ?? (data as any).qr_url);
  setField('upi_id',         data.upi_id);
  setField('notes',          data.notes);
  setField('is_active',      data.is_active);

  if (!fields.length) return null;
  fields.push(`updated_at = NOW()`);

  const { rows } = await pool.query(
    `UPDATE school_bank_accounts
     SET ${fields.join(', ')}
     WHERE id = $${idx++} AND school_id = $${idx++}
     RETURNING *`,
    [...vals, id, school_id]
  );
  return rows[0] || null;
};

export const deleteBankAccount = async (id: number, school_id: number) => {
  const { rowCount } = await pool.query(
    `DELETE FROM school_bank_accounts WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (rowCount ?? 0) > 0;
};

// ── PAYMENT REQUESTS ─────────────────────────────────────────────────────────

export const createPaymentRequest = async (
  school_id:  number,
  student_id: number,
  data:       ICreatePaymentRequest
) => {
  const { rows } = await pool.query(
    `INSERT INTO online_payment_requests
       (school_id, student_id, collection_id, bank_account_id, amount,
        transaction_ref, payment_date, screenshot_url, remarks)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      school_id,
      student_id,
      data.collection_id,
      data.bank_account_id || null,
      data.amount,
      data.transaction_ref || null,
      data.payment_date,
      data.screenshot_url  || null,
      data.remarks         || null,
    ]
  );
  return rows[0];
};

export const getPaymentRequestsBySchool = async (school_id: number, status?: string) => {
  const params: any[] = [school_id];
  let where = 'WHERE opr.school_id = $1';
  if (status) { where += ` AND opr.status = $2`; params.push(status); }

  const { rows } = await pool.query(
    `SELECT
       opr.*,
       s.full_name,
       s.admission_number,
       c.name             AS class_name,
       sec.name           AS section_name,
       fc.fee_name,
       fc.total_amount    AS fee_total,
       fc.remaining_amount AS collection_remaining_amount,
       fc.status          AS collection_status,
       ba.bank_name,
       ba.account_number
     FROM online_payment_requests opr
     JOIN students s ON s.id = opr.student_id
     LEFT JOIN student_enrollments se
           ON se.student_id = opr.student_id
          AND se.school_id  = opr.school_id
          AND se.id = (
                SELECT id FROM student_enrollments
                WHERE student_id = opr.student_id
                  AND school_id  = opr.school_id
                ORDER BY created_at DESC LIMIT 1
              )
     LEFT JOIN classes  c   ON c.id   = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     JOIN fee_collections fc ON fc.id = opr.collection_id
     LEFT JOIN school_bank_accounts ba ON ba.id = opr.bank_account_id
     ${where}
     ORDER BY opr.created_at DESC`,
    params
  );
  return rows;
};


export const getPaymentRequestsByStudent = async (student_id: number, school_id: number) => {
  const { rows } = await pool.query(
    `SELECT
       opr.*,
       fc.fee_name,
       fc.total_amount  AS fee_total,
       fc.remaining_amount,
       fc.status        AS collection_status,
       ba.bank_name,
       ba.account_number
     FROM online_payment_requests opr
     JOIN fee_collections fc ON fc.id = opr.collection_id
     LEFT JOIN school_bank_accounts ba ON ba.id = opr.bank_account_id
     WHERE opr.student_id = $1 AND opr.school_id = $2
     ORDER BY opr.created_at DESC`,
    [student_id, school_id]
  );
  return rows;
};

export const getPaymentRequestById = async (id: number, school_id: number) => {
  const { rows } = await pool.query(
    `SELECT
       opr.*,
       s.full_name,
       s.admission_number,
       c.name             AS class_name,
       sec.name           AS section_name,
       fc.fee_name,
       fc.total_amount    AS fee_total,
       fc.remaining_amount AS collection_remaining_amount,
       fc.status          AS collection_status,
       ba.bank_name,
       ba.account_number
     FROM online_payment_requests opr
     JOIN students s ON s.id = opr.student_id
     LEFT JOIN student_enrollments se
           ON se.student_id = opr.student_id
          AND se.school_id  = opr.school_id
          AND se.id = (
                SELECT id FROM student_enrollments
                WHERE student_id = opr.student_id
                  AND school_id  = opr.school_id
                ORDER BY created_at DESC LIMIT 1
              )
     LEFT JOIN classes  c   ON c.id   = se.class_id
     LEFT JOIN sections sec ON sec.id = se.section_id
     JOIN fee_collections fc ON fc.id = opr.collection_id
     LEFT JOIN school_bank_accounts ba ON ba.id = opr.bank_account_id
     WHERE opr.id = $1 AND opr.school_id = $2`,
    [id, school_id]
  );
  return rows[0] || null;
};


export const getPendingCountBySchool = async (school_id: number): Promise<number> => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM online_payment_requests
     WHERE school_id = $1 AND status = 'pending'`,
    [school_id]
  );
  return rows[0]?.count ?? 0;
};

// Verify: mark request as verified, link the fee_payment that was created
export const verifyPaymentRequest = async (
  id:             number,
  school_id:      number,
  admin_id:       number,
  fee_payment_id: number
) => {
  const { rows } = await pool.query(
    `UPDATE online_payment_requests
     SET status = 'verified',
         verified_by    = $3,
         verified_at    = NOW(),
         fee_payment_id = $4,
         updated_at     = NOW()
     WHERE id = $1 AND school_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, school_id, admin_id, fee_payment_id]
  );
  return rows[0] || null;
};

export const rejectPaymentRequest = async (
  id:               number,
  school_id:        number,
  admin_id:         number,
  rejection_reason: string
) => {
  const { rows } = await pool.query(
    `UPDATE online_payment_requests
     SET status = 'rejected',
         verified_by      = $3,
         verified_at      = NOW(),
         rejection_reason = $4,
         updated_at       = NOW()
     WHERE id = $1 AND school_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, school_id, admin_id, rejection_reason]
  );
  return rows[0] || null;
};

// Check for an existing pending request for the same fee (prevent duplicates)
export const getPendingRequestForCollection = async (collection_id: number, student_id: number) => {
  const { rows } = await pool.query(
    `SELECT id FROM online_payment_requests
     WHERE collection_id = $1 AND student_id = $2 AND status = 'pending'
     LIMIT 1`,
    [collection_id, student_id]
  );
  return rows[0] || null;
};
