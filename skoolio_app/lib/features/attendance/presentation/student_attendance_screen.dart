import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../auth/presentation/auth_providers.dart';

final studentAttendanceDetailProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentAttendanceSummary);
    if (res is Map<String, dynamic>) return res;
  } catch (_) {}
  return null;
});

class StudentAttendanceScreen extends ConsumerWidget {
  const StudentAttendanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(studentAttendanceDetailProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My Attendance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async => ref.refresh(studentAttendanceDetailProvider.future),
        child: summaryAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error loading attendance: $err')),
          data: (data) {
            final pct = data?['attendance_percentage'] ?? data?['percentage'] ?? 0;
            final present = data?['present_days'] ?? data?['total_present'] ?? 0;
            final absent = data?['absent_days'] ?? data?['total_absent'] ?? 0;
            final leave = data?['leave_days'] ?? data?['total_leave'] ?? 0;
            final total = data?['working_days'] ?? data?['total_working_days'] ?? (present + absent + leave);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Donut summary card
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    children: [
                      Text(
                        '$pct%',
                        style: const TextStyle(
                          fontSize: 44,
                          fontWeight: FontWeight.bold,
                          color: AppColors.success,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Overall Attendance Rate',
                        style: TextStyle(fontSize: 14, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildStatColumn('Present', '$present', AppColors.success),
                          _buildStatColumn('Absent', '$absent', AppColors.error),
                          _buildStatColumn('Leave', '$leave', const Color(0xFF7C3AED)),
                          _buildStatColumn('Total Days', '$total', AppColors.textPrimary),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildStatColumn(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ],
    );
  }
}
