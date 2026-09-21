import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/attendance/presentation/student_attendance_screen.dart';
import '../features/attendance/presentation/teacher_attendance_screen.dart';
import '../features/attendance/presentation/teacher_attendance_register_screen.dart';
import '../features/attendance/presentation/teacher_own_attendance_screen.dart';
import '../features/students/presentation/teacher_student_detail_screen.dart';
import '../features/auth/domain/models.dart';
import '../features/auth/presentation/auth_providers.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/calendar/presentation/calendar_screen.dart';
import '../features/dashboard/presentation/student_dashboard_screen.dart';
import '../features/dashboard/presentation/teacher_dashboard_screen.dart';
import '../features/exams/presentation/results_screen.dart';
import '../features/exams/presentation/teacher_marks_screen.dart';
import '../features/fees/presentation/fees_screen.dart';
import '../features/fees/presentation/student_fee_submissions_screen.dart';
import '../features/fees/presentation/student_bank_payment_screen.dart';
import '../features/notices/presentation/notices_screen.dart';
import '../features/profile/presentation/student_profile_screen.dart';
import '../features/profile/presentation/teacher_profile_screen.dart';
import '../features/salary/presentation/teacher_salary_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/contact/presentation/contact_screen.dart';
import '../features/students/presentation/teacher_students_screen.dart';
import '../features/timetable/presentation/timetable_screen.dart';

class RouterNotifier extends ChangeNotifier {
  final Ref _ref;

  RouterNotifier(this._ref) {
    _ref.listen<AuthState>(
      authStateProvider,
      (_, __) => notifyListeners(),
    );
  }

  String? redirect(BuildContext context, GoRouterState state) {
    final authState = _ref.read(authStateProvider);

    // Stay on splash screen while initial session check is running
    if (!authState.isInitialized) {
      return state.matchedLocation == '/' ? null : '/';
    }

    final isLoggingIn = state.matchedLocation == '/login';
    final isSplash = state.matchedLocation == '/';

    if (!authState.isAuthenticated) {
      return isLoggingIn ? null : '/login';
    }

    final user = authState.user;
    final isFaculty = user?.role == UserRole.faculty;

    // Redirect authenticated users away from splash or login
    if (isSplash || isLoggingIn) {
      return isFaculty ? '/teacher-dashboard' : '/student-dashboard';
    }

    // Prevent cross-role route access
    if (isFaculty && state.matchedLocation.startsWith('/student')) {
      return '/teacher-dashboard';
    }

    if (!isFaculty && state.matchedLocation.startsWith('/teacher')) {
      return '/student-dashboard';
    }

    return null;
  }
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  return RouterNotifier(ref);
});

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: notifier,
    redirect: notifier.redirect,
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/student-dashboard',
        builder: (context, state) => const StudentDashboardScreen(),
      ),
      GoRoute(
        path: '/teacher-dashboard',
        builder: (context, state) => const TeacherDashboardScreen(),
      ),

      // ── Timetable (Student & Teacher) ──
      GoRoute(
        path: '/student/timetable',
        builder: (context, state) => const TimetableScreen(),
      ),
      GoRoute(
        path: '/teacher/timetable',
        builder: (context, state) => const TimetableScreen(),
      ),

      // ── Attendance ──
      GoRoute(
        path: '/student/attendance',
        builder: (context, state) => const StudentAttendanceScreen(),
      ),
      GoRoute(
        path: '/teacher/attendance',
        builder: (context, state) => const TeacherAttendanceScreen(),
      ),
      GoRoute(
        path: '/teacher/attendance/register',
        builder: (context, state) {
          final secStr = state.uri.queryParameters['section_id'];
          final secId = secStr != null ? int.tryParse(secStr) : null;
          return TeacherAttendanceRegisterScreen(initialSectionId: secId);
        },
      ),

      // ── Fees & Payments ──
      GoRoute(
        path: '/student/fees',
        builder: (context, state) => const FeesScreen(),
      ),
      GoRoute(
        path: '/student/fees/my-submissions',
        builder: (context, state) => const StudentFeeSubmissionsScreen(),
      ),
      GoRoute(
        path: '/student/fees/bank-payment',
        builder: (context, state) => const StudentBankPaymentScreen(),
      ),

      // ── Exams & Results ──
      GoRoute(
        path: '/student/results',
        builder: (context, state) => const ResultsScreen(),
      ),
      GoRoute(
        path: '/teacher/results',
        builder: (context, state) => const TeacherMarksScreen(),
      ),

      // ── Notices ──
      GoRoute(
        path: '/student/notices',
        builder: (context, state) => const NoticesScreen(),
      ),
      GoRoute(
        path: '/teacher/notices',
        builder: (context, state) => const NoticesScreen(),
      ),

      // ── Calendar ──
      GoRoute(
        path: '/student/calendar',
        builder: (context, state) => const CalendarScreen(),
      ),
      GoRoute(
        path: '/teacher/calendar',
        builder: (context, state) => const CalendarScreen(),
      ),

      // ── Profiles ──
      GoRoute(
        path: '/student/profile',
        builder: (context, state) => const StudentProfileScreen(),
      ),
      GoRoute(
        path: '/teacher/profile',
        builder: (context, state) => const TeacherProfileScreen(),
      ),

      // ── Teacher-specific ──
      GoRoute(
        path: '/teacher/salary',
        builder: (context, state) => const TeacherSalaryScreen(),
      ),
      GoRoute(
        path: '/teacher/students',
        builder: (context, state) => const TeacherStudentsScreen(),
      ),
      GoRoute(
        path: '/teacher/students/:id',
        builder: (context, state) {
          final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
          return TeacherStudentDetailScreen(studentId: id);
        },
      ),
      GoRoute(
        path: '/teacher/attendance/own',
        builder: (context, state) => const TeacherOwnAttendanceScreen(),
      ),

      // ── Contact & Support ──
      GoRoute(
        path: '/contact',
        builder: (context, state) => const ContactScreen(),
      ),
      GoRoute(
        path: '/teacher/contact',
        builder: (context, state) => const ContactScreen(),
      ),
      GoRoute(
        path: '/student/contact',
        builder: (context, state) => const ContactScreen(),
      ),
    ],
  );
});
