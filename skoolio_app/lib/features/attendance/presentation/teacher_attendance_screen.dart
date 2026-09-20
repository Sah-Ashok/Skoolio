import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../data/teacher_attendance_repository.dart';
import '../domain/attendance_models.dart';

class TeacherAttendanceScreen extends ConsumerStatefulWidget {
  const TeacherAttendanceScreen({super.key});

  @override
  ConsumerState<TeacherAttendanceScreen> createState() => _TeacherAttendanceScreenState();
}

class _TeacherAttendanceScreenState extends ConsumerState<TeacherAttendanceScreen> {
  TeacherSection? _selectedSection;
  DateTime _selectedDate = DateTime.now();
  bool _isLoading = false;
  bool _isSaving = false;
  int? _existingAttendanceId;
  String _attendanceStatus = 'none'; // 'none', 'draft', 'submitted'
  bool _isClassSuspended = false;
  String? _suspensionRemarks;

  List<StudentAttendanceItem> _students = [];

  // Quick-mark by roll numbers
  final TextEditingController _quickRollsController = TextEditingController();
  AttendanceStatus _quickStatus = AttendanceStatus.absent;

  @override
  void dispose() {
    _quickRollsController.dispose();
    super.dispose();
  }

  String get _formattedDate => DateFormat('yyyy-MM-dd').format(_selectedDate);
  String get _displayDate => DateFormat('MMM dd, yyyy').format(_selectedDate);

