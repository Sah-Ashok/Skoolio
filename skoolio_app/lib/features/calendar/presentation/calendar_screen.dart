import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_loader.dart';
import '../../../core/utils/date_formatter.dart';
import '../data/calendar_repository.dart';
import '../domain/calendar_models.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _selectedMonth;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _selectedMonth = DateTime(now.year, now.month, 1);
  }

  void _changeMonth(int delta) {
    setState(() {
      _selectedMonth = DateTime(_selectedMonth.year, _selectedMonth.month + delta, 1);
    });
  }

  String get _monthYearLabel => DateFormat('MMMM yyyy').format(_selectedMonth);

  void _showDayDetails(CalendarDayCell cell) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        final dateFormatted = DateFormat('EEEE, MMMM d, yyyy').format(cell.date);

        Color bannerBg;
        Color bannerText;
        IconData bannerIcon;
        String bannerStatus;

        if (cell.isOffOrHoliday) {
          bannerBg = const Color(0xFFFEE2E2);
          bannerText = const Color(0xFF991B1B);
          bannerIcon = Icons.beach_access_rounded;
          bannerStatus = 'School Closed (Holiday / Off Day)';
        } else if (cell.isEarlyClosing) {
          bannerBg = const Color(0xFFF3E8FF);
          bannerText = const Color(0xFF6B21A8);
          bannerIcon = Icons.schedule_rounded;
          bannerStatus = 'Early Closing Day';
        } else if (cell.isEvent) {
          bannerBg = const Color(0xFFE0E7FF);
          bannerText = const Color(0xFF3730A3);
          bannerIcon = Icons.campaign_rounded;
          bannerStatus = 'Special School Event / Activity';
        } else {
          bannerBg = const Color(0xFFECFDF5);
          bannerText = const Color(0xFF065F46);
          bannerIcon = Icons.check_circle_rounded;
          bannerStatus = 'Regular School Working Day';
        }

        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Date Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          dateFormatted,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (cell.isToday)
                          const Padding(
                            padding: EdgeInsets.only(top: 2),
                            child: Text(
                              'Today',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.accent,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20, color: AppColors.textSecondary),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Status banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: bannerBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    Icon(bannerIcon, size: 20, color: bannerText),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        bannerStatus,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: bannerText,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // Event label & description (if any)
              if (cell.label != null && cell.label!.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'EVENT / ENTRY',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        cell.label!,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      if (cell.description != null && cell.description!.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          cell.description!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final calendarAsync = ref.watch(calendarBundleProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Academic Calendar',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.today_rounded),
            tooltip: 'Go to Current Month',
            onPressed: () {
              final now = DateTime.now();
              setState(() {
                _selectedMonth = DateTime(now.year, now.month, 1);
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Calendar',
            onPressed: () => ref.invalidate(calendarBundleProvider),
          ),
        ],
      ),
      body: calendarAsync.when(
        loading: () => const AppLoader(text: 'Loading calendar...', size: AppLoaderSize.lg),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                const Text(
                  'Failed to load calendar',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 6),
                Text(
                  err.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.invalidate(calendarBundleProvider),
                  child: const Text('Try Again'),
                ),
              ],
            ),
          ),
        ),
        data: (bundle) {
          final stats = bundle.calculateMonthStats(_selectedMonth.year, _selectedMonth.month);
          final grid = bundle.buildMonthGrid(_selectedMonth.year, _selectedMonth.month);
          final monthEvents = bundle.getMonthEvents(_selectedMonth.year, _selectedMonth.month);

          return RefreshIndicator(
            color: AppColors.accent,
            onRefresh: () async => ref.refresh(calendarBundleProvider.future),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Top Month Switcher ──
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.chevron_left_rounded, size: 28),
                          tooltip: 'Previous Month',
                          onPressed: () => _changeMonth(-1),
                        ),
                        Column(
                          children: [
                            Text(
                              _monthYearLabel,
                              style: const TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w900,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'School schedule & events',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.chevron_right_rounded, size: 28),
                          tooltip: 'Next Month',
                          onPressed: () => _changeMonth(1),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── Top Stats Strip (3 KPI Cards) ──
                  Row(
                    children: [
                      _buildKpiCard(
                        title: 'Working Days',
                        value: '${stats.workingDays}',
                        sublabel: _monthYearLabel,
                        icon: Icons.calendar_today_rounded,
                        accentColor: const Color(0xFF166534),
                        bgColor: const Color(0xFFF0FDF4),
                        borderColor: const Color(0xFFBBF7D0),
                      ),
                      const SizedBox(width: 8),
                      _buildKpiCard(
                        title: 'Holidays / Off',
                        value: '${stats.holidaysAndOff}',
                        sublabel: 'Weekly off + declared',
                        icon: Icons.beach_access_rounded,
                        accentColor: const Color(0xFF991B1B),
                        bgColor: const Color(0xFFFEE2E2),
                        borderColor: const Color(0xFFFECDD3),
                      ),
                      const SizedBox(width: 8),
                      _buildKpiCard(
                        title: 'Events',
                        value: '${stats.schoolEvents}',
                        sublabel: 'School activities',
                        icon: Icons.campaign_rounded,
                        accentColor: const Color(0xFF1E40AF),
                        bgColor: const Color(0xFFEFF6FF),
                        borderColor: const Color(0xFFBFDBFE),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // ── Calendar Legend / Key ──
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          const Text(
                            'Key: ',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                          ),
                          _buildLegendDot(const Color(0xFFB42318), 'Off / Holiday'),
                          const SizedBox(width: 12),
                          _buildLegendDot(const Color(0xFF3B5BDB), 'School Event'),
                          const SizedBox(width: 12),
                          _buildLegendDot(const Color(0xFF7C3AED), 'Early Closing'),
                          const SizedBox(width: 12),
                          _buildLegendDot(AppColors.accent, 'Today'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // ── 7-Column Monthly Calendar Grid ──
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
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
                      children: [
                        // Weekday Headers
                        Row(
                          children: const [
                            Expanded(child: _WeekdayHeader('Mon')),
                            Expanded(child: _WeekdayHeader('Tue')),
                            Expanded(child: _WeekdayHeader('Wed')),
                            Expanded(child: _WeekdayHeader('Thu')),
                            Expanded(child: _WeekdayHeader('Fri')),
                            Expanded(child: _WeekdayHeader('Sat')),
                            Expanded(child: _WeekdayHeader('Sun')),
                          ],
                        ),
                        const Divider(height: 12, color: AppColors.border),

                        // Grid Rows
                        ..._buildGridRows(grid),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Weekly Off Schedule Card ──
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFFED7AA)),
                          ),
                          child: const Icon(
                            Icons.wb_sunny_outlined,
                            size: 18,
                            color: Color(0xFFEA580C),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Weekly Off Schedule',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                bundle.getWeeklyOffSummary(),
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFFC2410C),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // ── Monthly Entries Section ──
                  const Text(
                    'Monthly Entries & Activities',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),

                  if (monthEvents.isEmpty)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        children: const [
                          Icon(Icons.event_available_rounded, size: 36, color: AppColors.textMuted),
                          SizedBox(height: 8),
                          Text(
                            'No special entries for this month',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Only regular working days and weekly offs are scheduled.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    )
                  else
                    ...monthEvents.map((ev) {
                      Color tagColor;
                      Color tagBg;
                      Color tagBorder;
                      IconData tagIcon;
                      String typeName;

                      if (ev.isHoliday) {
                        tagColor = const Color(0xFF991B1B);
                        tagBg = const Color(0xFFFEE2E2);
                        tagBorder = const Color(0xFFFECDD3);
                        tagIcon = Icons.beach_access_rounded;
                        typeName = 'HOLIDAY';
                      } else if (ev.isEarlyClosing) {
                        tagColor = const Color(0xFF6B21A8);
                        tagBg = const Color(0xFFF3E8FF);
                        tagBorder = const Color(0xFFE9D5FF);
                        tagIcon = Icons.schedule_rounded;
                        typeName = 'EARLY CLOSING';
                      } else {
                        tagColor = const Color(0xFF1E40AF);
                        tagBg = const Color(0xFFEFF6FF);
                        tagBorder = const Color(0xFFBFDBFE);
                        tagIcon = Icons.campaign_rounded;
                        typeName = 'EVENT';
                      }

                      final startFmt = DateFormatter.formatString(
                        ev.startDate.toIso8601String(),
                        pattern: 'MMM d',
                      );
                      final endFmt = DateFormatter.formatString(
                        ev.endDate.toIso8601String(),
                        pattern: 'MMM d, yyyy',
                      );
                      final isSingleDay = ev.startDate.isAtSameMomentAs(ev.endDate);
                      final dateRange = isSingleDay
                          ? DateFormatter.formatString(ev.startDate.toIso8601String(), pattern: 'MMM d, yyyy')
                          : '$startFmt – $endFmt';

                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Material(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(14),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: () {
                              _showDayDetails(CalendarDayCell(
                                date: ev.startDate,
                                dayNumber: ev.startDate.day,
                                type: ev.eventType,
                                label: ev.title,
                                description: ev.description,
                              ));
                            },
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 36,
                                    height: 36,
                                    decoration: BoxDecoration(
                                      color: tagBg,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: tagBorder),
                                    ),
                                    child: Icon(tagIcon, size: 18, color: tagColor),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: tagBg,
                                                borderRadius: BorderRadius.circular(4),
                                                border: Border.all(color: tagBorder),
                                              ),
                                              child: Text(
                                                typeName,
                                                style: TextStyle(
                                                  fontSize: 9,
                                                  fontWeight: FontWeight.bold,
                                                  color: tagColor,
                                                ),
                                              ),
                                            ),
                                            const Spacer(),
                                            Text(
                                              dateRange,
                                              style: const TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w600,
                                                color: AppColors.textSecondary,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          ev.title,
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w800,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        if (ev.description != null && ev.description!.isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            ev.description!,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              color: AppColors.textSecondary,
                                              height: 1.35,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  List<Widget> _buildGridRows(List<CalendarDayCell> cells) {
    final rows = <Widget>[];
    for (int i = 0; i < cells.length; i += 7) {
      final chunk = cells.sublist(i, (i + 7 > cells.length) ? cells.length : i + 7);
      rows.add(
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            children: chunk.map((cell) {
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: _CalendarDayCellWidget(
                    cell: cell,
                    onTap: () {
                      if (!cell.isMuted) {
                        _showDayDetails(cell);
                      }
                    },
                  ),
                ),
              );
            }).toList(),
          ),
        ),
      );
    }
    return rows;
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String sublabel,
    required IconData icon,
    required Color accentColor,
    required Color bgColor,
    required Color borderColor,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: borderColor),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: accentColor,
                  ),
                ),
                Icon(icon, size: 16, color: accentColor),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              title,
              style: const TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              sublabel,
              style: const TextStyle(
                fontSize: 9,
                color: AppColors.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendDot(Color color, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(
          text,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
      ],
    );
  }
}

class _WeekdayHeader extends StatelessWidget {
  final String label;
  const _WeekdayHeader(this.label);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}

class _CalendarDayCellWidget extends StatelessWidget {
  final CalendarDayCell cell;
  final VoidCallback onTap;

  const _CalendarDayCellWidget({
    required this.cell,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    if (cell.isMuted) {
      return Container(
        height: 52,
        decoration: BoxDecoration(
          color: const Color(0xFFFAFAFA),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text(
            '${cell.dayNumber}',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: Color(0xFFCBD5E1),
            ),
          ),
        ),
      );
    }

    Color cellBg = Colors.white;
    Color cellBorder = const Color(0xFFE2E8F0);
    Color textColor = AppColors.textPrimary;
    String? badgeLabel;
    Color? badgeColor;

    if (cell.isOffOrHoliday) {
      cellBg = const Color(0xFFFEE2E2);
      cellBorder = const Color(0xFFFECDD3);
      textColor = const Color(0xFF991B1B);
      badgeLabel = cell.isWeeklyOff ? 'Off' : 'Holiday';
      badgeColor = const Color(0xFFB42318);
    } else if (cell.isEarlyClosing) {
      cellBg = const Color(0xFFF3E8FF);
      cellBorder = const Color(0xFFE9D5FF);
      textColor = const Color(0xFF6B21A8);
      badgeLabel = 'Early';
      badgeColor = const Color(0xFF7C3AED);
    } else if (cell.isEvent) {
      cellBg = const Color(0xFFE0E7FF);
      cellBorder = const Color(0xFFC7D2FE);
      textColor = const Color(0xFF3730A3);
      badgeLabel = 'Event';
      badgeColor = const Color(0xFF3B5BDB);
    }

    if (cell.isToday) {
      cellBorder = AppColors.accent;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 52,
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        decoration: BoxDecoration(
          color: cellBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: cellBorder,
            width: cell.isToday ? 1.8 : 1.0,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '${cell.dayNumber}',
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: cell.isToday ? FontWeight.w900 : FontWeight.w700,
                    color: cell.isToday ? AppColors.accent : textColor,
                  ),
                ),
                if (cell.isToday) ...[
                  const SizedBox(width: 2),
                  Container(
                    width: 5,
                    height: 5,
                    decoration: const BoxDecoration(
                      color: AppColors.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
            if (badgeLabel != null) ...[
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 1),
                decoration: BoxDecoration(
                  color: badgeColor!.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(3),
                ),
                child: Text(
                  badgeLabel,
                  style: TextStyle(
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                    color: badgeColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
