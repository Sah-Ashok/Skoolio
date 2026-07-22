-- Migration: enhance teacher_salaries with attendance-based calculation fields
-- Run once. All additions are IF NOT EXISTS / safe to re-run.

-- 1. Add attendance-based salary calculation fields to teacher_salaries
ALTER TABLE teacher_salaries
  ADD COLUMN IF NOT EXISTS working_days   INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS present_days   INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS absent_days    INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS half_days      INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS leave_days     INTEGER       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS per_day_salary DECIMAL(12,2) DEFAULT NULL;

COMMENT ON COLUMN teacher_salaries.working_days   IS 'Total working days in the month';
COMMENT ON COLUMN teacher_salaries.present_days   IS 'Days teacher was present';
COMMENT ON COLUMN teacher_salaries.absent_days    IS 'Days teacher was absent (deducted)';
COMMENT ON COLUMN teacher_salaries.half_days      IS 'Half days (counted as 0.5 each)';
COMMENT ON COLUMN teacher_salaries.leave_days     IS 'Approved leave days (not deducted)';
COMMENT ON COLUMN teacher_salaries.per_day_salary IS 'Monthly salary / working_days — used for absent deduction';

-- 2. Ensure teacher_attendance table exists with correct structure
CREATE TABLE IF NOT EXISTS teacher_attendance (
  id          SERIAL PRIMARY KEY,
  school_id   INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date        DATE    NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'present'
                CHECK (status IN ('present','absent','leave','half_day')),
  check_in    TIME    DEFAULT NULL,
  check_out   TIME    DEFAULT NULL,
  note        TEXT    DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, teacher_id, date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_school_date ON teacher_attendance(school_id, date);
CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher     ON teacher_attendance(teacher_id, date);
