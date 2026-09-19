import 'package:flutter_test/flutter_test.dart';
import 'package:skoolio_app/features/auth/domain/models.dart';

void main() {
  group('Auth Models Test', () {
    test('UserRole converts correctly', () {
      expect(UserRole.fromString('student'), UserRole.student);
      expect(UserRole.fromString('faculty'), UserRole.faculty);
      expect(UserRole.fromString('teacher'), UserRole.faculty);
    });

    test('UserModel parses from JSON correctly', () {
      final json = {
        'id': 42,
        'email': 'teacher@skoolio.app',
        'full_name': 'Prof. John Doe',
        'role': 'faculty',
        'school_id': 101,
        'school_name': 'Global International Academy',
        'currency': 'USD',
        'currency_symbol': '\$',
      };

      final user = UserModel.fromJson(json);
      expect(user.id, 42);
      expect(user.fullName, 'Prof. John Doe');
      expect(user.role, UserRole.faculty);
      expect(user.schoolName, 'Global International Academy');
      expect(user.currencySymbol, '\$');
    });
  });
}
