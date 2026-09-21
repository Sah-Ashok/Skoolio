import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_loader.dart';
import '../../../core/utils/date_formatter.dart';
import '../../attendance/data/teacher_attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../auth/presentation/auth_providers.dart';

// ── Exam List Provider ──────────────────────────────────────────
final teacherExamsListProvider = FutureProvider<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.teacherExams);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['exams'] is List) {
      return res['exams'] as List;
    }
  } catch (_) {}
  return [];
});

// ── Exam Schedules Family Provider ──────────────────────────────
final teacherExamSchedulesProvider = FutureProvider.autoDispose.family<List<dynamic>, int>((ref, examId) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get('/exams/$examId/schedules');
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['schedules'] is List) {
      return res['schedules'] as List;
    }
  } catch (_) {}
  return [];
});

class TeacherMarksScreen extends ConsumerStatefulWidget {
  const TeacherMarksScreen({super.key});

  @override
  ConsumerState<TeacherMarksScreen> createState() => _TeacherMarksScreenState();
}

class _TeacherMarksScreenState extends ConsumerState<TeacherMarksScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Exams & Marks', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFFF97316),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFFF97316),
          indicatorWeight: 3,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [
            Tab(icon: Icon(Icons.edit_note_rounded, size: 20), text: 'Marks Entry'),
            Tab(icon: Icon(Icons.table_chart_outlined, size: 20), text: 'Class Register'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _MarksEntryTab(),
          _ClassRegisterTab(),
        ],
      ),
    );
  }
}

// ═════════════════════════════════════════════════════════════════
// ── TAB 1: MARKS ENTRY ──────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════

class _MarksEntryTab extends ConsumerStatefulWidget {
  const _MarksEntryTab();

  @override
  ConsumerState<_MarksEntryTab> createState() => _MarksEntryTabState();
}

class _MarksEntryTabState extends ConsumerState<_MarksEntryTab> {
  int? _expandedExamId;

