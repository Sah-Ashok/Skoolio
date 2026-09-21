import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/app_bottom_nav_bar.dart';
import '../../../core/widgets/app_loader.dart';
import '../../auth/presentation/auth_providers.dart';

// Independent dashboard card providers to avoid single-failure crashes
final studentAttendanceSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentAttendanceSummary);
    if (res is Map<String, dynamic>) {
      return res['data'] is Map<String, dynamic> ? res['data'] as Map<String, dynamic> : res;
    }
  } catch (_) {}
  return null;
});

final studentFeesSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentFees);
    List items = [];
    if (res is List) {
      items = res;
    } else if (res is Map<String, dynamic>) {
      items = res['collections'] ?? res['data'] ?? [];
    }

    num totalDue = 0;
    int unpaidCount = 0;
    for (final item in items) {
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
      'collections': items,
    };
  } catch (_) {}
  return {'total_due': 0, 'unpaid_count': 0, 'collections': []};
});

final studentResultsSummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentResults);
    List results = [];
    if (res is List) {
      results = res;
    } else if (res is Map<String, dynamic> && res['results'] is List) {
      results = res['results'] as List;
    }

    if (results.isNotEmpty) {
      num totalObtained = 0;
      num totalFull = 0;
      for (final r in results) {
        if (r is Map<String, dynamic>) {
          totalObtained += num.tryParse((r['marks_obtained'] ?? 0).toString()) ?? 0;
          totalFull += num.tryParse((r['full_marks'] ?? r['max_marks'] ?? 100).toString()) ?? 100;
        }
      }
      final avg = totalFull > 0 ? ((totalObtained / totalFull) * 100).round() : 0;
      String grade = 'D';
      if (avg >= 90) {
        grade = 'A+';
      } else if (avg >= 80) {
        grade = 'A';
      } else if (avg >= 70) {
        grade = 'B+';
      } else if (avg >= 60) {
        grade = 'B';
      } else if (avg >= 50) {
        grade = 'C';
      }

      return {
        'has_results': true,
        'semester_avg': avg,
        'semester_grade': grade,
        'results': results,
      };
    }
  } catch (_) {}
  return {
    'has_results': false,
    'semester_avg': 0,
    'semester_grade': '—',
    'results': [],
  };
});

final studentRecentNoticesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentNotices);
    if (res is List) return res.take(4).toList();
    if (res is Map<String, dynamic> && res['notices'] is List) {
      return (res['notices'] as List).take(4).toList();
    }
  } catch (_) {}
  return [];
});

