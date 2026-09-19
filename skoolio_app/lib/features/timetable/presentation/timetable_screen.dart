import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/domain/models.dart';
import '../../auth/presentation/auth_providers.dart';

class TimetableScreen extends ConsumerStatefulWidget {
  const TimetableScreen({super.key});

  @override
  ConsumerState<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends ConsumerState<TimetableScreen> {
  int _selectedDayIndex = 0; // 0 = Mon, 1 = Tue, etc.
  static const _days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  bool _isLoading = true;
  String? _error;
  List<dynamic> _periods = [];

  @override
  void initState() {
    super.initState();
    // Default to current weekday if Monday-Saturday
    final now = DateTime.now();
    if (now.weekday >= 1 && now.weekday <= 6) {
      _selectedDayIndex = now.weekday - 1;
    }
    _loadTimetable();
  }

  Future<void> _loadTimetable() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final client = ref.read(apiClientProvider);
    final user = ref.read(authStateProvider).user;
    final endpoint = user?.role == UserRole.faculty
        ? ApiConstants.timetableTeacher
        : ApiConstants.timetableStudent;

    try {
      final res = await client.get(endpoint);
      List<dynamic> list = [];
      if (res is List) {
        list = res;
      } else if (res is Map) {
        final data = res['data'];
        if (data is List) {
          list = data;
        } else if (data is Map) {
          if (data['slots'] is List) {
            list = data['slots'] as List;
          } else if (data['schedule_by_day'] is Map) {
            final dayMap = data['schedule_by_day'] as Map;
            list = dayMap.values.expand((v) => v is List ? v : []).toList();
          }
        }
      }

      setState(() {
        _periods = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _periods = [];
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final isFaculty = user?.role == UserRole.faculty;

    // Filter periods for the selected day of week
    final currentDay = _days[_selectedDayIndex].toLowerCase();
    final dayPeriods = _periods.where((p) {
      final day = p['day_of_week']?.toString().toLowerCase() ?? '';
      return day == currentDay;
    }).toList();

    dayPeriods.sort((a, b) {
      final pA = a['period_number'] as num? ?? 0;
      final pB = b['period_number'] as num? ?? 0;
      if (pA != pB) return pA.compareTo(pB);
      final tA = a['start_time']?.toString() ?? '';
      final tB = b['start_time']?.toString() ?? '';
      return tA.compareTo(tB);
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Class Timetable'),
      ),
      body: Column(
        children: [
          // Day Selector Tabs
          Container(
            height: 52,
            color: AppColors.surface,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              itemCount: _days.length,
              itemBuilder: (context, index) {
                final day = _days[index];
                final isSelected = _selectedDayIndex == index;

                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(day.substring(0, 3)),
                    selected: isSelected,
                    onSelected: (_) => setState(() => _selectedDayIndex = index),
                    selectedColor: AppColors.primary,
                    backgroundColor: AppColors.surfaceVariant,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                      fontSize: 13,
                    ),
                  ),
                );
              },
            ),
          ),
          const Divider(height: 1),

          // Schedule List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
                : _error != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
                              const SizedBox(height: 12),
                              const Text('Could not load timetable', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                              const SizedBox(height: 8),
                              Text(_error!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                              const SizedBox(height: 16),
                              ElevatedButton(onPressed: _loadTimetable, child: const Text('Try Again')),
                            ],
                          ),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadTimetable,
                        child: dayPeriods.isEmpty
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: [
                                  SizedBox(
                                    height: MediaQuery.of(context).size.height * 0.5,
                                    child: Center(
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(16),
                                            decoration: BoxDecoration(
                                              color: AppColors.primary.withValues(alpha: 0.08),
                                              shape: BoxShape.circle,
                                            ),
                                            child: const Icon(Icons.calendar_today_outlined, size: 40, color: AppColors.primary),
                                          ),
                                          const SizedBox(height: 14),
                                          Text(
                                            'No classes scheduled for ${_days[_selectedDayIndex]}',
                                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: AppColors.textPrimary),
                                          ),
                                          const SizedBox(height: 4),
                                          const Text(
                                            'Enjoy your free time or prepare for upcoming classes.',
                                            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              )
                            : ListView.separated(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.all(16),
                                itemCount: dayPeriods.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  final p = dayPeriods[index];
                                  final isBreak = p['is_break'] == true;
                                  final subject = isBreak
                                      ? (p['title'] ?? 'Break')
                                      : (p['subject_name'] ?? p['title'] ?? 'Class');

                                  final rawStart = p['start_time']?.toString() ?? '09:00';
                                  final rawEnd = p['end_time']?.toString() ?? '09:45';
                                  final startTime = rawStart.length >= 5 ? rawStart.substring(0, 5) : rawStart;
                                  final endTime = rawEnd.length >= 5 ? rawEnd.substring(0, 5) : rawEnd;

                                  final teacher = p['teacher_name']?.toString() ?? '';
                                  final className = [p['class_name'], p['section_name']]
                                      .where((s) => s != null && s.toString().isNotEmpty)
                                      .join(' - ');
                                  final room = (p['room_no'] ?? p['room'] ?? p['venue'])?.toString() ?? '';

                                  final subtitleDetails = <String>[];
                                  if (isFaculty && className.isNotEmpty) {
                                    subtitleDetails.add('Class: $className');
                                  } else if (!isFaculty && teacher.isNotEmpty) {
                                    subtitleDetails.add(teacher);
                                  }
                                  if (room.isNotEmpty) {
                                    subtitleDetails.add('Room $room');
                                  }

                                  return Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      color: isBreak
                                          ? AppColors.surfaceVariant.withValues(alpha: 0.5)
                                          : AppColors.surface,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: isBreak ? AppColors.border : AppColors.border,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                          decoration: BoxDecoration(
                                            color: (isBreak ? AppColors.warning : AppColors.primary)
                                                .withValues(alpha: 0.08),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Column(
                                            children: [
                                              Text(
                                                startTime,
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 13,
                                                  color: isBreak ? AppColors.warning : AppColors.primary,
                                                ),
                                              ),
                                              Text(
                                                endTime,
                                                style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 14),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Expanded(
                                                    child: Text(
                                                      subject.toString(),
                                                      style: TextStyle(
                                                        fontWeight: FontWeight.bold,
                                                        fontSize: 15,
                                                        color: isBreak ? AppColors.textSecondary : AppColors.textPrimary,
                                                      ),
                                                    ),
                                                  ),
                                                  if (isBreak)
                                                    Container(
                                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                      decoration: BoxDecoration(
                                                        color: AppColors.warning.withValues(alpha: 0.1),
                                                        borderRadius: BorderRadius.circular(4),
                                                      ),
                                                      child: const Text(
                                                        'BREAK',
                                                        style: TextStyle(
                                                          fontSize: 10,
                                                          fontWeight: FontWeight.bold,
                                                          color: AppColors.warning,
                                                        ),
                                                      ),
                                                    ),
                                                ],
                                              ),
                                              if (subtitleDetails.isNotEmpty) ...[
                                                const SizedBox(height: 4),
                                                Text(
                                                  subtitleDetails.join(' • '),
                                                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                                ),
                                              ],
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}
