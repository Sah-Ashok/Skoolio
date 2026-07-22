-- Migration: add monthly_salary to teachers table
-- Run once. Safe to re-run (IF NOT EXISTS guard on the column).

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS monthly_salary DECIMAL(12, 2) DEFAULT NULL;

COMMENT ON COLUMN teachers.monthly_salary IS 'Base monthly salary agreed at hiring. Used as default when generating salary payments.';
