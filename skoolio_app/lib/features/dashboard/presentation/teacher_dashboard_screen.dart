import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';
import '../domain/teacher_dashboard_model.dart';
import 'dashboard_providers.dart';

class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Sign Out', style: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
        content: Text(
          'Are you sure you want to sign out of your teacher portal?',
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
    final authState = ref.watch(authStateProvider);
    final user      = authState.user;

    final attendanceAsync = ref.watch(teacherAttendanceSummaryProvider);
    final noticesAsync    = ref.watch(teacherNoticesProvider);

    final subjectCount = user?.subjects.length ?? 0;
    final sectionCount = user?.sections.length ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(8), border: Border.all(color: AppColors.border)),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                'assets/Logo.png',
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Container(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  child: const Icon(Icons.co_present_rounded, color: AppColors.primary, size: 20),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user?.schoolName ?? 'Skoolio',
                    style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.2)),
                Text('Faculty Portal', style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textSecondary)),
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
          ref.invalidate(teacherAttendanceSummaryProvider);
          ref.invalidate(teacherNoticesProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Profile Card ──────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppColors.primary, AppColors.primaryDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.28), blurRadius: 20, offset: const Offset(0, 8))],
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 30,
                      backgroundColor: AppColors.accent,
                      child: Text(
                        (user?.fullName.isNotEmpty == true) ? user!.fullName[0].toUpperCase() : 'T',
                        style: GoogleFonts.dmSans(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textOnAccent),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(user?.fullName ?? 'Faculty Member',
                              style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -0.3)),
                          const SizedBox(height: 4),
                          Text(user?.email ?? 'Faculty Account',
                              style: GoogleFonts.dmSans(fontSize: 13, color: Colors.white.withValues(alpha: 0.8))),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(6)),
                                child: Text(
                                  user?.status == 'active' ? 'Active Faculty' : (user?.status?.toUpperCase() ?? 'Faculty'),
                                  style: GoogleFonts.dmSans(fontSize: 11, color: Colors.white, fontWeight: FontWeight.w500),
                                ),
                              ),
                              if (user?.employeeId != null) ...[
                                const SizedBox(width: 6),
                                Text('ID: ${user!.employeeId}', style: GoogleFonts.dmSans(fontSize: 11, color: Colors.white.withValues(alpha: 0.6))),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // ── KPI Stat Cards ────────────────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: attendanceAsync.when(
                      loading: () => const _StatCardSkeleton(),
                      error: (_, __) => const _StatCard(label: 'My Attendance', value: '\u2014', icon: Icons.how_to_reg_rounded, color: AppColors.success),
                      data: (s) => _StatCard(label: 'My Attendance', value: s?.formattedPercentage ?? '\u2014', icon: Icons.how_to_reg_rounded, color: AppColors.success),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: _StatCard(label: 'Sections', value: '$sectionCount', icon: Icons.groups_rounded, color: const Color(0xFF3B82F6))),
                  const SizedBox(width: 10),
                  Expanded(child: _StatCard(label: 'Subjects', value: '$subjectCount', icon: Icons.menu_book_rounded, color: const Color(0xFF8B5CF6))),
                ],
              ),
              const SizedBox(height: 20),

              // ── Mark Attendance CTA ───────────────────────────────────
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.accent.withValues(alpha: 0.35)),
                  boxShadow: [BoxShadow(color: AppColors.accent.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 4))],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AppColors.accent.withValues(alpha: 0.14), shape: BoxShape.circle),
                      child: const Icon(Icons.how_to_reg_rounded, color: AppColors.accent, size: 28),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("Mark Today's Attendance",
                              style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.2)),
                          const SizedBox(height: 3),
                          Text('Record attendance for your assigned section.',
                              style: GoogleFonts.dmSans(fontSize: 12, color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                    IconButton(
                      style: IconButton.styleFrom(backgroundColor: AppColors.accent, foregroundColor: Colors.white),
                      icon: const Icon(Icons.arrow_forward_rounded, size: 20),
                      onPressed: () => context.push('/teacher/attendance'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── My Subjects Panel ─────────────────────────────────────
              if (subjectCount > 0) ...[
                Text('My Subjects', style: _sectionTitle),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: (user?.subjects ?? []).map((s) => _Chip(label: s.name)).toList(),
                ),
                const SizedBox(height: 24),
              ],

              // ── My Sections Panel ─────────────────────────────────────
              if (sectionCount > 0) ...[
                Text('My Sections', style: _sectionTitle),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8, runSpacing: 8,
                  children: (user?.sections ?? [])
                      .map((s) => _Chip(label: s.className != null ? '${s.className} \u2013 ${s.name}' : s.name))
                      .toList(),
                ),
                const SizedBox(height: 24),
              ],

              // ── Teacher Operations Grid ───────────────────────────────
              Text('Teacher Operations', style: _sectionTitle),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.4,
                children: const [
                  _TeacherActionCard(title: 'My Sections',  subtitle: 'Student roster & profiles',  icon: Icons.groups_rounded,             color: Color(0xFF3B82F6), route: null),
                  _TeacherActionCard(title: 'Enter Marks',  subtitle: 'Exams & evaluations',         icon: Icons.edit_note_rounded,          color: Color(0xFF10B981), route: null),
                  _TeacherActionCard(title: 'My Timetable', subtitle: 'Class & lecture periods',     icon: Icons.calendar_view_week_rounded, color: Color(0xFF8B5CF6), route: '/teacher/timetable'),
                  _TeacherActionCard(title: 'Post Notice',  subtitle: 'Section announcements',       icon: Icons.campaign_rounded,           color: Color(0xFFEC4899), route: '/teacher/notices'),
                ],
              ),
              const SizedBox(height: 24),

              // ── Live Notices ──────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Recent Notices', style: _sectionTitle),
                  TextButton(onPressed: () => context.push('/teacher/notices'), child: const Text('See all')),
                ],
              ),
              const SizedBox(height: 8),
              noticesAsync.when(
                loading: () => const _ListSkeleton(rows: 2),
                error: (_, __) => _emptyCard('Could not load notices.'),
                data: (notices) => notices.isEmpty
                    ? _emptyCard('No notices at this time.')
                    : Column(children: notices.map((n) => _TeacherNoticeRow(notice: n)).toList()),
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

final _sectionTitle = GoogleFonts.dmSans(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.textPrimary, letterSpacing: -0.2);

Widget _emptyCard(String msg) => Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Center(child: Text(msg, style: GoogleFonts.dmSans(fontSize: 13, color: AppColors.textMuted))),
    );

