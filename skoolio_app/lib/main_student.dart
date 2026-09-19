// Entry point for the STUDENT flavor APK.
// Build: flutter build apk --flavor student -t lib/main_student.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/app.dart';
import 'core/storage/secure_storage_service.dart';
import 'features/auth/presentation/auth_providers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storageService = await SecureStorageService.init();
  runApp(
    ProviderScope(
      overrides: [
        storageServiceProvider.overrideWithValue(storageService),
        appForcedRoleProvider.overrideWithValue('student'),
      ],
      child: const SkoolioApp(forcedRole: 'student'),
    ),
  );
}
