import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../data/teacher_attendance_repository.dart';
import '../domain/attendance_models.dart';

class TeacherAttendanceRegisterScreen extends ConsumerStatefulWidget {
  final int? initialSectionId;

  const TeacherAttendanceRegisterScreen({super.key, this.initialSectionId});

  @override
  ConsumerState<TeacherAttendanceRegisterScreen> createState() =>
      _TeacherAttendanceRegisterScreenState();
}

class _TeacherAttendanceRegisterScreenState
    extends ConsumerState<TeacherAttendanceRegisterScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  TeacherSection? _selectedSection;
  DateTime _selectedMonth = DateTime(DateTime.now().year, DateTime.now().month, 1);
  bool _isLoading = false;
  String? _errorMessage;
  List<SectionRegisterStudent> _students = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  int get _daysInMonth =>
      DateTime(_selectedMonth.year, _selectedMonth.month + 1, 0).day;

  String get _monthDisplayTitle => DateFormat('MMMM yyyy').format(_selectedMonth);

  void _prevMonth() {
    setState(() {
      _selectedMonth =
          DateTime(_selectedMonth.year, _selectedMonth.month - 1, 1);
    });
    if (_selectedSection != null) {
      _loadRegister();
    }
  }

  void _nextMonth() {
    final now = DateTime.now();
    final next = DateTime(_selectedMonth.year, _selectedMonth.month + 1, 1);
    if (next.isAfter(DateTime(now.year, now.month + 1, 1))) return;
    setState(() {
      _selectedMonth = next;
    });
    if (_selectedSection != null) {
      _loadRegister();
    }
  }

  Future<void> _loadRegister() async {
    if (_selectedSection == null) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final repo = ref.read(teacherAttendanceRepositoryProvider);
    String pad(int n) => n.toString().padLeft(2, '0');
    final startDate =
        '${_selectedMonth.year}-${pad(_selectedMonth.month)}-01';
    final endDate =
        '${_selectedMonth.year}-${pad(_selectedMonth.month)}-${pad(_daysInMonth)}';

    try {
      final rows = await repo.getSectionRegister(
        sectionId: _selectedSection!.id,
        year: _selectedMonth.year,
        month: _selectedMonth.month,
        academicYearId: _selectedSection!.academicYearId,
        startDate: startDate,
        endDate: endDate,
      );

      final parsed = parseRegisterRows(rows);

      setState(() {
        _students = parsed;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load attendance register: $e';
        _isLoading = false;
      });
    }
  }

  double get _sectionAveragePercentage {
    if (_students.isEmpty) return 0.0;
    double total = 0;
    int count = 0;
    for (final s in _students) {
      if (s.monthTotal > 0) {
        total += s.monthAttendancePct;
        count++;
      }
    }
    return count > 0 ? (total / count) : 0.0;
  }

  int get _markedDaysCount {
    final allDates = <String>{};
    for (final s in _students) {
      allDates.addAll(s.byDate.keys);
    }
    return allDates.length;
  }

  @override
  Widget build(BuildContext context) {
    final sectionsAsync = ref.watch(teacherSectionsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        title: const Text(
          'Attendance Register',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.fact_check_outlined, color: Color(0xFFF97316)),
            tooltip: 'Mark Roll',
            onPressed: () => context.push('/teacher/attendance'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF64748B)),
            tooltip: 'Refresh',
            onPressed: () => _loadRegister(),
          ),
        ],
      ),
      body: sectionsAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: Color(0xFFF97316)),
        ),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Error loading sections: $err',
              style: const TextStyle(color: AppColors.error),
            ),
          ),
        ),
        data: (sections) {
          if (sections.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'No assigned sections found for your account.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
                ),
              ),
            );
          }

          // Auto-select initial section
          if (_selectedSection == null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              TeacherSection? match;
              if (widget.initialSectionId != null) {
                match = sections.firstWhere(
                  (s) => s.id == widget.initialSectionId,
                  orElse: () => sections.first,
                );
              } else {
                match = sections.first;
              }
              setState(() => _selectedSection = match);
              _loadRegister();
            });
          }

          return Column(
            children: [
              // Top Section & Month Selection Bar
              Container(
                color: Colors.white,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Column(
                  children: [
                    // Section Selector Dropdown
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<TeacherSection>(
                          isExpanded: true,
                          value: _selectedSection,
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF475569)),
                          items: sections.map((sec) {
                            return DropdownMenuItem<TeacherSection>(
                              value: sec,
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0F172A),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      sec.name.isNotEmpty ? sec.name[0] : 'S',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      '${sec.className} — ${sec.name}',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                  ),
                                  if (sec.isCoordinator)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFDCFCE7),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Text(
                                        'Coordinator',
                                        style: TextStyle(
                                          color: Color(0xFF16A34A),
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          }).toList(),
                          onChanged: (newSec) {
                            if (newSec != null && newSec.id != _selectedSection?.id) {
                              setState(() => _selectedSection = newSec);
                              _loadRegister();
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),

                    // Month Navigation Row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.chevron_left_rounded, color: Color(0xFF334155)),
                          onPressed: _prevMonth,
                          tooltip: 'Previous Month',
                        ),
                        Row(
                          children: [
                            const Icon(Icons.calendar_month_outlined, size: 18, color: Color(0xFFF97316)),
                            const SizedBox(width: 6),
                            Text(
                              _monthDisplayTitle,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.chevron_right_rounded, color: Color(0xFF334155)),
                          onPressed: _nextMonth,
                          tooltip: 'Next Month',
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              // KPI Summary Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                color: Colors.white,
                child: Row(
                  children: [
                    Expanded(
                      child: _buildSummaryCard(
                        title: 'STUDENTS',
                        value: '${_students.length}',
                        color: const Color(0xFF2563EB),
                        icon: Icons.groups_outlined,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildSummaryCard(
                        title: 'MARKED DAYS',
                        value: '$_markedDaysCount',
                        color: const Color(0xFF16A34A),
                        icon: Icons.event_available_outlined,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildSummaryCard(
                        title: 'AVG ATTENDANCE',
                        value: '${_sectionAveragePercentage.toStringAsFixed(1)}%',
                        color: const Color(0xFFF97316),
                        icon: Icons.pie_chart_outline_rounded,
                      ),
                    ),
                  ],
                ),
              ),

              // Tab Bar (Summary vs Sheet View)
              Container(
                color: Colors.white,
                child: TabBar(
                  controller: _tabController,
                  indicatorColor: const Color(0xFFF97316),
                  indicatorWeight: 3,
                  labelColor: const Color(0xFFF97316),
                  unselectedLabelColor: const Color(0xFF64748B),
                  labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  tabs: const [
                    Tab(
                      icon: Icon(Icons.people_alt_outlined, size: 18),
                      text: 'Student Summary',
                    ),
                    Tab(
                      icon: Icon(Icons.table_chart_outlined, size: 18),
                      text: 'Register Sheet',
                    ),
                  ],
                ),
              ),

              const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),

              // Main Tab Content
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: Color(0xFFF97316)),
                      )
                    : _errorMessage != null
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.error_outline_rounded,
                                      size: 40, color: AppColors.error),
                                  const SizedBox(height: 12),
                                  Text(
                                    _errorMessage!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                        color: Color(0xFF64748B), fontSize: 13),
                                  ),
                                  const SizedBox(height: 16),
                                  ElevatedButton(
                                    onPressed: _loadRegister,
                                    child: const Text('Try Again'),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : _students.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: const [
                                    Icon(Icons.assignment_outlined,
                                        size: 48, color: Color(0xFF94A3B8)),
                                    SizedBox(height: 12),
                                    Text(
                                      'No attendance records found for this month.',
                                      style: TextStyle(
                                        color: Color(0xFF64748B),
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              )
                            : TabBarView(
                                controller: _tabController,
                                children: [
                                  _buildStudentSummaryTab(),
                                  _buildRegisterSheetTab(),
                                ],
                              ),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF97316),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.edit_calendar_rounded, size: 18),
                  label: const Text(
                    'Mark Roll for Section',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  onPressed: () => context.push('/teacher/attendance'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryCard({
    required String title,
    required String value,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF64748B),
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  // ── Tab 1: Student Monthly Summary List ──
  Widget _buildStudentSummaryTab() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _students.length,
      itemBuilder: (context, index) {
        final s = _students[index];
        final pct = s.monthAttendancePct;
        final pctColor = pct >= 80
            ? const Color(0xFF16A34A)
            : (pct >= 60 ? const Color(0xFFF59E0B) : const Color(0xFFEF4444));

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      s.rollNumber != null && s.rollNumber!.isNotEmpty
                          ? s.rollNumber!
                          : '${index + 1}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                        color: Color(0xFF334155),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      s.fullName,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: pctColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${pct.toStringAsFixed(0)}%',
                      style: TextStyle(
                        color: pctColor,
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _buildStatusPill(
                    label: 'P',
                    count: s.monthPresent,
                    color: const Color(0xFF16A34A),
                    bgColor: const Color(0xFFDCFCE7),
                  ),
                  const SizedBox(width: 8),
                  _buildStatusPill(
                    label: 'A',
                    count: s.monthAbsent,
                    color: const Color(0xFFEF4444),
                    bgColor: const Color(0xFFFEE2E2),
                  ),
                  const SizedBox(width: 8),
                  _buildStatusPill(
                    label: 'Lv',
                    count: s.monthLeave,
                    color: const Color(0xFFD97706),
                    bgColor: const Color(0xFFFEF3C7),
                  ),
                  const Spacer(),
                  Text(
                    'Year: ${s.yearAttendancePct.toStringAsFixed(0)}%',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatusPill({
    required String label,
    required int count,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: 11,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            '$count',
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  // ── Tab 2: Horizontal Register Grid / Sheet ──
  Widget _buildRegisterSheetTab() {
    String pad(int n) => n.toString().padLeft(2, '0');
    final daysInMonth = _daysInMonth;

    return SingleChildScrollView(
      scrollDirection: Axis.vertical,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Container(
          color: Colors.white,
          child: DataTable(
            headingRowHeight: 44,
            dataRowMinHeight: 40,
            dataRowMaxHeight: 44,
            horizontalMargin: 12,
            columnSpacing: 10,
            headingRowColor: WidgetStateProperty.all(const Color(0xFFF1F5F9)),
            columns: [
              const DataColumn(
                label: Text(
                  'Roll',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    color: Color(0xFF334155),
                  ),
                ),
              ),
              const DataColumn(
                label: Text(
                  'Student',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    color: Color(0xFF334155),
                  ),
                ),
              ),
              const DataColumn(
                label: Text(
                  'Tot',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    color: Color(0xFF334155),
                  ),
                ),
              ),
              // Day columns: 1 to daysInMonth
              ...List.generate(daysInMonth, (index) {
                final dayNum = index + 1;
                final dt = DateTime(_selectedMonth.year, _selectedMonth.month, dayNum);
                final dow = DateFormat('E').format(dt)[0];
                final isWeekend = dt.weekday == DateTime.sunday;
                return DataColumn(
                  label: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$dayNum',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          color: isWeekend
                              ? const Color(0xFFEF4444)
                              : const Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        dow,
                        style: TextStyle(
                          fontSize: 9,
                          color: isWeekend
                              ? const Color(0xFFEF4444)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
            rows: _students.map((student) {
              return DataRow(
                cells: [
                  DataCell(
                    Text(
                      student.rollNumber ?? '—',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        color: Color(0xFF475569),
                      ),
                    ),
                  ),
                  DataCell(
                    SizedBox(
                      width: 110,
                      child: Text(
                        student.fullName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                  ),
                  DataCell(
                    Text(
                      '${student.monthPresent}/${student.monthTotal}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                  ),
                  ...List.generate(daysInMonth, (index) {
                    final dayNum = index + 1;
                    final dateKey =
                        '${_selectedMonth.year}-${pad(_selectedMonth.month)}-${pad(dayNum)}';
                    final status = student.byDate[dateKey];
                    return DataCell(_buildCellBadge(status));
                  }),
                ],
              );
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _buildCellBadge(String? status) {
    if (status == 'present') {
      return Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFFDCFCE7),
          borderRadius: BorderRadius.circular(4),
        ),
        child: const Text(
          'P',
          style: TextStyle(
            color: Color(0xFF16A34A),
            fontWeight: FontWeight.bold,
            fontSize: 11,
          ),
        ),
      );
    } else if (status == 'absent') {
      return Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFFFEE2E2),
          borderRadius: BorderRadius.circular(4),
        ),
        child: const Text(
          'A',
          style: TextStyle(
            color: Color(0xFFEF4444),
            fontWeight: FontWeight.bold,
            fontSize: 11,
          ),
        ),
      );
    } else if (status == 'leave') {
      return Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: const Color(0xFFFEF3C7),
          borderRadius: BorderRadius.circular(4),
        ),
        child: const Text(
          'L',
          style: TextStyle(
            color: Color(0xFFD97706),
            fontWeight: FontWeight.bold,
            fontSize: 11,
          ),
        ),
      );
    }
    return const Center(
      child: Text(
        '—',
        style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11),
      ),
    );
  }
}
