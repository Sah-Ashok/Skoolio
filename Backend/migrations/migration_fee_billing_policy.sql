-- Run once. Safe to re-run (IF NOT EXISTS / ON CONFLICT).
-- Creates the fee_billing_policy table used by the billing engine.

CREATE TABLE IF NOT EXISTS fee_billing_policy (
  id                   SERIAL PRIMARY KEY,
  school_id            INTEGER NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
  billing_start_from   VARCHAR(20) NOT NULL DEFAULT 'academic_year'
    CHECK (billing_start_from IN ('academic_year', 'join_date')),
  monthly_bill_window  VARCHAR(20) NOT NULL DEFAULT 'bill_current'
    CHECK (monthly_bill_window IN ('bill_current', 'bill_past_due')),
  overdue_grace_days   INTEGER NOT NULL DEFAULT 0 CHECK (overdue_grace_days >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fee_billing_policy IS
  'Per-school fee billing configuration — one row per school (UNIQUE on school_id).';
COMMENT ON COLUMN fee_billing_policy.billing_start_from IS
  'academic_year: bill all students from AY start; join_date: bill from the month student joined.';
COMMENT ON COLUMN fee_billing_policy.monthly_bill_window IS
  'bill_current: only generate the requested month; bill_past_due: also back-fill all unbilled past months.';
COMMENT ON COLUMN fee_billing_policy.overdue_grace_days IS
  'Days after due_date before a bill is marked overdue in the UI (does not change the DB due_date).';
