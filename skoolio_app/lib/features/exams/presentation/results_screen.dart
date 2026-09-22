import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_loader.dart';
import '../../../core/widgets/app_bottom_nav_bar.dart';
import '../../auth/presentation/auth_providers.dart';

final studentResultsListProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentResults);
    if (res is List) return res;
    if (res is Map<String, dynamic>) {
      final list = res['results'] ?? res['data'];
      if (list is List) return list;
    }
  } catch (_) {}
  return [];
});

final studentExamSchedulesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentExamSchedules);
    if (res is List) return res;
    if (res is Map<String, dynamic>) {
      final list = res['schedules'] ?? res['data'];
      if (list is List) return list;
    }
  } catch (_) {}
  return [];
});

class ResultsScreen extends ConsumerWidget {
  const ResultsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.background,
        bottomNavigationBar: const AppHorizontalNavBar(currentRoute: '/student/results'),
        appBar: AppBar(
          title: const Text(
            'Exams & Results',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          bottom: const TabBar(
            indicatorColor: Color(0xFFF97316),
            indicatorWeight: 3,
            labelColor: Color(0xFFF97316),
            unselectedLabelColor: Color(0xFF64748B),
            labelStyle: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5),
            tabs: [
              Tab(
                icon: Icon(Icons.calendar_month_outlined, size: 20),
                text: 'Exam Routine',
              ),
              Tab(
                icon: Icon(Icons.fact_check_outlined, size: 20),
                text: 'My Results',
              ),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildRoutineTab(context, ref),
            _buildResultsTab(context, ref),
          ],
        ),
      ),
    );
  }

  Widget _buildRoutineTab(BuildContext context, WidgetRef ref) {
    final schedulesAsync = ref.watch(studentExamSchedulesProvider);

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () async => ref.refresh(studentExamSchedulesProvider.future),
      child: schedulesAsync.when(
        loading: () => const AppLoader(text: 'Loading exam routines...', size: AppLoaderSize.lg),
        error: (err, _) => Center(child: Text('Error loading routines: $err')),
        data: (schedules) {
          if (schedules.isEmpty) {
            return ListView(
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                const Center(
                  child: Column(
                    children: [
                      Icon(Icons.event_busy_outlined, size: 48, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text('No Exam Routines Published', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(height: 4),
                      Text('Exam schedules will appear here once released.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            );
          }

          // Group schedules by exam_name
          final Map<String, List<Map<String, dynamic>>> grouped = {};
          for (final s in schedules) {
            if (s is Map<String, dynamic>) {
              final key = s['exam_name']?.toString() ?? 'Examination';
              grouped.putIfAbsent(key, () => []).add(s);
            }
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: grouped.keys.length,
            itemBuilder: (context, groupIndex) {
              final examName = grouped.keys.elementAt(groupIndex);
              final items = grouped[examName]!;

              return Container(
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
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
                    // Exam Header
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(16),
                          topRight: Radius.circular(16),
                        ),
                        border: Border(bottom: BorderSide(color: Color(0xFFFFEDD5))),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.menu_book_rounded, size: 18, color: Color(0xFFF97316)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              examName,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFFC2410C),
                              ),
                            ),
                          ),
                          Text(
                            '${items.length} subjects',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFF97316),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Exam routines list
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      itemBuilder: (context, idx) {
                        final item = items[idx];
                        final subject = item['subject_name']?.toString() ?? 'Subject';
                        final dateStr = item['exam_date']?.toString() ?? '';
                        final startTime = item['start_time']?.toString() ?? '';
                        final endTime = item['end_time']?.toString() ?? '';
                        final roomNo = item['room_number']?.toString();
                        final maxMarks = item['max_marks'];
                        final passingMarks = item['passing_marks'];

                        DateTime? date;
                        try {
                          date = DateTime.parse(dateStr);
                        } catch (_) {}
                        final formattedDate = date != null ? DateFormat('EEE, MMM dd, yyyy').format(date) : dateStr;

                        return Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      subject,
                                      style: const TextStyle(
                                        fontSize: 14.5,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                  ),
                                  if (roomNo != null && roomNo.isNotEmpty)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF1F5F9),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        'Room $roomNo',
                                        style: const TextStyle(
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF475569),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  const Icon(Icons.calendar_today_outlined, size: 13, color: Color(0xFF64748B)),
                                  const SizedBox(width: 5),
                                  Text(
                                    formattedDate,
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                                  ),
                                  if (startTime.isNotEmpty) ...[
                                    const SizedBox(width: 12),
                                    const Icon(Icons.access_time_rounded, size: 13, color: Color(0xFF64748B)),
                                    const SizedBox(width: 4),
                                    Text(
                                      '$startTime - $endTime',
                                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                                    ),
                                  ],
                                ],
                              ),
                              if (maxMarks != null) ...[
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    Text(
                                      'Full: $maxMarks',
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B)),
                                    ),
                                    if (passingMarks != null) ...[
                                      const SizedBox(width: 10),
                                      Text(
                                        'Pass: $passingMarks',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF16A34A)),
                                      ),
                                    ],
                                  ],
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildResultsTab(BuildContext context, WidgetRef ref) {
    final resultsAsync = ref.watch(studentResultsListProvider);

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () async => ref.refresh(studentResultsListProvider.future),
      child: resultsAsync.when(
        loading: () => const AppLoader(text: 'Loading exam results...', size: AppLoaderSize.lg),
        error: (err, _) => Center(child: Text('Error loading results: $err')),
        data: (results) {
          if (results.isEmpty) {
            return ListView(
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                const Center(
                  child: Column(
                    children: [
                      Icon(Icons.assignment_outlined, size: 48, color: AppColors.textMuted),
                      SizedBox(height: 12),
                      Text('No results published yet', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      SizedBox(height: 4),
                      Text('Check back after exam marks are released.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
              ],
            );
          }

          // Group results by exam_name
          final Map<String, List<Map<String, dynamic>>> grouped = {};
          for (final r in results) {
            if (r is Map<String, dynamic>) {
              final key = r['exam_name']?.toString() ?? 'Examination';
              grouped.putIfAbsent(key, () => []).add(r);
            }
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: grouped.keys.length,
            itemBuilder: (context, groupIndex) {
              final examName = grouped.keys.elementAt(groupIndex);
              final items = grouped[examName]!;

              // Calculate exam metrics
              num totalObtained = 0;
              num totalFull = 0;
              bool anyFail = false;
              String? topperBadge;
              String? rankSubtitle;

              for (final it in items) {
                final obtained = num.tryParse((it['marks_obtained'] ?? 0).toString()) ?? 0;
                final full = num.tryParse((it['full_marks'] ?? it['max_marks'] ?? 100).toString()) ?? 100;
                final pass = num.tryParse((it['passing_marks'] ?? 40).toString()) ?? 40;

                totalObtained += obtained;
                totalFull += full;

                if (obtained < pass) {
                  anyFail = true;
                }

                // Rank info
                final classRank = it['class_rank'];
                final sectionRank = it['section_rank'];
                if (classRank != null && topperBadge == null) {
                  final cRank = num.tryParse(classRank.toString()) ?? 0;
                  final sRank = num.tryParse((sectionRank ?? 0).toString()) ?? 0;

                  if (cRank == 1) {
                    topperBadge = '👑 Class Topper';
                    rankSubtitle = 'Rank 1 in Class';
                  } else if (sRank == 1) {
                    topperBadge = '🏆 Section Topper';
                    rankSubtitle = 'Rank 1 in Section';
                  } else if (cRank == 2) {
                    topperBadge = '🥈 2nd Rank';
                    rankSubtitle = 'Rank 2 in Class';
                  } else if (cRank == 3) {
                    topperBadge = '🥉 3rd Rank';
                    rankSubtitle = 'Rank 3 in Class';
                  } else if (cRank > 0) {
                    topperBadge = '🎯 Rank #$cRank';
                    rankSubtitle = 'Rank $cRank in Class';
                  }
                }
              }

              final pct = totalFull > 0 ? ((totalObtained / totalFull) * 100).round() : 0;
              String overallGrade = 'D';
              if (pct >= 90) {
                overallGrade = 'A+';
              } else if (pct >= 80) {
                overallGrade = 'A';
              } else if (pct >= 70) {
                overallGrade = 'B+';
              } else if (pct >= 60) {
                overallGrade = 'B';
              } else if (pct >= 50) {
                overallGrade = 'C';
              }

              final isPassed = !anyFail;

              return Container(
                margin: const EdgeInsets.only(bottom: 18),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 3),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Exam Header & Rank Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: const BoxDecoration(
                        color: Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.only(
                          topLeft: Radius.circular(16),
                          topRight: Radius.circular(16),
                        ),
                        border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  examName,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isPassed ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isPassed ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5),
                                  ),
                                ),
                                child: Text(
                                  isPassed ? 'PASSED' : 'FAILED',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900,
                                    color: isPassed ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (topperBadge != null) ...[
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF3C7),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFFDE68A)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    topperBadge,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 12,
                                      color: Color(0xFF92400E),
                                    ),
                                  ),
                                  if (rankSubtitle != null) ...[
                                    const SizedBox(width: 6),
                                    Text(
                                      '($rankSubtitle)',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFFB45309),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),

                          // Exam Summary KPI Row
                          Row(
                            children: [
                              _buildScoreTile('Grade', overallGrade, const Color(0xFF4F46E5), const Color(0xFFEEF2FF)),
                              const SizedBox(width: 8),
                              _buildScoreTile('Average', '$pct%', const Color(0xFF0284C7), const Color(0xFFE0F2FE)),
                              const SizedBox(width: 8),
                              _buildScoreTile('Total Marks', '$totalObtained / $totalFull', const Color(0xFF16A34A), const Color(0xFFDCFCE7)),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Subject Marks Breakdown Table
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      itemBuilder: (context, sIdx) {
                        final sub = items[sIdx];
                        final subjectName = sub['subject_name']?.toString() ?? 'Subject';
                        final subjectCode = sub['subject_code']?.toString();
                        final marks = num.tryParse((sub['marks_obtained'] ?? 0).toString()) ?? 0;
                        final fullMarks = num.tryParse((sub['full_marks'] ?? sub['max_marks'] ?? 100).toString()) ?? 100;
                        final passingMarks = num.tryParse((sub['passing_marks'] ?? 40).toString()) ?? 40;
                        final grade = sub['grade']?.toString() ?? _calculateGrade(marks, fullMarks);
                        final isSubPass = marks >= passingMarks;

                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          child: Row(
                            children: [
                              // Grade Box
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: isSubPass ? const Color(0xFFEEF2FF) : const Color(0xFFFEE2E2),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: isSubPass ? const Color(0xFFC7D2FE) : const Color(0xFFFCA5A5),
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  grade,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 14,
                                    color: isSubPass ? const Color(0xFF4338CA) : const Color(0xFFDC2626),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),

                              // Subject Info
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      subjectName,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                    if (subjectCode != null && subjectCode.isNotEmpty)
                                      Text(
                                        'Code: $subjectCode',
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                      ),
                                  ],
                                ),
                              ),

                              // Score & Status
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '$marks / $fullMarks',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      color: isSubPass ? const Color(0xFF0F172A) : const Color(0xFFDC2626),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    isSubPass ? 'PASS (min $passingMarks)' : 'FAIL (min $passingMarks)',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: isSubPass ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildScoreTile(String label, String value, Color color, Color bg) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: color),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: color.withValues(alpha: 0.8)),
            ),
          ],
        ),
      ),
    );
  }

  String _calculateGrade(num obtained, num full) {
    if (full <= 0) return '—';
    final pct = (obtained / full) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'D';
  }
}
