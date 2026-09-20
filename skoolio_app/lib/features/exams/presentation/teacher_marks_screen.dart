import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

// ── Exam List Provider ──────────────────────────────────────────
final examsListProvider = FutureProvider<List<dynamic>>((ref) async {
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
final examSchedulesProvider = FutureProvider.autoDispose.family<List<dynamic>, int>((ref, examId) async {
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

class _TeacherMarksScreenState extends ConsumerState<TeacherMarksScreen> {
  int? _expandedExamId;

  @override
  Widget build(BuildContext context) {
    final examsAsync = ref.watch(examsListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Marks & Grades Entry', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async {
          ref.invalidate(examsListProvider);
          if (_expandedExamId != null) {
            ref.invalidate(examSchedulesProvider(_expandedExamId!));
          }
        },
        child: examsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error loading exams: $err')),
          data: (exams) {
            if (exams.isEmpty) {
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                  Center(
                    child: Column(
                      children: const [
                        Icon(Icons.edit_note_rounded, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No active exams scheduled', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text(
                          'Once exams are published by administration, you can record marks here.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
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
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isExpanded ? AppColors.primary.withValues(alpha: 0.5) : AppColors.border,
                      width: isExpanded ? 1.5 : 1.0,
                    ),
                  ),
                  child: Column(
                    children: [
                      InkWell(
                        borderRadius: BorderRadius.circular(14),
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
                                  color: AppColors.primary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.assignment_turned_in_outlined, color: AppColors.primary, size: 24),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      name.toString(),
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      term.toString(),
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isPublished ? AppColors.successLight : AppColors.surface,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  isPublished ? 'Published' : 'Draft',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: isPublished ? AppColors.success : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Icon(
                                isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                                color: AppColors.textSecondary,
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (isExpanded) ...[
                        const Divider(height: 1, color: AppColors.border),
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
      ),
    );
  }
}

// ── Exam Schedules Section ──────────────────────────────────────
class _ExamSchedulesSection extends ConsumerWidget {
  final int examId;
  final String examName;

  const _ExamSchedulesSection({
    required this.examId,
    required this.examName,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(examSchedulesProvider(examId));

    return schedulesAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(20),
        child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
      ),
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
              style: TextStyle(fontSize: 13, color: AppColors.textMuted),
            ),
          );
        }

        return ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          itemCount: schedules.length,
          separatorBuilder: (_, __) => const Divider(height: 12, color: AppColors.border),
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
              borderRadius: BorderRadius.circular(8),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => MarksEntryScreen(
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
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  className,
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Max: ${maxMarks.toInt()}  •  Pass: ${passMarks.toInt()}${examDate != null ? "  •  Date: ${DateFormatter.formatString(examDate, pattern: 'MMM dd')}" : ""}',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        minimumSize: Size.zero,
                      ),
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => MarksEntryScreen(
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

// ── Interactive Marks Entry Screen ──────────────────────────────
class MarksEntryScreen extends ConsumerStatefulWidget {
  final int examId;
  final String examName;
  final int scheduleId;
  final int classId;
  final String className;
  final int subjectId;
  final String subjectName;
  final double maxMarks;
  final double passMarks;

  const MarksEntryScreen({
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
  ConsumerState<MarksEntryScreen> createState() => _MarksEntryScreenState();
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

class _MarksEntryScreenState extends ConsumerState<MarksEntryScreen> {
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;
  List<_StudentEntryRecord> _records = [];

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
      // 1. Fetch class student enrollments
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

      // 2. Fetch existing results for this exam & class
      List<dynamic> existingResults = [];
      try {
        final resultsRes = await client.get('/exams/${widget.examId}/class/${widget.classId}/results');
        if (resultsRes is List) {
          existingResults = resultsRes;
        } else if (resultsRes is Map<String, dynamic> && resultsRes['results'] is List) {
          existingResults = resultsRes['results'] as List;
        }
      } catch (_) {}

      // Map existing results by student_id
      final resultsMap = <int, Map<String, dynamic>>{};
      for (final r in existingResults) {
        if (r is Map<String, dynamic>) {
          final sId = r['student_id'] is int ? r['student_id'] as int : int.tryParse(r['student_id']?.toString() ?? '0');
          final subId = r['subject_id'] is int ? r['subject_id'] as int : int.tryParse(r['subject_id']?.toString() ?? '0');
          if (sId != null && subId == widget.subjectId) {
            resultsMap[sId] = r;
          }
        }
      }

      final List<_StudentEntryRecord> records = [];
      for (final en in enrollmentsList) {
        final studentId = en['student_id'] is int ? en['student_id'] as int : int.tryParse(en['student_id']?.toString() ?? '0') ?? 0;
        final enrollmentId = en['id'] is int ? en['id'] as int : int.tryParse(en['id']?.toString() ?? '0') ?? 0;
        final name = en['full_name']?.toString() ?? en['student_name']?.toString() ?? 'Student';
        final roll = en['roll_number']?.toString() ?? '-';

        final existing = resultsMap[studentId];
        final marksVal = existing != null && existing['marks_obtained'] != null
            ? existing['marks_obtained'].toString()
            : '';
        final isAbsent = existing != null && existing['is_absent'] == true;
        final remarksVal = existing != null && existing['remarks'] != null ? existing['remarks'].toString() : '';

        records.add(
          _StudentEntryRecord(
            studentId: studentId,
            enrollmentId: enrollmentId,
            fullName: name,
            rollNumber: roll,
            marksController: TextEditingController(text: marksVal),
            remarksController: TextEditingController(text: remarksVal),
            isAbsent: isAbsent,
          ),
        );
      }

      // Sort by roll number
      records.sort((a, b) => (int.tryParse(a.rollNumber) ?? 9999).compareTo(int.tryParse(b.rollNumber) ?? 9999));

      setState(() {
        _records = records;
        _isLoading = false;
      });
    } catch (err) {
      setState(() {
        _isLoading = false;
        _errorMessage = err.toString();
      });
    }
  }

  void _validateRecord(_StudentEntryRecord record) {
    if (record.isAbsent) {
      record.validationError = null;
      return;
    }
    final text = record.marksController.text.trim();
    if (text.isEmpty) {
      record.validationError = null;
      return;
    }
    final val = double.tryParse(text);
    if (val == null) {
      record.validationError = 'Invalid';
    } else if (val < 0) {
      record.validationError = '≥ 0';
    } else if (val > widget.maxMarks) {
      record.validationError = '≤ ${widget.maxMarks.toInt()}';
    } else {
      record.validationError = null;
    }
  }

  Future<void> _saveMarks() async {
    // Validate all records
    bool hasError = false;
    for (final r in _records) {
      _validateRecord(r);
      if (r.validationError != null) {
        hasError = true;
      }
    }

    if (hasError) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please correct invalid marks before submitting.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isSaving = true);
    final client = ref.read(apiClientProvider);

    final payloadResults = _records.map((r) {
      final marksVal = double.tryParse(r.marksController.text.trim());
      return {
        'student_id': r.studentId,
        'enrollment_id': r.enrollmentId,
        'marks_obtained': r.isAbsent ? null : marksVal,
        'is_absent': r.isAbsent,
        'remarks': r.remarksController.text.trim().isNotEmpty ? r.remarksController.text.trim() : null,
      };
    }).toList();

    try {
      await client.post(
        ApiConstants.teacherExamResultsBulk,
        data: {
          'exam_id': widget.examId,
          'schedule_id': widget.scheduleId,
          'subject_id': widget.subjectId,
          'results': payloadResults,
        },
      );

      setState(() => _isSaving = false);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Marks saved successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (err) {
      setState(() => _isSaving = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save marks: $err'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final enteredCount = _records.where((r) => r.isAbsent || r.marksController.text.trim().isNotEmpty).length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${widget.subjectName} Marks', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text('${widget.className} • Max: ${widget.maxMarks.toInt()}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
                        const SizedBox(height: 12),
                        Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.error)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadData, child: const Text('Try Again')),
                      ],
                    ),
                  ),
                )
              : _records.isEmpty
                  ? const Center(child: Text('No students found in this class.'))
                  : Column(
                      children: [
                        // Summary Banner
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          color: Colors.white,
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  'Entered: $enteredCount / ${_records.length}',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primary),
                                ),
                              ),
                              const Spacer(),
                              Text(
                                'Pass Mark: ${widget.passMarks.toInt()}',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        const Divider(height: 1, color: AppColors.border),

                        // Student Marks List
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _records.length,
                            itemBuilder: (context, index) {
                              final record = _records[index];

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: record.validationError != null ? AppColors.error : AppColors.border,
                                    width: record.validationError != null ? 1.5 : 1.0,
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          radius: 16,
                                          backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                                          child: Text(
                                            record.rollNumber,
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                record.fullName,
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                              ),
                                              Text(
                                                'Roll No: ${record.rollNumber}',
                                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                              ),
                                            ],
                                          ),
                                        ),
                                        // Absent toggle chip
                                        FilterChip(
                                          label: const Text('Absent'),
                                          selected: record.isAbsent,
                                          selectedColor: AppColors.error.withValues(alpha: 0.2),
                                          labelStyle: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: record.isAbsent ? AppColors.error : AppColors.textSecondary,
                                          ),
                                          onSelected: (val) {
                                            setState(() {
                                              record.isAbsent = val;
                                              if (val) {
                                                record.marksController.clear();
                                                record.validationError = null;
                                              }
                                            });
                                          },
                                        ),
                                        const SizedBox(width: 8),
                                        // Marks input field
                                        SizedBox(
                                          width: 72,
                                          child: TextField(
                                            controller: record.marksController,
                                            enabled: !record.isAbsent,
                                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                            decoration: InputDecoration(
                                              contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                                              hintText: record.isAbsent ? 'ABS' : 'Marks',
                                              hintStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
                                              errorText: record.validationError,
                                              errorStyle: const TextStyle(fontSize: 10, height: 1),
                                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                              filled: record.isAbsent,
                                              fillColor: Colors.grey.shade100,
                                            ),
                                            onChanged: (_) {
                                              setState(() {
                                                _validateRecord(record);
                                              });
                                            },
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

                        // Bottom Save Bar
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 10,
                                offset: const Offset(0, -3),
                              ),
                            ],
                          ),
                          child: SafeArea(
                            top: false,
                            child: SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.accent,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: _isSaving ? null : _saveMarks,
                                icon: _isSaving
                                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                    : const Icon(Icons.save_rounded, size: 20),
                                label: Text(
                                  _isSaving ? 'Saving Marks...' : 'Save Marks',
                                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
    );
  }
}
