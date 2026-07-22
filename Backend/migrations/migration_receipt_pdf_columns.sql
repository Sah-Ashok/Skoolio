-- migration_receipt_pdf_columns.sql
-- Adds receipt PDF tracking columns to fee_payments.
-- Run ONCE against your PostgreSQL database.

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS receipt_pdf_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS receipt_pdf_url    TEXT        DEFAULT NULL;

-- Index for fast status polls
CREATE INDEX IF NOT EXISTS idx_fee_payments_receipt_status
  ON fee_payments (id, school_id, receipt_pdf_status);

-- Comment for clarity
COMMENT ON COLUMN fee_payments.receipt_pdf_status IS
  'pending | generating | ready | failed — tracks background PDF generation state';
COMMENT ON COLUMN fee_payments.receipt_pdf_url IS
  'Azure Blob URL to the generated PDF, NULL until status = ready';
