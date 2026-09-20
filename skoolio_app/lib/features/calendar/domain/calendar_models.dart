import 'package:intl/intl.dart';

class AcademicCalendar {
  final int id;
  final int academicYearId;
  final String weekendType; // 'sunday_only', 'saturday_only', 'saturday_sunday'
  final String? name;

  AcademicCalendar({
    required this.id,
    required this.academicYearId,
    required this.weekendType,
    this.name,
  });

  factory AcademicCalendar.fromJson(Map<String, dynamic> json) {
    return AcademicCalendar(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      academicYearId: json['academic_year_id'] is int
          ? json['academic_year_id']
          : int.tryParse(json['academic_year_id']?.toString() ?? '0') ?? 0,
      weekendType: json['weekend_type']?.toString() ?? 'sunday_only',
      name: json['name']?.toString(),
    );
  }
}

class CalendarEvent {
  final int id;
  final int calendarId;
  final String title;
  final String eventType; // 'holiday', 'event', 'early_closing', 'working'
  final DateTime startDate;
  final DateTime endDate;
  final String? description;

  CalendarEvent({
    required this.id,
    required this.calendarId,
    required this.title,
    required this.eventType,
    required this.startDate,
    required this.endDate,
    this.description,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) {
    final startStr = json['event_date']?.toString() ?? json['start_date']?.toString() ?? '';
    final endStr = json['end_date']?.toString() ?? startStr;

    final parsedStart = DateTime.tryParse(startStr) ?? DateTime.now();
    final parsedEnd = DateTime.tryParse(endStr) ?? parsedStart;

    return CalendarEvent(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      calendarId: json['calendar_id'] is int ? json['calendar_id'] : int.tryParse(json['calendar_id']?.toString() ?? '0') ?? 0,
      title: json['title']?.toString() ?? json['event_name']?.toString() ?? 'Event',
      eventType: json['event_type']?.toString().toLowerCase() ?? 'event',
      startDate: DateTime(parsedStart.year, parsedStart.month, parsedStart.day),
      endDate: DateTime(parsedEnd.year, parsedEnd.month, parsedEnd.day),
      description: json['description']?.toString(),
    );
  }

  bool get isHoliday => eventType == 'holiday' || eventType == 'off';
  bool get isSchoolEvent => eventType == 'event';
  bool get isEarlyClosing => eventType == 'early_closing';

  bool containsDate(DateTime date) {
    final target = DateTime(date.year, date.month, date.day);
    return !target.isBefore(startDate) && !target.isAfter(endDate);
  }
}

class CalendarWeeklyOff {
  final int? id;
  final int dayOfWeek; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  final String weekPattern; // 'all', '1st', '2nd', '3rd', '4th', '5th'

  CalendarWeeklyOff({
    this.id,
    required this.dayOfWeek,
    required this.weekPattern,
  });

  factory CalendarWeeklyOff.fromJson(Map<String, dynamic> json) {
    return CalendarWeeklyOff(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? ''),
      dayOfWeek: json['day_of_week'] is int ? json['day_of_week'] : int.tryParse(json['day_of_week']?.toString() ?? '0') ?? 0,
      weekPattern: json['week_pattern']?.toString().toLowerCase() ?? 'all',
    );
  }
}

class CalendarDayCell {
  final DateTime date;
  final int dayNumber;
  final bool isMuted; // True if padding from previous/next month
  final bool isToday;
  final String? type; // 'off', 'holiday', 'event', 'early_closing', 'working'
  final String? label;
  final String? description;
  final bool isWeeklyOff;

  CalendarDayCell({
    required this.date,
    required this.dayNumber,
    this.isMuted = false,
    this.isToday = false,
    this.type,
    this.label,
    this.description,
    this.isWeeklyOff = false,
  });

  bool get isOffOrHoliday => type == 'off' || type == 'holiday';
  bool get isEvent => type == 'event';
  bool get isEarlyClosing => type == 'early_closing';
  bool get isWorkingDay => !isMuted && !isOffOrHoliday && !isEarlyClosing;
}

class CalendarMonthStats {
  final int workingDays;
  final int holidaysAndOff;
  final int schoolEvents;

  CalendarMonthStats({
    required this.workingDays,
    required this.holidaysAndOff,
    required this.schoolEvents,
  });
}

class CalendarBundle {
  final AcademicCalendar? calendar;
  final List<CalendarEvent> events;
  final List<CalendarWeeklyOff> weeklyOffs;
  final Map<String, dynamic>? academicYear;

  CalendarBundle({
    this.calendar,
    required this.events,
    required this.weeklyOffs,
    this.academicYear,
  });

  static const List<String> ordinals = ['1st', '2nd', '3rd', '4th', '5th'];

  static String getNthWeekday(int dayOfMonth) {
    final idx = ((dayOfMonth - 1) ~/ 7);
    if (idx >= 0 && idx < ordinals.length) {
      return ordinals[idx];
    }
    return '5th';
  }

