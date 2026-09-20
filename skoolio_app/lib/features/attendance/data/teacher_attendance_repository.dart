import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/attendance_models.dart';

class TeacherAttendanceRepository {
  final ApiClient _apiClient;
  int? _cachedAcademicYearId;

  TeacherAttendanceRepository(this._apiClient);

  Future<int?> getActiveAcademicYearId() async {
    if (_cachedAcademicYearId != null) return _cachedAcademicYearId;
    try {
      final res = await _apiClient.get(ApiConstants.activeAcademicYear);
      if (res is Map<String, dynamic>) {
        final idVal = res['id'];
        _cachedAcademicYearId = idVal is int ? idVal : int.tryParse(idVal?.toString() ?? '');
        return _cachedAcademicYearId;
      }
    } catch (_) {
      // ignore
    }
    return null;
  }

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
    final yearId = academicYearId ?? await getActiveAcademicYearId();
    try {
      final res = await _apiClient.get(
        '/attendance/section/$sectionId',
        queryParameters: {
          'date': date,
          if (yearId != null) 'academic_year_id': yearId,
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
    final yearId = academicYearId ?? await getActiveAcademicYearId();
    final res = await _apiClient.get(
      ApiConstants.studentEnrollments,
      queryParameters: {
        'section_id': sectionId,
        if (yearId != null) 'academic_year_id': yearId,
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
    int? classId,
    required String date,
    int? academicYearId,
    required List<StudentAttendanceItem> students,
  }) async {
    final yearId = academicYearId ?? await getActiveAcademicYearId();
    return await _apiClient.post(
      ApiConstants.teacherAttendanceCreate,
      data: {
        'section_id': sectionId,
        if (classId != null) 'class_id': classId,
        'date': date,
        if (yearId != null) 'academic_year_id': yearId,
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

  Future<Map<String, dynamic>?> getActiveAcademicYear() async {
    try {
      final res = await _apiClient.get(ApiConstants.activeAcademicYear);
      if (res is Map<String, dynamic>) {
        final idVal = res['id'];
        _cachedAcademicYearId = idVal is int ? idVal : int.tryParse(idVal?.toString() ?? '');
        return res;
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getTeacherOwnAttendanceYearly({int? academicYearId}) async {
    final yearId = academicYearId ?? await getActiveAcademicYearId();
    try {
      final res = await _apiClient.get(
        '/teachers/me/attendance/yearly',
        queryParameters: {
          if (yearId != null) 'academic_year_id': yearId,
        },
      );
      if (res is Map<String, dynamic>) return res;
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getTeacherOwnAttendanceMonthly({
    required int year,
    required int month,
  }) async {
    try {
      final res = await _apiClient.get(
        '/teachers/me/attendance',
        queryParameters: {
          'year': year,
          'month': month,
        },
      );
      if (res is Map<String, dynamic>) return res;
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getStudentDetails(int studentId) async {
    try {
      final res = await _apiClient.get('/students/$studentId');
      if (res is Map<String, dynamic>) return res;
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getStudentMonthlyAttendance({
    required int studentId,
    required int year,
    required int month,
    int? academicYearId,
  }) async {
    final yearId = academicYearId ?? await getActiveAcademicYearId();
    try {
      final res = await _apiClient.get(
        '/attendance/student/$studentId/monthly',
        queryParameters: {
          'year': year,
          'month': month,
          if (yearId != null) 'academic_year_id': yearId,
        },
      );
      if (res is Map<String, dynamic>) return res;
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>> getSectionRegister({
    required int sectionId,
    required int year,
    required int month,
    int? academicYearId,
    String? startDate,
    String? endDate,
  }) async {
    final yearId = academicYearId ?? await getActiveAcademicYearId();
    String pad(int n) => n.toString().padLeft(2, '0');
    final start = startDate ?? '$year-${pad(month)}-01';
    final lastDay = DateTime(year, month + 1, 0).day;
    final end = endDate ?? '$year-${pad(month)}-${pad(lastDay)}';

    try {
      final res = await _apiClient.get(
        ApiConstants.teacherSectionRegister(sectionId),
        queryParameters: {
          if (yearId != null) 'academic_year_id': yearId,
          'year': year,
          'month': month,
          'start_date': start,
          'end_date': end,
        },
      );

      if (res is List) {
        return res.whereType<Map<String, dynamic>>().toList();
      }
      if (res is Map<String, dynamic> && res['data'] is List) {
        return (res['data'] as List).whereType<Map<String, dynamic>>().toList();
      }
    } catch (_) {}
    return [];
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

final activeAcademicYearProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final repo = ref.watch(teacherAttendanceRepositoryProvider);
  return await repo.getActiveAcademicYear();
});

final teacherYearlyAttendanceProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final repo = ref.watch(teacherAttendanceRepositoryProvider);
  return await repo.getTeacherOwnAttendanceYearly();
});
