-- Migration: Add esewa_id and khalti_id columns to school_bank_accounts
-- Nepal schools use eSewa and Khalti as separate mobile wallet fields

ALTER TABLE school_bank_accounts
  ADD COLUMN IF NOT EXISTS esewa_id  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS khalti_id VARCHAR(50);

COMMENT ON COLUMN school_bank_accounts.esewa_id  IS 'eSewa merchant ID or phone number';
COMMENT ON COLUMN school_bank_accounts.khalti_id IS 'Khalti merchant ID or phone number';
