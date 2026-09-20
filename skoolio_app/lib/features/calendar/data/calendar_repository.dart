import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/calendar_models.dart';

class CalendarRepository {
  final ApiClient _apiClient;
  int? _cachedAcademicYearId;
  Map<String, dynamic>? _cachedAcademicYear;

  CalendarRepository(this._apiClient);

  Future<Map<String, dynamic>?> getActiveAcademicYear() async {
    if (_cachedAcademicYear != null) return _cachedAcademicYear;
    try {
      final res = await _apiClient.get(ApiConstants.activeAcademicYear);
      if (res is Map<String, dynamic>) {
        _cachedAcademicYear = res;
        final idVal = res['id'];
        _cachedAcademicYearId = idVal is int ? idVal : int.tryParse(idVal?.toString() ?? '');
        return res;
      }
    } catch (_) {}
    return null;
  }

  Future<int?> getActiveAcademicYearId() async {
    if (_cachedAcademicYearId != null) return _cachedAcademicYearId;
    final year = await getActiveAcademicYear();
    return _cachedAcademicYearId;
  }

  Future<AcademicCalendar?> getCalendar({int? academicYearId}) async {
    final yearId = academicYearId ?? await getActiveAcademicYearId();
    try {
      final res = await _apiClient.get(
        '/calendar',
        queryParameters: yearId != null ? {'academic_year_id': yearId} : null,
      );
      if (res is Map<String, dynamic>) {
        // Backend wrap or direct
        final data = res.containsKey('data') && res['data'] is Map<String, dynamic>
            ? res['data'] as Map<String, dynamic>
            : res;
        return AcademicCalendar.fromJson(data);
      }
    } catch (_) {}
    return null;
  }

  Future<List<CalendarEvent>> getCalendarEvents(int calendarId) async {
    try {
      final res = await _apiClient.get('/calendar/$calendarId/events');
      if (res is List) {
        return res
            .whereType<Map<String, dynamic>>()
            .map((e) => CalendarEvent.fromJson(e))
            .toList();
      }
      if (res is Map<String, dynamic> && res['data'] is List) {
        return (res['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((e) => CalendarEvent.fromJson(e))
            .toList();
      }
    } catch (_) {}
    return [];
  }

  Future<List<CalendarWeeklyOff>> getWeeklyOffs(int calendarId) async {
    try {
      final res = await _apiClient.get('/calendar/$calendarId/weekly-offs');
      if (res is List) {
        return res
            .whereType<Map<String, dynamic>>()
            .map((w) => CalendarWeeklyOff.fromJson(w))
            .toList();
      }
      if (res is Map<String, dynamic> && res['data'] is List) {
        return (res['data'] as List)
            .whereType<Map<String, dynamic>>()
            .map((w) => CalendarWeeklyOff.fromJson(w))
            .toList();
      }
    } catch (_) {}
    return [];
  }

  Future<CalendarBundle> getCalendarBundle({int? academicYearId}) async {
    final academicYear = await getActiveAcademicYear();
    final yearId = academicYearId ?? (academicYear?['id'] is int
        ? academicYear!['id'] as int
        : int.tryParse(academicYear?['id']?.toString() ?? ''));

    final calendar = await getCalendar(academicYearId: yearId);

    List<CalendarEvent> events = [];
    List<CalendarWeeklyOff> weeklyOffs = [];

    if (calendar != null) {
      final results = await Future.wait([
        getCalendarEvents(calendar.id),
        getWeeklyOffs(calendar.id),
      ]);
      events = results[0] as List<CalendarEvent>;
      weeklyOffs = results[1] as List<CalendarWeeklyOff>;
    }

    return CalendarBundle(
      calendar: calendar,
      events: events,
      weeklyOffs: weeklyOffs,
      academicYear: academicYear,
    );
  }
}

final calendarRepositoryProvider = Provider<CalendarRepository>((ref) {
  final client = ref.watch(apiClientProvider);
  return CalendarRepository(client);
});

final calendarBundleProvider = FutureProvider<CalendarBundle>((ref) async {
  final repo = ref.watch(calendarRepositoryProvider);
  return await repo.getCalendarBundle();
});
