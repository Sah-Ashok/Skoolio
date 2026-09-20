class TimetableSlot {
  final int id;
  final String dayOfWeek;
  final int periodNumber;
  final String startTime;
  final String endTime;
  final bool isBreak;
  final String? title;
  final String? roomNo;
  final String? subjectName;
  final String? subjectCode;
  final String? teacherName;
  final String? className;
  final String? sectionName;

  TimetableSlot({
    required this.id,
    required this.dayOfWeek,
    required this.periodNumber,
    required this.startTime,
    required this.endTime,
    required this.isBreak,
    this.title,
    this.roomNo,
    this.subjectName,
    this.subjectCode,
    this.teacherName,
    this.className,
    this.sectionName,
  });

  factory TimetableSlot.fromJson(Map<String, dynamic> json) {
    return TimetableSlot(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      dayOfWeek: json['day_of_week']?.toString().toLowerCase() ?? 'monday',
      periodNumber: json['period_number'] is int
          ? json['period_number']
          : int.tryParse(json['period_number']?.toString() ?? '1') ?? 1,
      startTime: json['start_time']?.toString() ?? '',
      endTime: json['end_time']?.toString() ?? '',
      isBreak: json['is_break'] == true,
      title: json['title']?.toString(),
      roomNo: json['room_no']?.toString(),
      subjectName: json['subject_name']?.toString(),
      subjectCode: json['subject_code']?.toString(),
      teacherName: json['teacher_name']?.toString(),
      className: json['class_name']?.toString(),
      sectionName: json['section_name']?.toString(),
    );
  }

  String get timeRange => '$startTime - $endTime';
}

class TimetableSchedule {
  final int? academicYearId;
  final List<TimetableSlot> allSlots;
  final Map<String, List<TimetableSlot>> scheduleByDay;

  TimetableSchedule({
    this.academicYearId,
    required this.allSlots,
    required this.scheduleByDay,
  });

  factory TimetableSchedule.fromJson(Map<String, dynamic> json) {
    final rawSlots = json['slots'] as List<dynamic>? ?? [];
    final allSlots = rawSlots
        .whereType<Map<String, dynamic>>()
        .map((s) => TimetableSlot.fromJson(s))
        .toList();

    final scheduleByDay = <String, List<TimetableSlot>>{
      'monday': [],
      'tuesday': [],
      'wednesday': [],
      'thursday': [],
      'friday': [],
      'saturday': [],
      'sunday': [],
    };

    if (json['schedule_by_day'] is Map<String, dynamic>) {
      final rawMap = json['schedule_by_day'] as Map<String, dynamic>;
      rawMap.forEach((key, val) {
        final lowerKey = key.toLowerCase();
        if (val is List) {
          scheduleByDay[lowerKey] = val
              .whereType<Map<String, dynamic>>()
              .map((s) => TimetableSlot.fromJson(s))
              .toList();
        }
      });
    } else {
      for (final slot in allSlots) {
        scheduleByDay[slot.dayOfWeek]?.add(slot);
      }
    }

    // Sort slots by periodNumber
    scheduleByDay.forEach((day, list) {
      list.sort((a, b) => a.periodNumber.compareTo(b.periodNumber));
    });

    return TimetableSchedule(
      academicYearId: json['academic_year_id'] is int
          ? json['academic_year_id']
          : int.tryParse(json['academic_year_id']?.toString() ?? ''),
      allSlots: allSlots,
      scheduleByDay: scheduleByDay,
    );
  }
}
