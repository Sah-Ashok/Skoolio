import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../domain/student_dashboard_model.dart';

class StudentDashboardRepository {
  final ApiClient _api;

  StudentDashboardRepository(this._api);

  /// Fetches attendance summary for the current student.
  Future<AttendanceSummary?> fetchAttendanceSummary({int? academicYearId}) async {
    try {
      final path = academicYearId != null
          ? '${ApiConstants.studentAttendanceSummary}?academic_year_id=$academicYearId'
          : ApiConstants.studentAttendanceSummary;
      final response = await _api.get(path);
      if (response is Map<String, dynamic>) {
        return AttendanceSummary.fromJson(response);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Fetches the student's fee collections (paid + pending).
  /// Passes active academic year so only current-year bills are included.
  Future<FeeOverview?> fetchFeeOverview({int? academicYearId}) async {
    try {
      final path = academicYearId != null
          ? '${ApiConstants.studentFeeCollections}?academic_year_id=$academicYearId'
          : ApiConstants.studentFeeCollections;
      final response = await _api.get(path);
      if (response is Map<String, dynamic>) {
        return FeeOverview.fromJson(response);
      }
      if (response is List && response.isNotEmpty) {
        final list = response
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        return FeeOverview.fromList(list);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Fetches the student's exam results.
  Future<List<ExamResult>> fetchExamResults({int? academicYearId}) async {
    try {
      final queryParams = <String, dynamic>{};
      if (academicYearId != null) queryParams['academic_year_id'] = academicYearId;

      final response = await _api.get(
        ApiConstants.studentResults,
        queryParameters: queryParams.isNotEmpty ? queryParams : null,
      );
      final list = response is List
          ? response
          : (response is Map && response['data'] is List)
              ? response['data'] as List
              : <dynamic>[];
      return list
          .whereType<Map>()
          .map((e) => ExamResult.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } catch (_) {
      return const [];
    }
  }

  /// Fetches the notices visible to this student.
  Future<List<StudentNotice>> fetchNotices() async {
    try {
      final response = await _api.get(ApiConstants.studentNotices);
      final list = response is List
          ? response
          : (response is Map && response['data'] is List)
              ? response['data'] as List
              : <dynamic>[];
      return list
          .whereType<Map<String, dynamic>>()
          .map(StudentNotice.fromJson)
          .take(5)
          .toList();
    } catch (_) {
      return const [];
    }
  }
}
