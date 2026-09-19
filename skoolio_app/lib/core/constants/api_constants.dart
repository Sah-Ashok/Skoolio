import 'package:flutter/foundation.dart';

class ApiConstants {
  // ── Base URL ──────────────────────────────────────────────────────────────
  // The backend runs plain HTTP on port 5001 (no TLS on the server itself).
  // Using https:// here was causing HandshakeException → fake logout.
  // When you add a domain + reverse proxy with TLS, switch back to https://.
  static String get defaultBaseUrl {
    if (kIsWeb) return 'http://20.219.6.128:5001';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://20.219.6.128:5001';
    }
    // iOS / other
    return 'http://20.219.6.128:5001';
  }

  // ── Auth ─────────────────────────────────────────────────────────────────
  static const String studentLogin = '/api/auth/login/student';
  static const String teacherLogin = '/api/auth/login/teacher';
  static const String getMe        = '/api/auth/me';
  static const String logout       = '/api/auth/logout';

  // ── Academic Year ─────────────────────────────────────────────────────────
  static const String activeAcademicYear = '/api/academic-years/active';

  // ── Student — Attendance ─────────────────────────────────────────────────
  static const String studentAttendanceSummary = '/api/attendance/me/summary';
  static const String studentAttendanceMonthly = '/api/attendance/me/monthly';

  // ── Student — Fees ───────────────────────────────────────────────────────
  static const String studentFeeCollections = '/api/fees/me/collections';
  static const String studentFeePayments    = '/api/fees/payments/student';
  static const String downloadReceipt       = '/api/fees/receipts';

  // ── Student — Exams & Results ────────────────────────────────────────────
  static const String studentResults = '/api/exams/my-results';

  // ── Notices ──────────────────────────────────────────────────────────────
  static const String studentNotices = '/api/notices/student';
  static const String teacherNotices = '/api/notices/teacher';

  // ── Calendar ─────────────────────────────────────────────────────────────
  static const String calendarBase = '/api/calendar';

  // ── Timetable ────────────────────────────────────────────────────────────
  static const String timetableStudent = '/api/timetable/student/my-schedule';
  static const String timetableTeacher = '/api/timetable/teacher/my-schedule';

  // ── Teacher ──────────────────────────────────────────────────────────────
  static const String teacherProfile          = '/api/auth/me';
  static const String teacherSections         = '/api/teachers/me/sections';
  static const String teacherSalaries         = '/api/teachers/me/salary';
  static const String teacherMarkAttendance   = '/api/attendance';
  static const String teacherSectionMonthly   = '/api/attendance/section';
  /// Yearly own-attendance summary: append ?academic_year_id=`id`
  static const String teacherAttendanceYearly = '/api/teachers/me/attendance/yearly';

  // ── Exams (teacher) ──────────────────────────────────────────────────────
  static const String teacherResults  = '/api/exams/results';
  static const String examSchedules   = '/api/exams';
}
