-- Migration: Fix fee billing idempotency constraint (v4)
-- First removes existing duplicate bills (keeping the oldest per month),
-- then creates the unique indexes.
--
-- SAFE: only deletes the NEWER duplicate rows (higher id = created later).
-- The oldest bill for each month is kept intact with all its payment history.
--
-- RUN ONCE:
--   psql $DATABASE_URL -f migration_fix_fee_idempotency_constraint_v4.sql

BEGIN;

-- ── Step 1: Remove duplicate academic fee bills ───────────────────────────────
-- For each (school, student, fee_structure, year, month) group that has more
-- than one row, delete all rows except the one with the lowest id (oldest).
-- We only delete rows that have no payments (remaining_amount = net_amount,
-- paid_amount = 0) to avoid destroying payment history. If BOTH duplicates
-- have payments, we keep both and let the admin resolve manually — the index
-- creation will then fail only for those specific rows.

DELETE FROM fee_collections
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          school_id,
          student_id,
          fee_structure_id,
          date_part('year',  due_date),
          date_part('month', due_date)
        ORDER BY id ASC  -- keep the oldest (lowest id)
      ) AS rn,
      paid_amount
    FROM fee_collections
    WHERE fee_structure_id IS NOT NULL
  ) ranked
  WHERE rn > 1          -- these are the duplicates
    AND paid_amount = 0  -- only delete if no cash has been collected on this bill
);

-- ── Step 2: Remove duplicate transport fee bills ──────────────────────────────
DELETE FROM fee_collections
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          school_id,
          student_id,
          academic_year_id,
          date_part('year',  due_date),
          date_part('month', due_date)
        ORDER BY id ASC
      ) AS rn,
      paid_amount
    FROM fee_collections
    WHERE fee_type = 'transport'
  ) ranked
  WHERE rn > 1
    AND paid_amount = 0
);

-- ── Step 3: Remove duplicate hostel fee bills ─────────────────────────────────
DELETE FROM fee_collections
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          school_id,
          student_id,
          academic_year_id,
          date_part('year',  due_date),
          date_part('month', due_date)
        ORDER BY id ASC
      ) AS rn,
      paid_amount
    FROM fee_collections
    WHERE fee_type = 'hostel'
  ) ranked
  WHERE rn > 1
    AND paid_amount = 0
);

-- ── Step 4: Report any remaining duplicates that could NOT be auto-deleted ────
-- (These would be duplicate months where BOTH rows have payments — rare but
--  possible. The index creation below will fail for these and show you which
--  students need manual review.)
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT school_id, student_id, fee_structure_id,
           date_part('year', due_date), date_part('month', due_date)
    FROM fee_collections
    WHERE fee_structure_id IS NOT NULL
    GROUP BY 1,2,3,4,5
    HAVING COUNT(*) > 1
  ) dups;

  IF dup_count > 0 THEN
    RAISE WARNING 'WARNING: % duplicate academic fee group(s) still exist with payments on both rows. Manual review required before index can be created.', dup_count;
  ELSE
    RAISE NOTICE 'All academic fee duplicates resolved. Proceeding to create indexes.';
  END IF;
END $$;

-- ── Step 5: Create the unique indexes ────────────────────────────────────────
DROP INDEX IF EXISTS uq_academic_fee_per_student_period;
DROP INDEX IF EXISTS uq_academic_fee_per_student_month;

CREATE UNIQUE INDEX uq_academic_fee_per_student_month
  ON fee_collections (
    school_id,
    student_id,
    fee_structure_id,
    date_part('year',  due_date),
    date_part('month', due_date)
  )
  WHERE fee_structure_id IS NOT NULL;

DROP INDEX IF EXISTS uq_transport_fee_per_student_period;
DROP INDEX IF EXISTS uq_transport_fee_per_student_month;

CREATE UNIQUE INDEX uq_transport_fee_per_student_month
  ON fee_collections (
    school_id,
    student_id,
    academic_year_id,
    date_part('year',  due_date),
    date_part('month', due_date)
  )
  WHERE fee_type = 'transport';

DROP INDEX IF EXISTS uq_hostel_fee_per_student_period;
DROP INDEX IF EXISTS uq_hostel_fee_per_student_month;

CREATE UNIQUE INDEX uq_hostel_fee_per_student_month
  ON fee_collections (
    school_id,
    student_id,
    academic_year_id,
    date_part('year',  due_date),
    date_part('month', due_date)
  )
  WHERE fee_type = 'hostel';

COMMIT;
