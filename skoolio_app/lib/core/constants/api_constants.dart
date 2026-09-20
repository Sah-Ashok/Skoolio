class ApiConstants {
  // Configurable base URL
  static const String defaultBaseUrl = 'http://20.219.6.128:5001/api';

  // ── Auth Endpoints ──────────────────────────────────────────
  static const String studentLogin = '/auth/login/student';
  static const String teacherLogin = '/auth/login/teacher';
  static const String logout = '/auth/logout';
  static const String getMe = '/auth/me';

  // ── Student Endpoints ───────────────────────────────────────
  static const String studentAttendanceSummary = '/attendance/me/summary';
  static const String studentAttendanceMonthly = '/attendance/me/monthly';
  static const String studentFees = '/fees/me/collections';
  static const String studentPayments = '/fees/me/payments';
  static const String studentNotices = '/notices/student';
  static const String studentResults = '/exams/my-results';
  static const String studentExamSchedules = '/exams/me/schedules';
  static const String studentTimetable = '/timetable/student/my-schedule';
  static const String studentOnlinePaymentRequests = '/online-payments/requests';
  static const String studentMyPaymentRequests = '/online-payments/my-requests';
  static const String activeBankAccounts = '/online-payments/active-bank-accounts';

  // ── Teacher Endpoints ───────────────────────────────────────
  static const String teacherSections = '/teachers/me/sections';
  static const String teacherSalary = '/teachers/me/salary';
  static const String teacherAttendanceOwn = '/teachers/me/attendance';
  static const String teacherTimetable = '/timetable/teacher/my-schedule';
  static const String teacherNotices = '/notices/teacher';
  static const String teacherAttendanceCreate = '/attendance';
  static String teacherSectionRegister(int sectionId) => '/attendance/section/$sectionId/register';
  static String teacherAttendanceBulkUpdate(int attendanceId) => '/attendance/$attendanceId/details/bulk';
  static String teacherAttendanceSubmit(int attendanceId) => '/attendance/$attendanceId/submit';
  static const String teacherExams = '/exams';
  static String teacherExamRegister(int examId, int classId) => '/exams/$examId/class/$classId/register';
  static const String teacherExamResultsBulk = '/exams/results/bulk';
  static const String studentEnrollments = '/students/enrollments';

  // ── Shared Endpoints ────────────────────────────────────────
  static const String calendarEvents = '/calendar';
  static String noticeDetail(int id) => '/notices/$id';
}
