import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../features/attendance/presentation/attendance_screen.dart';
import '../features/auth/domain/models.dart';
import '../features/auth/presentation/auth_providers.dart';
// Unified login (dev build — both role tabs visible)
import '../features/auth/presentation/login_screen.dart';
// Flavor-specific login screens (no role tab)
import '../features/auth/presentation/student_login_screen.dart';
import '../features/auth/presentation/teacher_login_screen.dart';
import '../features/calendar/presentation/calendar_screen.dart';
import '../features/dashboard/presentation/student_dashboard_screen.dart';
import '../features/dashboard/presentation/teacher_dashboard_screen.dart';
import '../features/fees/presentation/fees_screen.dart';
import '../features/notices/presentation/notices_screen.dart';
import '../features/profile/presentation/student_profile_screen.dart';
import '../features/profile/presentation/teacher_profile_screen.dart';
import '../features/results/presentation/results_screen.dart';
import '../features/salary/presentation/teacher_salary_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/timetable/presentation/timetable_screen.dart';
import 'app.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final forcedRole     = ref.read(appForcedRoleProvider);
  final routerNotifier = _AuthRouterNotifier(ref);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: routerNotifier,
    redirect: (BuildContext context, GoRouterState state) {
      final authState = routerNotifier.authState;

      // While still initialising, stay on splash.
      if (!authState.isInitialized) {
        return state.matchedLocation == '/' ? null : '/';
      }

      final isLoggedIn = authState.isAuthenticated;

      // Login paths differ per flavor.
      final loginPath = forcedRole == 'student'
          ? '/login/student'
          : forcedRole == 'teacher'
              ? '/login/teacher'
              : '/login';

      final isOnSplash = state.matchedLocation == '/';
      final isOnLogin  = state.matchedLocation.startsWith('/login');

      // Not logged in — only login screens are accessible.
      if (!isLoggedIn) {
        return isOnLogin ? null : loginPath;
      }

      // Logged in — redirect away from splash/login to the correct dashboard.
      if (isOnSplash || isOnLogin) {
        return authState.user?.role == UserRole.faculty
            ? '/teacher-dashboard'
            : '/student-dashboard';
      }

      // Role guard: prevent accessing the wrong dashboard.
      final loc = state.matchedLocation;
      if (loc == '/student-dashboard' &&
          authState.user?.role == UserRole.faculty) {
        return '/teacher-dashboard';
      }
      if (loc == '/teacher-dashboard' &&
          authState.user?.role == UserRole.student) {
        return '/student-dashboard';
      }

      // Flavor guard: block cross-portal routes on single-role builds.
      if (forcedRole == 'student' && loc.startsWith('/teacher')) {
        return '/student-dashboard';
      }
      if (forcedRole == 'teacher' && loc.startsWith('/student')) {
        return '/teacher-dashboard';
      }

      return null;
    },
    routes: [
      // ── Core ──────────────────────────────────────────────────────────────
      GoRoute(path: '/', builder: (_, __) => const SplashScreen()),

      // Unified login (dev / main.dart — both role tabs).
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),

      // Flavor-specific login screens.
      GoRoute(
          path: '/login/student',
          builder: (_, __) => const StudentLoginScreen()),
      GoRoute(
          path: '/login/teacher',
          builder: (_, __) => const TeacherLoginScreen()),

      // ── Student Dashboard ──────────────────────────────────────────────
      GoRoute(
          path: '/student-dashboard',
          builder: (_, __) => const StudentDashboardScreen()),

      // ── Student Module Screens ───────────────────────────────────────────
      GoRoute(
          path: '/student/attendance',
          builder: (_, __) => const AttendanceScreen()),
      GoRoute(
          path: '/student/fees',
          builder: (_, __) => const FeesScreen()),
      GoRoute(
          path: '/student/results',
          builder: (_, __) => const ResultsScreen()),
      GoRoute(
          path: '/student/notices',
          builder: (_, __) => const NoticesScreen()),
      GoRoute(
          path: '/student/timetable',
          builder: (_, __) => const TimetableScreen()),
      GoRoute(
          path: '/student/calendar',
          builder: (_, __) => const CalendarScreen()),
      GoRoute(
          path: '/student/profile',
          builder: (_, __) => const StudentProfileScreen()),

      // ── Teacher Dashboard ──────────────────────────────────────────────
      GoRoute(
          path: '/teacher-dashboard',
          builder: (_, __) => const TeacherDashboardScreen()),

      // ── Teacher Module Screens ───────────────────────────────────────────
      GoRoute(
          path: '/teacher/attendance',
          builder: (_, __) => const AttendanceScreen()),
      GoRoute(
          path: '/teacher/notices',
          builder: (_, __) => const NoticesScreen()),
      GoRoute(
          path: '/teacher/timetable',
          builder: (_, __) => const TimetableScreen()),
      GoRoute(
          path: '/teacher/calendar',
          builder: (_, __) => const CalendarScreen()),
      GoRoute(
          path: '/teacher/salary',
          builder: (_, __) => const TeacherSalaryScreen()),
      GoRoute(
          path: '/teacher/profile',
          builder: (_, __) => const TeacherProfileScreen()),
    ],
  );
});

/// Triggers GoRouter re-evaluation whenever [authStateProvider] changes.
class _AuthRouterNotifier extends ChangeNotifier {
  final Ref _ref;
  AuthState _authState;

  _AuthRouterNotifier(this._ref)
      : _authState = _ref.read(authStateProvider) {
    _ref.listen<AuthState>(authStateProvider, (_, next) {
      _authState = next;
      notifyListeners();
    });
  }

  AuthState get authState => _authState;
}
