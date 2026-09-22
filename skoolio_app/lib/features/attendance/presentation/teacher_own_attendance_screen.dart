import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_loader.dart';
import '../../../core/widgets/app_bottom_nav_bar.dart';
import '../data/teacher_attendance_repository.dart';

class TeacherOwnAttendanceScreen extends ConsumerStatefulWidget {
  const TeacherOwnAttendanceScreen({super.key});

  @override
  ConsumerState<TeacherOwnAttendanceScreen> createState() => _TeacherOwnAttendanceScreenState();
}

class _TeacherOwnAttendanceScreenState extends ConsumerState<TeacherOwnAttendanceScreen> {
  DateTime _currentMonth = DateTime.now();
  bool _isLoading = true;
  Map<String, dynamic>? _yearlySummary;
  Map<String, dynamic>? _monthlyData;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final repo = ref.read(teacherAttendanceRepositoryProvider);

    try {
      final results = await Future.wait([
        repo.getTeacherOwnAttendanceYearly(),
        repo.getTeacherOwnAttendanceMonthly(
          year: _currentMonth.year,
          month: _currentMonth.month,
        ),
      ]);

      setState(() {
        _yearlySummary = results[0];
        _monthlyData = results[1];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  void _prevMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
    _fetchData();
  }

  void _nextMonth() {
    final now = DateTime.now();
    if (_currentMonth.year >= now.year && _currentMonth.month >= now.month) return;
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
    _fetchData();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      bottomNavigationBar: const AppHorizontalNavBar(currentRoute: '/teacher/attendance/own'),
      appBar: AppBar(
        title: const Text('My Attendance', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchData,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const AppLoader(text: 'Loading your attendance...', size: AppLoaderSize.lg)
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
                        const SizedBox(height: 12),
                        Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _fetchData,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Yearly KPI Overview ──
                    _buildYearlyOverviewCard(),
                    const SizedBox(height: 18),

                    // ── Month Selector ──
                    _buildMonthSelector(),
                    const SizedBox(height: 14),

                    // ── Monthly Records ──
                    _buildMonthlyRecordsList(),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildYearlyOverviewCard() {
    final y = _yearlySummary ?? {};
    final present = y['total_present'] ?? 0;
    final absent = y['total_absent'] ?? 0;
    final working = y['total_working_days'] ?? 0;
    final pct = y['attendance_percentage'] != null ? '${y['attendance_percentage']}%' : '—';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.analytics_outlined, size: 20, color: Color(0xFFF97316)),
              ),
              const SizedBox(width: 10),
              const Text(
                'Annual Attendance Overview',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  label: 'Working Days',
                  value: '$working',
                  color: const Color(0xFF0F172A),
                  bg: const Color(0xFFF1F5F9),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Present',
                  value: '$present',
                  color: AppColors.success,
                  bg: AppColors.successLight,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Absent',
                  value: '$absent',
                  color: AppColors.error,
                  bg: AppColors.errorLight,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Rate',
                  value: pct,
                  color: const Color(0xFF0284C7),
                  bg: const Color(0xFFE0F2FE),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required Color color,
    required Color bg,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: color.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMonthSelector() {
    final now = DateTime.now();
    final isLatest = _currentMonth.year >= now.year && _currentMonth.month >= now.month;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded, color: AppColors.textPrimary),
            onPressed: _prevMonth,
          ),
          Text(
            DateFormat('MMMM yyyy').format(_currentMonth),
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.textPrimary),
          ),
          IconButton(
            icon: Icon(
              Icons.chevron_right_rounded,
              color: isLatest ? AppColors.textMuted : AppColors.textPrimary,
            ),
            onPressed: isLatest ? null : _nextMonth,
          ),
        ],
      ),
    );
  }

  Widget _buildMonthlyRecordsList() {
    final records = _monthlyData?['records'] as List? ?? [];

    if (records.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Icon(Icons.event_busy_outlined, size: 40, color: Colors.grey.shade300),
            const SizedBox(height: 10),
            const Text(
              'No attendance records found for this month.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'Daily Log (${records.length} days logged)',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textSecondary),
          ),
        ),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: records.length,
          itemBuilder: (context, index) {
            final rec = records[index] as Map<String, dynamic>;
            final dateStr = rec['date']?.toString() ?? '';
            final status = rec['status']?.toString().toLowerCase() ?? 'present';
            final remarks = rec['remarks']?.toString();

            DateTime? parsedDate;
            try {
              parsedDate = DateTime.parse(dateStr);
            } catch (_) {}

            final formattedDate = parsedDate != null
                ? DateFormat('EEE, MMM dd, yyyy').format(parsedDate)
                : dateStr;

            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          formattedDate,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                        ),
                        if (remarks != null && remarks.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            remarks,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                        ],
                      ],
                    ),
                  ),
                  _buildStatusBadge(status),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg;
    Color fg;
    String label;

    switch (status) {
      case 'present':
        bg = AppColors.successLight;
        fg = AppColors.success;
        label = 'Present';
        break;
      case 'absent':
        bg = AppColors.errorLight;
        fg = AppColors.error;
        label = 'Absent';
        break;
      case 'half_day':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFD97706);
        label = 'Half Day';
        break;
      case 'leave':
        bg = const Color(0xFFF3EEFF);
        fg = const Color(0xFF7C3AED);
        label = 'Leave';
        break;
      default:
        bg = const Color(0xFFF1F5F9);
        fg = const Color(0xFF64748B);
        label = status.toUpperCase();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 12,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
