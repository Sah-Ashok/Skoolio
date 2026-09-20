import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/domain/models.dart';
import '../../features/auth/presentation/auth_providers.dart';

class NavItem {
  final String title;
  final String route;
  final IconData activeIcon;
  final IconData inactiveIcon;
  final bool isAction;

  const NavItem({
    required this.title,
    required this.route,
    required this.activeIcon,
    required this.inactiveIcon,
    this.isAction = false,
  });
}

/// A horizontally scrollable navigation bar that matches 1-to-1 with the web portal sidebar links.
class AppHorizontalNavBar extends ConsumerStatefulWidget {
  final String currentRoute;

  const AppHorizontalNavBar({
    super.key,
    required this.currentRoute,
  });

  static const List<NavItem> teacherNavItems = [
    NavItem(
      title: 'Dashboard',
      route: '/teacher-dashboard',
      activeIcon: Icons.dashboard_rounded,
      inactiveIcon: Icons.dashboard_outlined,
    ),
    NavItem(
      title: 'Timetable',
      route: '/teacher/timetable',
      activeIcon: Icons.calendar_view_week_rounded,
      inactiveIcon: Icons.calendar_view_week_outlined,
    ),
    NavItem(
      title: 'Mark Attend.',
      route: '/teacher/attendance',
      activeIcon: Icons.assignment_turned_in_rounded,
      inactiveIcon: Icons.assignment_turned_in_outlined,
    ),
    NavItem(
      title: 'Register',
      route: '/teacher/attendance/register',
      activeIcon: Icons.table_chart_rounded,
      inactiveIcon: Icons.table_chart_outlined,
    ),
    NavItem(
      title: 'My Attend.',
      route: '/teacher/attendance/own',
      activeIcon: Icons.co_present_rounded,
      inactiveIcon: Icons.co_present_outlined,
    ),
    NavItem(
      title: 'Students',
      route: '/teacher/students',
      activeIcon: Icons.groups_rounded,
      inactiveIcon: Icons.groups_outlined,
    ),
    NavItem(
      title: 'Results',
      route: '/teacher/results',
      activeIcon: Icons.edit_note_rounded,
      inactiveIcon: Icons.edit_note_outlined,
    ),
    NavItem(
      title: 'Calendar',
      route: '/teacher/calendar',
      activeIcon: Icons.calendar_month_rounded,
      inactiveIcon: Icons.calendar_month_outlined,
    ),
    NavItem(
      title: 'Notices',
      route: '/teacher/notices',
      activeIcon: Icons.campaign_rounded,
      inactiveIcon: Icons.campaign_outlined,
    ),
    NavItem(
      title: 'Salary',
      route: '/teacher/salary',
      activeIcon: Icons.payments_rounded,
      inactiveIcon: Icons.payments_outlined,
    ),
    NavItem(
      title: 'Profile',
      route: '/teacher/profile',
      activeIcon: Icons.person_rounded,
      inactiveIcon: Icons.person_outline_rounded,
    ),
    NavItem(
      title: 'Sign Out',
      route: 'logout',
      activeIcon: Icons.logout_rounded,
      inactiveIcon: Icons.logout_rounded,
      isAction: true,
    ),
  ];

  static const List<NavItem> studentNavItems = [
    NavItem(
      title: 'Dashboard',
      route: '/student-dashboard',
      activeIcon: Icons.dashboard_rounded,
      inactiveIcon: Icons.dashboard_outlined,
    ),
    NavItem(
      title: 'Timetable',
      route: '/student/timetable',
      activeIcon: Icons.calendar_view_week_rounded,
      inactiveIcon: Icons.calendar_view_week_outlined,
    ),
    NavItem(
      title: 'Attendance',
      route: '/student/attendance',
      activeIcon: Icons.assignment_turned_in_rounded,
      inactiveIcon: Icons.assignment_turned_in_outlined,
    ),
    NavItem(
      title: 'Results',
      route: '/student/results',
      activeIcon: Icons.fact_check_rounded,
      inactiveIcon: Icons.fact_check_outlined,
    ),
    NavItem(
      title: 'Fee Status',
      route: '/student/fees',
      activeIcon: Icons.receipt_long_rounded,
      inactiveIcon: Icons.receipt_long_outlined,
    ),
    NavItem(
      title: 'Notices',
      route: '/student/notices',
      activeIcon: Icons.campaign_rounded,
      inactiveIcon: Icons.campaign_outlined,
    ),
    NavItem(
      title: 'Calendar',
      route: '/student/calendar',
      activeIcon: Icons.calendar_month_rounded,
      inactiveIcon: Icons.calendar_month_outlined,
    ),
    NavItem(
      title: 'Profile',
      route: '/student/profile',
      activeIcon: Icons.person_rounded,
      inactiveIcon: Icons.person_outline_rounded,
    ),
    NavItem(
      title: 'Sign Out',
      route: 'logout',
      activeIcon: Icons.logout_rounded,
      inactiveIcon: Icons.logout_rounded,
      isAction: true,
    ),
  ];

