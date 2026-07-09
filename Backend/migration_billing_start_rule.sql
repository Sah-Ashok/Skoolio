-- Migration: billing_start_rule on fee_structures
-- Run once against your PostgreSQL database.

ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS billing_start_rule VARCHAR(20) NOT NULL DEFAULT 'next_month';

-- Valid values:
-- 'next_month'      = first bill is the month AFTER admission month (default, most common)
-- 'skip_two_months' = first bill is 2 months after admission (buffer for late joiners)
-- 'academic_year'   = bill from academic year start regardless of admission date

-- Mid-month rule (applied to ALL rules):
--   Student admitted day <= 15 → include current month
--   Student admitted day >  15 → skip current month, start next

COMMENT ON COLUMN fee_structures.billing_start_rule IS
  'When monthly billing starts relative to student admission date';
