// Entry point for the TEACHER flavor APK.
// Build: flutter build apk --flavor teacher -t lib/main_teacher.dart
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
        appForcedRoleProvider.overrideWithValue('teacher'),
      ],
      child: const SkoolioApp(forcedRole: 'teacher'),
    ),
  );
}
