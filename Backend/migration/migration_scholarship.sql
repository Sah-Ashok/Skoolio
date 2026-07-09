-- Migration: add scholarship fields to students
-- Run once against your database.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS scholarship_type    VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scholarship_percent DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scholarship_remarks TEXT         DEFAULT NULL;

-- scholarship_type values: 'merit' | 'need_based' | 'sports' | 'staff_child' | 'government' | 'custom'
-- scholarship_percent: 0.00 - 100.00 (percentage discount applied to fee collections)

COMMENT ON COLUMN students.scholarship_type    IS 'Type of scholarship awarded to student';
COMMENT ON COLUMN students.scholarship_percent IS 'Percentage fee discount from scholarship (0-100)';
COMMENT ON COLUMN students.scholarship_remarks IS 'Notes on scholarship terms or conditions';
