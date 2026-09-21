import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/widgets/app_bottom_nav_bar.dart';
import '../../attendance/data/teacher_attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../auth/presentation/auth_providers.dart';
import '../../notices/presentation/notices_screen.dart';
import '../../timetable/data/timetable_repository.dart';

final teacherSalarySummaryProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.teacherSalary);
    if (res is Map<String, dynamic>) return res;
    if (res is List && res.isNotEmpty) return res.first as Map<String, dynamic>;
  } catch (_) {}
  return null;
});

class TeacherDashboardScreen extends ConsumerWidget {
  const TeacherDashboardScreen({super.key});

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

  String _formatTeacherName(String? name) {
    if (name == null || name.trim().isEmpty) return 'Sir Teacher';
    final trimmed = name.trim();
    final lower = trimmed.toLowerCase();
    if (lower.startsWith('sir') ||
        lower.startsWith('dr.') ||
        lower.startsWith('dr ') ||
        lower.startsWith('prof') ||
        lower.startsWith('mr.') ||
        lower.startsWith('mr ') ||
        lower.startsWith('mrs.') ||
        lower.startsWith('ms.') ||
        lower.startsWith('madam')) {
      return trimmed;
    }
    return 'Sir $trimmed';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;
    final sectionsAsync = ref.watch(teacherSectionsProvider);
    final academicYearAsync = ref.watch(activeAcademicYearProvider);
    final yearlyAttendanceAsync = ref.watch(teacherYearlyAttendanceProvider);
    final noticesAsync = ref.watch(noticesListProvider);
    final timetableAsync = ref.watch(teacherTimetableProvider);

    final now = DateTime.now();
    final greetingText = _getGreetingText(now.hour);
    final greetingIcon = _getGreetingIcon(now.hour);
    final teacherName = _formatTeacherName(user?.fullName);
    final schoolName = (user?.schoolName != null && user!.schoolName!.isNotEmpty)
        ? user.schoolName!
        : 'Golu Patshala';

    final academicYearName = academicYearAsync.maybeWhen(
      data: (data) => data?['year_name']?.toString() ?? data?['name']?.toString() ?? '2026-2027',
      orElse: () => '2026-2027',
    );

    final sections = sectionsAsync.maybeWhen(
      data: (data) => data,
      orElse: () => <TeacherSection>[],
    );

    final notices = noticesAsync.maybeWhen(
      data: (data) => data,
      orElse: () => <dynamic>[],
    );

    // Extract subjects from timetable
    final List<String> subjects = timetableAsync.maybeWhen(
      data: (schedule) {
        final set = <String>{};
        for (final slot in schedule.allSlots) {
          if (slot.subjectName != null && slot.subjectName!.trim().isNotEmpty) {
            set.add(slot.subjectName!.trim());
          }
        }
        return set.isNotEmpty ? set.toList() : ['Computer', 'Science'];
      },
      orElse: () => ['Computer', 'Science'],
    );

    final yearlyAttendance = yearlyAttendanceAsync.maybeWhen(
      data: (data) => data,
      orElse: () => null,
    );

    final attendanceDisplayValue = (yearlyAttendance != null &&
            (yearlyAttendance['total_marked'] ?? 0) > 0 &&
            yearlyAttendance['attendance_percentage'] != null)
        ? '${yearlyAttendance['attendance_percentage']}%'
        : '——';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      // No Navbar / AppBar as per requirement
      body: SafeArea(
        child: RefreshIndicator(
          color: const Color(0xFFF97316),
          onRefresh: () async {
            ref.invalidate(teacherSectionsProvider);
            ref.invalidate(activeAcademicYearProvider);
            ref.invalidate(teacherYearlyAttendanceProvider);
            ref.invalidate(noticesListProvider);
            ref.invalidate(teacherTimetableProvider);
            ref.invalidate(teacherSalarySummaryProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Top Header Section ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // School Name
                      Text(
                        schoolName,
                        style: const TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFFF97316),
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Dynamic Greeting Row with SVG Icon
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          SvgPicture.asset(
                            greetingIcon,
                            width: 26,
                            height: 26,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            greetingText,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),

                      // Teacher Name
                      Text(
                        teacherName,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Badges Row: [ 📅 2026-2027 ] [ • active ]
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFE2E8F0)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.calendar_month_outlined, size: 13, color: Color(0xFF475569)),
                                const SizedBox(width: 5),
                                Text(
                                  academicYearName,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF475569),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: const [
                                Text(
                                  '• ',
                                  style: TextStyle(
                                    color: Color(0xFF16A34A),
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  'active',
                                  style: TextStyle(
                                    color: Color(0xFF16A34A),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // ── 4 KPI Summary Cards (2x2 Grid) ──
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: () => context.push('/teacher/attendance/own'),
                              borderRadius: BorderRadius.circular(14),
                              child: _buildKpiCard(
                                icon: Icons.calendar_month_outlined,
                                title: 'ATTENDANCE',
                                value: attendanceDisplayValue,
                                subtitle: '• This year',
                                accentColor: const Color(0xFFF97316),
                                subtitleDotColor: const Color(0xFF16A34A),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildKpiCard(
                              icon: Icons.assignment_outlined,
                              title: 'SECTIONS',
                              value: '${sections.length}',
                              subtitle: 'Section coordinator',
                              accentColor: const Color(0xFF16A34A),
                              valueColor: const Color(0xFF16A34A),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: _buildKpiCard(
                              icon: Icons.menu_book_outlined,
                              title: 'SUBJECTS',
                              value: '${subjects.length}',
                              subtitle: 'Assigned subjects',
                              accentColor: const Color(0xFF2563EB),
                              valueColor: const Color(0xFF2563EB),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildKpiCard(
                              icon: Icons.notifications_none_outlined,
                              title: 'NOTICES',
                              value: '${notices.length}',
                              subtitle: notices.isEmpty ? 'Nothing new' : '${notices.length} active',
                              accentColor: const Color(0xFF9333EA),
                              valueColor: const Color(0xFF9333EA),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // ── QUICK ACCESS Section ──
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.bolt_rounded, size: 16, color: Color(0xFF94A3B8)),
                          SizedBox(width: 4),
                          Text(
                            'QUICK ACCESS',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF94A3B8),
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 12,
                        crossAxisSpacing: 12,
                        childAspectRatio: 1.32,
                        children: [
                          _buildQuickAccessTile(
                            context,
                            title: 'Mark Attendance',
                            icon: Icons.assignment_turned_in_outlined,
                            iconColor: const Color(0xFFF97316),
                            route: '/teacher/attendance',
                          ),
                          _buildQuickAccessTile(
                            context,
                            title: 'My Students',
                            icon: Icons.groups_outlined,
                            iconColor: const Color(0xFF6366F1),
                            route: '/teacher/students',
                          ),
                          _buildQuickAccessTile(
                            context,
                            title: 'Enter Results',
                            icon: Icons.edit_note_rounded,
                            iconColor: const Color(0xFF10B981),
                            route: '/teacher/results',
                          ),
                          _buildQuickAccessTile(
                            context,
                            title: 'My Attendance',
                            icon: Icons.co_present_outlined,
                            iconColor: const Color(0xFF0D9488),
                            route: '/teacher/attendance/own',
                          ),
                          _buildQuickAccessTile(
                            context,
                            title: 'My Salary',
                            icon: Icons.payments_outlined,
                            iconColor: const Color(0xFFF59E0B),
                            route: '/teacher/salary',
                          ),
                          _buildQuickAccessTile(
                            context,
                            title: 'Calendar',
                            icon: Icons.calendar_month_outlined,
                            iconColor: const Color(0xFF3B82F6),
                            route: '/teacher/calendar',
                          ),
                          _buildQuickAccessTile(
                            context,
                            title: 'Notices',
                            icon: Icons.campaign_outlined,
                            iconColor: const Color(0xFFEF4444),
                            route: '/teacher/notices',
                          ),
                          _buildQuickAccessTile(
                            context,
                            title: 'Profile',
                            icon: Icons.person_outline_rounded,
                            iconColor: const Color(0xFFEC4899),
                            route: '/teacher/profile',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ── NOTICES Section ──
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
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
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: const [
                                Icon(Icons.campaign_outlined, size: 16, color: Color(0xFF94A3B8)),
                                SizedBox(width: 6),
                                Text(
                                  'NOTICES',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF94A3B8),
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ],
                            ),
                            InkWell(
                              onTap: () => context.push('/teacher/notices'),
                              child: Row(
                                children: const [
                                  Text(
                                    'See all ',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF2563EB),
                                    ),
                                  ),
                                  Icon(Icons.chevron_right_rounded, size: 14, color: Color(0xFF2563EB)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        if (notices.isEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Column(
                              children: const [
                                Icon(Icons.notifications_off_outlined, size: 28, color: Color(0xFFCBD5E1)),
                                SizedBox(height: 6),
                                Text(
                                  'No notices right now',
                                  style: TextStyle(
                                    color: Color(0xFF94A3B8),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          )
                        else
                          Column(
                            children: notices.take(2).map((notice) {
                              final title = notice['title']?.toString() ?? 'Notice';
                              final isPinned = notice['is_pinned'] == true;
                              return Container(
                                margin: const EdgeInsets.only(top: 8),
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFE2E8F0)),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      isPinned ? Icons.push_pin_rounded : Icons.info_outline_rounded,
                                      size: 16,
                                      color: const Color(0xFFF97316),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            }).toList(),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // ── MY SECTIONS Section ──
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
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
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: const [
                                Icon(Icons.folder_open_rounded, size: 16, color: Color(0xFF94A3B8)),
                                SizedBox(width: 6),
                                Text(
                                  'MY SECTIONS',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF94A3B8),
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ],
                            ),
                            InkWell(
                              onTap: () => context.push('/teacher/students'),
                              child: Row(
                                children: const [
                                  Text(
                                    'Students ',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFF2563EB),
                                    ),
                                  ),
                                  Icon(Icons.arrow_forward_rounded, size: 14, color: Color(0xFF2563EB)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        if (sections.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Text(
                              'No coordinator sections assigned',
                              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                            ),
                          )
                        else
                          Column(
                            children: sections.map((sec) {
                              final letter = sec.name.isNotEmpty ? sec.name[0].toUpperCase() : 'A';
                              return InkWell(
                                onTap: () => context.push('/teacher/attendance'),
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  margin: const EdgeInsets.only(top: 8),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF8FAFC),
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 34,
                                        height: 34,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF1E293B),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          letter,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.bold,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '${sec.className} — ${sec.name}',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w700,
                                                fontSize: 13,
                                                color: Color(0xFF0F172A),
                                              ),
                                            ),
                                            Text(
                                              sec.isCoordinator ? 'Coordinator' : 'Assigned Teacher',
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: Color(0xFF64748B),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFDCFCE7),
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: const Text(
                                          'Active',
                                          style: TextStyle(
                                            color: Color(0xFF16A34A),
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // ── MY SUBJECTS Section ──
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
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
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: const [
                                Icon(Icons.menu_book_rounded, size: 16, color: Color(0xFF94A3B8)),
                                SizedBox(width: 6),
                                Text(
                                  'MY SUBJECTS',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF94A3B8),
                                    letterSpacing: 0.8,
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '${subjects.length}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Column(
                          children: subjects.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final sub = entry.value;
                            final initial = sub.isNotEmpty ? sub[0].toUpperCase() : 'S';
                            final colors = [
                              const Color(0xFF9333EA),
                              const Color(0xFF0284C7),
                              const Color(0xFF16A34A),
                              const Color(0xFFF97316),
                            ];
                            final bgColors = [
                              const Color(0xFFF3E8FF),
                              const Color(0xFFE0F2FE),
                              const Color(0xFFDCFCE7),
                              const Color(0xFFFFEDD5),
                            ];
                            final color = colors[idx % colors.length];
                            final bgColor = bgColors[idx % bgColors.length];

                            return Container(
                              margin: const EdgeInsets.only(top: 8),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 32,
                                    height: 32,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: bgColor,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      initial,
                                      style: TextStyle(
                                        color: color,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      sub,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // ── Bright Orange Horizontal Divider ──
                Container(
                  height: 3,
                  width: double.infinity,
                  color: const Color(0xFFF97316),
                ),
                const SizedBox(height: 28),

                // ── Footer Brand Section ──
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    children: [
                      // Logo + Cloud Active Pill
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Image.asset(
                            'assets/logo.png',
                            height: 34,
                            errorBuilder: (_, __, ___) => const Text(
                              'Skoolio',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0A3B88),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Text(
                              '• Cloud Active',
                              style: TextStyle(
                                color: Color(0xFF16A34A),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Platform Description
                      const Text(
                        'Everything your school manages — attendance, results, notices, and daily operations — in one seamless, role-aware platform.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 16),

                      // Social Icons Row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _buildSocialButton(Icons.facebook, label: 'f'),
                          const SizedBox(width: 12),
                          _buildSocialButton(Icons.work_outline_rounded, label: 'in'),
                          const SizedBox(width: 12),
                          _buildSocialButton(Icons.chat_bubble_outline_rounded, label: 'wa'),
                          const SizedBox(width: 12),
                          _buildSocialButton(Icons.email_outlined, label: '@'),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // Direct Support Subheading
                      const Text(
                        'DIRECT SUPPORT',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Support Card 1: WhatsApp Instant Chat
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.chat_bubble_rounded,
                                color: Color(0xFF16A34A),
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  'WHATSAPP INSTANT CHAT',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF16A34A),
                                    letterSpacing: 0.8,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  '+977 9713823636',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Support Card 2: Official Email Helpdesk
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFEDD5),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.mail_outline_rounded,
                                color: Color(0xFFF97316),
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text(
                                  'OFFICIAL EMAIL HELPDESK',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFFF97316),
                                    letterSpacing: 0.8,
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'skoolio.support@gmail.com',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Helpdesk link
                      InkWell(
                        onTap: () {},
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.headset_mic_outlined, size: 16, color: Color(0xFFF97316)),
                            SizedBox(width: 6),
                            Text(
                              'Helpdesk & Inquiry Page →',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFF97316),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Copyright & Credits
                      const Text(
                        '© 2026 Skoolio. All rights reserved.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                      ),
                      const SizedBox(height: 4),
                      RichText(
                        text: const TextSpan(
                          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          children: [
                            TextSpan(text: 'Crafted with ❤️ by '),
                            TextSpan(
                              text: '@ZenoSoft.in',
                              style: TextStyle(
                                color: Color(0xFFF97316),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Engineered for modern school management',
                        style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      ),
                      const SizedBox(height: 20),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),

      // ── Custom Horizontally Scrollable Bottom Navigation Bar ──
      bottomNavigationBar: const AppHorizontalNavBar(
        currentRoute: '/teacher-dashboard',
      ),
    );
  }

  // ── KPI Card Widget ──
  Widget _buildKpiCard({
    required IconData icon,
    required String title,
    required String value,
    required String subtitle,
    required Color accentColor,
    Color? valueColor,
    Color? subtitleDotColor,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(color: accentColor, width: 3.5),
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 13, color: const Color(0xFF94A3B8)),
                  const SizedBox(width: 5),
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF94A3B8),
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                value,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: valueColor ?? const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  if (subtitleDotColor != null) ...[
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: subtitleDotColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                  ],
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Quick Access Tile Widget ──
  Widget _buildQuickAccessTile(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Color iconColor,
    required String route,
  }) {
    return InkWell(
      onTap: () => context.push(route),
      borderRadius: BorderRadius.circular(16),
      child: Container(
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
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.07),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: iconColor.withValues(alpha: 0.35),
                  width: 1.2,
                ),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  title,
                  maxLines: 1,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF334155),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Social Button Helper ──
  Widget _buildSocialButton(IconData icon, {required String label}) {
    return Container(
      width: 36,
      height: 36,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        shape: BoxShape.circle,
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontWeight: FontWeight.bold,
          color: Color(0xFF475569),
          fontSize: 13,
        ),
      ),
    );
  }
}
