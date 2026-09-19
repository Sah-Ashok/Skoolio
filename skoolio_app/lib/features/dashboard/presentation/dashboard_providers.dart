import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../auth/presentation/auth_providers.dart';
import '../data/student_dashboard_repository.dart';
import '../data/teacher_dashboard_repository.dart';
import '../domain/student_dashboard_model.dart';
import '../domain/teacher_dashboard_model.dart';

// ── Repositories ──────────────────────────────────────────────────────────────

final studentDashboardRepositoryProvider =
    Provider<StudentDashboardRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return StudentDashboardRepository(client);
});

final teacherDashboardRepositoryProvider =
    Provider<TeacherDashboardRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return TeacherDashboardRepository(client);
});

// ── Student providers ─────────────────────────────────────────────────────────

final attendanceSummaryProvider =
    FutureProvider.autoDispose<AttendanceSummary?>((ref) async {
  final repo = ref.watch(studentDashboardRepositoryProvider);
  final academicId = await ref.watch(activeAcademicYearIdProvider.future);
  return repo.fetchAttendanceSummary(academicYearId: academicId);
});

/// Active academic year id — fetched once and cached for the session.
final activeAcademicYearIdProvider = FutureProvider.autoDispose<int?>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.activeAcademicYear);
    if (res is Map<String, dynamic>) {
      final raw = res['id'] ?? res['academic_year_id'];
      return raw is int ? raw : int.tryParse(raw?.toString() ?? '');
    }
  } catch (_) {}
  return null;
});

final feeOverviewProvider =
    FutureProvider.autoDispose<FeeOverview?>((ref) async {
  final repo = ref.watch(studentDashboardRepositoryProvider);
  final academicId = await ref.watch(activeAcademicYearIdProvider.future);
  return repo.fetchFeeOverview(academicYearId: academicId);
});

final studentExamResultsProvider =
    FutureProvider.autoDispose<List<ExamResult>>((ref) async {
  final repo = ref.watch(studentDashboardRepositoryProvider);
  final academicId = await ref.watch(activeAcademicYearIdProvider.future);
  return repo.fetchExamResults(academicYearId: academicId);
});

final studentNoticesProvider =
    FutureProvider.autoDispose<List<StudentNotice>>((ref) {
  final repo = ref.watch(studentDashboardRepositoryProvider);
  return repo.fetchNotices();
});

// ── Teacher providers ─────────────────────────────────────────────────────────

/// Own yearly attendance — academic_year_id omitted; backend defaults to
/// the current active year when the parameter is absent.
final teacherAttendanceSummaryProvider =
    FutureProvider.autoDispose<TeacherAttendanceSummary?>((ref) {
  final repo = ref.watch(teacherDashboardRepositoryProvider);
  return repo.fetchAttendanceSummary(null);
});

final teacherNoticesProvider =
    FutureProvider.autoDispose<List<TeacherNotice>>((ref) {
  final repo = ref.watch(teacherDashboardRepositoryProvider);
  return repo.fetchNotices();
});
