import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_loader.dart';
import '../../../core/widgets/app_bottom_nav_bar.dart';
import '../../auth/presentation/auth_providers.dart';

class StudentAttendanceScreen extends ConsumerStatefulWidget {
  const StudentAttendanceScreen({super.key});

  @override
  ConsumerState<StudentAttendanceScreen> createState() => _StudentAttendanceScreenState();
}

class _StudentAttendanceScreenState extends ConsumerState<StudentAttendanceScreen> {
  DateTime _currentMonth = DateTime.now();
  bool _isLoading = true;
  Map<String, dynamic>? _yearlySummary;
  List<dynamic> _monthlyRecords = [];
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

    final client = ref.read(apiClientProvider);

    try {
      final summaryFuture = client.get(ApiConstants.studentAttendanceSummary);
      final monthlyFuture = client.get(
        '${ApiConstants.studentAttendanceMonthly}?year=${_currentMonth.year}&month=${_currentMonth.month}',
      );

      final results = await Future.wait([summaryFuture, monthlyFuture]);

      final summaryRes = results[0];
      final monthlyRes = results[1];

      Map<String, dynamic>? summary;
      if (summaryRes is Map<String, dynamic>) {
        summary = summaryRes['data'] is Map<String, dynamic>
            ? summaryRes['data'] as Map<String, dynamic>
            : summaryRes;
      }

      List<dynamic> records = [];
      if (monthlyRes is List) {
        records = monthlyRes;
      } else if (monthlyRes is Map<String, dynamic>) {
        final raw = monthlyRes['records'] ?? monthlyRes['data'];
        if (raw is List) records = raw;
      }

      setState(() {
        _yearlySummary = summary;
        _monthlyRecords = records;
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
      bottomNavigationBar: const AppHorizontalNavBar(currentRoute: '/student/attendance'),
      appBar: AppBar(
        title: const Text(
          'My Attendance',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchData,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const AppLoader(text: 'Loading attendance records...', size: AppLoaderSize.lg)
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
                  color: AppColors.accent,
                  onRefresh: _fetchData,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Annual Summary Card ──
                        _buildAnnualSummaryCard(),
                        const SizedBox(height: 18),

                        // ── Month Selector ──
                        _buildMonthSelector(),
                        const SizedBox(height: 14),

                        // ── Selected Month Breakdown ──
                        _buildMonthBreakdownRow(),
                        const SizedBox(height: 14),

                        // ── Daily Records ──
                        _buildDailyRecordsList(),
                        const SizedBox(height: 18),

                        // ── Status Legend ──
                        _buildLegend(),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildAnnualSummaryCard() {
    final y = _yearlySummary ?? {};
    final present = y['total_present'] ?? y['present_days'] ?? 0;
    final absent = y['total_absent'] ?? y['absent_days'] ?? 0;
    final working = y['total_working_days'] ?? y['working_days'] ?? 0;
    final pct = y['attendance_percentage'] ?? y['percentage'];
    final pctStr = pct != null ? '$pct%' : '—';

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
                'Full-Year Attendance Summary',
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
                  color: const Color(0xFF16A34A),
                  bg: const Color(0xFFDCFCE7),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Absent',
                  value: '$absent',
                  color: const Color(0xFFDC2626),
                  bg: const Color(0xFFFEE2E2),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Rate',
                  value: pctStr,
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
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: color,
              ),
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

  Widget _buildMonthBreakdownRow() {
    int mPresent = 0;
    int mAbsent = 0;
    int mLeave = 0;
    int mSuspended = 0;

    for (final r in _monthlyRecords) {
      final st = (r['status'] ?? '').toString().toLowerCase();
      if (st == 'present') {
        mPresent++;
      } else if (st == 'absent') {
        mAbsent++;
      } else if (st == 'leave') {
        mLeave++;
      } else if (st == 'suspended') {
        mSuspended++;
      }
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildMiniStat('Present', '$mPresent', const Color(0xFF16A34A)),
          _buildMiniStat('Absent', '$mAbsent', const Color(0xFFDC2626)),
          _buildMiniStat('Leave', '$mLeave', const Color(0xFF7C3AED)),
          _buildMiniStat('Suspended', '$mSuspended', const Color(0xFF0284C7)),
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String count, Color color) {
    return Column(
      children: [
        Text(
          count,
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: color),
        ),
        Text(
          label,
          style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildDailyRecordsList() {
    if (_monthlyRecords.isEmpty) {
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
            'Daily Attendance Log (${_monthlyRecords.length} entries)',
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.textSecondary),
          ),
        ),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _monthlyRecords.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final rec = _monthlyRecords[index] as Map<String, dynamic>;
            final dateStr = rec['date']?.toString() ?? '';
            final status = rec['status']?.toString().toLowerCase() ?? 'present';
            final remarks = rec['remarks']?.toString();

            DateTime? parsedDate;
            try {
              parsedDate = DateTime.parse(dateStr);
            } catch (_) {}

            final formattedDate = parsedDate != null
                ? DateFormat('EEEE, MMM dd, yyyy').format(parsedDate)
                : dateStr;

            final statusConfig = _getStatusConfig(status);

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: statusConfig.bg,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      statusConfig.short,
                      style: TextStyle(
                        color: statusConfig.color,
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          formattedDate,
                          style: const TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (remarks != null && remarks.trim().isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            remarks,
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFF64748B),
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusConfig.bg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: statusConfig.border),
                    ),
                    child: Text(
                      statusConfig.label,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: statusConfig.color,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildLegend() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Status Legend',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF475569)),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: [
              _buildLegendItem('Present (P)', const Color(0xFF16A34A)),
              _buildLegendItem('Absent (A)', const Color(0xFFDC2626)),
              _buildLegendItem('Leave (Lv)', const Color(0xFF7C3AED)),
              _buildLegendItem('Suspended (Su)', const Color(0xFF0284C7)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  _StatusConfig _getStatusConfig(String status) {
    switch (status) {
      case 'present':
        return const _StatusConfig(
          label: 'Present',
          short: 'P',
          color: Color(0xFF16A34A),
          bg: Color(0xFFDCFCE7),
          border: Color(0xFF86EFAC),
        );
      case 'absent':
        return const _StatusConfig(
          label: 'Absent',
          short: 'A',
          color: Color(0xFFDC2626),
          bg: Color(0xFFFEE2E2),
          border: Color(0xFFFCA5A5),
        );
      case 'suspended':
        return const _StatusConfig(
          label: 'Suspended',
          short: 'Su',
          color: Color(0xFF0284C7),
          bg: Color(0xFFE0F2FE),
          border: Color(0xFF7DD3FC),
        );
      case 'leave':
        return const _StatusConfig(
          label: 'Leave',
          short: 'Lv',
          color: Color(0xFF7C3AED),
          bg: Color(0xFFF3EEFF),
          border: Color(0xFFDDD6FE),
        );
      default:
        return const _StatusConfig(
          label: 'Unknown',
          short: '?',
          color: Color(0xFF64748B),
          bg: Color(0xFFF1F5F9),
          border: Color(0xFFCBD5E1),
        );
    }
  }
}

class _StatusConfig {
  final String label;
  final String short;
  final Color color;
  final Color bg;
  final Color border;

  const _StatusConfig({
    required this.label,
    required this.short,
    required this.color,
    required this.bg,
    required this.border,
  });
}
