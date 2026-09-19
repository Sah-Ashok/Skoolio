import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/domain/models.dart';
import '../../auth/presentation/auth_providers.dart';

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  bool _isLoading = true;
  String? _error;

  // Student state
  Map<String, dynamic>? _summary;
  List<dynamic> _monthlyRecords = [];
  int _selectedMonth = DateTime.now().month;
  final int _selectedYear = DateTime.now().year;

  // Teacher state
  List<dynamic> _sections = [];
  int? _selectedSectionId;
  int? _activeYearId;
  List<Map<String, dynamic>> _studentAttendance = [];
  bool _isSaving = false;
  DateTime _attendanceDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final user = ref.read(authStateProvider).user;
    if (user == null) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    final client = ref.read(apiClientProvider);

    try {
      // Resolve active academic year
      try {
        final yearRes = await client.get(ApiConstants.activeAcademicYear);
        if (yearRes is Map) {
          final raw = yearRes['id'] ?? yearRes['academic_year_id'];
          _activeYearId = raw is int ? raw : int.tryParse(raw?.toString() ?? '');
        }
      } catch (_) {}

      if (user.role == UserRole.student) {
        // Fetch student summary and monthly records
        final summaryRes = await client.get(ApiConstants.studentAttendanceSummary);
        final monthlyRes = await client.get(
          ApiConstants.studentAttendanceMonthly,
          queryParameters: {
            'year': _selectedYear,
            'month': _selectedMonth,
          },
        );

        setState(() {
          _summary = summaryRes is Map<String, dynamic> ? summaryRes : null;
          _monthlyRecords = monthlyRes is List ? monthlyRes : [];
          _isLoading = false;
        });
      } else {
        // Fetch teacher's assigned coordinator sections
        final sectionsRes = await client.get(ApiConstants.teacherSections);
        final sectionList = sectionsRes is List
            ? sectionsRes
            : (sectionsRes is Map && sectionsRes['data'] is List ? sectionsRes['data'] as List : []);

        int? firstSectionId;
        if (sectionList.isNotEmpty) {
          firstSectionId = int.tryParse(sectionList[0]['id']?.toString() ?? '');
        }

        setState(() {
          _sections = sectionList;
          _selectedSectionId = firstSectionId;
        });

        if (firstSectionId != null) {
          await _loadSectionStudents(firstSectionId);
        } else {
          setState(() => _isLoading = false);
        }
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _loadSectionStudents(int sectionId) async {
    final client = ref.read(apiClientProvider);
    try {
      final query = <String, dynamic>{'section_id': sectionId};
      if (_activeYearId != null) {
        query['academic_year_id'] = _activeYearId;
      }
      final res = await client.get('/api/students/enrollments', queryParameters: query);
      final list = res is List ? res : (res is Map && res['data'] is List ? res['data'] as List : []);

      setState(() {
        _studentAttendance = list.map((s) {
          final id = s['student_id'] ?? s['id'];
          return {
            'student_id': id is int ? id : int.tryParse(id?.toString() ?? '0') ?? 0,
            'full_name': s['full_name'] ?? s['name'] ?? 'Student',
            'admission_number': s['admission_number'] ?? '',
            'status': 'present', // Default to present
          };
        }).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _submitTeacherAttendance() async {
    if (_selectedSectionId == null || _studentAttendance.isEmpty) return;

    final selectedSection = _sections.firstWhere(
      (s) => s['id'] == _selectedSectionId,
      orElse: () => null,
    );
    final classId = selectedSection != null
        ? (selectedSection['class_id'] is int
            ? selectedSection['class_id']
            : int.tryParse(selectedSection['class_id']?.toString() ?? ''))
        : null;

    setState(() => _isSaving = true);
    final client = ref.read(apiClientProvider);

    try {
      final payload = <String, dynamic>{
        'section_id': _selectedSectionId,
        'date': DateFormatter.formatIso(_attendanceDate),
        'students': _studentAttendance.map((s) => {
          'student_id': s['student_id'],
          'status': s['status'] ?? 'present',
        }).toList(),
      };
      if (_activeYearId != null) {
        payload['academic_year_id'] = _activeYearId;
      }
      if (classId != null) {
        payload['class_id'] = classId;
      }

      final created = await client.post(
        ApiConstants.teacherMarkAttendance,
        data: payload,
      );

      // Submit immediately if backend returned draft
      final createdId = (created is Map) ? (created['id'] ?? (created['data'] is Map ? created['data']['id'] : null)) : null;
      if (createdId != null) {
        try {
          await client.patch('/api/attendance/$createdId/submit');
        } catch (_) {}
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Attendance recorded and submitted successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error saving: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final isTeacher = user?.role == UserRole.faculty;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(isTeacher ? 'Mark Attendance' : 'My Attendance'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? _buildErrorView()
              : isTeacher
                  ? _buildTeacherView()
                  : _buildStudentView(),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
            const SizedBox(height: 12),
            Text(
              'Could not load attendance data',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? '',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _loadData, child: const Text('Try Again')),
          ],
        ),
      ),
    );
  }

  // ── STUDENT VIEW ──────────────────────────────────────────────────────────
  Widget _buildStudentView() {
    final percentage = _summary?['attendance_percentage'] ?? 0;
    final totalDays = _summary?['total_working_days'] ?? 0;
    final presentDays = _summary?['total_present'] ?? 0;
    final absentDays = _summary?['total_absent'] ?? 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Year Overview Banner
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Yearly Attendance',
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatPercent(percentage)}%',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$presentDays Present out of $totalDays Days',
                      style: const TextStyle(color: Colors.white70, fontSize: 12),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.donut_large_rounded, color: AppColors.accent, size: 36),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Mini Stats
          Row(
            children: [
              Expanded(child: _buildMiniStat('Present', '$presentDays', AppColors.success)),
              const SizedBox(width: 8),
              Expanded(child: _buildMiniStat('Absent', '$absentDays', AppColors.error)),
              const SizedBox(width: 8),
              Expanded(child: _buildMiniStat('Working Days', '$totalDays', AppColors.primary)),
            ],
          ),
          const SizedBox(height: 24),

          // Monthly Filter
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Daily Records',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              DropdownButton<int>(
                value: _selectedMonth,
                underline: const SizedBox(),
                items: List.generate(12, (index) {
                  final monthNum = index + 1;
                  const monthNames = [
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                  ];
                  return DropdownMenuItem(
                    value: monthNum,
                    child: Text('${monthNames[index]} $_selectedYear', style: const TextStyle(fontSize: 13)),
                  );
                }),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _selectedMonth = val);
                    _loadData();
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Monthly list or empty
          if (_monthlyRecords.isEmpty)
            Container(
              padding: const EdgeInsets.all(24),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: const Text('No records for this month', style: TextStyle(color: AppColors.textSecondary)),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _monthlyRecords.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final rec = _monthlyRecords[index];
                final status = rec['status']?.toString().toLowerCase() ?? 'present';
                final date = rec['attendance_date'] ?? rec['date'] ?? '';
                final isPresent = status == 'present';
                final isLate = status == 'late';

                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isPresent ? Icons.check_circle_rounded : isLate ? Icons.access_time_rounded : Icons.cancel_rounded,
                            color: isPresent ? AppColors.success : isLate ? AppColors.warning : AppColors.error,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            DateFormatter.formatString(date.toString()),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isPresent
                              ? AppColors.successLight
                              : isLate
                                  ? AppColors.warningLight
                                  : AppColors.errorLight,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: isPresent ? AppColors.success : isLate ? AppColors.warning : AppColors.error,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String val, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          const SizedBox(height: 4),
          Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  // ── TEACHER VIEW ──────────────────────────────────────────────────────────
  Widget _buildTeacherView() {
    if (_sections.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text('No assigned sections found for your account.'),
        ),
      );
    }

    return Column(
      children: [
        // Section Selector Bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          color: AppColors.surface,
          child: Row(
            children: [
              const Text('Section: ', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButton<int>(
                  isExpanded: true,
                  value: _selectedSectionId,
                  underline: const SizedBox(),
                  items: _sections.map((s) {
                    return DropdownMenuItem<int>(
                      value: s['id'] as int,
                      child: Text('${s['class_name'] ?? 'Class'} - Section ${s['name'] ?? ''}'),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _selectedSectionId = val;
                        _isLoading = true;
                      });
                      _loadSectionStudents(val);
                    }
                  },
                ),
              ),
              TextButton.icon(
                icon: const Icon(Icons.calendar_today, size: 16),
                label: Text(DateFormatter.formatMedium(_attendanceDate), style: const TextStyle(fontSize: 12)),
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _attendanceDate,
                    firstDate: DateTime(2020),
                    lastDate: DateTime.now(),
                  );
                  if (picked != null) {
                    setState(() => _attendanceDate = picked);
                  }
                },
              ),
            ],
          ),
        ),
        const Divider(height: 1),

        // Student Roster
        Expanded(
          child: _studentAttendance.isEmpty
              ? const Center(child: Text('No students in this section.'))
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: _studentAttendance.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final student = _studentAttendance[index];
                    final status = student['status'] as String;

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          CircleAvatar(
                            radius: 18,
                            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                            child: Text(
                              (student['full_name'] as String).substring(0, 1).toUpperCase(),
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  student['full_name'] as String,
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                ),
                                if (student['admission_number'] != '')
                                  Text(
                                    'Adm: ${student['admission_number']}',
                                    style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                  ),
                              ],
                            ),
                          ),
                          // Present / Absent toggle buttons
                          Row(
                            children: [
                              _StatusChip(
                                label: 'P',
                                isSelected: status == 'present',
                                selectedColor: AppColors.success,
                                onTap: () => setState(() => student['status'] = 'present'),
                              ),
                              const SizedBox(width: 6),
                              _StatusChip(
                                label: 'L',
                                isSelected: status == 'late',
                                selectedColor: AppColors.warning,
                                onTap: () => setState(() => student['status'] = 'late'),
                              ),
                              const SizedBox(width: 6),
                              _StatusChip(
                                label: 'A',
                                isSelected: status == 'absent',
                                selectedColor: AppColors.error,
                                onTap: () => setState(() => student['status'] = 'absent'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),

        // Save Bottom Bar
        Container(
          padding: const EdgeInsets.all(16),
          color: AppColors.surface,
          child: SafeArea(
            child: ElevatedButton(
              onPressed: _isSaving ? null : _submitTeacherAttendance,
              child: _isSaving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Save Attendance'),
            ),
          ),
        ),
      ],
    );
  }

  String _formatPercent(dynamic val) {
    if (val == null) return '0.0';
    if (val is num) return val.toStringAsFixed(1);
    final n = num.tryParse(val.toString()) ?? 0.0;
    return n.toStringAsFixed(1);
  }
}

class _StatusChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final Color selectedColor;
  final VoidCallback onTap;

  const _StatusChip({
    required this.label,
    required this.isSelected,
    required this.selectedColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected ? selectedColor : AppColors.surfaceVariant,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? selectedColor : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 12,
            color: isSelected ? Colors.white : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
