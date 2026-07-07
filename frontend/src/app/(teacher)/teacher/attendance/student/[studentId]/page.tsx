import StudentAttendancePage from "@/components/admin/attendance/StudentAttendancePage";

// NOTE: StudentAttendancePage still renders hardcoded/static data and doesn't
// accept a studentId prop yet - that's a separate fix. This file only wires
// up the route itself so /attendance/student/[studentId] no longer 404s.
export default function AttendanceStudentRoutePage() {
  return <StudentAttendancePage />;
}
