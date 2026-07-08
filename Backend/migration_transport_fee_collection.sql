-- Migration: add fee_type to fee_collections
-- Run once against your database.

ALTER TABLE fee_collections
  ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) NOT NULL DEFAULT 'academic';

-- Prevents double-billing transport fees for the same student + period
CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_fee_per_student_period
  ON fee_collections (school_id, student_id, academic_year_id, fee_type, due_date)
  WHERE fee_type = 'transport';

COMMENT ON COLUMN fee_collections.fee_type IS
  'academic | transport | hostel — used to identify and deduplicate auto-added facility fees';
