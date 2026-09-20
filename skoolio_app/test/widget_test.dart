import 'package:flutter_test/flutter_test.dart';
import 'package:skoolio_app/features/attendance/domain/attendance_models.dart';
import 'package:skoolio_app/features/auth/domain/models.dart';
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
}
