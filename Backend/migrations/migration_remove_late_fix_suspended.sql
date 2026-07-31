-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Remove late/suspended from student attendance
-- Safe PostgreSQL ENUM migration
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ============================================================================
-- STEP 1: Convert existing 'late' records to 'present'
-- ============================================================================

UPDATE attendance_details
SET
    status = 'present'::student_attendance_status_enum,
    updated_at = NOW()
WHERE status::text = 'late';

-- ============================================================================
-- STEP 2: Delete suspended attendance records
-- ============================================================================

DELETE FROM attendance_details
WHERE status::text = 'suspended';

-- ============================================================================
-- STEP 3: Remove total_late column
-- ============================================================================

ALTER TABLE attendance
DROP COLUMN IF EXISTS total_late;

-- ============================================================================
-- STEP 4: Remove default before changing enum
-- ============================================================================

ALTER TABLE attendance_details
ALTER COLUMN status DROP DEFAULT;

-- ============================================================================
-- STEP 5: Rename old enum
-- ============================================================================

ALTER TYPE student_attendance_status_enum
RENAME TO student_attendance_status_enum_old;

-- ============================================================================
-- STEP 6: Create new enum
-- ============================================================================

CREATE TYPE student_attendance_status_enum AS ENUM (
    'present',
    'absent',
    'leave'
);

-- ============================================================================
-- STEP 7: Change column to new enum
-- ============================================================================

ALTER TABLE attendance_details
ALTER COLUMN status
TYPE student_attendance_status_enum
USING status::text::student_attendance_status_enum;

-- ============================================================================
-- STEP 8: Restore default
-- ============================================================================

ALTER TABLE attendance_details
ALTER COLUMN status
SET DEFAULT 'present'::student_attendance_status_enum;

-- ============================================================================
-- STEP 9: Drop old enum
-- ============================================================================

DROP TYPE student_attendance_status_enum_old;

-- ============================================================================
-- STEP 10: Recalculate attendance totals
-- ============================================================================

UPDATE attendance a
SET
    total_present = (
        SELECT COUNT(*)
        FROM attendance_details ad
        WHERE ad.attendance_id = a.id
          AND ad.status = 'present'
    ),
    total_absent = (
        SELECT COUNT(*)
        FROM attendance_details ad
        WHERE ad.attendance_id = a.id
          AND ad.status = 'absent'
    ),
    total_leave = (
        SELECT COUNT(*)
        FROM attendance_details ad
        WHERE ad.attendance_id = a.id
          AND ad.status = 'leave'
    ),
    updated_at = NOW()
WHERE a.status::text = 'draft';

COMMIT;