class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key});

  String _getGreetingText(int hour) {
    if (hour < 12) {
      return 'Good morning,';
    } else if (hour < 17) {
      return 'Good afternoon,';
    } else {
      return 'Good evening,';
    }
  }

  String _getGreetingIcon(int hour) {
    if (hour < 12) {
      return 'assets/icons/GoodMorning.svg';
    } else if (hour < 17) {
      return 'assets/icons/Afternoon.svg';
    } else {
      return 'assets/icons/GoodEvening.svg';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;
    final currencySymbol = user?.currencySymbol ?? '\$';

    final feesAsync = ref.watch(studentFeesSummaryProvider);
    final resultsAsync = ref.watch(studentResultsSummaryProvider);
    final noticesAsync = ref.watch(studentRecentNoticesProvider);

    final now = DateTime.now();
    final greetingText = _getGreetingText(now.hour);
    final greetingIcon = _getGreetingIcon(now.hour);
    final firstName = (user?.fullName ?? 'Student').split(' ').first;
    final schoolName = user?.schoolName ?? 'Skoolio Academy';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.school_rounded, color: Color(0xFFF97316), size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    schoolName,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const Text(
                    'Student Portal',
                    style: TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline_rounded, color: AppColors.textSecondary),
            tooltip: 'My Profile',
            onPressed: () => context.push('/student/profile'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async {
          ref.invalidate(studentAttendanceSummaryProvider);
          ref.invalidate(studentFeesSummaryProvider);
          ref.invalidate(studentResultsSummaryProvider);
          ref.invalidate(studentRecentNoticesProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Hero Section (School Brand, SVG Greeting, Name & Status Pill) ──
              _buildHeroSection(context, user, greetingText, greetingIcon, firstName),
              const SizedBox(height: 18),

              // ── 3 KPI Cards (Fees Due, Notices, Semester Avg) ──
              _buildKpiGrid(feesAsync, resultsAsync, noticesAsync, currencySymbol),
              const SizedBox(height: 22),

              // ── 8 Quick Access Tiles (Full Web Alignment) ──
              _buildQuickAccessSection(context),
              const SizedBox(height: 22),

              // ── Announcements & Recent Payments Panels ──
              _buildNoticesAndPayments(context, noticesAsync, feesAsync, currencySymbol),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
      // ── Custom Horizontally Scrollable Bottom Navigation Bar ──
      bottomNavigationBar: const AppHorizontalNavBar(
        currentRoute: '/student-dashboard',
      ),
    );
  }

  Widget _buildHeroSection(
    BuildContext context,
    dynamic user,
    String greetingText,
    String greetingIcon,
    String firstName,
  ) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    SvgPicture.asset(
                      greetingIcon,
                      width: 24,
                      height: 24,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      greetingText,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  firstName,
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF86EFAC)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.circle, size: 7, color: Color(0xFF16A34A)),
                          SizedBox(width: 5),
                          Text(
                            'Active Student',
                            style: TextStyle(
                              color: Color(0xFF166534),
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (user?.className != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        'Class ${user.className}${user?.sectionName != null ? ' - ${user.sectionName}' : ''}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          InkWell(
            onTap: () => context.push('/student/profile'),
            borderRadius: BorderRadius.circular(14),
            child: Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFF97316), width: 2),
              ),
              alignment: Alignment.center,
              child: Text(
                firstName.isNotEmpty ? firstName[0].toUpperCase() : 'S',
                style: const TextStyle(
                  color: Color(0xFFF97316),
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiGrid(
    AsyncValue<Map<String, dynamic>> feesAsync,
    AsyncValue<Map<String, dynamic>> resultsAsync,
    AsyncValue<List<dynamic>> noticesAsync,
    String currencySymbol,
  ) {
    return Row(
      children: [
        // 1. Fees Due
        Expanded(
          child: feesAsync.when(
            loading: () => _buildKpiPlaceholder(),
            error: (_, __) => _buildStatBox(
              title: 'Fees Due',
              value: 'Clear ✓',
              subtitle: 'All paid',
              accentColor: const Color(0xFF16A34A),
              valueColor: const Color(0xFF16A34A),
              icon: Icons.account_balance_wallet_outlined,
            ),
            data: (data) {
              final due = data['total_due'] ?? 0;
              final unpaidCount = data['unpaid_count'] ?? 0;
              final hasDue = due > 0;
              return _buildStatBox(
                title: 'Fees Due',
                value: hasDue ? CurrencyFormatter.format(due, symbol: currencySymbol) : 'Clear ✓',
                subtitle: hasDue ? '$unpaidCount pending' : 'All paid',
                accentColor: hasDue ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                valueColor: hasDue ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                icon: Icons.account_balance_wallet_outlined,
              );
            },
          ),
        ),
        const SizedBox(width: 8),

        // 2. Notices
        Expanded(
          child: noticesAsync.when(
            loading: () => _buildKpiPlaceholder(),
            error: (_, __) => _buildStatBox(
              title: 'Notices',
              value: '0',
              subtitle: 'Nothing new',
              accentColor: const Color(0xFF3B82F6),
              valueColor: const Color(0xFF3B82F6),
              icon: Icons.campaign_outlined,
            ),
            data: (notices) {
              final count = notices.length;
              return _buildStatBox(
                title: 'Notices',
                value: '$count',
                subtitle: count > 0 ? 'Announcements' : 'Nothing new',
                accentColor: const Color(0xFF3B82F6),
                valueColor: const Color(0xFF3B82F6),
                icon: Icons.campaign_outlined,
              );
            },
          ),
        ),
        const SizedBox(width: 8),

        // 3. Semester Avg / Exam Results
        Expanded(
          child: resultsAsync.when(
            loading: () => _buildKpiPlaceholder(),
            error: (_, __) => _buildStatBox(
              title: 'Semester Avg',
              value: '—',
              subtitle: 'No exams yet',
              accentColor: const Color(0xFF94A3B8),
              valueColor: const Color(0xFF94A3B8),
              icon: Icons.grade_outlined,
            ),
            data: (data) {
              final hasResults = data['has_results'] == true;
              final grade = data['semester_grade'] ?? '—';
              final avg = data['semester_avg'] ?? 0;
              return _buildStatBox(
                title: 'Semester Avg',
                value: hasResults ? grade : '—',
                subtitle: hasResults ? '$avg% Overall' : 'No exams yet',
                accentColor: hasResults ? const Color(0xFF7C3AED) : const Color(0xFF94A3B8),
                valueColor: hasResults ? const Color(0xFF7C3AED) : const Color(0xFF94A3B8),
                icon: Icons.grade_outlined,
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStatBox({
    required String title,
    required String value,
    required String subtitle,
    required Color accentColor,
    required Color valueColor,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: accentColor),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF94A3B8),
                    letterSpacing: 0.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: valueColor,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiPlaceholder() {
    return Container(
      height: 80,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Center(
        child: AppLoader.spinner(size: 18, color: const Color(0xFFF97316)),
      ),
    );
  }

  Widget _buildQuickAccessSection(BuildContext context) {
    final quickItems = [
      _QuickItem(
        title: 'Attendance',
        route: '/student/attendance',
        icon: Icons.calendar_month_outlined,
        color: const Color(0xFFF97316),
        bg: const Color(0xFFFFF7ED),
        border: const Color(0xFFFED7AA),
      ),
      _QuickItem(
        title: 'My Fees',
        route: '/student/fees',
        icon: Icons.receipt_long_rounded,
        color: const Color(0xFFF59E0B),
        bg: const Color(0xFFFFFBEB),
        border: const Color(0xFFFDE68A),
      ),
      _QuickItem(
        title: 'Results',
        route: '/student/results',
        icon: Icons.fact_check_outlined,
        color: const Color(0xFF22C55E),
        bg: const Color(0xFFF0FDF4),
        border: const Color(0xFFBBF7D0),
      ),
      _QuickItem(
        title: 'Calendar',
        route: '/student/calendar',
        icon: Icons.event_note_rounded,
        color: const Color(0xFF3B82F6),
        bg: const Color(0xFFEFF6FF),
        border: const Color(0xFFBFDBFE),
      ),
      _QuickItem(
        title: 'Profile',
        route: '/student/profile',
        icon: Icons.person_outline_rounded,
        color: const Color(0xFFEC4899),
        bg: const Color(0xFFFDF2F8),
        border: const Color(0xFFFBCFE8),
      ),
      _QuickItem(
        title: 'Payment Form',
        route: '/student/fees/bank-payment',
        icon: Icons.send_rounded,
        color: const Color(0xFF0EA5E9),
        bg: const Color(0xFFF0F9FF),
        border: const Color(0xFFBAE6FD),
      ),
      _QuickItem(
        title: 'Bank Info',
        route: '/student/fees/bank-payment',
        icon: Icons.account_balance_outlined,
        color: const Color(0xFF6366F1),
        bg: const Color(0xFFEEF2FF),
        border: const Color(0xFFC7D2FE),
      ),
      _QuickItem(
        title: 'Submissions',
        route: '/student/fees/my-submissions',
        icon: Icons.history_rounded,
        color: const Color(0xFF8B5CF6),
        bg: const Color(0xFFF5F3FF),
        border: const Color(0xFFDDD6FE),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(
              children: [
                Icon(Icons.bolt_rounded, size: 18, color: Color(0xFFF59E0B)),
                SizedBox(width: 6),
                Text(
                  'Quick Access',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
            Text(
              '8 Modules',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Colors.grey.shade500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: quickItems.length,
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 0.95,
          ),
          itemBuilder: (context, index) {
            final item = quickItems[index];
            return InkWell(
              onTap: () => context.push(item.route),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: item.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: item.bg,
                        shape: BoxShape.circle,
                        border: Border.all(color: item.border),
                      ),
                      alignment: Alignment.center,
                      child: Icon(item.icon, size: 18, color: item.color),
                    ),
                    const SizedBox(height: 6),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        item.title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildNoticesAndPayments(
    BuildContext context,
    AsyncValue<List<dynamic>> noticesAsync,
    AsyncValue<Map<String, dynamic>> feesAsync,
    String currencySymbol,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Recent Notices ──
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(
              children: [
                Icon(Icons.campaign_rounded, size: 18, color: Color(0xFF3B82F6)),
                SizedBox(width: 6),
                Text(
                  'Announcements',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
            TextButton(
              onPressed: () => context.push('/student/notices'),
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
              ),
              child: const Row(
                children: [
                  Text(
                    'View all',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF3B82F6)),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFF3B82F6)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        noticesAsync.when(
          loading: () => const AppLoader(text: 'Loading notices...', size: AppLoaderSize.sm),
          error: (_, __) => const SizedBox(),
          data: (notices) {
            if (notices.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(20),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Center(
                  child: Text('No announcements right now', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                ),
              );
            }
            return Column(
              children: notices.map((n) {
                final title = n['title']?.toString() ?? 'Notice';
                final date = n['created_at']?.toString() ?? '';
                final shortDate = date.length >= 10 ? date.substring(0, 10) : date;
                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFFF97316),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: Color(0xFF0F172A)),
                            ),
                            if (shortDate.isNotEmpty)
                              Text(shortDate, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8), size: 18),
                    ],
                  ),
                );
              }).toList(),
            );
          },
        ),
        const SizedBox(height: 18),

        // ── Recent Payments ──
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(
              children: [
                Icon(Icons.history_edu_rounded, size: 18, color: Color(0xFF16A34A)),
                SizedBox(width: 6),
                Text(
                  'Recent Payments',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
            TextButton(
              onPressed: () => context.push('/student/fees/my-submissions'),
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
              ),
              child: const Row(
                children: [
                  Text(
                    'History',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF16A34A)),
                  ),
                  Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFF16A34A)),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        feesAsync.when(
          loading: () => const SizedBox(),
          error: (_, __) => const SizedBox(),
          data: (data) {
            final collections = (data['collections'] as List? ?? [])
                .where((c) => (num.tryParse((c['paid_amount'] ?? 0).toString()) ?? 0) > 0)
                .take(3)
                .toList();

            if (collections.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(20),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Center(
                  child: Text('No payment records yet', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                ),
              );
            }

            return Column(
              children: collections.map((p) {
                final title = p['fee_name'] ?? p['fee_type'] ?? 'Fee Payment';
                final amount = num.tryParse((p['paid_amount'] ?? p['total_amount'] ?? 0).toString()) ?? 0;
                final date = p['updated_at'] ?? p['created_at'] ?? '';
                final shortDate = date.length >= 10 ? date.substring(0, 10) : '';

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.receipt_long_rounded, size: 16, color: Color(0xFF16A34A)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title.toString(),
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A)),
                            ),
                            if (shortDate.isNotEmpty)
                              Text(shortDate, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            CurrencyFormatter.format(amount, symbol: currencySymbol),
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF16A34A)),
                          ),
                          const SizedBox(height: 2),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              'Paid',
                              style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Color(0xFF166534)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            );
          },
        ),
      ],
    );
  }
}

class _QuickItem {
  final String title;
  final String route;
  final IconData icon;
  final Color color;
  final Color bg;
  final Color border;

  _QuickItem({
    required this.title,
    required this.route,
    required this.icon,
    required this.color,
    required this.bg,
    required this.border,
  });
}
