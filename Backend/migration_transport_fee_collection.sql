-- ============================================================
-- School-POS Migration: Transport Fee in Fee Collections
-- Run this ONCE against your PostgreSQL database
-- ============================================================

-- 1. Add fee_type column to fee_collections
ALTER TABLE fee_collections
  ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) NOT NULL DEFAULT 'academic';

-- 2. Make fee_structure_id nullable
--    Transport & hostel fees don't have a fee_structure row
ALTER TABLE fee_collections
  ALTER COLUMN fee_structure_id DROP NOT NULL;

-- 3. Add index on fee_type for fast filtering
CREATE INDEX IF NOT EXISTS idx_fee_collections_fee_type
  ON fee_collections(school_id, fee_type);

-- 4. Add unique constraint to prevent duplicate transport bills per period
--    (same student, same year, same type, same due_date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_collections_transport_period
  ON fee_collections(school_id, student_id, academic_year_id, fee_type, due_date)
  WHERE fee_type IN ('transport', 'hostel');

-- Done.
