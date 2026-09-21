import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_loader.dart';
import '../../attendance/data/teacher_attendance_repository.dart';

class TeacherStudentDetailScreen extends ConsumerStatefulWidget {
  final int studentId;
  final String? studentName;

  const TeacherStudentDetailScreen({
    super.key,
    required this.studentId,
    this.studentName,
  });

  @override
  ConsumerState<TeacherStudentDetailScreen> createState() => _TeacherStudentDetailScreenState();
}

class _TeacherStudentDetailScreenState extends ConsumerState<TeacherStudentDetailScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _student;
  Map<String, dynamic>? _attendanceSummary;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final repo = ref.read(teacherAttendanceRepositoryProvider);

    try {
      final now = DateTime.now();
      final results = await Future.wait([
        repo.getStudentDetails(widget.studentId),
        repo.getStudentMonthlyAttendance(
          studentId: widget.studentId,
          year: now.year,
          month: now.month,
        ),
      ]);

      setState(() {
        _student = results[0];
        _attendanceSummary = results[1];
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = e.toString();
      });
    }
  }

  String _initials(String? name) {
    if (name == null || name.trim().isEmpty) return '?';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          widget.studentName ?? _student?['full_name'] ?? 'Student Profile',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _fetchDetails,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const AppLoader(text: 'Loading student details...', size: AppLoaderSize.lg)
          : _errorMessage != null && _student == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: AppColors.error),
                        const SizedBox(height: 12),
                        Text(
                          'Failed to load student: $_errorMessage',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _fetchDetails,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Try Again'),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchDetails,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Hero Profile Card ──
                        _buildHeroCard(),
                        const SizedBox(height: 16),

                        // ── Attendance Overview Card ──
                        _buildAttendanceCard(),
                        const SizedBox(height: 16),

                        // ── Guardian & Contact Card ──
                        _buildGuardianCard(),
                        const SizedBox(height: 16),

                        // ── Residence & Student Contact Card ──
                        _buildContactCard(),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildHeroCard() {
    final s = _student ?? {};
    final fullName = s['full_name']?.toString() ?? widget.studentName ?? 'Unknown Student';
    final gender = s['gender']?.toString().toLowerCase() ?? '';
    final isMale = gender == 'male';
    final isFemale = gender == 'female';

    final avatarBg = isMale
        ? const Color(0xFFE0F2FE)
        : isFemale
            ? const Color(0xFFFCE7F3)
            : const Color(0xFFF1F5F9);
    final avatarColor = isMale
        ? const Color(0xFF0284C7)
        : isFemale
            ? const Color(0xFFDB2777)
            : AppColors.primary;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(18),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 30,
                  backgroundColor: avatarBg,
                  child: Text(
                    _initials(fullName),
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: avatarColor,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        fullName,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          if (gender.isNotEmpty)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: avatarBg,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                gender[0].toUpperCase() + gender.substring(1),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: avatarColor,
                                ),
                              ),
                            ),
                          if (s['admission_number'] != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              'Adm: ${s['admission_number']}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (s['blood_group'] != null || s['date_of_birth'] != null || s['nationality'] != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFFFAFAFA),
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
                border: Border(top: BorderSide(color: AppColors.divider)),
              ),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (s['blood_group'] != null && s['blood_group'].toString().isNotEmpty)
                    _buildChip(
                      icon: Icons.bloodtype,
                      label: s['blood_group'].toString(),
                      color: const Color(0xFFDC2626),
                      bg: const Color(0xFFFEE2E2),
                    ),
                  if (s['date_of_birth'] != null && s['date_of_birth'].toString().isNotEmpty)
                    _buildChip(
                      icon: Icons.cake_outlined,
                      label: _formatDate(s['date_of_birth'].toString()),
                      color: const Color(0xFFD97706),
                      bg: const Color(0xFFFEF3C7),
                    ),
                  if (s['nationality'] != null && s['nationality'].toString().isNotEmpty)
                    _buildChip(
                      icon: Icons.flag_outlined,
                      label: s['nationality'].toString(),
                      color: const Color(0xFF2563EB),
                      bg: const Color(0xFFDBEAFE),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildChip({
    required IconData icon,
    required String label,
    required Color color,
    required Color bg,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAttendanceCard() {
    final att = _attendanceSummary ?? {};
    final totalPresent = att['total_present'] ?? att['present_days'] ?? 0;
    final totalAbsent = att['total_absent'] ?? att['absent_days'] ?? 0;
    final totalLeave = att['total_leave'] ?? att['leave_days'] ?? 0;
    final totalDays = totalPresent + totalAbsent + totalLeave;
    final pct = totalDays > 0 ? ((totalPresent / totalDays) * 100).toStringAsFixed(1) : '—';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(18),
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
                child: const Icon(Icons.calendar_month, size: 18, color: AppColors.accent),
              ),
              const SizedBox(width: 10),
              const Text(
                'This Month Attendance',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: AppColors.textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  label: 'Present',
                  value: '$totalPresent',
                  color: AppColors.success,
                  bg: AppColors.successLight,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricTile(
                  label: 'Absent',
                  value: '$totalAbsent',
                  color: AppColors.error,
                  bg: AppColors.errorLight,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricTile(
                  label: 'Rate',
                  value: pct == '—' ? '—' : '$pct%',
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
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: color.withValues(alpha: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGuardianCard() {
    final s = _student ?? {};
    final guardianName = s['guardian_name']?.toString();
    final relation = s['guardian_relation']?.toString();
    final phone = s['guardian_phone']?.toString();
    final email = s['guardian_email']?.toString();
    final occupation = s['guardian_occupation']?.toString();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardHeader(Icons.family_restroom, 'Guardian & Primary Contact'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
            child: Column(
              children: [
                _buildInfoRow(Icons.person_outline, 'Guardian Name', guardianName),
                _buildInfoRow(Icons.people_outline, 'Relation', relation),
                _buildInfoRow(Icons.phone_outlined, 'Phone', phone),
                _buildInfoRow(Icons.email_outlined, 'Email', email),
                _buildInfoRow(Icons.work_outline, 'Occupation', occupation),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContactCard() {
    final s = _student ?? {};
    final address = [s['guardian_address'], s['city'], s['state'], s['country']]
        .where((e) => e != null && e.toString().trim().isNotEmpty)
        .join(', ');
    final studentPhone = s['phone']?.toString();
    final studentEmail = s['email']?.toString();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCardHeader(Icons.location_on_outlined, 'Residence & Contact'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
            child: Column(
              children: [
                _buildInfoRow(Icons.home_outlined, 'Address', address.isNotEmpty ? address : null),
                _buildInfoRow(Icons.phone_android_outlined, 'Student Phone', studentPhone),
                _buildInfoRow(Icons.alternate_email_outlined, 'Student Email', studentEmail),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCardHeader(IconData icon, String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 18, color: AppColors.accent),
          ),
          const SizedBox(width: 10),
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: AppColors.textPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String? value) {
    final isEmpty = value == null || value.trim().isEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: isEmpty ? AppColors.textMuted : AppColors.textSecondary),
          const SizedBox(width: 12),
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
            ),
          ),
          Expanded(
            child: Text(
              isEmpty ? '—' : value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: isEmpty ? AppColors.textMuted : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return DateFormat('MMM dd, yyyy').format(d);
    } catch (_) {
      return iso;
    }
  }
}
