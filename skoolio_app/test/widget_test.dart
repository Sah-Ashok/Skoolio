import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:skoolio_app/core/widgets/app_bottom_nav_bar.dart';
import 'package:skoolio_app/core/widgets/app_loader.dart';
import 'package:skoolio_app/features/attendance/domain/attendance_models.dart';
import 'package:skoolio_app/features/auth/domain/models.dart';
import 'package:skoolio_app/features/auth/presentation/auth_providers.dart';
import 'package:skoolio_app/features/calendar/domain/calendar_models.dart';
import 'package:skoolio_app/features/timetable/domain/timetable_model.dart';

void main() {
  group('Auth Models Test', () {
    test('UserRole converts correctly', () {
      expect(UserRole.fromString('student'), UserRole.student);
      expect(UserRole.fromString('faculty'), UserRole.faculty);
      expect(UserRole.fromString('teacher'), UserRole.faculty);
    });

    test('UserModel parses faculty from JSON correctly', () {
      final json = {
        'id': 42,
        'email': 'teacher@skoolio.app',
        'full_name': 'Prof. John Doe',
        'role': 'faculty',
        'school_id': 101,
        'school_name': 'Global International Academy',
        'currency': 'USD',
        'currency_symbol': '\$',
        'employee_id': 'EMP-007',
        'qualification': 'M.Ed',
        'specialization': 'Physics',
      };

      final user = UserModel.fromJson(json);
      expect(user.id, 42);
      expect(user.fullName, 'Prof. John Doe');
      expect(user.role, UserRole.faculty);
      expect(user.schoolName, 'Global International Academy');
      expect(user.currencySymbol, '\$');
      expect(user.employeeId, 'EMP-007');
      expect(user.qualification, 'M.Ed');
      expect(user.specialization, 'Physics');
    });

    test('UserModel parses student from JSON correctly', () {
      final json = {
        'id': 99,
        'email': 'student@skoolio.app',
        'full_name': 'Jane Student',
        'role': 'student',
        'school_id': 101,
        'school_name': 'Global International Academy',
        'admission_number': 'ADM-2024-001',
        'roll_number': '12',
        'class_name': 'Grade 10',
        'section_name': 'A',
        'parent_name': 'Robert Student',
        'parent_phone': '+15551234567',
      };

      final user = UserModel.fromJson(json);
      expect(user.id, 99);
      expect(user.fullName, 'Jane Student');
      expect(user.role, UserRole.student);
      expect(user.admissionNumber, 'ADM-2024-001');
      expect(user.rollNumber, '12');
      expect(user.className, 'Grade 10');
      expect(user.sectionName, 'A');
      expect(user.parentName, 'Robert Student');
      expect(user.parentPhone, '+15551234567');
    });
  });

  group('Attendance Models Test', () {
    test('AttendanceStatus converts and generates labels correctly', () {
      expect(AttendanceStatus.fromString('present'), AttendanceStatus.present);
      expect(AttendanceStatus.fromString('absent'), AttendanceStatus.absent);
      expect(AttendanceStatus.fromString('leave'), AttendanceStatus.leave);

      expect(AttendanceStatus.present.shortLabel, 'P');
      expect(AttendanceStatus.absent.shortLabel, 'A');
      expect(AttendanceStatus.leave.shortLabel, 'Lv');

      expect(AttendanceStatus.present.displayLabel, 'Present');
      expect(AttendanceStatus.absent.displayLabel, 'Absent');
      expect(AttendanceStatus.leave.displayLabel, 'Leave');
    });

    test('TeacherSection parses JSON correctly', () {
      final json = {
        'id': 5,
        'section_name': 'Section B',
        'class_id': 2,
        'class_name': 'Grade 8',
        'is_coordinator': true,
      };

      final sec = TeacherSection.fromJson(json);
      expect(sec.id, 5);
      expect(sec.name, 'Section B');
      expect(sec.classId, 2);
      expect(sec.className, 'Grade 8');
      expect(sec.isCoordinator, true);
      expect(sec.displayName, 'Grade 8 - Section B');
    });

    test('SectionRegisterStudent and parseRegisterRows parse attendance rows correctly', () {
      final rows = [
        {
          'student_id': 10,
          'full_name': 'Alice Wonder',
          'roll_number': '1',
          'date': '2026-09-01T00:00:00Z',
          'status': 'present',
          'year_present': 15,
          'year_absent': 1,
          'year_leave': 0,
          'year_total': 16,
        },
        {
          'student_id': 10,
          'full_name': 'Alice Wonder',
          'roll_number': '1',
          'date': '2026-09-02T00:00:00Z',
          'status': 'absent',
          'year_present': 15,
          'year_absent': 1,
          'year_leave': 0,
          'year_total': 16,
        },
        {
          'student_id': 20,
          'full_name': 'Bob Builder',
          'roll_number': '2',
          'date': '2026-09-01T00:00:00Z',
          'status': 'leave',
          'year_present': 10,
          'year_absent': 2,
          'year_leave': 3,
          'year_total': 15,
        },
      ];

      final students = parseRegisterRows(rows);
      expect(students.length, 2);

      final alice = students[0];
      expect(alice.fullName, 'Alice Wonder');
      expect(alice.rollNumber, '1');
      expect(alice.monthPresent, 1);
      expect(alice.monthAbsent, 1);
      expect(alice.monthLeave, 0);
      expect(alice.monthTotal, 2);
      expect(alice.monthAttendancePct, 50.0);
      expect(alice.byDate['2026-09-01'], 'present');
      expect(alice.byDate['2026-09-02'], 'absent');

      final bob = students[1];
      expect(bob.fullName, 'Bob Builder');
      expect(bob.monthLeave, 1);
      expect(bob.monthPresent, 0);
      expect(bob.monthTotal, 1);
      expect(bob.byDate['2026-09-01'], 'leave');
    });
    test('StudentAttendanceItem parses enrollment_id and status correctly', () {
      final json = {
        'id': 105,
        'student_id': 22,
        'enrollment_id': 105,
        'full_name': 'Charlie Chaplin',
        'roll_number': '7',
        'status': 'absent',
        'remarks': 'Sick leave',
      };

      final item = StudentAttendanceItem.fromJson(json);
      expect(item.studentId, 22);
      expect(item.enrollmentId, 105);
      expect(item.fullName, 'Charlie Chaplin');
      expect(item.rollNumber, '7');
      expect(item.status, AttendanceStatus.absent);
      expect(item.remarks, 'Sick leave');
    });
  });

  group('Timetable Models Test', () {
    test('TimetableSlot parses and detects breaks correctly', () {
      final classSlot = TimetableSlot.fromJson({
        'id': 1,
        'day_of_week': 'monday',
        'period_number': 1,
        'start_time': '09:00',
        'end_time': '09:45',
        'subject_name': 'Mathematics',
        'teacher_name': 'Mr. Newton',
        'room_number': '101',
        'is_break': false,
      });

      expect(classSlot.isBreak, false);
      expect(classSlot.subjectName, 'Mathematics');
      expect(classSlot.timeRange, '09:00 - 09:45');

      final breakSlot = TimetableSlot.fromJson({
        'id': 2,
        'day_of_week': 'monday',
        'period_number': 4,
        'start_time': '12:00',
        'end_time': '12:45',
        'subject_name': 'Lunch Break',
        'is_break': true,
      });

      expect(breakSlot.isBreak, true);
      expect(breakSlot.subjectName, 'Lunch Break');
    });

    test('TimetableSchedule parses scheduleByDay correctly', () {
      final json = {
        'academic_year_id': 2026,
        'slots': [
          {
            'id': 1,
            'day_of_week': 'monday',
            'period_number': 1,
            'start_time': '08:00',
            'end_time': '08:45',
            'subject_name': 'Physics',
            'is_break': false,
          },
          {
            'id': 2,
            'day_of_week': 'friday',
            'period_number': 2,
            'start_time': '09:00',
            'end_time': '09:45',
            'subject_name': 'Chemistry',
            'is_break': false,
          },
        ],
      };

      final schedule = TimetableSchedule.fromJson(json);
      expect(schedule.academicYearId, 2026);
      expect(schedule.scheduleByDay['monday']?.length, 1);
      expect(schedule.scheduleByDay['monday']?.first.subjectName, 'Physics');
      expect(schedule.scheduleByDay['friday']?.length, 1);
      expect(schedule.scheduleByDay['friday']?.first.subjectName, 'Chemistry');
      expect(schedule.scheduleByDay['sunday']?.isEmpty, true);
    });
  });

  group('Calendar Models Test', () {
    test('AcademicCalendar and CalendarEvent parse from JSON correctly', () {
      final calJson = {
        'id': 10,
        'academic_year_id': 2026,
        'weekend_type': 'saturday_sunday',
        'name': 'Main Academic Calendar',
      };

      final cal = AcademicCalendar.fromJson(calJson);
      expect(cal.id, 10);
      expect(cal.academicYearId, 2026);
      expect(cal.weekendType, 'saturday_sunday');
      expect(cal.name, 'Main Academic Calendar');

      final eventJson = {
        'id': 101,
        'calendar_id': 10,
        'title': 'Autumn Break',
        'event_type': 'holiday',
        'event_date': '2026-10-15T00:00:00Z',
        'end_date': '2026-10-20T00:00:00Z',
        'description': 'School closed for autumn festival',
      };

      final event = CalendarEvent.fromJson(eventJson);
      expect(event.id, 101);
      expect(event.calendarId, 10);
      expect(event.title, 'Autumn Break');
      expect(event.isHoliday, true);
      expect(event.isSchoolEvent, false);
      expect(event.containsDate(DateTime(2026, 10, 16)), true);
      expect(event.containsDate(DateTime(2026, 10, 25)), false);
    });

    test('CalendarBundle builds monthly grid and detects weekly offs correctly', () {
      final bundle = CalendarBundle(
        calendar: AcademicCalendar(
          id: 1,
          academicYearId: 2026,
          weekendType: 'sunday_only',
        ),
        events: [
          CalendarEvent(
            id: 1,
            calendarId: 1,
            title: 'Sports Day',
            eventType: 'event',
            startDate: DateTime(2026, 9, 15),
            endDate: DateTime(2026, 9, 15),
            description: 'Annual inter-house athletic meet',
          ),
        ],
        weeklyOffs: [
          CalendarWeeklyOff(dayOfWeek: 0, weekPattern: 'all'), // Every Sunday
        ],
      );

      // September 2026: starts on Tuesday (Sept 1), ends on Wednesday (Sept 30) -> 30 days
      final grid = bundle.buildMonthGrid(2026, 9);
      // Lead day: Monday Aug 31 (1 lead day). Total visible = 30. Trail days = 4 (Oct 1-4). Total = 35 (5 weeks * 7)
      expect(grid.length % 7, 0);
      expect(grid.length, 35);

      final sportsDayCell = grid.firstWhere((c) => !c.isMuted && c.dayNumber == 15);
      expect(sportsDayCell.isEvent, true);
      expect(sportsDayCell.label, 'Sports Day');

      final sundayCell = grid.firstWhere((c) => !c.isMuted && c.dayNumber == 6); // Sep 6, 2026 is Sunday
      expect(sundayCell.isOffOrHoliday, true);
      expect(sundayCell.isWeeklyOff, true);

      final stats = bundle.calculateMonthStats(2026, 9);
      expect(stats.schoolEvents, 1);
      expect(stats.holidaysAndOff, 4); // 4 Sundays in Sep 2026 (6, 13, 20, 27)
      expect(stats.workingDays, 26);
      expect(bundle.getWeeklyOffSummary(), 'Every Sunday');
    });
  });

  group('AppHorizontalNavBar Tests', () {
    test('Teacher nav items contain all 12 web portal routes', () {
      final items = AppHorizontalNavBar.teacherNavItems;
      expect(items.length, 12);
      expect(items.map((e) => e.route).toList(), [
        '/teacher-dashboard',
        '/teacher/timetable',
        '/teacher/attendance',
        '/teacher/attendance/register',
        '/teacher/attendance/own',
        '/teacher/students',
        '/teacher/results',
        '/teacher/calendar',
        '/teacher/notices',
        '/teacher/salary',
        '/teacher/profile',
        'logout',
      ]);
      expect(items.any((e) => e.title == 'Dashboard'), true);
      expect(items.any((e) => e.title == 'Calendar'), true);
      expect(items.any((e) => e.title == 'Salary'), true);
      expect(items.any((e) => e.title == 'Sign Out'), true);
    });

    test('Student nav items contain all 9 web portal routes', () {
      final items = AppHorizontalNavBar.studentNavItems;
      expect(items.length, 9);
      expect(items.map((e) => e.route).toList(), [
        '/student-dashboard',
        '/student/timetable',
        '/student/attendance',
        '/student/results',
        '/student/fees',
        '/student/notices',
        '/student/calendar',
        '/student/profile',
        'logout',
      ]);
      expect(items.any((e) => e.title == 'Fee Status'), true);
      expect(items.any((e) => e.title == 'Calendar'), true);
      expect(items.any((e) => e.title == 'Sign Out'), true);
    });

    testWidgets('AppHorizontalNavBar renders horizontal scrollable strip and tabs', (tester) async {
      final facultyUser = UserModel(
        id: 1,
        email: 'teacher@test.com',
        fullName: 'Teacher Jane',
        role: UserRole.faculty,
        schoolId: 101,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authStateProvider.overrideWith(
              (ref) => FakeAuthNotifier(facultyUser),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              bottomNavigationBar: AppHorizontalNavBar(
                currentRoute: '/teacher-dashboard',
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // Verify horizontal scroll view exists
      final scrollFinder = find.byType(SingleChildScrollView);
      expect(scrollFinder, findsOneWidget);
      final SingleChildScrollView scrollView = tester.widget(scrollFinder);
      expect(scrollView.scrollDirection, Axis.horizontal);

      // Verify initial tabs are visible
      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Timetable'), findsOneWidget);

      // Drag horizontally to bring latter tabs into view
      await tester.drag(scrollFinder, const Offset(-400, 0));
      await tester.pumpAndSettle();

      // Verify further tabs appear after horizontal scroll
      expect(find.text('Calendar'), findsOneWidget);
    });

    testWidgets('AppHorizontalNavBar renders student navigation tabs for student role', (tester) async {
      final studentUser = UserModel(
        id: 2,
        email: 'student@test.com',
        fullName: 'Student Alex',
        role: UserRole.student,
        schoolId: 101,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authStateProvider.overrideWith(
              (ref) => FakeAuthNotifier(studentUser),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              bottomNavigationBar: AppHorizontalNavBar(
                currentRoute: '/student-dashboard',
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Dashboard'), findsOneWidget);
      expect(find.text('Fee Status'), findsOneWidget);
      expect(find.text('Results'), findsOneWidget);
    });
  });

  group('AppLoader Widget Tests', () {
    testWidgets('AppLoader renders text and animated components correctly', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: AppLoader(
              text: 'Loading timetable...',
              size: AppLoaderSize.lg,
            ),
          ),
        ),
      );

      expect(find.text('Loading timetable...'), findsOneWidget);
    });

    testWidgets('AppLoader.spinner renders compact spinner widget', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AppLoader.spinner(size: 18, color: Colors.orange),
          ),
        ),
      );

      expect(find.byType(CustomPaint), findsWidgets);
    });
  });
}

class FakeAuthNotifier extends StateNotifier<AuthState> implements AuthNotifier {
  FakeAuthNotifier(UserModel user) : super(AuthState(user: user, isInitialized: true));

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

