import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/attendance_models.dart';

class TeacherAttendanceRepository {
  final ApiClient _apiClient;

  TeacherAttendanceRepository(this._apiClient);

  Future<List<TeacherSection>> getTeacherSections() async {
    final res = await _apiClient.get(ApiConstants.teacherSections);
    if (res is List) {
      return res
          .whereType<Map<String, dynamic>>()
          .map((s) => TeacherSection.fromJson(s))
          .toList();
    }
    return [];
  }

  Future<Map<String, dynamic>?> getSectionAttendanceForDate({
    required int sectionId,
    required String date,
    int? academicYearId,
  }) async {
    try {
      final res = await _apiClient.get(
        '/attendance/section/$sectionId',
        queryParameters: {
          'date': date,
          if (academicYearId != null) 'academic_year_id': academicYearId,
        },
      );
      if (res is Map<String, dynamic>) {
        return res;
      }
      if (res is List && res.isNotEmpty) {
        return res.first as Map<String, dynamic>;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<List<StudentAttendanceItem>> getSectionStudents({
    required int sectionId,
    int? academicYearId,
  }) async {
    final res = await _apiClient.get(
      ApiConstants.studentEnrollments,
      queryParameters: {
        'section_id': sectionId,
        if (academicYearId != null) 'academic_year_id': academicYearId,
      },
    );

    if (res is List) {
      return res
          .whereType<Map<String, dynamic>>()
          .map((item) => StudentAttendanceItem.fromJson(item))
          .toList();
    }
    return [];
  }

  Future<dynamic> createAttendance({
    required int sectionId,
    required String date,
    int? academicYearId,
    required List<StudentAttendanceItem> students,
  }) async {
    return await _apiClient.post(
      ApiConstants.teacherAttendanceCreate,
      data: {
        'section_id': sectionId,
        'date': date,
        if (academicYearId != null) 'academic_year_id': academicYearId,
        'students': students.map((s) => s.toJson()).toList(),
      },
    );
  }

  Future<dynamic> updateAttendanceDetails({
    required int attendanceId,
    required List<StudentAttendanceItem> students,
  }) async {
    return await _apiClient.put(
      ApiConstants.teacherAttendanceBulkUpdate(attendanceId),
      data: {
        'details': students.map((s) => s.toJson()).toList(),
      },
    );
  }

  Future<dynamic> submitAttendance(int attendanceId) async {
    return await _apiClient.patch(
      ApiConstants.teacherAttendanceSubmit(attendanceId),
    );
  }
}

final teacherAttendanceRepositoryProvider = Provider<TeacherAttendanceRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return TeacherAttendanceRepository(client);
});

final teacherSectionsProvider = FutureProvider.autoDispose<List<TeacherSection>>((ref) async {
  final repo = ref.watch(teacherAttendanceRepositoryProvider);
  return await repo.getTeacherSections();
});
