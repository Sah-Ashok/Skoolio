enum AttendanceStatus {
  present,
  absent,
  leave;

  static AttendanceStatus fromString(String? str) {
    switch (str?.toLowerCase()) {
      case 'absent':
        return AttendanceStatus.absent;
      case 'leave':
        return AttendanceStatus.leave;
      case 'present':
      default:
        return AttendanceStatus.present;
    }
  }

  String get shortLabel {
    switch (this) {
      case AttendanceStatus.present:
        return 'P';
      case AttendanceStatus.absent:
        return 'A';
      case AttendanceStatus.leave:
        return 'Lv';
    }
  }

  String get displayLabel {
    switch (this) {
      case AttendanceStatus.present:
        return 'Present';
      case AttendanceStatus.absent:
        return 'Absent';
      case AttendanceStatus.leave:
        return 'Leave';
    }
  }
}

class TeacherSection {
  final int id;
  final String name;
  final int classId;
  final String className;
  final bool isCoordinator;
  final int? academicYearId;

  TeacherSection({
    required this.id,
    required this.name,
    required this.classId,
    required this.className,
    required this.isCoordinator,
    this.academicYearId,
  });

  factory TeacherSection.fromJson(Map<String, dynamic> json) {
    return TeacherSection(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: json['section_name']?.toString() ?? json['name']?.toString() ?? '',
      classId: json['class_id'] is int ? json['class_id'] : int.tryParse(json['class_id']?.toString() ?? '0') ?? 0,
      className: json['class_name']?.toString() ?? '',
      isCoordinator: json['is_coordinator'] == true || json['role']?.toString().toLowerCase() == 'coordinator',
      academicYearId: json['academic_year_id'] is int
          ? json['academic_year_id'] as int
          : int.tryParse(json['academic_year_id']?.toString() ?? ''),
    );
  }

  String get displayName => '$className - $name';
}

class StudentAttendanceItem {
  final int studentId;
  final String fullName;
  final String? rollNumber;
  final String? photoUrl;
  AttendanceStatus status;
  String? remarks;

  StudentAttendanceItem({
    required this.studentId,
    required this.fullName,
    this.rollNumber,
    this.photoUrl,
    this.status = AttendanceStatus.present,
    this.remarks,
  });

  factory StudentAttendanceItem.fromJson(Map<String, dynamic> json) {
    final sId = json['student_id'] ?? json['id'];
    return StudentAttendanceItem(
      studentId: sId is int ? sId : int.tryParse(sId?.toString() ?? '0') ?? 0,
      fullName: json['full_name']?.toString() ?? json['student_name']?.toString() ?? 'Student',
      rollNumber: json['roll_number']?.toString(),
      photoUrl: json['photo']?.toString() ?? json['photo_url']?.toString(),
      status: AttendanceStatus.fromString(json['status']?.toString()),
      remarks: json['remarks']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'student_id': studentId,
      'status': status.name,
      'remarks': remarks,
    };
  }
}

class SectionRegisterStudent {
  final int studentId;
  final String fullName;
  final String? rollNumber;
  final Map<String, String> byDate;
  int monthPresent;
  int monthAbsent;
  int monthLeave;
  int monthTotal;
  final int yearPresent;
  final int yearAbsent;
  final int yearLeave;
  final int yearTotal;

  SectionRegisterStudent({
    required this.studentId,
    required this.fullName,
    this.rollNumber,
    required this.byDate,
    this.monthPresent = 0,
    this.monthAbsent = 0,
    this.monthLeave = 0,
    this.monthTotal = 0,
    this.yearPresent = 0,
    this.yearAbsent = 0,
    this.yearLeave = 0,
    this.yearTotal = 0,
  });

  double get monthAttendancePct =>
      monthTotal > 0 ? (monthPresent / monthTotal) * 100 : 0.0;

  double get yearAttendancePct =>
      yearTotal > 0 ? (yearPresent / yearTotal) * 100 : 0.0;
}

List<SectionRegisterStudent> parseRegisterRows(List<Map<String, dynamic>> rows) {
  final map = <int, SectionRegisterStudent>{};
  for (final r in rows) {
    final sId = r['student_id'] is int
        ? r['student_id'] as int
        : int.tryParse(r['student_id']?.toString() ?? '0') ?? 0;
    if (sId == 0) continue;

    if (!map.containsKey(sId)) {
      map[sId] = SectionRegisterStudent(
        studentId: sId,
        fullName: r['full_name']?.toString() ?? 'Student',
        rollNumber: r['roll_number']?.toString(),
        byDate: {},
        yearPresent: int.tryParse(r['year_present']?.toString() ?? '0') ?? 0,
        yearAbsent: int.tryParse(r['year_absent']?.toString() ?? '0') ?? 0,
        yearLeave: int.tryParse(r['year_leave']?.toString() ?? '0') ?? 0,
        yearTotal: int.tryParse(r['year_total']?.toString() ?? '0') ?? 0,
      );
    }

    final rawDate = r['date']?.toString();
    final rawStatus = r['status']?.toString().toLowerCase();
    if (rawDate != null && rawStatus != null && rawStatus.isNotEmpty) {
      final dateStr = rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
      final statusStr = rawStatus == 'late' ? 'present' : rawStatus;
      map[sId]!.byDate[dateStr] = statusStr;
    }
  }

  final students = map.values.toList();
  students.sort((a, b) {
    final ra = int.tryParse(a.rollNumber ?? '9999') ?? 9999;
    final rb = int.tryParse(b.rollNumber ?? '9999') ?? 9999;
    if (ra != rb) return ra.compareTo(rb);
    return a.fullName.compareTo(b.fullName);
  });

  for (final s in students) {
    s.monthPresent = s.byDate.values.where((st) => st == 'present').length;
    s.monthAbsent = s.byDate.values.where((st) => st == 'absent').length;
    s.monthLeave = s.byDate.values.where((st) => st == 'leave').length;
    s.monthTotal = s.byDate.length;
  }

  return students;
}
