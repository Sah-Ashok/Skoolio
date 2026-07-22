-- Migration: Add scholarship_applies column to fee_structures
-- Run this against your database to support per-fee scholarship control

ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS scholarship_applies BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: existing structures default to applying scholarship (backward compatible)
UPDATE fee_structures SET scholarship_applies = TRUE WHERE scholarship_applies IS NULL;

-- Verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'fee_structures' AND column_name = 'scholarship_applies';
