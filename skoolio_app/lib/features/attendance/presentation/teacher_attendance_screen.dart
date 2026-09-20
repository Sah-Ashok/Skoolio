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

  List<StudentAttendanceItem> _students = [];

  @override
  void initState() {
    super.initState();
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
      _students = [];
    });

    final repo = ref.read(teacherAttendanceRepositoryProvider);

    try {
      // 1. Check if attendance already exists for this date
      final existing = await repo.getSectionAttendanceForDate(
        sectionId: section.id,
        date: _formattedDate,
      );

      if (existing != null && existing['details'] is List) {
        _existingAttendanceId = existing['id'] is int ? existing['id'] : int.tryParse(existing['id']?.toString() ?? '');
        _attendanceStatus = existing['status']?.toString() ?? 'draft';

        final details = existing['details'] as List;
        final list = details
            .whereType<Map<String, dynamic>>()
            .map((d) => StudentAttendanceItem.fromJson(d))
            .toList();

        // Sort by roll number
        list.sort((a, b) => (int.tryParse(a.rollNumber ?? '9999') ?? 9999)
            .compareTo(int.tryParse(b.rollNumber ?? '9999') ?? 9999));

        setState(() {
          _students = list;
          _isLoading = false;
        });
        return;
      }

      // 2. No attendance recorded yet: fetch section roster
      final roster = await repo.getSectionStudents(sectionId: section.id);
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
    if (_attendanceStatus == 'submitted') return;
    setState(() {
      for (final s in _students) {
        s.status = status;
      }
    });
  }

  Future<void> _saveAttendance({bool isSubmit = false}) async {
    if (_selectedSection == null || _students.isEmpty) return;

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
        final res = await repo.createAttendance(
          sectionId: _selectedSection!.id,
          date: _formattedDate,
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
          if (_selectedSection != null)
            IconButton(
              icon: const Icon(Icons.refresh_rounded),
              onPressed: () => _loadAttendanceForSection(_selectedSection!),
            ),
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
                            Icon(Icons.people_outline_rounded, size: 48, color: AppColors.textMuted),
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
            decoration: BoxDecoration(
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
