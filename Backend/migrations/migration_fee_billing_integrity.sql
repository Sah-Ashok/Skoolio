-- Billing integrity: run once after the fee tables and fee_type migration.
-- These indexes make concurrent bill generation idempotent at the database layer.

CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_payments_school_receipt_number
  ON fee_payments (school_id, receipt_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_fee_per_student_period
  ON fee_collections (school_id, student_id, fee_structure_id, due_date)
  WHERE fee_structure_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_fee_per_student_period
  ON fee_collections (school_id, student_id, academic_year_id, fee_type, due_date)
  WHERE fee_type = 'hostel';
