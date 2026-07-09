-- migration_receipt_pdf_url.sql
-- Adds receipt_pdf_url and receipt_pdf_status columns to fee_payments.
-- Run once against your database.

ALTER TABLE fee_payments
  ADD COLUMN IF NOT EXISTS receipt_pdf_url    TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS receipt_pdf_status VARCHAR(20)  DEFAULT 'pending'
    CHECK (receipt_pdf_status IN ('pending', 'generating', 'ready', 'failed'));

COMMENT ON COLUMN fee_payments.receipt_pdf_url    IS 'Azure Blob URL: school-receipts/School-Receipt/<school_id>/<receipt_number>.pdf';
COMMENT ON COLUMN fee_payments.receipt_pdf_status IS 'pending → generating → ready | failed';

-- Index for fast lookup when checking if a receipt is already generated
CREATE INDEX IF NOT EXISTS idx_fee_payments_receipt_pdf_status
  ON fee_payments (school_id, receipt_pdf_status);
