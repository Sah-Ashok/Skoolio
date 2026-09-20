import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../attendance/data/teacher_attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../auth/domain/models.dart';
import '../../auth/presentation/auth_providers.dart';
import '../data/timetable_repository.dart';
import '../domain/timetable_model.dart';

class TimetableScreen extends ConsumerStatefulWidget {
  const TimetableScreen({super.key});

  @override
  ConsumerState<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends ConsumerState<TimetableScreen>
    with SingleTickerProviderStateMixin {
  final List<String> _days = const [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  late String _selectedDay;
  TabController? _teacherTabController;
  TeacherSection? _selectedSection;

  @override
  void initState() {
    super.initState();
    final weekday = DateTime.now().weekday; // 1 = Mon, 7 = Sun
    _selectedDay = _days[(weekday - 1) % 7];
    _teacherTabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _teacherTabController?.dispose();
    super.dispose();
  }

  String _formatDayLabel(String day) {
    return day.substring(0, 1).toUpperCase() + day.substring(1);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final isTeacher = user?.role == UserRole.faculty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          isTeacher ? 'Timetable & Routine' : 'Class Timetable',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () {
              if (isTeacher) {
                ref.invalidate(teacherTimetableProvider);
                if (_selectedSection != null) {
                  ref.invalidate(sectionTimetableProvider(_selectedSection!.id));
                }
              } else {
                ref.invalidate(studentTimetableProvider);
              }
            },
          ),
        ],
        bottom: isTeacher
            ? TabBar(
                controller: _teacherTabController,
                indicatorColor: AppColors.accent,
                indicatorWeight: 3,
                labelColor: AppColors.accent,
                unselectedLabelColor: AppColors.textSecondary,
                labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                tabs: const [
                  Tab(
                    icon: Icon(Icons.person_outline_rounded, size: 20),
                    text: 'My Teaching Schedule',
                  ),
                  Tab(
                    icon: Icon(Icons.table_chart_outlined, size: 20),
                    text: 'Section Timetable',
                  ),
                ],
              )
            : null,
      ),
      body: isTeacher
          ? TabBarView(
              controller: _teacherTabController,
              children: [
                _buildMyScheduleTab(),
                _buildSectionScheduleTab(),
              ],
            )
          : _buildStudentScheduleView(),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tab 1: Teacher's Personal Teaching Schedule
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildMyScheduleTab() {
    final scheduleAsync = ref.watch(teacherTimetableProvider);

    return Column(
      children: [
        _buildDaySelector(),
        const Divider(height: 1, color: AppColors.border),
        Expanded(
          child: scheduleAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.accent),
            ),
            error: (err, _) => _buildErrorState(
              err.toString(),
              onRetry: () => ref.invalidate(teacherTimetableProvider),
            ),
            data: (schedule) {
              final daySlots = schedule.scheduleByDay[_selectedDay] ?? [];

              return RefreshIndicator(
                color: AppColors.accent,
                onRefresh: () async {
                  ref.invalidate(teacherTimetableProvider);
                },
                child: daySlots.isEmpty
                    ? _buildEmptyState(
                        'No classes scheduled on ${_formatDayLabel(_selectedDay)}',
                        'Enjoy your day off or check another day.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: daySlots.length,
                        itemBuilder: (context, index) {
                          return _TimetableSlotCard(
                            slot: daySlots[index],
                            viewMode: _SlotViewMode.teacherPersonal,
                          );
                        },
                      ),
              );
            },
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tab 2: Coordinated Section Timetable
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildSectionScheduleTab() {
    final sectionsAsync = ref.watch(teacherSectionsProvider);

    return sectionsAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: AppColors.accent),
      ),
      error: (err, _) => _buildErrorState(
        'Failed to load sections: $err',
        onRetry: () => ref.invalidate(teacherSectionsProvider),
      ),
      data: (sections) {
        if (sections.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.info_outline_rounded,
                      size: 40,
                      color: Colors.amber.shade800,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No Coordinated Sections',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'You are not currently assigned as a class/section coordinator.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          );
        }

        // Auto-select first section if unselected or not in list
        if (_selectedSection == null ||
            !sections.any((s) => s.id == _selectedSection!.id)) {
          _selectedSection = sections.first;
        }

        final sectionScheduleAsync =
            ref.watch(sectionTimetableProvider(_selectedSection!.id));

        return Column(
          children: [
            // Section picker bar
            Container(
              color: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.school_outlined, size: 20, color: AppColors.accent),
                  const SizedBox(width: 10),
                  const Text(
                    'Section:',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<TeacherSection>(
                          isExpanded: true,
                          value: _selectedSection,
                          items: sections.map((sec) {
                            return DropdownMenuItem<TeacherSection>(
                              value: sec,
                              child: Text(
                                '${sec.className} - Section ${sec.name}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            );
                          }).toList(),
                          onChanged: (newSec) {
                            if (newSec != null) {
                              setState(() => _selectedSection = newSec);
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.border),

            _buildDaySelector(),
            const Divider(height: 1, color: AppColors.border),

            Expanded(
              child: sectionScheduleAsync.when(
                loading: () => const Center(
                  child: CircularProgressIndicator(color: AppColors.accent),
                ),
                error: (err, _) => _buildErrorState(
                  err.toString(),
                  onRetry: () => ref.invalidate(
                      sectionTimetableProvider(_selectedSection!.id)),
                ),
                data: (schedule) {
                  final daySlots = schedule.scheduleByDay[_selectedDay] ?? [];

                  return RefreshIndicator(
                    color: AppColors.accent,
                    onRefresh: () async {
                      ref.invalidate(
                          sectionTimetableProvider(_selectedSection!.id));
                    },
                    child: daySlots.isEmpty
                        ? _buildEmptyState(
                            'No routine found for ${_selectedSection?.className} - ${_selectedSection?.name} on ${_formatDayLabel(_selectedDay)}',
                            'Select another day or check with admin.',
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: daySlots.length,
                            itemBuilder: (context, index) {
                              return _TimetableSlotCard(
                                slot: daySlots[index],
                                viewMode: _SlotViewMode.sectionRoutine,
                              );
                            },
                          ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Student Timetable View
  // ──────────────────────────────────────────────────────────────────────────
  Widget _buildStudentScheduleView() {
    final scheduleAsync = ref.watch(studentTimetableProvider);

    return Column(
      children: [
        _buildDaySelector(),
        const Divider(height: 1, color: AppColors.border),
        Expanded(
          child: scheduleAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: AppColors.accent),
            ),
            error: (err, _) => _buildErrorState(
              err.toString(),
              onRetry: () => ref.invalidate(studentTimetableProvider),
            ),
            data: (schedule) {
              final daySlots = schedule.scheduleByDay[_selectedDay] ?? [];

              return RefreshIndicator(
                color: AppColors.accent,
                onRefresh: () async {
                  ref.invalidate(studentTimetableProvider);
                },
                child: daySlots.isEmpty
                    ? _buildEmptyState(
                        'No classes on ${_formatDayLabel(_selectedDay)}',
                        'Enjoy your day off or check other days.',
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: daySlots.length,
                        itemBuilder: (context, index) {
                          return _TimetableSlotCard(
                            slot: daySlots[index],
                            viewMode: _SlotViewMode.student,
                          );
                        },
                      ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDaySelector() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _days.map((day) {
            final isSelected = _selectedDay == day;
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(
                label: Text(_formatDayLabel(day)),
                selected: isSelected,
                selectedColor: AppColors.primary,
                backgroundColor: AppColors.surface,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textSecondary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  fontSize: 13,
                ),
                onSelected: (selected) {
                  if (selected) {
                    setState(() => _selectedDay = day);
                  }
                },
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildEmptyState(String title, String subtitle) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.18),
        Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.event_busy_rounded,
                  size: 40,
                  color: AppColors.textMuted,
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildErrorState(String message, {required VoidCallback onRetry}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
            const SizedBox(height: 12),
            const Text(
              'Failed to load timetable',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onRetry,
              child: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}

enum _SlotViewMode {
  teacherPersonal,
  sectionRoutine,
  student,
}

class _TimetableSlotCard extends StatelessWidget {
  final TimetableSlot slot;
  final _SlotViewMode viewMode;

  const _TimetableSlotCard({
    required this.slot,
    required this.viewMode,
  });

  @override
  Widget build(BuildContext context) {
    if (slot.isBreak) {
      return Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.warningLight.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.coffee_rounded, color: AppColors.warning, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    slot.title ?? 'Break / Recess',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: Color(0xFF92400E),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${slot.startTime} - ${slot.endTime}',
                    style: const TextStyle(fontSize: 12, color: Color(0xFFB45309)),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'Break',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: AppColors.warning,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Left Period & Time indicator bar
            Container(
              width: 82,
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
              decoration: const BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(14),
                  bottomLeft: Radius.circular(14),
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'P${slot.periodNumber}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    slot.startTime,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Text(
                    slot.endTime,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),

            // Vertical divider line
            Container(width: 1, color: AppColors.border),

            // Right details
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            slot.subjectName ?? 'Class Period',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        if (slot.subjectCode != null &&
                            slot.subjectCode!.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.surface,
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Text(
                              slot.subjectCode!,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Context line based on mode:
                    // - teacherPersonal: shows class & section name
                    // - sectionRoutine: shows assigned teacher name
                    // - student: shows assigned faculty name
                    Row(
                      children: [
                        Icon(
                          viewMode == _SlotViewMode.teacherPersonal
                              ? Icons.class_outlined
                              : Icons.person_outline_rounded,
                          size: 15,
                          color: AppColors.textSecondary,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            viewMode == _SlotViewMode.teacherPersonal
                                ? '${slot.className ?? ''} ${slot.sectionName ?? ''}'
                                    .trim()
                                : (slot.teacherName ?? 'Unassigned Faculty'),
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),

                    // Room badge if available
                    if (slot.roomNo != null && slot.roomNo!.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.room_outlined,
                              size: 14, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            'Room: ${slot.roomNo}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textMuted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
