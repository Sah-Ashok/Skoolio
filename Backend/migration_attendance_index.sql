-- P8 Fix: Add missing index on attendance_details for student summary queries.
-- getStudentAttendanceSummary runs COUNT + JOIN without index support — this resolves it.
-- Run once against your database.

CREATE INDEX IF NOT EXISTS idx_attendance_details_student
  ON attendance_details(student_id, school_id);