  bool isWeeklyOffDay(DateTime date, int dayOfMonth) {
    final weekday = date.weekday % 7; // DateTime: Mon=1, Sun=7 -> convert to 0=Sun, 1=Mon...6=Sat
    if (weeklyOffs.isNotEmpty) {
      final nth = getNthWeekday(dayOfMonth);
      return weeklyOffs.any((w) =>
          w.dayOfWeek == weekday && (w.weekPattern == 'all' || w.weekPattern == nth));
    }

    final fallback = calendar?.weekendType ?? 'sunday_only';
    if (fallback == 'saturday_only') {
      return weekday == 6; // Saturday
    } else if (fallback == 'saturday_sunday') {
      return weekday == 6 || weekday == 0; // Sat & Sun
    }
    return weekday == 0; // Default: Sunday
  }

  String getWeeklyOffSummary() {
    if (weeklyOffs.isEmpty) {
      final fallback = calendar?.weekendType ?? 'sunday_only';
      if (fallback == 'saturday_only') return 'Every Saturday';
      if (fallback == 'saturday_sunday') return 'Every Saturday & Sunday';
      return 'Every Sunday';
    }

    const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    final grouped = <int, List<String>>{};
    for (final off in weeklyOffs) {
      grouped.putIfAbsent(off.dayOfWeek, () => []).add(off.weekPattern);
    }

    final parts = <String>[];
    for (int dayNum = 0; dayNum < 7; dayNum++) {
      if (grouped.containsKey(dayNum)) {
        final patterns = grouped[dayNum]!;
        if (patterns.contains('all')) {
          parts.add('Every ${dayLabels[dayNum]}');
        } else {
          parts.add('${patterns.join(' & ')} ${dayLabels[dayNum]}');
        }
      }
    }
    return parts.isNotEmpty ? parts.join(', ') : 'None';
  }

  /// Builds a 7-column monthly grid starting on Monday and ending on Sunday
  List<CalendarDayCell> buildMonthGrid(int year, int month) {
    final cells = <CalendarDayCell>[];
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);

    final firstDayOfMonth = DateTime(year, month, 1);
    final daysInMonth = DateTime(year, month + 1, 0).day;

    // Weekday in Dart: 1 = Mon, 7 = Sun
    // Leading padding days (Monday based: if first day is Wed (3), lead = 2 days: Mon, Tue)
    int leadDays = firstDayOfMonth.weekday - 1;
    for (int i = leadDays; i > 0; i--) {
      final leadDate = firstDayOfMonth.subtract(Duration(days: i));
      cells.add(CalendarDayCell(
        date: leadDate,
        dayNumber: leadDate.day,
        isMuted: true,
      ));
    }

    // Days in current month
    for (int day = 1; day <= daysInMonth; day++) {
      final date = DateTime(year, month, day);
      final isToday = date.isAtSameMomentAs(today);

      // Find event matching this date (ignore exams in calendar grid)
      CalendarEvent? matchedEvent;
      for (final ev in events) {
        if (ev.eventType != 'exam' && ev.containsDate(date)) {
          matchedEvent = ev;
          break;
        }
      }

      final isOff = isWeeklyOffDay(date, day);
      final type = matchedEvent?.eventType ?? (isOff ? 'off' : null);
      final label = matchedEvent?.title ?? (isOff ? 'Weekly Off' : null);
      final description = matchedEvent?.description;

      cells.add(CalendarDayCell(
        date: date,
        dayNumber: day,
        isMuted: false,
        isToday: isToday,
        type: type,
        label: label,
        description: description,
        isWeeklyOff: isOff,
      ));
    }

    // Trailing padding days to fill grid to multiple of 7
    final remainder = cells.length % 7;
    if (remainder != 0) {
      final trailDays = 7 - remainder;
      final lastDayOfMonth = DateTime(year, month, daysInMonth);
      for (int i = 1; i <= trailDays; i++) {
        final trailDate = lastDayOfMonth.add(Duration(days: i));
        cells.add(CalendarDayCell(
          date: trailDate,
          dayNumber: trailDate.day,
          isMuted: true,
        ));
      }
    }

    return cells;
  }

  CalendarMonthStats calculateMonthStats(int year, int month) {
    final grid = buildMonthGrid(year, month);
    final visible = grid.where((d) => !d.isMuted).toList();

    final offCount = visible.where((d) => d.type == 'off' || d.type == 'holiday').length;
    final eventCount = visible.where((d) => d.type == 'event').length;
    final workingCount = visible.length - offCount;

    return CalendarMonthStats(
      workingDays: workingCount > 0 ? workingCount : 0,
      holidaysAndOff: offCount,
      schoolEvents: eventCount,
    );
  }

  List<CalendarEvent> getMonthEvents(int year, int month) {
    final startOfMonth = DateTime(year, month, 1);
    final endOfMonth = DateTime(year, month + 1, 0, 23, 59, 59);

    return events.where((ev) {
      if (ev.eventType == 'exam') return false;
      return !ev.endDate.isBefore(startOfMonth) && !ev.startDate.isAfter(endOfMonth);
    }).toList();
  }
}
