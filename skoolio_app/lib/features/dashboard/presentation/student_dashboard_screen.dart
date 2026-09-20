import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

// Independent dashboard card providers to avoid single-failure crashes
final studentAttendanceSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentAttendanceSummary);
    if (res is Map<String, dynamic>) return res;
  } catch (_) {}
  return null;
});

final studentFeesSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentFees);
    if (res is List) {
      num totalDue = 0;
      int unpaidCount = 0;
      for (final item in res) {
        if (item is Map<String, dynamic>) {
          final due = item['remaining_amount'] ?? item['due_amount'] ??
              ((item['total_amount'] ?? item['amount'] ?? 0) - (item['paid_amount'] ?? 0));
          final dueNum = num.tryParse(due.toString()) ?? 0;
          if (dueNum > 0) {
            totalDue += dueNum;
            unpaidCount++;
          }
        }
      }
      return {
        'total_due': totalDue,
        'unpaid_count': unpaidCount,
      };
    }
    if (res is Map<String, dynamic>) {
      return {
        'total_due': res['total_due'] ?? res['pending_amount'] ?? 0,
        'unpaid_count': res['unpaid_count'] ?? 0,
      };
    }
  } catch (_) {}
  return {'total_due': 0, 'unpaid_count': 0};
});

final studentRecentNoticesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentNotices);
    if (res is List) return res.take(3).toList();
    if (res is Map<String, dynamic> && res['notices'] is List) {
      return (res['notices'] as List).take(3).toList();
    }
  } catch (_) {}
  return [];
});

class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key});

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out of your account?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authStateProvider.notifier).logout();
              if (context.mounted) {
                context.go('/login');
              }
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;
    final currencySymbol = user?.currencySymbol ?? '\$';

    final attendanceAsync = ref.watch(studentAttendanceSummaryProvider);
    final feesAsync = ref.watch(studentFeesSummaryProvider);
    final noticesAsync = ref.watch(studentRecentNoticesProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.school_rounded, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user?.schoolName ?? 'Skoolio Portal',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                Text(
                  user?.fullName ?? 'Student Portal',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline_rounded, color: AppColors.textSecondary),
            tooltip: 'My Profile',
            onPressed: () => context.push('/student/profile'),
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary),
            tooltip: 'Sign Out',
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async {
          ref.invalidate(studentAttendanceSummaryProvider);
          ref.invalidate(studentFeesSummaryProvider);
          ref.invalidate(studentRecentNoticesProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome & Student ID Banner
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => context.push('/student/profile'),
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.primaryLight],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.2),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 26,
                          backgroundColor: AppColors.accent,
                          child: Text(
                            (user?.fullName.isNotEmpty == true) ? user!.fullName[0].toUpperCase() : 'S',
                            style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user?.fullName ?? 'Student',
                                style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                [
                                  if (user?.className != null) 'Class: ${user!.className}',
                                  if (user?.sectionName != null) 'Sec: ${user!.sectionName}',
                                  if (user?.admissionNumber != null) 'Adm: ${user!.admissionNumber}',
                                ].join('  •  '),
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white70, size: 16),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // KPI Stats Grid (Attendance & Fees)
              Row(
                children: [
                  Expanded(
                    child: attendanceAsync.when(
                      loading: () => _buildShimmerCard(),
                      error: (_, __) => _buildStatCard('Attendance', '0%', '0 days marked', Icons.check_circle_outline, AppColors.success),
                      data: (data) {
                        final pct = data?['attendance_percentage'] ?? data?['percentage'] ?? 0;
                        final days = data?['present_days'] ?? data?['total_present'] ?? 0;
                        return _buildStatCard('Attendance', '$pct%', '$days days present', Icons.check_circle_outline, AppColors.success);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: feesAsync.when(
                      loading: () => _buildShimmerCard(),
                      error: (_, __) => _buildStatCard('Dues', '${currencySymbol}0', 'Up to date', Icons.account_balance_wallet_outlined, AppColors.accent),
                      data: (data) {
                        final dues = data['total_due'] ?? data['pending_amount'] ?? 0;
                        final formatted = CurrencyFormatter.format(dues, symbol: currencySymbol);
                        return _buildStatCard(
                          'Pending Fees',
                          formatted,
                          (num.tryParse(dues.toString()) ?? 0) <= 0 ? 'Fully Paid' : 'Due payment',
                          Icons.account_balance_wallet_outlined,
                          AppColors.accent,
                        );
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Quick Actions Grid
              const Text(
                'Academic Modules',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  _buildModuleItem(context, 'Timetable', Icons.calendar_view_week_rounded, AppColors.primary, '/student/timetable'),
                  _buildModuleItem(context, 'Attendance', Icons.fact_check_outlined, AppColors.success, '/student/attendance'),
                  _buildModuleItem(context, 'Fees & Dues', Icons.receipt_long_rounded, AppColors.accent, '/student/fees'),
                  _buildModuleItem(context, 'Exam Results', Icons.grade_outlined, Colors.purple, '/student/results'),
                  _buildModuleItem(context, 'Notice Board', Icons.campaign_outlined, Colors.orange, '/student/notices'),
                  _buildModuleItem(context, 'Calendar', Icons.event_note_rounded, Colors.teal, '/student/calendar'),
                ],
              ),
              const SizedBox(height: 24),

              // Recent Notices Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Announcements',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  TextButton(
                    onPressed: () => context.push('/student/notices'),
                    child: const Text('View All', style: TextStyle(fontSize: 13, color: AppColors.accent)),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              noticesAsync.when(
                loading: () => const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator())),
                error: (_, __) => const SizedBox(),
                data: (notices) {
                  if (notices.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(20),
                      width: double.infinity,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                      child: const Center(child: Text('No active notices at this time.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13))),
                    );
                  }
                  return Column(
                    children: notices.map((n) {
                      final title = n['title']?.toString() ?? 'Notice';
                      final date = n['created_at']?.toString() ?? '';
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(color: AppColors.surface, shape: BoxShape.circle),
                              child: const Icon(Icons.campaign_rounded, size: 18, color: AppColors.primary),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppColors.textPrimary)),
                                  if (date.isNotEmpty)
                                    Text(date.length > 10 ? date.substring(0, 10) : date, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
                          ],
                        ),
                      );
                    }).toList(),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard(String label, String value, String sub, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500)),
              Icon(icon, color: color, size: 20),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
        ],
      ),
    );
  }

  Widget _buildShimmerCard() {
    return Container(
      height: 90,
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))),
    );
  }

  Widget _buildModuleItem(BuildContext context, String title, IconData icon, Color color, String route) {
    return InkWell(
      onTap: () => context.push(route),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: color.withValues(alpha: 0.1), shape: BoxShape.circle),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
