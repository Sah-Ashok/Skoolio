import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/theme/app_theme.dart';
import 'routes.dart';

/// Optional forced role for flavor builds.
/// 'student' → login route shows student-only screen, teacher routes blocked.
/// 'teacher' → login route shows teacher-only screen, student routes blocked.
/// null       → unified login with role tab (dev / main.dart build).
final appForcedRoleProvider = Provider<String?>((ref) => null);

class SkoolioApp extends StatelessWidget {
  final String? forcedRole;
  const SkoolioApp({super.key, this.forcedRole});

  @override
  Widget build(BuildContext context) {
    final appTitle = forcedRole == 'teacher'
        ? 'Skoolio Teacher'
        : forcedRole == 'student'
            ? 'Skoolio Student'
            : 'Skoolio';

    return ProviderScope(
      overrides: [
        if (forcedRole != null)
          appForcedRoleProvider.overrideWithValue(forcedRole),
      ],
      child: _SkoolioAppContent(title: appTitle),
    );
  }
}

class _SkoolioAppContent extends ConsumerWidget {
  final String title;
  const _SkoolioAppContent({required this.title});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: title,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: router,
    );
  }
}
