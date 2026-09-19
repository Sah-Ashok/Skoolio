import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../core/theme/app_colors.dart';

/// Pure loading/branding screen.
/// All navigation is handled by GoRouter's redirect in routes.dart
/// once [authStateProvider] marks [isInitialized] = true.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo from assets
            Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.18),
                    blurRadius: 32,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: Image.asset(
                'assets/Logo.png',
                fit: BoxFit.contain,
                // Graceful fallback if asset is missing in debug
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.school_rounded,
                  color: AppColors.primary,
                  size: 52,
                ),
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Skoolio',
              style: GoogleFonts.dmSans(
                fontSize: 36,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: -1.0,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Modern Cloud School ERP',
              style: GoogleFonts.dmSans(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: Colors.white.withValues(alpha: 0.65),
                letterSpacing: 0.2,
              ),
            ),
            const SizedBox(height: 56),
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                color: AppColors.accent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
