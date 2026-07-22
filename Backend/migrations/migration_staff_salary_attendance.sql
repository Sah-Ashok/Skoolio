-- Migration: add attendance-based salary fields to staff_salary_payments
-- Run once. All additions are IF NOT EXISTS — safe to re-run.

ALTER TABLE staff_salary_payments
  ADD COLUMN IF NOT EXISTS working_days   INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS present_days   INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS absent_days    INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS half_days      INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS leave_days     INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS per_day_salary DECIMAL(12,2) DEFAULT NULL;

COMMENT ON COLUMN staff_salary_payments.working_days   IS 'Total working days in the month (calendar days minus weekly offs/holidays)';
COMMENT ON COLUMN staff_salary_payments.present_days   IS 'Days staff was present';
COMMENT ON COLUMN staff_salary_payments.absent_days    IS 'Days absent — each deducted at per_day_salary rate';
COMMENT ON COLUMN staff_salary_payments.half_days      IS 'Half days — each deducted at 0.5 × per_day_salary';
COMMENT ON COLUMN staff_salary_payments.leave_days     IS 'Approved leave days — not deducted';
COMMENT ON COLUMN staff_salary_payments.per_day_salary IS 'basic_salary / working_days — used for absent deduction';
