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

  TeacherSection({
    required this.id,
    required this.name,
    required this.classId,
    required this.className,
    required this.isCoordinator,
  });

  factory TeacherSection.fromJson(Map<String, dynamic> json) {
    return TeacherSection(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: json['section_name']?.toString() ?? json['name']?.toString() ?? '',
      classId: json['class_id'] is int ? json['class_id'] : int.tryParse(json['class_id']?.toString() ?? '0') ?? 0,
      className: json['class_name']?.toString() ?? '',
      isCoordinator: json['is_coordinator'] == true || json['role']?.toString().toLowerCase() == 'coordinator',
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
