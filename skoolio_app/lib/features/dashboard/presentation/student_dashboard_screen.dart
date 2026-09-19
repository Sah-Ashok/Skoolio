import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/student_dashboard_model.dart';
import 'dashboard_providers.dart';

class StudentDashboardScreen extends ConsumerWidget {
  const StudentDashboardScreen({super.key});

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Sign Out', style: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
        content: Text(
          'Are you sure you want to sign out of your account?',
          style: GoogleFonts.dmSans(fontSize: 14, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              minimumSize: Size.zero,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authStateProvider.notifier).logout();
            },
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState      = ref.watch(authStateProvider);
    final user           = authState.user;
    final currencySymbol = user?.currencySymbol ?? '\$';

    final attendanceAsync = ref.watch(attendanceSummaryProvider);
    final feeAsync        = ref.watch(feeOverviewProvider);
    final noticesAsync    = ref.watch(studentNoticesProvider);
    final resultsAsync    = ref.watch(studentExamResultsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                'assets/Logo.png',
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  child: const Icon(Icons.school_rounded, color: AppColors.primary, size: 20),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user?.schoolName ?? 'Skoolio',
                  style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.2),
                ),
                Text(
                  user?.schoolCode != null ? 'Code: ${user!.schoolCode}' : 'Student Portal',
                  style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textSecondary),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.textSecondary),
            tooltip: 'Sign Out',
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          ref.invalidate(attendanceSummaryProvider);
          ref.invalidate(feeOverviewProvider);
          ref.invalidate(studentNoticesProvider);
          ref.invalidate(studentExamResultsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Profile Card ────────────────────────────────────────
              _ProfileCard(
                name: user?.fullName ?? 'Student',
                sub: '${user?.className ?? "Class"} \u2022 Section ${user?.sectionName ?? "A"}',
                detail: user?.admissionNumber != null ? 'Adm No: ${user!.admissionNumber}' : null,
                avatarInitial: (user?.fullName.isNotEmpty == true) ? user!.fullName[0].toUpperCase() : 'S',
              ),
              const SizedBox(height: 20),

              // ── KPI Cards ────────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: attendanceAsync.when(
                      loading: () => const _KpiSkeleton(),
                      error: (_, __) => const _KpiCard(
                        title: 'Attendance', value: '\u2014', subtitle: 'Could not load',
                        icon: Icons.event_available_rounded, iconColor: AppColors.success,
                        badgeText: 'N/A', badgeColor: AppColors.surfaceVariant, badgeTextColor: AppColors.textMuted,
                      ),
                      data: (s) => _KpiCard(
                        title: 'Attendance',
                        value: s?.formattedPercentage ?? '\u2014',
                        subtitle: s != null ? '${s.presentDays}/${s.totalDays} days present' : 'No data yet',
                        icon: Icons.event_available_rounded, iconColor: AppColors.success,
                        badgeText: _attendanceBadge(s?.attendancePercentage),
                        badgeColor: _attendanceBadgeColor(s?.attendancePercentage),
                        badgeTextColor: _attendanceBadgeTextColor(s?.attendancePercentage),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: feeAsync.when(
                      loading: () => const _KpiSkeleton(),
                      error: (_, __) => const _KpiCard(
                        title: 'Fee Status', value: '\u2014', subtitle: 'Could not load',
                        icon: Icons.receipt_long_rounded, iconColor: AppColors.accent,
                        badgeText: 'N/A', badgeColor: AppColors.surfaceVariant, badgeTextColor: AppColors.textMuted,
                      ),
                      data: (fee) => _KpiCard(
                        title: 'Fee Status',
                        value: CurrencyFormatter.format(fee?.overdueDue ?? 0, symbol: currencySymbol),
                        subtitle: fee == null ? 'No fee data' : fee.isCleared ? 'All clear' : 'Overdue balance',
                        icon: Icons.receipt_long_rounded, iconColor: AppColors.accent,
                        badgeText: fee == null || fee.isCleared ? 'Cleared' : 'Due',
                        badgeColor: fee == null || fee.isCleared ? AppColors.successLight : AppColors.warningLight,
                        badgeTextColor: fee == null || fee.isCleared ? AppColors.success : AppColors.warning,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // ── Quick Access Grid ─────────────────────────────────────
              Text('Quick Access', style: _sectionTitle),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 3,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.95,
                children: const [
                  _ModuleItem(title: 'Attendance',   icon: Icons.calendar_month_rounded,       color: Color(0xFF3B82F6), route: '/student/attendance'),
                  _ModuleItem(title: 'Fee Receipts', icon: Icons.payments_rounded,             color: Color(0xFF10B981), route: '/student/fees'),
                  _ModuleItem(title: 'Exam Results', icon: Icons.workspace_premium_rounded,    color: Color(0xFFF59E0B), route: '/student/results'),
                  _ModuleItem(title: 'Timetable',    icon: Icons.schedule_rounded,             color: Color(0xFF8B5CF6), route: '/student/timetable'),
                  _ModuleItem(title: 'Notices',      icon: Icons.notifications_active_rounded, color: Color(0xFFEC4899), route: '/student/notices'),
                  _ModuleItem(title: 'Calendar',     icon: Icons.event_note_rounded,           color: Color(0xFF06B6D4), route: '/student/calendar'),
                  _ModuleItem(title: 'Profile',      icon: Icons.person_outline_rounded,       color: Color(0xFF64748B), route: '/student/profile'),
                ],
              ),
              const SizedBox(height: 24),

              // ── Recent Exam Results ───────────────────────────────────
              Text('Exam Results', style: _sectionTitle),
              const SizedBox(height: 12),
              resultsAsync.when(
                loading: () => const _ListSkeleton(rows: 3),
                error: (_, __) => _emptyCard('Could not load results.'),
                data: (results) => results.isEmpty
                    ? _emptyCard('No exam results yet.')
                    : Column(children: results.take(4).map((r) => _ExamResultRow(result: r)).toList()),
              ),
              const SizedBox(height: 24),

              // ── Recent Notices ────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Recent Notices', style: _sectionTitle),
                  TextButton(
                    onPressed: () => context.push('/student/notices'),
                    child: const Text('See all'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              noticesAsync.when(
                loading: () => const _ListSkeleton(rows: 2),
                error: (_, __) => _emptyCard('Could not load notices.'),
                data: (notices) => notices.isEmpty
                    ? _emptyCard('No notices at this time.')
                    : Column(children: notices.map((n) => _NoticeRow(notice: n)).toList()),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

final _sectionTitle = GoogleFonts.dmSans(
  fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.2,
);

Widget _emptyCard(String msg) => Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Center(child: Text(msg, style: GoogleFonts.dmSans(fontSize: 13, color: AppColors.textMuted))),
    );

String _attendanceBadge(double? pct) {
  if (pct == null) return 'N/A';
  if (pct >= 90) return 'Good';
  if (pct >= 75) return 'Fair';
  return 'Low';
}

Color _attendanceBadgeColor(double? pct) {
  if (pct == null) return AppColors.surfaceVariant;
  if (pct >= 90) return AppColors.successLight;
  if (pct >= 75) return AppColors.warningLight;
  return AppColors.errorLight;
}

Color _attendanceBadgeTextColor(double? pct) {
  if (pct == null) return AppColors.textMuted;
  if (pct >= 90) return AppColors.success;
  if (pct >= 75) return AppColors.warning;
  return AppColors.error;
}

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _ProfileCard extends StatelessWidget {
  final String name;
  final String sub;
  final String? detail;
  final String avatarInitial;
  const _ProfileCard({required this.name, required this.sub, this.detail, required this.avatarInitial});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.28), blurRadius: 20, offset: const Offset(0, 8))],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: AppColors.accent,
            child: Text(avatarInitial, style: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textOnAccent)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -0.3)),
                const SizedBox(height: 4),
                Text(sub, style: GoogleFonts.dmSans(fontSize: 13, color: Colors.white.withValues(alpha: 0.8))),
                if (detail != null) ...[
                  const SizedBox(height: 2),
                  Text(detail!, style: GoogleFonts.dmSans(fontSize: 12, color: Colors.white.withValues(alpha: 0.6))),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiSkeleton extends StatelessWidget {
  const _KpiSkeleton();
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
          const SizedBox(height: 12),
          Container(width: 60, height: 14, decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4))),
          const SizedBox(height: 8),
          Container(width: 90, height: 11, decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(4))),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String title, value, subtitle, badgeText;
  final IconData icon;
  final Color iconColor, badgeColor, badgeTextColor;

  const _KpiCard({
    required this.title, required this.value, required this.subtitle,
    required this.icon, required this.iconColor,
    required this.badgeText, required this.badgeColor, required this.badgeTextColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: iconColor, size: 22),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(8)),
                child: Text(badgeText, style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w600, color: badgeTextColor)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(value, style: GoogleFonts.dmSans(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.5)),
          const SizedBox(height: 3),
          Text(subtitle, style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _ModuleItem extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color color;
  final String? route;

  const _ModuleItem({required this.title, required this.icon, required this.color, required this.route});

  @override
  Widget build(BuildContext context) {
    final isAvailable    = route != null;
    final effectiveColor = isAvailable ? color : AppColors.textMuted;

    return Opacity(
      opacity: isAvailable ? 1.0 : 0.62,
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: isAvailable
              ? () => context.push(route!)
              : () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$title \u2014 coming soon'), duration: const Duration(seconds: 2))),
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(color: effectiveColor.withValues(alpha: 0.12), shape: BoxShape.circle),
                      child: Icon(icon, color: effectiveColor, size: 24),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600, color: isAvailable ? AppColors.textPrimary : AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              if (!isAvailable)
                Positioned(
                  top: 4, right: 4,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(6)),
                    child: Text('Soon', style: GoogleFonts.dmSans(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.textMuted)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ExamResultRow extends StatelessWidget {
  final ExamResult result;
  const _ExamResultRow({required this.result});

  @override
  Widget build(BuildContext context) {
    final pct   = result.percentage;
    final grade = result.grade ?? '\u2014';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.workspace_premium_rounded, color: AppColors.primary, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(result.subjectName, style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                Text(result.examName,    style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textSecondary)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(pct != null ? '${pct.toStringAsFixed(0)}%' : '\u2014',
                  style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              Text('Grade: $grade', style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textSecondary)),
            ],
          ),
        ],
      ),
    );
  }
}

class _NoticeRow extends StatelessWidget {
  final StudentNotice notice;
  const _NoticeRow({required this.notice});

  Color _priorityColor(String p) {
    switch (p.toLowerCase()) {
      case 'urgent': return AppColors.error;
      case 'high':   return AppColors.warning;
      case 'normal': return AppColors.info;
      default:       return AppColors.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    final pc = _priorityColor(notice.priority);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: pc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
            child: Icon(Icons.campaign_rounded, color: pc, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(notice.title, style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                if (notice.message != null && notice.message!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(notice.message!, maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.dmSans(fontSize: 12, color: AppColors.textSecondary)),
                  ),
                const SizedBox(height: 4),
                Text(DateFormatter.formatString(notice.createdAt), style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textMuted)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(color: pc.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
            child: Text(notice.priority.toUpperCase(), style: GoogleFonts.dmSans(fontSize: 9, fontWeight: FontWeight.w700, color: pc)),
          ),
        ],
      ),
    );
  }
}

class _ListSkeleton extends StatelessWidget {
  final int rows;
  const _ListSkeleton({required this.rows});
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(rows, (_) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        height: 60,
        decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
      )),
    );
  }
}
