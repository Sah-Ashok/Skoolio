/// Attendance summary returned by /api/attendance/me/summary
class AttendanceSummary {
  final int totalDays;
  final int presentDays;
  final int absentDays;
  final double attendancePercentage;

  const AttendanceSummary({
    required this.totalDays,
    required this.presentDays,
    required this.absentDays,
    required this.attendancePercentage,
  });

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) {
    final total   = _toInt(json['total_days']   ?? json['totalDays']);
    final present = _toInt(json['present_days'] ?? json['presentDays']);
    final absent  = _toInt(json['absent_days']  ?? json['absentDays']);
    final double pct = json['attendance_percentage'] != null
        ? _toDouble(json['attendance_percentage'])
        : (total > 0 ? (present / total) * 100 : 0.0);
    return AttendanceSummary(
      totalDays:            total,
      presentDays:          present,
      absentDays:           absent,
      attendancePercentage: pct,
    );
  }

  String get formattedPercentage =>
      '${attendancePercentage.toStringAsFixed(1)}%';
}

/// Simplified fee overview derived from /api/fees/me/collections
class FeeOverview {
  final double totalDue;
  final double totalPaid;
  final double overdueDue;

  const FeeOverview({
    required this.totalDue,
    required this.totalPaid,
    required this.overdueDue,
  });

  bool get isCleared => overdueDue <= 0 && totalDue <= 0;

  factory FeeOverview.fromJson(Map<String, dynamic> json) {
    return FeeOverview(
      totalDue:  _toDouble(json['total_due']      ?? json['totalDue']  ?? json['pending_amount'] ?? 0),
      totalPaid: _toDouble(json['total_paid']     ?? json['totalPaid'] ?? json['paid_amount']    ?? 0),
      overdueDue:_toDouble(json['overdue_amount'] ?? json['overdueDue'] ?? 0),
    );
  }

  factory FeeOverview.fromList(List<Map<String, dynamic>> list) {
    double totalDue = 0, totalPaid = 0, overdueDue = 0;
    final now = DateTime.now();
    for (final item in list) {
      // Skoolio API returns remaining_amount / paid_amount / total_amount
      final remaining = _toDouble(
          item['remaining_amount'] ?? item['due_amount'] ?? item['amount_due'] ?? 0);
      final paid = _toDouble(
          item['paid_amount'] ?? item['amount_paid'] ?? 0);
      final status = item['status']?.toString().toLowerCase() ?? '';
      // Skip already settled bills
      if (status == 'paid' || status == 'waived') continue;
      totalDue  += remaining;
      totalPaid += paid;
      // Overdue: still unpaid AND past due date
      final rawDue = item['due_date']?.toString();
      if (remaining > 0 && rawDue != null && rawDue.isNotEmpty) {
        try {
          final dueDate = DateTime.parse(rawDue);
          if (dueDate.isBefore(now)) overdueDue += remaining;
        } catch (_) {}
      }
    }
    return FeeOverview(
        totalDue: totalDue, totalPaid: totalPaid, overdueDue: overdueDue);
  }
}

/// Single exam result row from /api/exams/my-results
class ExamResult {
  final int id;
  final String subjectName;
  final String examName;
  final double? marksObtained;
  final double? totalMarks;
  final String? grade;
  final String? remarks;

  const ExamResult({
    required this.id,
    required this.subjectName,
    required this.examName,
    this.marksObtained,
    this.totalMarks,
    this.grade,
    this.remarks,
  });

  double? get percentage => (marksObtained != null && totalMarks != null && totalMarks! > 0)
      ? (marksObtained! / totalMarks!) * 100
      : null;

  factory ExamResult.fromJson(Map<String, dynamic> j) => ExamResult(
        id:            _toInt(j['id']),
        subjectName:   j['subject_name']?.toString() ?? j['subject']?.toString() ?? 'Subject',
        examName:      j['exam_name']?.toString()    ?? j['exam']?.toString()    ?? 'Exam',
        marksObtained: _toDoubleNullable(j['marks_obtained'] ?? j['marksObtained']),
        totalMarks:    _toDoubleNullable(j['total_marks']    ?? j['totalMarks']),
        grade:         j['grade']?.toString(),
        remarks:       j['remarks']?.toString(),
      );
}

/// A single notice row from /api/notices/student
class StudentNotice {
  final int id;
  final String title;
  final String? message;
  final String priority; // 'urgent' | 'high' | 'normal' | 'low'
  final String createdAt;

  const StudentNotice({
    required this.id,
    required this.title,
    this.message,
    required this.priority,
    required this.createdAt,
  });

  factory StudentNotice.fromJson(Map<String, dynamic> j) => StudentNotice(
        id:        _toInt(j['id']),
        title:     j['title']?.toString()      ?? '',
        message:   j['message']?.toString(),
        priority:  j['priority']?.toString()   ?? 'normal',
        createdAt: j['created_at']?.toString() ?? '',
      );
}

// ── helpers ───────────────────────────────────────────────────────────────────
int    _toInt(dynamic v)           => v is int    ? v : int.tryParse(v?.toString()    ?? '0') ?? 0;
double _toDouble(dynamic v)        => v is double ? v : double.tryParse(v?.toString() ?? '0') ?? 0.0;
double? _toDoubleNullable(dynamic v) {
  if (v == null) return null;
  if (v is double) return v;
  return double.tryParse(v.toString());
}
