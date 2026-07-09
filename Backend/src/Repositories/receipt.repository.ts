// ── Repositories/receipt.repository.ts ───────────────────────────────────────
import pool from '../config/db';

export type ReceiptPdfStatus = 'pending' | 'generating' | 'ready' | 'failed';

/**
 * Atomically claim generation — sets status to 'generating'.
 * Returns true only if the row was in pending / failed / NULL state
 * (NULL handles rows created before the migration ran).
 * Returns false if already generating or ready — caller skips spawning worker.
 */
export const claimReceiptGeneration = async (
  payment_id: number,
  school_id:  number
): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE fee_payments
     SET receipt_pdf_status = 'generating',
         updated_at         = NOW()
     WHERE id        = $1
       AND school_id = $2
       AND (
         receipt_pdf_status IS NULL
         OR receipt_pdf_status = 'pending'
         OR receipt_pdf_status = 'failed'
       )
     RETURNING id`,
    [payment_id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

/**
 * Save the uploaded URL and mark status = 'ready'.
 */
export const saveReceiptUrl = async (
  payment_id:      number,
  school_id:       number,
  receipt_pdf_url: string
): Promise<void> => {
  await pool.query(
    `UPDATE fee_payments
     SET receipt_pdf_url    = $1,
         receipt_pdf_status = 'ready',
         updated_at         = NOW()
     WHERE id = $2 AND school_id = $3`,
    [receipt_pdf_url, payment_id, school_id]
  );
};

/**
 * Mark generation as failed so it can be retried.
 */
export const markReceiptFailed = async (
  payment_id: number,
  school_id:  number
): Promise<void> => {
  await pool.query(
    `UPDATE fee_payments
     SET receipt_pdf_status = 'failed',
         updated_at         = NOW()
     WHERE id = $1 AND school_id = $2`,
    [payment_id, school_id]
  );
};

/**
 * Get current PDF url + status for a payment.
 * Returns null if payment doesn't exist.
 */
export const getReceiptPdfInfo = async (
  payment_id: number,
  school_id:  number
): Promise<{ receipt_pdf_url: string | null; receipt_pdf_status: ReceiptPdfStatus } | null> => {
  const result = await pool.query(
    `SELECT
       receipt_pdf_url,
       COALESCE(receipt_pdf_status, 'pending') AS receipt_pdf_status
     FROM fee_payments
     WHERE id = $1 AND school_id = $2`,
    [payment_id, school_id]
  );
  return result.rows[0] ?? null;
};
