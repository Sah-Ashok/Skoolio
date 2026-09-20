import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/timetable_model.dart';

class TimetableRepository {
  final ApiClient _apiClient;

  TimetableRepository(this._apiClient);

  Future<TimetableSchedule> getStudentSchedule() async {
    final res = await _apiClient.get(ApiConstants.studentTimetable);
    if (res is Map<String, dynamic>) {
      return TimetableSchedule.fromJson(res);
    }
    return TimetableSchedule(allSlots: [], scheduleByDay: {});
  }

  Future<TimetableSchedule> getTeacherSchedule() async {
    final res = await _apiClient.get(ApiConstants.teacherTimetable);
    if (res is Map<String, dynamic>) {
      return TimetableSchedule.fromJson(res);
    }
    return TimetableSchedule(allSlots: [], scheduleByDay: {});
  }
}

final timetableRepositoryProvider = Provider<TimetableRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return TimetableRepository(client);
});

final studentTimetableProvider = FutureProvider<TimetableSchedule>((ref) async {
  final repo = ref.watch(timetableRepositoryProvider);
  return await repo.getStudentSchedule();
});

final teacherTimetableProvider = FutureProvider<TimetableSchedule>((ref) async {
  final repo = ref.watch(timetableRepositoryProvider);
  return await repo.getTeacherSchedule();
});