  @override
  ConsumerState<AppHorizontalNavBar> createState() => _AppHorizontalNavBarState();
}

class _AppHorizontalNavBarState extends ConsumerState<AppHorizontalNavBar> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToActiveItem();
    });
  }

  @override
  void didUpdateWidget(covariant AppHorizontalNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentRoute != widget.currentRoute) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollToActiveItem();
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToActiveItem() {
    if (!_scrollController.hasClients) return;
    final user = ref.read(authStateProvider).user;
    final items = user?.role == UserRole.faculty
        ? AppHorizontalNavBar.teacherNavItems
        : AppHorizontalNavBar.studentNavItems;

    final index = items.indexWhere((it) => it.route == widget.currentRoute);
    if (index > 2) {
      final targetOffset = (index - 1.5) * 80.0;
      _scrollController.animateTo(
        targetOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 22),
            SizedBox(width: 8),
            Text(
              'Sign Out',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        content: const Text(
          'Are you sure you want to sign out of your account?',
          style: TextStyle(fontSize: 14, color: Color(0xFF475569)),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text(
              'Cancel',
              style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              foregroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authStateProvider.notifier).logout();
              if (context.mounted) {
                context.go('/login');
              }
            },
            child: const Text(
              'Sign Out',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  void _onItemTap(BuildContext context, WidgetRef ref, NavItem item) {
    if (item.isAction && item.route == 'logout') {
      _confirmLogout(context, ref);
      return;
    }
    if (item.route == widget.currentRoute) {
      return;
    }
    if (item.route == '/teacher-dashboard' || item.route == '/student-dashboard') {
      context.go(item.route);
    } else {
      context.push(item.route);
    }
  }

  Widget _buildNavItem(BuildContext context, WidgetRef ref, NavItem item, bool isActive) {
    const brandColor = Color(0xFFF97316);
    const inactiveColor = Color(0xFF64748B);
    final iconColor = isActive ? brandColor : (item.isAction ? const Color(0xFFEF4444) : inactiveColor);
    final textColor = isActive ? brandColor : (item.isAction ? const Color(0xFFEF4444) : inactiveColor);

    return Container(
      width: 76,
      margin: const EdgeInsets.symmetric(horizontal: 2),
      child: InkWell(
        onTap: () => _onItemTap(context, ref, item),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Active top indicator
              Container(
                width: 28,
                height: 3,
                decoration: BoxDecoration(
                  color: isActive ? brandColor : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 3),
              // Icon with pill highlight if active
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: isActive ? const Color(0xFFFFF7ED) : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  isActive ? item.activeIcon : item.inactiveIcon,
                  color: iconColor,
                  size: 20,
                ),
              ),
              const SizedBox(height: 2),
              // Text label
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    item.title,
                    maxLines: 1,
                    style: TextStyle(
                      color: textColor,
                      fontSize: 10.5,
                      fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final items = user?.role == UserRole.faculty
        ? AppHorizontalNavBar.teacherNavItems
        : AppHorizontalNavBar.studentNavItems;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 62,
          child: SingleChildScrollView(
            controller: _scrollController,
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: items.map((item) {
                final isActive = item.route == widget.currentRoute;
                return _buildNavItem(context, ref, item, isActive);
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }
}
