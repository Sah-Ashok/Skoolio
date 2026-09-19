import 'package:flutter/material.dart';

/// Skoolio design system color tokens
class AppColors {
  // Brand Colors
  static const Color primary = Color(0xFF25343F);       // Dark Slate (Primary brand color)
  static const Color primaryDark = Color(0xFF1A252D);   // Deep Slate
  static const Color primaryLight = Color(0xFF3B4E5B);  // Medium Slate
  // Accent: #FF9B51 — warm orange.
  // White text on this passes contrast for large/bold text (WCAG AA Large: ≥3:1).
  // For normal-weight body text prefer AppColors.textOnAccent (#1A1A1A).
  static const Color accent = Color(0xFFFF9B51);
  static const Color accentLight = Color(0xFFFFF3E8);   // Very soft orange tint
  // Use dark text on accent backgrounds for normal-weight sizes.
  static const Color textOnAccent = Color(0xFF1A1A1A);

  // Neutral Backgrounds
  static const Color background = Color(0xFFF8FAFC);    // Main scaffold background
  static const Color surface = Color(0xFFFFFFFF);       // Cards, sheets, dialogs
  static const Color surfaceVariant = Color(0xFFF1F5F9);// Subtle container fill

  // Typography Colors
  static const Color textPrimary = Color(0xFF0F172A);   // High-emphasis text
  static const Color textSecondary = Color(0xFF475569); // Medium-emphasis text
  static const Color textMuted = Color(0xFF94A3B8);     // Hints, disabled text
  static const Color textOnPrimary = Color(0xFFFFFFFF); // Text on primary background

  // Borders & Dividers
  static const Color border = Color(0xFFE2E8F0);        // Standard border
  static const Color borderSubtle = Color(0xFFF1F5F9);  // Subtle hairline

  // Status & Feedback Colors (Universal)
  static const Color success = Color(0xFF10B981);       // Present, Paid, Success
  static const Color successLight = Color(0xFFECFDF5);
  static const Color warning = Color(0xFFF59E0B);       // Late, Due Soon, Pending
  static const Color warningLight = Color(0xFFFFFBEB);
  static const Color error = Color(0xFFEF4444);         // Absent, Overdue, Failed
  static const Color errorLight = Color(0xFFFEF2F2);
  static const Color info = Color(0xFF3B82F6);          // Events, Announcements
  static const Color infoLight = Color(0xFFEFF6FF);
}
