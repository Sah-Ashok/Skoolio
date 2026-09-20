import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/presentation/auth_providers.dart';

final studentResultsListProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentResults);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['results'] is List) {
      return res['results'] as List;
    }
  } catch (_) {}
  return [];
});

final studentExamSchedulesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentExamSchedules);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['schedules'] is List) {
      return res['schedules'] as List;
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
        appBar: AppBar(
          title: const Text(
            'Exams & Results',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          bottom: const TabBar(
            indicatorColor: AppColors.accent,
            indicatorWeight: 3,
            labelColor: AppColors.textPrimary,
            unselectedLabelColor: AppColors.textSecondary,
            labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
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
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Center(child: Text('Error loading routines: $err')),
        data: (schedules) {
          if (schedules.isEmpty) {
            return ListView(
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                Center(
                  child: Column(
                    children: const [
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

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: schedules.length,
            itemBuilder: (context, index) {
              final item = schedules[index] as Map<String, dynamic>;
              final examName = item['exam_name']?.toString() ?? 'Examination';
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
              final formattedDate = date != null ? DateFormat('EEEE, MMM dd, yyyy').format(date) : dateStr;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFFFEDD5)),
                          ),
                          child: Text(
                            examName,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFFF97316),
                            ),
                          ),
                        ),
                        if (roomNo != null && roomNo.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.meeting_room_outlined, size: 13, color: Color(0xFF64748B)),
                                const SizedBox(width: 4),
                                Text(
                                  'Room $roomNo',
                                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      subject,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                        const SizedBox(width: 6),
                        Text(
                          formattedDate,
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                        ),
                      ],
                    ),
                    if (startTime.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.access_time_rounded, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Text(
                            '$startTime - $endTime',
                            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ],
                    if (maxMarks != null) ...[
                      const SizedBox(height: 10),
                      const Divider(height: 1, color: AppColors.divider),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Text(
                            'Full Marks: $maxMarks',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
                          ),
                          if (passingMarks != null) ...[
                            const SizedBox(width: 14),
                            Text(
                              'Pass Marks: $passingMarks',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.success),
                            ),
                          ],
                        ],
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

  Widget _buildResultsTab(BuildContext context, WidgetRef ref) {
    final resultsAsync = ref.watch(studentResultsListProvider);

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () async => ref.refresh(studentResultsListProvider.future),
      child: resultsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Center(child: Text('Error loading results: $err')),
        data: (results) {
          if (results.isEmpty) {
            return ListView(
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                Center(
                  child: Column(
                    children: const [
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

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: results.length,
            itemBuilder: (context, index) {
              final item = results[index];
              final subject = item['subject_name'] ?? 'Subject';
              final marks = item['marks_obtained'] ?? 0;
              final maxMarks = item['max_marks'] ?? 100;
              final grade = item['grade']?.toString() ?? '-';

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        grade,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.primary),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            subject.toString(),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Score: $marks / $maxMarks',
                            style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
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
}
