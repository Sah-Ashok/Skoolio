import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/teacher_dashboard_model.dart';

class TeacherDashboardRepository {
  final ApiClient _api;

  TeacherDashboardRepository(this._api);

  /// Own yearly attendance summary — requires active academic year id.
  Future<TeacherAttendanceSummary?> fetchAttendanceSummary(
      int? academicYearId) async {
    try {
      final query = academicYearId != null
          ? '?academic_year_id=$academicYearId'
          : '';
      final response = await _api.get(
          '${ApiConstants.teacherAttendanceYearly}$query');
      if (response is Map<String, dynamic>) {
        return TeacherAttendanceSummary.fromJson(response);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Notices visible to this teacher.
  Future<List<TeacherNotice>> fetchNotices() async {
    try {
      final response = await _api.get(ApiConstants.teacherNotices);
      // Backend may return { data: [...] } or a bare list
      final list = response is List
          ? response
          : (response is Map && response['data'] is List)
              ? response['data'] as List
              : <dynamic>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(TeacherNotice.fromJson)
          .take(5)
          .toList();
    } catch (_) {
      return const [];
    }
  }
}
