-- Migration: Fix fee billing idempotency constraint (v3)
-- Fixes from v2: no :: cast inside index expressions (syntax error in some PG versions).
-- Use date_part() which returns float8 and is IMMUTABLE on a date column.
--
-- RUN ONCE:
--   psql $DATABASE_URL -f migration_fix_fee_idempotency_constraint_v3.sql

BEGIN;

-- ── Academic fees ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS uq_academic_fee_per_student_period;
DROP INDEX IF EXISTS uq_academic_fee_per_student_month;

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_fee_per_student_month
  ON fee_collections (
    school_id,
    student_id,
    fee_structure_id,
    date_part('year',  due_date),
    date_part('month', due_date)
  )
  WHERE fee_structure_id IS NOT NULL;

-- ── Transport fees ────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS uq_transport_fee_per_student_period;
DROP INDEX IF EXISTS uq_transport_fee_per_student_month;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_fee_per_student_month
  ON fee_collections (
    school_id,
    student_id,
    academic_year_id,
    date_part('year',  due_date),
    date_part('month', due_date)
  )
  WHERE fee_type = 'transport';

-- ── Hostel fees ───────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS uq_hostel_fee_per_student_period;
DROP INDEX IF EXISTS uq_hostel_fee_per_student_month;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_fee_per_student_month
  ON fee_collections (
    school_id,
    student_id,
    academic_year_id,
    date_part('year',  due_date),
    date_part('month', due_date)
  )
  WHERE fee_type = 'hostel';

COMMIT;
