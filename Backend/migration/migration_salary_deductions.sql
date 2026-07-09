-- Migration: salary deduction breakdown columns
-- Run once against your database.
-- Adds named deduction columns so admin can specify tax/PF/other
-- separately. `deduction` column = sum of all three (enforced at app layer).

ALTER TABLE teacher_salaries
  ADD COLUMN IF NOT EXISTS tax_amount        DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provident_fund    DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deduction   DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_remarks TEXT          DEFAULT NULL;

COMMENT ON COLUMN teacher_salaries.tax_amount        IS 'Income tax / TDS deducted from salary';
COMMENT ON COLUMN teacher_salaries.provident_fund    IS 'Provident fund / EPF deduction';
COMMENT ON COLUMN teacher_salaries.other_deduction   IS 'Any other deduction (loan, advance, etc.)';
COMMENT ON COLUMN teacher_salaries.deduction_remarks IS 'Notes on deductions';
