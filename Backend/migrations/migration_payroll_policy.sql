-- Migration: payroll_policy — per-school salary calculation rules
-- Run once. Safe to re-run (all IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS payroll_policy (
  id                     SERIAL PRIMARY KEY,
  school_id              INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- Paid leave quota
  paid_leave_days_per_month  INTEGER        NOT NULL DEFAULT 0,
  -- Leave days within this quota are NOT deducted from salary.
  -- Days beyond quota are deducted at per_day_salary rate.

  -- Half-day pay rule
  half_day_pay_percent   INTEGER        NOT NULL DEFAULT 50
    CHECK (half_day_pay_percent BETWEEN 0 AND 100),
  -- 50 = teacher earns 50% of per-day salary for a half day
  -- 0  = half-day is fully deducted
  -- 100 = no deduction for half-day

  -- Absent days beyond paid leave quota: deducted at per_day_salary
  -- (always true — no toggle needed)

  -- Default deduction fields (pre-fill values in PaySalaryPage)
  default_tax_percent    DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  default_pf_percent     DECIMAL(5,2)   NOT NULL DEFAULT 0.00,
  -- These are % of basic_salary applied as defaults when admin opens PaySalaryPage.
  -- Admin can still override per payment.

  -- Working days basis
  working_days_basis     VARCHAR(20)    NOT NULL DEFAULT 'manual'
    CHECK (working_days_basis IN ('manual', 'calendar')),
  -- 'manual'   = admin types working days each month
  -- 'calendar' = auto-compute from calendar_weekly_offs + calendar_events (future)

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (school_id) -- one policy per school
);

CREATE INDEX IF NOT EXISTS idx_payroll_policy_school ON payroll_policy(school_id);

COMMENT ON TABLE payroll_policy IS 'Per-school payroll calculation rules — paid leave quota, half-day pay, default deductions';
COMMENT ON COLUMN payroll_policy.paid_leave_days_per_month IS 'Monthly quota of leaves that are paid (not deducted). Days beyond quota are deducted.';
COMMENT ON COLUMN payroll_policy.half_day_pay_percent IS '0–100: % of per-day salary earned on a half-day. 50 = half pay, 0 = full deduction, 100 = no deduction.';
COMMENT ON COLUMN payroll_policy.default_tax_percent IS 'Default income tax % of basic salary (pre-fills PaySalaryPage, admin can override)';
COMMENT ON COLUMN payroll_policy.default_pf_percent IS 'Default provident fund % of basic salary (pre-fills PaySalaryPage, admin can override)';