  @override
  Widget build(BuildContext context) {
    final examsAsync = ref.watch(teacherExamsListProvider);

    return RefreshIndicator(
      color: const Color(0xFFF97316),
      onRefresh: () async {
        ref.invalidate(teacherExamsListProvider);
        if (_expandedExamId != null) {
          ref.invalidate(teacherExamSchedulesProvider(_expandedExamId!));
        }
      },
      child: examsAsync.when(
        loading: () => const AppLoader(text: 'Loading exams...', size: AppLoaderSize.lg),
        error: (err, _) => Center(child: Text('Error loading exams: $err')),
        data: (exams) {
          if (exams.isEmpty) {
            return ListView(
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                Center(
                  child: Column(
                    children: const [
                      Icon(Icons.edit_note_rounded, size: 48, color: Color(0xFF94A3B8)),
                      SizedBox(height: 12),
                      Text('No active exams scheduled', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(height: 4),
                      Text(
                        'Once exams are published by administration, you can record marks here.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: exams.length,
            itemBuilder: (context, index) {
              final ex = exams[index];
              final examId = ex['id'] is int ? ex['id'] as int : int.tryParse(ex['id']?.toString() ?? '0') ?? 0;
              final name = ex['name'] ?? ex['title'] ?? 'Exam';
              final term = ex['term'] ?? ex['academic_year_name'] ?? 'Current Term';
              final isPublished = ex['is_published'] == true;
              final isExpanded = _expandedExamId == examId;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isExpanded ? const Color(0xFFF97316) : const Color(0xFFE2E8F0),
                    width: isExpanded ? 1.5 : 1.0,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        setState(() {
                          _expandedExamId = isExpanded ? null : examId;
                        });
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFFED7AA)),
                              ),
                              child: const Icon(Icons.assignment_turned_in_outlined, color: Color(0xFFF97316), size: 24),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name.toString(),
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    term.toString(),
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: isPublished ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                isPublished ? 'Published' : 'Draft',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: isPublished ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Icon(
                              isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                              color: const Color(0xFF94A3B8),
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (isExpanded) ...[
                      const Divider(height: 1, color: Color(0xFFE2E8F0)),
                      _ExamSchedulesSection(
                        examId: examId,
                        examName: name.toString(),
                      ),
                    ],
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _ExamSchedulesSection extends ConsumerWidget {
  final int examId;
  final String examName;

  const _ExamSchedulesSection({
    required this.examId,
    required this.examName,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(teacherExamSchedulesProvider(examId));

    return schedulesAsync.when(
      loading: () => const AppLoader(text: 'Loading schedule...', size: AppLoaderSize.sm),
      error: (e, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Error loading schedules: $e', style: const TextStyle(fontSize: 12, color: AppColors.error)),
      ),
      data: (schedules) {
        if (schedules.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(20),
            child: Text(
              'No paper schedules added for this exam yet.',
              style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
            ),
          );
        }

        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          itemCount: schedules.length,
          separatorBuilder: (_, __) => const Divider(height: 12, color: Color(0xFFE2E8F0)),
          itemBuilder: (context, idx) {
            final s = schedules[idx];
            final scheduleId = s['id'] is int ? s['id'] as int : int.tryParse(s['id']?.toString() ?? '0') ?? 0;
            final classId = s['class_id'] is int ? s['class_id'] as int : int.tryParse(s['class_id']?.toString() ?? '0') ?? 0;
            final subjectId = s['subject_id'] is int ? s['subject_id'] as int : int.tryParse(s['subject_id']?.toString() ?? '0') ?? 0;
            final subjectName = s['subject_name']?.toString() ?? 'Subject';
            final className = s['class_name']?.toString() ?? 'Class';
            final maxMarks = (s['max_marks'] is num ? s['max_marks'] : num.tryParse(s['max_marks']?.toString() ?? '100'))?.toDouble() ?? 100.0;
            final passMarks = (s['pass_marks'] is num ? s['pass_marks'] : num.tryParse(s['pass_marks']?.toString() ?? '40'))?.toDouble() ?? 40.0;
            final examDate = s['exam_date']?.toString();

            return InkWell(
              borderRadius: BorderRadius.circular(10),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => MarksEntryDetailScreen(
                      examId: examId,
                      examName: examName,
                      scheduleId: scheduleId,
                      classId: classId,
                      className: className,
                      subjectId: subjectId,
                      subjectName: subjectName,
                      maxMarks: maxMarks,
                      passMarks: passMarks,
                    ),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                subjectName,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  className,
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Max: ${maxMarks.toInt()}  •  Pass: ${passMarks.toInt()}${examDate != null ? "  •  Date: ${DateFormatter.formatString(examDate, pattern: 'MMM dd')}" : ""}',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF97316),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        minimumSize: Size.zero,
                      ),
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => MarksEntryDetailScreen(
                              examId: examId,
                              examName: examName,
                              scheduleId: scheduleId,
                              classId: classId,
                              className: className,
                              subjectId: subjectId,
                              subjectName: subjectName,
                              maxMarks: maxMarks,
                              passMarks: passMarks,
                            ),
                          ),
                        );
                      },
                      child: const Text('Enter Marks'),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}

// ── Interactive Marks Entry Detail Screen ─────────────────────────
class MarksEntryDetailScreen extends ConsumerStatefulWidget {
  final int examId;
  final String examName;
  final int scheduleId;
  final int classId;
  final String className;
  final int subjectId;
  final String subjectName;
  final double maxMarks;
  final double passMarks;

  const MarksEntryDetailScreen({
    super.key,
    required this.examId,
    required this.examName,
    required this.scheduleId,
    required this.classId,
    required this.className,
    required this.subjectId,
    required this.subjectName,
    required this.maxMarks,
    required this.passMarks,
  });

  @override
  ConsumerState<MarksEntryDetailScreen> createState() => _MarksEntryDetailScreenState();
}

class _StudentEntryRecord {
  final int studentId;
  final int enrollmentId;
  final String fullName;
  final String rollNumber;
  final TextEditingController marksController;
  final TextEditingController remarksController;
  bool isAbsent;
  String? validationError;

  _StudentEntryRecord({
    required this.studentId,
    required this.enrollmentId,
    required this.fullName,
    required this.rollNumber,
    required this.marksController,
    required this.remarksController,
    this.isAbsent = false,
  });

  void dispose() {
    marksController.dispose();
    remarksController.dispose();
  }
}

class _MarksEntryDetailScreenState extends ConsumerState<MarksEntryDetailScreen> {
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;
  List<_StudentEntryRecord> _records = [];
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    for (final r in _records) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _loadData() async {
    for (final r in _records) {
      r.dispose();
    }
    _records = [];

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final client = ref.read(apiClientProvider);

    try {
      final enrollmentsRes = await client.get(
        ApiConstants.studentEnrollments,
        queryParameters: {'class_id': widget.classId},
      );

      List<dynamic> enrollmentsList = [];
      if (enrollmentsRes is List) {
        enrollmentsList = enrollmentsRes;
      } else if (enrollmentsRes is Map<String, dynamic> && enrollmentsRes['enrollments'] is List) {
        enrollmentsList = enrollmentsRes['enrollments'] as List;
      }

      List<dynamic> existingResults = [];
      try {
        final resultsRes = await client.get('/exams/${widget.examId}/class/${widget.classId}/results');
        if (resultsRes is List) {
          existingResults = resultsRes;
        } else if (resultsRes is Map<String, dynamic> && resultsRes['results'] is List) {
          existingResults = resultsRes['results'] as List;
        }
      } catch (_) {}

      final resultsMap = <int, Map<String, dynamic>>{};
      for (final r in existingResults) {
        if (r is Map<String, dynamic>) {
          final sId = r['student_id'] is int ? r['student_id'] as int : int.tryParse(r['student_id']?.toString() ?? '');
          final subId = r['subject_id'] is int ? r['subject_id'] as int : int.tryParse(r['subject_id']?.toString() ?? '');
          if (sId != null && subId == widget.subjectId) {
            resultsMap[sId] = r;
          }
        }
      }

      final records = <_StudentEntryRecord>[];
      for (final en in enrollmentsList) {
        if (en is! Map<String, dynamic>) continue;
        final studentId = en['student_id'] is int ? en['student_id'] as int : int.tryParse(en['student_id']?.toString() ?? '0') ?? 0;
        final enrollmentId = en['id'] is int ? en['id'] as int : int.tryParse(en['id']?.toString() ?? '0') ?? 0;
        final fullName = en['full_name']?.toString() ?? en['student_name']?.toString() ?? 'Student';
        final rollNumber = en['roll_number']?.toString() ?? en['roll_no']?.toString() ?? '';

        final existing = resultsMap[studentId];
        final marksObtained = existing?['marks_obtained']?.toString() ?? '';
        final remarks = existing?['remarks']?.toString() ?? '';
        final isAbsent = existing?['is_absent'] == true;

        final marksCtrl = TextEditingController(text: marksObtained);
        final remarksCtrl = TextEditingController(text: remarks);

        records.add(
          _StudentEntryRecord(
            studentId: studentId,
            enrollmentId: enrollmentId,
            fullName: fullName,
            rollNumber: rollNumber,
            marksController: marksCtrl,
            remarksController: remarksCtrl,
            isAbsent: isAbsent,
          ),
        );
      }

      records.sort((a, b) => (int.tryParse(a.rollNumber) ?? 9999).compareTo(int.tryParse(b.rollNumber) ?? 9999));

      setState(() {
        _records = records;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _saveAll() async {
    setState(() => _isSaving = true);
    final client = ref.read(apiClientProvider);

    final payloadList = <Map<String, dynamic>>[];
    for (final r in _records) {
      final marksStr = r.marksController.text.trim();
      final marks = double.tryParse(marksStr);

      if (!r.isAbsent && marksStr.isNotEmpty && (marks == null || marks < 0 || marks > widget.maxMarks)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Invalid mark for ${r.fullName}. Must be between 0 and ${widget.maxMarks.toInt()}'),
            backgroundColor: AppColors.error,
          ),
        );
        setState(() => _isSaving = false);
        return;
      }

      if (marksStr.isNotEmpty || r.isAbsent) {
        payloadList.add({
          'student_id': r.studentId,
          'schedule_id': widget.scheduleId,
          'marks_obtained': r.isAbsent ? null : marks,
          'is_absent': r.isAbsent,
          'remarks': r.remarksController.text.trim().isEmpty ? null : r.remarksController.text.trim(),
        });
      }
    }

    if (payloadList.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No marks entered to save')),
      );
      setState(() => _isSaving = false);
      return;
    }

    try {
      await client.post('/exams/results/bulk', data: {'results': payloadList});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Successfully saved ${payloadList.length} marks!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save marks: $e'),
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
    final filtered = _records.where((r) {
      if (_searchQuery.isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return r.fullName.toLowerCase().contains(q) || r.rollNumber.contains(q);
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('${widget.subjectName} — ${widget.className}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ),
      body: _isLoading
          ? const AppLoader(text: 'Loading marks register...', size: AppLoaderSize.lg)
          : _errorMessage != null
              ? Center(child: Text('Error: $_errorMessage'))
              : Column(
                  children: [
                    // Header info card
                    Container(
                      padding: const EdgeInsets.all(14),
                      margin: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatItem('EXAM', widget.examName),
                          _buildStatItem('MAX MARKS', '${widget.maxMarks.toInt()}'),
                          _buildStatItem('PASS MARKS', '${widget.passMarks.toInt()}'),
                          _buildStatItem('STUDENTS', '${_records.length}'),
                        ],
                      ),
                    ),

                    // Search input
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: TextField(
                        onChanged: (v) => setState(() => _searchQuery = v),
                        decoration: InputDecoration(
                          hintText: 'Search student by name or roll…',
                          prefixIcon: const Icon(Icons.search_rounded, size: 20),
                          isDense: true,
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          fillColor: Colors.white,
                          filled: true,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Student list
                    Expanded(
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, idx) {
                          final r = filtered[idx];
                          final val = double.tryParse(r.marksController.text);
                          final hasMark = !r.isAbsent && val != null;
                          final isPassed = hasMark && val >= widget.passMarks;

                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    // Roll number badge
                                    Container(
                                      width: 32,
                                      height: 32,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        r.rollNumber.isNotEmpty ? r.rollNumber : '—',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            r.fullName,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                                          ),
                                          if (hasMark) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              isPassed ? 'Passed' : 'Failed',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: isPassed ? const Color(0xFF16A34A) : AppColors.error,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),

                                    // Absent toggle
                                    InkWell(
                                      onTap: () {
                                        setState(() {
                                          r.isAbsent = !r.isAbsent;
                                          if (r.isAbsent) r.marksController.clear();
                                        });
                                      },
                                      borderRadius: BorderRadius.circular(8),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: r.isAbsent ? const Color(0xFFFEE2E2) : const Color(0xFFF1F5F9),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: r.isAbsent ? const Color(0xFFFCA5A5) : const Color(0xFFE2E8F0)),
                                        ),
                                        child: Text(
                                          'Absent',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: r.isAbsent ? const Color(0xFFEF4444) : const Color(0xFF64748B),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),

                                    // Marks input field
                                    SizedBox(
                                      width: 65,
                                      height: 38,
                                      child: TextField(
                                        controller: r.marksController,
                                        enabled: !r.isAbsent,
                                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                        textAlign: TextAlign.center,
                                        onChanged: (_) => setState(() {}),
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                          color: hasMark ? (isPassed ? const Color(0xFF16A34A) : AppColors.error) : const Color(0xFF0F172A),
                                        ),
                                        decoration: InputDecoration(
                                          contentPadding: EdgeInsets.zero,
                                          hintText: '/${widget.maxMarks.toInt()}',
                                          hintStyle: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                                          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: Color(0xFFF97316))),
                                          fillColor: r.isAbsent ? const Color(0xFFF8FAFC) : Colors.white,
                                          filled: true,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),

                    // Sticky Bottom Save Bar
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                      child: SafeArea(
                        child: Row(
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Entered: ${_records.where((r) => r.isAbsent || r.marksController.text.isNotEmpty).length} / ${_records.length}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                                ),
                                const Text('Students recorded', style: TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                              ],
                            ),
                            const Spacer(),
                            ElevatedButton.icon(
                              onPressed: _isSaving ? null : _saveAll,
                              icon: _isSaving ? AppLoader.spinner(color: Colors.white) : const Icon(Icons.check_rounded, size: 18),
                              label: Text(_isSaving ? 'Saving…' : 'Save All Marks'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFF97316),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8))),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
      ],
    );
  }
}

// ═════════════════════════════════════════════════════════════════
// ── TAB 2: CLASS MARKS REGISTER (FOR COORDINATORS) ──────────────
// ═════════════════════════════════════════════════════════════════

class _ClassRegisterTab extends ConsumerStatefulWidget {
  const _ClassRegisterTab();

  @override
  ConsumerState<_ClassRegisterTab> createState() => _ClassRegisterTabState();
}

class _ClassRegisterTabState extends ConsumerState<_ClassRegisterTab> {
  TeacherSection? _selectedSection;
  int? _selectedExamId;
  bool _isLoading = false;
  Map<String, dynamic>? _registerData;
  String? _errorMessage;
  String _statusFilter = 'all'; // 'all', 'passed', 'failed'
  String _searchQuery = '';

  Future<void> _fetchRegister() async {
    if (_selectedSection == null || _selectedExamId == null) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final client = ref.read(apiClientProvider);

    try {
      final res = await client.get(
        '/exams/$_selectedExamId/class/${_selectedSection!.classId}/register',
        queryParameters: {'section_id': _selectedSection!.id},
      );

      if (res is Map<String, dynamic>) {
        setState(() {
          _registerData = res;
          _isLoading = false;
        });
      } else {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final sectionsAsync = ref.watch(teacherSectionsProvider);
    final examsAsync = ref.watch(teacherExamsListProvider);

    final sections = sectionsAsync.maybeWhen(
      data: (data) => data,
      orElse: () => <TeacherSection>[],
    );

    final exams = examsAsync.maybeWhen(
      data: (data) => data,
      orElse: () => <dynamic>[],
    );

    if (sections.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Icon(Icons.shield_outlined, size: 48, color: Color(0xFF94A3B8)),
              SizedBox(height: 12),
              Text('Section Coordinator Access Required', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              SizedBox(height: 6),
              Text(
                'Class Marks Register is available to appointed section coordinators. Ask your administration to assign you as a section coordinator to view consolidated results.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    // Auto-select defaults
    if (_selectedSection == null && sections.isNotEmpty) {
      _selectedSection = sections.first;
    }
    if (_selectedExamId == null && exams.isNotEmpty) {
      final firstExam = exams.first;
      _selectedExamId = firstExam['id'] is int ? firstExam['id'] : int.tryParse(firstExam['id']?.toString() ?? '');
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _fetchRegister();
      });
    }

    final summary = _registerData?['summary'] as Map<String, dynamic>?;
    final studentsRaw = _registerData?['students'] as List<dynamic>? ?? [];

    final filteredStudents = studentsRaw.where((s) {
      if (s is! Map<String, dynamic>) return false;
      final name = s['full_name']?.toString().toLowerCase() ?? '';
      final roll = s['roll_number']?.toString() ?? '';
      final status = s['status']?.toString().toLowerCase() ?? '';

      if (_statusFilter == 'passed' && status != 'passed') return false;
      if (_statusFilter == 'failed' && status != 'failed') return false;

      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        if (!name.contains(q) && !roll.contains(q)) return false;
      }
      return true;
    }).toList();

    return RefreshIndicator(
      color: const Color(0xFFF97316),
      onRefresh: _fetchRegister,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Selectors card
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  // Section selector
                  DropdownButtonFormField<TeacherSection>(
                    initialValue: _selectedSection,
                    decoration: InputDecoration(
                      labelText: 'Select Section',
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    items: sections.map((sec) {
                      return DropdownMenuItem(value: sec, child: Text(sec.displayName));
                    }).toList(),
                    onChanged: (sec) {
                      if (sec != null) {
                        setState(() => _selectedSection = sec);
                        _fetchRegister();
                      }
                    },
                  ),
                  const SizedBox(height: 10),

                  // Exam selector
                  DropdownButtonFormField<int>(
                    initialValue: _selectedExamId,
                    decoration: InputDecoration(
                      labelText: 'Select Exam',
                      isDense: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    items: exams.map((ex) {
                      final id = ex['id'] is int ? ex['id'] as int : int.tryParse(ex['id']?.toString() ?? '0') ?? 0;
                      final name = ex['name'] ?? ex['title'] ?? 'Exam';
                      return DropdownMenuItem(value: id, child: Text(name.toString()));
                    }).toList(),
                    onChanged: (eId) {
                      if (eId != null) {
                        setState(() => _selectedExamId = eId);
                        _fetchRegister();
                      }
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            if (_isLoading)
              const AppLoader(text: 'Loading...', size: AppLoaderSize.md)
            else if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFCA5A5)),
                ),
                child: Text('Error: $_errorMessage', style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
              )
            else ...[
              // ── 4 Overview KPI Cards ──
              if (summary != null) ...[
                Row(
                  children: [
                    Expanded(
                      child: _buildRegisterKpiCard(
                        title: 'APPEARED',
                        value: '${summary['appeared_count'] ?? summary['appeared'] ?? 0}',
                        subtitle: 'of ${summary['total_students'] ?? 0} students',
                        color: const Color(0xFF2563EB),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildRegisterKpiCard(
                        title: 'PASSED',
                        value: '${summary['passed_count'] ?? summary['passed'] ?? 0}',
                        subtitle: '${summary['pass_percentage'] ?? 0}% rate',
                        color: const Color(0xFF16A34A),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildRegisterKpiCard(
                        title: 'FAILED',
                        value: '${summary['failed_count'] ?? summary['failed'] ?? 0}',
                        subtitle: 'Students',
                        color: AppColors.error,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildRegisterKpiCard(
                        title: 'AVG PERCENTAGE',
                        value: '${summary['average_percentage'] ?? 0}%',
                        subtitle: 'Highest: ${summary['highest_percentage'] ?? 0}%',
                        color: const Color(0xFFF97316),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
              ],

              // Filter & Search Row
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      onChanged: (v) => setState(() => _searchQuery = v),
                      decoration: InputDecoration(
                        hintText: 'Search student…',
                        prefixIcon: const Icon(Icons.search, size: 18),
                        isDense: true,
                        contentPadding: const EdgeInsets.all(10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                        fillColor: Colors.white,
                        filled: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  DropdownButton<String>(
                    value: _statusFilter,
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All')),
                      DropdownMenuItem(value: 'passed', child: Text('Passed')),
                      DropdownMenuItem(value: 'failed', child: Text('Failed')),
                    ],
                    onChanged: (v) => setState(() => _statusFilter = v ?? 'all'),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Student Register List
              if (filteredStudents.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32),
                    child: Text('No student records found matching filter.', style: TextStyle(color: Color(0xFF94A3B8))),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: filteredStudents.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final stu = filteredStudents[idx];
                    final name = stu['full_name']?.toString() ?? 'Student';
                    final roll = stu['roll_number']?.toString() ?? '—';
                    final rank = stu['rank'] != null ? '#${stu['rank']}' : '#${idx + 1}';
                    final totalMarks = stu['total_obtained'] ?? stu['total_marks'] ?? 0;
                    final totalMax = stu['total_max'] ?? stu['max_marks'] ?? 0;
                    final pct = stu['percentage'] != null ? '${stu['percentage']}%' : '—';
                    final status = stu['status']?.toString().toLowerCase() ?? 'passed';
                    final isPassed = status == 'passed';
                    final gpa = stu['gpa']?.toString() ?? stu['grade']?.toString() ?? '';

                    return Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              // Rank badge
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: idx == 0
                                      ? const Color(0xFFFEF3C7)
                                      : idx == 1
                                          ? const Color(0xFFF1F5F9)
                                          : idx == 2
                                              ? const Color(0xFFFFEDD5)
                                              : const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: idx == 0 ? const Color(0xFFFCD34D) : const Color(0xFFE2E8F0),
                                  ),
                                ),
                                child: Text(
                                  rank,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                    color: idx == 0 ? const Color(0xFFB45309) : const Color(0xFF334155),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                                    ),
                                    Text(
                                      'Roll: $roll',
                                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isPassed ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  isPassed ? 'Passed' : 'Failed',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isPassed ? const Color(0xFF16A34A) : const Color(0xFFEF4444),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 16, color: Color(0xFFF1F5F9)),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Total: $totalMarks / $totalMax', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                              Text('Score: $pct', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                              if (gpa.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFEFF6FF),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text('GPA: $gpa', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                                ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRegisterKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8))),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
        ],
      ),
    );
  }
}
