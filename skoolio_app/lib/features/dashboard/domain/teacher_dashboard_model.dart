// Models for teacher dashboard live data (attendance, notices).
// Subject/section counts come directly from UserModel.subjects / .sections
// which are populated from /auth/me — no separate API call needed.

class TeacherAttendanceSummary {
  final int totalPresent;
  final int totalAbsent;

  const TeacherAttendanceSummary({
    required this.totalPresent,
    required this.totalAbsent,
  });

  int get total => totalPresent + totalAbsent;

  /// null when no records exist yet (avoids showing "0%")
  double? get attendancePercentage =>
      total > 0 ? (totalPresent / total) * 100 : null;

  String get formattedPercentage =>
      attendancePercentage != null
          ? '${attendancePercentage!.toStringAsFixed(0)}%'
          : '—';

  factory TeacherAttendanceSummary.fromJson(Map<String, dynamic> j) {
    return TeacherAttendanceSummary(
      totalPresent: _toInt(j['total_present'] ?? j['totalPresent']),
      totalAbsent:  _toInt(j['total_absent']  ?? j['totalAbsent']),
    );
  }
}

class TeacherNotice {
  final int id;
  final String title;
  final String? message;
  final String priority; // 'urgent' | 'high' | 'normal' | 'low'
  final String createdAt;

  const TeacherNotice({
    required this.id,
    required this.title,
    this.message,
    required this.priority,
    required this.createdAt,
  });

  factory TeacherNotice.fromJson(Map<String, dynamic> j) => TeacherNotice(
        id:        _toInt(j['id']),
        title:     j['title']?.toString() ?? '',
        message:   j['message']?.toString(),
        priority:  j['priority']?.toString() ?? 'normal',
        createdAt: j['created_at']?.toString() ?? '',
      );
}

int _toInt(dynamic v) =>
    v is int ? v : int.tryParse(v?.toString() ?? '0') ?? 0;