// ── Sub-widgets ───────────────────────────────────────────────────────────────

class _StatCardSkeleton extends StatelessWidget {
  const _StatCardSkeleton();
  @override
  Widget build(BuildContext context) => Container(
        height: 72,
        decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(14)),
      );
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value, style: GoogleFonts.dmSans(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.textPrimary, letterSpacing: -0.4)),
            const SizedBox(height: 2),
            Text(label, style: GoogleFonts.dmSans(fontSize: 10, color: AppColors.textSecondary)),
          ],
        ),
      );
}

class _Chip extends StatelessWidget {
  final String label;
  const _Chip({required this.label});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
        ),
        child: Text(label, style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.primary)),
      );
}

class _TeacherActionCard extends StatelessWidget {
  final String title, subtitle;
  final IconData icon;
  final Color color;
  final String? route;

  const _TeacherActionCard({required this.title, required this.subtitle, required this.icon, required this.color, required this.route});

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
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: effectiveColor.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                      child: Icon(icon, color: effectiveColor, size: 22),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: isAvailable ? AppColors.textPrimary : AppColors.textMuted, letterSpacing: -0.2)),
                        const SizedBox(height: 2),
                        Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textSecondary)),
                      ],
                    ),
                  ],
                ),
              ),
              if (!isAvailable)
                Positioned(
                  top: 6, right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
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

class _TeacherNoticeRow extends StatelessWidget {
  final TeacherNotice notice;
  const _TeacherNoticeRow({required this.notice});

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
  Widget build(BuildContext context) => Column(
        children: List.generate(rows, (_) => Container(
          margin: const EdgeInsets.only(bottom: 8),
          height: 60,
          decoration: BoxDecoration(color: AppColors.surfaceVariant, borderRadius: BorderRadius.circular(12)),
        )),
      );
}
