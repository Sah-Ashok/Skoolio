import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../../attendance/data/teacher_attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../auth/presentation/auth_providers.dart';
import 'teacher_student_detail_screen.dart';

class TeacherStudentsScreen extends ConsumerStatefulWidget {
  const TeacherStudentsScreen({super.key});

  @override
  ConsumerState<TeacherStudentsScreen> createState() => _TeacherStudentsScreenState();
}

class _TeacherStudentsScreenState extends ConsumerState<TeacherStudentsScreen> {
  TeacherSection? _selectedSection;
  bool _isLoading = false;
  List<StudentAttendanceItem> _students = [];
  String _searchQuery = '';

  Future<void> _loadStudents(TeacherSection section) async {
    setState(() => _isLoading = true);
    final repo = ref.read(teacherAttendanceRepositoryProvider);

    try {
      final activeYearId = section.academicYearId ?? await repo.getActiveAcademicYearId();
      final roster = await repo.getSectionStudents(
        sectionId: section.id,
        academicYearId: activeYearId,
      );
      roster.sort((a, b) => (int.tryParse(a.rollNumber ?? '9999') ?? 9999)
          .compareTo(int.tryParse(b.rollNumber ?? '9999') ?? 9999));

      setState(() {
        _students = roster;
        _isLoading = false;
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

  void _showEditRollDialog(StudentAttendanceItem student) {
    final rollCtrl = TextEditingController(text: student.rollNumber ?? '');
    final remarksCtrl = TextEditingController();
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: Text('Edit Roll: ${student.fullName}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: rollCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Roll Number',
                    hintText: 'e.g. 14',
                  ),
                  keyboardType: TextInputType.text,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: remarksCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Remarks (Optional)',
                    hintText: 'Notes…',
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF97316),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: isSaving
                    ? null
                    : () async {
                        final messenger = ScaffoldMessenger.of(context);
                        final targetEnrollmentId = student.enrollmentId ?? student.studentId;
                        setDialogState(() => isSaving = true);
                        final client = ref.read(apiClientProvider);
                        try {
                          await client.patch(
                            '/students/enrollments/$targetEnrollmentId/roll',
                            data: {
                              'roll_number': rollCtrl.text.trim().isEmpty ? null : rollCtrl.text.trim(),
                              'remarks': remarksCtrl.text.trim().isEmpty ? null : remarksCtrl.text.trim(),
                            },
                          );
                          if (ctx.mounted) Navigator.pop(ctx);
                          if (mounted) {
                            messenger.showSnackBar(
                              const SnackBar(content: Text('Roll number updated successfully!'), backgroundColor: AppColors.success),
                            );
                            if (_selectedSection != null) {
                              _loadStudents(_selectedSection!);
                            }
                          }
                        } catch (e) {
                          setDialogState(() => isSaving = false);
                          if (ctx.mounted) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(content: Text('Failed: $e'), backgroundColor: AppColors.error),
                            );
                          }
                        }
                      },
                child: isSaving
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Save'),
              ),
            ],
          );
        },
      ),
    );
  }

  String _getInitials(String name) {
    if (name.trim().isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final sectionsAsync = ref.watch(teacherSectionsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('My Students', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: sectionsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFF97316))),
        error: (e, _) => Center(child: Text('Error loading sections: $e')),
        data: (sections) {
          if (sections.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: const [
                    Icon(Icons.groups_outlined, size: 54, color: Color(0xFFCBD5E1)),
                    SizedBox(height: 14),
                    Text('No Sections Assigned', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A))),
                    SizedBox(height: 6),
                    Text(
                      'Ask your administration to assign you as a section coordinator to view your class students.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                    ),
                  ],
                ),
              ),
            );
          }

          if (_selectedSection == null && sections.isNotEmpty) {
            _selectedSection = sections.first;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && _selectedSection != null) {
                _loadStudents(_selectedSection!);
              }
            });
          }

          final filtered = _students.where((s) {
            if (_searchQuery.isEmpty) return true;
            final q = _searchQuery.toLowerCase();
            return s.fullName.toLowerCase().contains(q) || (s.rollNumber != null && s.rollNumber!.contains(q));
          }).toList();

          return Column(
            children: [
              // ── Section Pill Tabs (Next.js style) ──
              Container(
                color: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: sections.map((sec) {
                      final isSelected = _selectedSection?.id == sec.id;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: InkWell(
                          onTap: () {
                            setState(() {
                              _selectedSection = sec;
                              _searchQuery = '';
                            });
                            _loadStudents(sec);
                          },
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFFFFF7ED) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected ? const Color(0xFFF97316) : const Color(0xFFE2E8F0),
                                width: isSelected ? 1.5 : 1.0,
                              ),
                            ),
                            child: Row(
                              children: [
                                Text(
                                  sec.displayName,
                                  style: TextStyle(
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    fontSize: 13,
                                    color: isSelected ? const Color(0xFFF97316) : const Color(0xFF475569),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),

              // ── Search Bar ──
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: TextField(
                  onChanged: (v) => setState(() => _searchQuery = v),
                  decoration: InputDecoration(
                    hintText: 'Search students by name or roll…',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF94A3B8)),
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

              // ── Count Bar ──
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                child: Row(
                  children: [
                    Text(
                      '${filtered.length} Students',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),

              // ── Students List ──
              Expanded(
                child: _isLoading
                    ? const Center(child: CircularProgressIndicator(color: Color(0xFFF97316)))
                    : filtered.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                _searchQuery.isEmpty ? 'No students found in this section.' : 'No students matching "$_searchQuery".',
                                style: const TextStyle(color: Color(0xFF94A3B8)),
                              ),
                            ),
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              final student = filtered[index];
                              final roll = student.rollNumber ?? '—';
                              final initials = _getInitials(student.fullName);

                              return Container(
                                margin: const EdgeInsets.only(bottom: 10),
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
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(14),
                                  onTap: () {
                                    Navigator.push(
                                      context,
                                      MaterialPageRoute(
                                        builder: (_) => TeacherStudentDetailScreen(
                                          studentId: student.studentId,
                                          studentName: student.fullName,
                                        ),
                                      ),
                                    );
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(
                                      children: [
                                        // Initials avatar
                                        Container(
                                          width: 44,
                                          height: 44,
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFEFF6FF),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: const Color(0xFFBFDBFE)),
                                          ),
                                          child: Text(
                                            initials,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w900,
                                              fontSize: 16,
                                              color: Color(0xFF1D4ED8),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),

                                        // Name & Details
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                student.fullName,
                                                style: const TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 14,
                                                  color: Color(0xFF0F172A),
                                                ),
                                              ),
                                              const SizedBox(height: 3),
                                              Row(
                                                children: [
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: const Color(0xFFF1F5F9),
                                                      borderRadius: BorderRadius.circular(6),
                                                    ),
                                                    child: Text(
                                                      'Roll $roll',
                                                      style: const TextStyle(
                                                        fontSize: 11,
                                                        fontWeight: FontWeight.w700,
                                                        color: Color(0xFF475569),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  InkWell(
                                                    onTap: () => _showEditRollDialog(student),
                                                    child: const Padding(
                                                      padding: EdgeInsets.all(2),
                                                      child: Icon(Icons.edit_outlined, size: 14, color: Color(0xFFF97316)),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),

                                        // Chevron arrow
                                        const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 20),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
              ),
            ],
          );
        },
      ),
    );
  }
}
