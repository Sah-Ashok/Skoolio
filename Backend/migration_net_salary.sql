-- Migration: add net_salary to teacher_salaries
-- Run once against your database.
-- Uses a GENERATED ALWAYS AS column so net_salary is always consistent
-- with basic_salary / bonus / deduction and never goes stale.

ALTER TABLE teacher_salaries
  ADD COLUMN IF NOT EXISTS net_salary DECIMAL
    GENERATED ALWAYS AS (basic_salary + bonus - deduction) STORED;
