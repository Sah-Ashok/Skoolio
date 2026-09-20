import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../attendance/data/teacher_attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';

class TeacherStudentsScreen extends ConsumerStatefulWidget {
  const TeacherStudentsScreen({super.key});

  @override
  ConsumerState<TeacherStudentsScreen> createState() => _TeacherStudentsScreenState();
}

class _TeacherStudentsScreenState extends ConsumerState<TeacherStudentsScreen> {
  TeacherSection? _selectedSection;
  bool _isLoading = false;
  List<StudentAttendanceItem> _students = [];

  Future<void> _loadStudents(TeacherSection section) async {
    setState(() => _isLoading = true);
    final repo = ref.read(teacherAttendanceRepositoryProvider);

    try {
      final roster = await repo.getSectionStudents(sectionId: section.id);
      roster.sort((a, b) => (int.tryParse(a.rollNumber ?? '9999') ?? 9999)
          .compareTo(int.tryParse(b.rollNumber ?? '9999') ?? 9999));

      setState(() {
        _students = roster;
        _isLoading = false;
      });
    } catch (_) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sectionsAsync = ref.watch(teacherSectionsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Student Directory', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: sectionsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Error loading sections: $e'),
              data: (sections) {
                if (sections.isEmpty) {
                  return const Text('No sections assigned.');
                }
                if (_selectedSection == null && sections.isNotEmpty) {
                  _selectedSection = sections.first;
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted && _selectedSection != null) {
                      _loadStudents(_selectedSection!);
                    }
                  });
                }
                return DropdownButtonFormField<TeacherSection>(
                  initialValue: _selectedSection,
                  decoration: const InputDecoration(labelText: 'Filter by Section'),
                  items: sections.map((s) {
                    return DropdownMenuItem(value: s, child: Text(s.displayName));
                  }).toList(),
                  onChanged: (s) {
                    if (s != null) {
                      setState(() => _selectedSection = s);
                      _loadStudents(s);
                    }
                  },
                );
              },
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
                : _students.isEmpty
                    ? const Center(child: Text('No students found in this section.'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _students.length,
                        itemBuilder: (context, index) {
                          final student = _students[index];
                          return Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                                  child: Text(
                                    student.rollNumber ?? '${index + 1}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        student.fullName,
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Roll No: ${student.rollNumber ?? 'N/A'}',
                                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