  int get _presentCount => _students.where((s) => s.status == AttendanceStatus.present).length;
  int get _absentCount => _students.where((s) => s.status == AttendanceStatus.absent).length;
  int get _leaveCount => _students.where((s) => s.status == AttendanceStatus.leave).length;

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(), // past or today only
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
      if (_selectedSection != null) {
        _loadAttendanceForSection(_selectedSection!);
      }
    }
  }

  Future<void> _loadAttendanceForSection(TeacherSection section) async {
    setState(() {
      _isLoading = true;
      _existingAttendanceId = null;
      _attendanceStatus = 'none';
      _isClassSuspended = false;
      _suspensionRemarks = null;
      _students = [];
      _quickRollsController.clear();
    });

    final repo = ref.read(teacherAttendanceRepositoryProvider);

    try {
      final activeYearId = section.academicYearId ?? await repo.getActiveAcademicYearId();

      // 1. Check if attendance already exists for this date
      final existing = await repo.getSectionAttendanceForDate(
        sectionId: section.id,
        date: _formattedDate,
        academicYearId: activeYearId,
      );

      if (existing != null) {
        _existingAttendanceId = existing['id'] is int ? existing['id'] : int.tryParse(existing['id']?.toString() ?? '');
        _attendanceStatus = existing['status']?.toString() ?? 'draft';
        _isClassSuspended = existing['is_holiday'] == true;
        _suspensionRemarks = existing['remarks']?.toString();

        if (_isClassSuspended) {
          setState(() => _isLoading = false);
          return;
        }

        if (existing['details'] is List) {
          final details = existing['details'] as List;
          final list = details
              .whereType<Map<String, dynamic>>()
              .map((d) => StudentAttendanceItem.fromJson(d))
              .toList();

          list.sort((a, b) => (int.tryParse(a.rollNumber ?? '9999') ?? 9999)
              .compareTo(int.tryParse(b.rollNumber ?? '9999') ?? 9999));

          setState(() {
            _students = list;
            _isLoading = false;
          });
          return;
        }
      }

      // 2. No attendance recorded yet: fetch section roster
      final roster = await repo.getSectionStudents(
        sectionId: section.id,
        academicYearId: activeYearId,
      );
      roster.sort((a, b) => (int.tryParse(a.rollNumber ?? '9999') ?? 9999)
          .compareTo(int.tryParse(b.rollNumber ?? '9999') ?? 9999));

      // Default all to Present
      for (final s in roster) {
        s.status = AttendanceStatus.present;
      }

      setState(() {
        _students = roster;
        _isLoading = false;
        _attendanceStatus = 'none';
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to load students: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _markAll(AttendanceStatus status) {
    if (_attendanceStatus == 'submitted' || _isClassSuspended) return;
    setState(() {
      for (final s in _students) {
        s.status = status;
      }
    });
  }

  // ── Quick Roll Mark ───────────────────────────────────────────────────────
  void _applyQuickRolls() {
    if (_attendanceStatus == 'submitted' || _isClassSuspended) return;
    final text = _quickRollsController.text.trim();
    if (text.isEmpty) return;

    final targetRolls = text
        .split(',')
        .map((r) => r.trim())
        .where((r) => r.isNotEmpty)
        .toSet();

    int matchedCount = 0;
    setState(() {
      for (final s in _students) {
        if (s.rollNumber != null && targetRolls.contains(s.rollNumber!.trim())) {
          s.status = _quickStatus;
          matchedCount++;
        }
      }
    });

    final statusName = _quickStatus == AttendanceStatus.absent ? 'Absent' : 'Present';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(matchedCount > 0
            ? 'Marked $matchedCount student(s) as $statusName.'
            : 'No matching students found for rolls: $text'),
        backgroundColor: matchedCount > 0 ? AppColors.accent : AppColors.warning,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  // ── Suspend Class ─────────────────────────────────────────────────────────
  Future<void> _showSuspendClassDialog() async {
    if (_selectedSection == null) return;
    final remarksController = TextEditingController(text: 'Class suspended by teacher');

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: const [
            Icon(Icons.pause_circle_outline_rounded, color: Colors.amber, size: 22),
            SizedBox(width: 8),
            Text('Suspend Class?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Mark ${_selectedSection!.displayName} as suspended/holiday for $_displayDate.',
              style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: remarksController,
              decoration: const InputDecoration(
                labelText: 'Reason / Remarks',
                border: OutlineInputBorder(),
              ),
              style: const TextStyle(fontSize: 13),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.amber.shade800, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Suspend Class', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _isSaving = true);
      try {
        final repo = ref.read(teacherAttendanceRepositoryProvider);
        final activeYearId = _selectedSection!.academicYearId ?? await repo.getActiveAcademicYearId();
        await repo.suspendClass(
          sectionId: _selectedSection!.id,
          classId: _selectedSection!.classId,
          date: _formattedDate,
          academicYearId: activeYearId,
          remarks: remarksController.text.trim(),
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Class successfully suspended for this date.'),
              backgroundColor: AppColors.success,
            ),
          );
          _loadAttendanceForSection(_selectedSection!);
        }
      } catch (e) {
        setState(() => _isSaving = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to suspend class: $e'), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  // ── Unsuspend Class ───────────────────────────────────────────────────────
  Future<void> _unsuspendClass() async {
    if (_existingAttendanceId == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Unsuspend Class?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Text(
          'Remove suspension for ${_selectedSection?.displayName} on $_displayDate and mark normal attendance?',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Confirm', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _isSaving = true);
      try {
        final repo = ref.read(teacherAttendanceRepositoryProvider);
        await repo.deleteAttendance(_existingAttendanceId!);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Class unsuspended. You can now mark attendance.'), backgroundColor: AppColors.success),
          );
          _loadAttendanceForSection(_selectedSection!);
        }
      } catch (e) {
        setState(() => _isSaving = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to unsuspend: $e'), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  Future<void> _saveAttendance({bool isSubmit = false}) async {
    if (_selectedSection == null || _students.isEmpty || _isClassSuspended) return;

    if (isSubmit) {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Submit Attendance?'),
          content: Text(
            'You are about to finalize attendance for ${_selectedSection!.displayName} on $_displayDate:\n\n'
            '• Present: $_presentCount\n'
            '• Absent: $_absentCount\n'
            '• Leave: $_leaveCount\n\n'
            'Once submitted, this record is locked.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirm & Submit'),
            ),
          ],
        ),
      );
      if (confirm != true) return;
    }

    setState(() => _isSaving = true);
    final repo = ref.read(teacherAttendanceRepositoryProvider);

    try {
      if (_existingAttendanceId == null) {
        // Create new
        final activeYearId = _selectedSection!.academicYearId ?? await repo.getActiveAcademicYearId();
        final res = await repo.createAttendance(
          sectionId: _selectedSection!.id,
          classId: _selectedSection!.classId,
          date: _formattedDate,
          academicYearId: activeYearId,
          students: _students,
        );

        if (res is Map<String, dynamic> && res['id'] != null) {
          _existingAttendanceId = res['id'] is int ? res['id'] : int.tryParse(res['id'].toString());
        }

        if (isSubmit && _existingAttendanceId != null) {
          await repo.submitAttendance(_existingAttendanceId!);
          _attendanceStatus = 'submitted';
        } else {
          _attendanceStatus = 'draft';
        }
      } else {
        // Update existing draft
        await repo.updateAttendanceDetails(
          attendanceId: _existingAttendanceId!,
          students: _students,
        );

        if (isSubmit) {
          await repo.submitAttendance(_existingAttendanceId!);
          _attendanceStatus = 'submitted';
        } else {
          _attendanceStatus = 'draft';
        }
      }

      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(isSubmit
                ? 'Attendance successfully submitted and locked!'
                : 'Attendance draft saved successfully!'),
            backgroundColor: isSubmit ? AppColors.success : AppColors.primary,
          ),
        );
      }
    } catch (e) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving attendance: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sectionsAsync = ref.watch(teacherSectionsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Mark Class Attendance',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          if (_selectedSection != null) ...[
            if (!_isClassSuspended && _attendanceStatus != 'submitted')
              IconButton(
                icon: const Icon(Icons.pause_circle_outline_rounded),
                tooltip: 'Suspend class for today',
                onPressed: _showSuspendClassDialog,
              ),
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Refresh attendance',
              onPressed: () => _loadAttendanceForSection(_selectedSection!),
            ),
          ],
        ],
      ),
      body: Column(
        children: [
          // Section & Date Selector Header
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Column(
              children: [
                // Section Picker
                sectionsAsync.when(
                  loading: () => const LinearProgressIndicator(),
                  error: (err, _) => Text(
                    'Failed to load sections: $err',
                    style: const TextStyle(color: AppColors.error, fontSize: 13),
                  ),
                  data: (sections) {
                    if (sections.isEmpty) {
                      return Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.warningLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline, color: AppColors.warning, size: 20),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'You are not assigned as a coordinator for any sections.',
                                style: TextStyle(color: Color(0xFF92400E), fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    if (_selectedSection == null && sections.isNotEmpty) {
                      _selectedSection = sections.first;
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted && _selectedSection != null) {
                          _loadAttendanceForSection(_selectedSection!);
                        }
                      });
                    }

                    return DropdownButtonFormField<TeacherSection>(
                      initialValue: _selectedSection,
                      decoration: const InputDecoration(
                        labelText: 'Assigned Section',
                        prefixIcon: Icon(Icons.class_outlined, color: AppColors.primary, size: 20),
                      ),
                      items: sections.map((s) {
                        return DropdownMenuItem(
                          value: s,
                          child: Text(
                            s.displayName,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                        );
                      }).toList(),
                      onChanged: (s) {
                        if (s != null) {
                          setState(() => _selectedSection = s);
                          _loadAttendanceForSection(s);
                        }
                      },
                    );
                  },
                ),
                const SizedBox(height: 12),

                // Date Picker row
                InkWell(
                  onTap: _pickDate,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_month_rounded, color: AppColors.accent, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Attendance Date',
                                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                              Text(
                                _displayDate,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textSecondary),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppColors.border),

          // ── Class Suspended Banner ──
          if (_isClassSuspended)
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFFDE68A), width: 1.5),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: const BoxDecoration(
                            color: Color(0xFFFEF3C7),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.beach_access_rounded,
                            size: 36,
                            color: Color(0xFFB45309),
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'Class Suspended for Today',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF92400E),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${_selectedSection?.displayName ?? "This section"} was marked as suspended / holiday for $_displayDate.',
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 13, color: Color(0xFFB45309), height: 1.4),
                        ),
                        if (_suspensionRemarks != null && _suspensionRemarks!.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Reason: "$_suspensionRemarks"',
                            style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Color(0xFF92400E)),
                          ),
                        ],
                        const SizedBox(height: 20),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFB45309),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                          ),
                          icon: const Icon(Icons.replay_rounded, size: 18),
                          label: const Text('Unsuspend Class', style: TextStyle(fontWeight: FontWeight.bold)),
                          onPressed: _isSaving ? null : _unsuspendClass,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            )
          else ...[
            // Status & Quick Action Bar
            if (_students.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                color: Colors.white,
                child: Column(
                  children: [
                    // KPI Counters Row
                    Row(
                      children: [
                        _buildKpiCard('Total', '${_students.length}', AppColors.textPrimary, AppColors.surface),
                        const SizedBox(width: 8),
                        _buildKpiCard('Present', '$_presentCount', AppColors.success, AppColors.successLight),
                        const SizedBox(width: 8),
                        _buildKpiCard('Absent', '$_absentCount', AppColors.error, AppColors.errorLight),
                        const SizedBox(width: 8),
                        _buildKpiCard('Leave', '$_leaveCount', const Color(0xFF7C3AED), const Color(0xFFF3EEFF)),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Quick Action Buttons
                    if (_attendanceStatus != 'submitted') ...[
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _markAll(AttendanceStatus.present),
                              icon: const Icon(Icons.done_all_rounded, size: 16, color: AppColors.success),
                              label: const Text('Mark All Present', style: TextStyle(fontSize: 12)),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.success),
                                padding: const EdgeInsets.symmetric(vertical: 8),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _markAll(AttendanceStatus.absent),
                              icon: const Icon(Icons.close_rounded, size: 16, color: AppColors.error),
                              label: const Text('Mark All Absent', style: TextStyle(fontSize: 12)),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppColors.error),
                                padding: const EdgeInsets.symmetric(vertical: 8),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),

                      // ── Quick Roll Mark Bar ──
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.bolt_rounded, size: 18, color: AppColors.accent),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: _quickRollsController,
                                decoration: const InputDecoration(
                                  hintText: 'Quick-mark rolls: e.g. 3, 5, 12',
                                  hintStyle: TextStyle(fontSize: 12, color: AppColors.textMuted),
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(vertical: 6),
                                  border: InputBorder.none,
                                ),
                                style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600),
                                onSubmitted: (_) => _applyQuickRolls(),
                              ),
                            ),
                            const SizedBox(width: 6),
                            // Status toggle chip
                            InkWell(
                              onTap: () {
                                setState(() {
                                  _quickStatus = _quickStatus == AttendanceStatus.absent
                                      ? AttendanceStatus.present
                                      : AttendanceStatus.absent;
                                });
                              },
                              borderRadius: BorderRadius.circular(6),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: _quickStatus == AttendanceStatus.absent
                                      ? AppColors.errorLight
                                      : AppColors.successLight,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: _quickStatus == AttendanceStatus.absent
                                        ? AppColors.error
                                        : AppColors.success,
                                  ),
                                ),
                                child: Text(
                                  _quickStatus == AttendanceStatus.absent ? 'Absent' : 'Present',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: _quickStatus == AttendanceStatus.absent
                                        ? AppColors.error
                                        : AppColors.success,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.accent,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                minimumSize: const Size(50, 32),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                              onPressed: _applyQuickRolls,
                              child: const Text('Apply', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppColors.successLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.lock_rounded, size: 16, color: AppColors.success),
                            SizedBox(width: 6),
                            Text(
                              'This attendance record is finalized and locked.',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.success,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.border),
            ],

            // Student Roster List
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
                  : _students.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.people_outline_rounded, size: 48, color: AppColors.textMuted),
                              const SizedBox(height: 12),
                              Text(
                                _selectedSection == null
                                    ? 'Select a section to begin'
                                    : 'No students enrolled in this section.',
                                style: const TextStyle(fontSize: 15, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          itemCount: _students.length,
                          itemBuilder: (context, index) {
                            final student = _students[index];
                            return _StudentAttendanceCard(
                              student: student,
                              isLocked: _attendanceStatus == 'submitted',
                              onStatusChanged: (status) {
                                setState(() => student.status = status);
                              },
                            );
                          },
                        ),
            ),

            // Bottom Action Bar
            if (_students.isNotEmpty && _attendanceStatus != 'submitted') ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 10,
                      offset: const Offset(0, -3),
                    ),
                  ],
                ),
                child: SafeArea(
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _isSaving ? null : () => _saveAttendance(isSubmit: false),
                          child: _isSaving
                              ? const SizedBox(
                                  height: 16,
                                  width: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Save Draft'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                          onPressed: _isSaving ? null : () => _saveAttendance(isSubmit: true),
                          child: _isSaving
                              ? const SizedBox(
                                  height: 16,
                                  width: 16,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                )
                              : const Text('Submit Attendance'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildKpiCard(String label, String value, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
                color: color,
              ),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: color.withValues(alpha: 0.8),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StudentAttendanceCard extends StatelessWidget {
  final StudentAttendanceItem student;
  final bool isLocked;
  final ValueChanged<AttendanceStatus> onStatusChanged;

  const _StudentAttendanceCard({
    required this.student,
    required this.isLocked,
    required this.onStatusChanged,
  });

  @override
  Widget build(BuildContext context) {
    Color cardBorder = AppColors.border;
    if (student.status == AttendanceStatus.absent) {
      cardBorder = AppColors.error.withValues(alpha: 0.4);
    } else if (student.status == AttendanceStatus.leave) {
      cardBorder = const Color(0xFF7C3AED).withValues(alpha: 0.4);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: cardBorder),
      ),
      child: Row(
        children: [
          // Roll Number Badge
          Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                student.rollNumber ?? '-',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Student Name
          Expanded(
            child: Text(
              student.fullName,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: AppColors.textPrimary,
              ),
            ),
          ),

          // PAL Status Toggle Buttons
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildStatusButton(
                AttendanceStatus.present,
                'P',
                AppColors.success,
                AppColors.successLight,
              ),
              const SizedBox(width: 4),
              _buildStatusButton(
                AttendanceStatus.absent,
                'A',
                AppColors.error,
                AppColors.errorLight,
              ),
              const SizedBox(width: 4),
              _buildStatusButton(
                AttendanceStatus.leave,
                'Lv',
                const Color(0xFF7C3AED),
                const Color(0xFFF3EEFF),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusButton(
    AttendanceStatus status,
    String label,
    Color activeColor,
    Color activeBg,
  ) {
    final isSelected = student.status == status;

    return InkWell(
      onTap: isLocked ? null : () => onStatusChanged(status),
      borderRadius: BorderRadius.circular(6),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: isSelected ? activeBg : Colors.white,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? activeColor : AppColors.border,
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isSelected ? activeColor : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
