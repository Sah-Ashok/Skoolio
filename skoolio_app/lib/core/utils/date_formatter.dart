import 'package:intl/intl.dart';

class DateFormatter {
  /// Format as "Sep 18, 2026"
  static String formatMedium(DateTime? date) {
    if (date == null) return '';
    return DateFormat('MMM dd, yyyy').format(date);
  }

  /// Format as "September 18, 2026"
  static String formatFull(DateTime? date) {
    if (date == null) return '';
    return DateFormat('MMMM dd, yyyy').format(date);
  }

  /// Format as standard ISO date "2026-09-18"
  static String formatIso(DateTime? date) {
    if (date == null) return '';
    return DateFormat('yyyy-MM-dd').format(date);
  }

  /// Format date string or DateTime
  static String formatString(String? isoString, {String pattern = 'MMM dd, yyyy'}) {
    if (isoString == null || isoString.isEmpty) return '';
    try {
      final parsed = DateTime.parse(isoString);
      return DateFormat(pattern).format(parsed);
    } catch (_) {
      return isoString;
    }
  }

  /// Format time as "09:30 AM"
  static String formatTime(DateTime? date) {
    if (date == null) return '';
    return DateFormat('hh:mm a').format(date);
  }

  /// Relative human-readable time (e.g. "Today", "Yesterday", "2 days ago", or "In 2 days")
  static String formatRelative(DateTime? date) {
    if (date == null) return '';
    final now = DateTime.now();
    final difference = now.difference(date);

    // Handle future dates gracefully
    if (difference.isNegative) {
      final futureDiff = date.difference(now);
      if (futureDiff.inDays == 0) {
        if (futureDiff.inHours == 0) {
          if (futureDiff.inMinutes <= 1) return 'In a moment';
          return 'In ${futureDiff.inMinutes}m';
        }
        return 'In ${futureDiff.inHours}h';
      } else if (futureDiff.inDays == 1) {
        return 'Tomorrow';
      } else if (futureDiff.inDays < 7) {
        return 'In ${futureDiff.inDays} days';
      } else {
        return formatMedium(date);
      }
    }

    if (difference.inDays == 0) {
      if (difference.inHours == 0) {
        if (difference.inMinutes <= 1) return 'Just now';
        return '${difference.inMinutes}m ago';
      }
      return '${difference.inHours}h ago';
    } else if (difference.inDays == 1) {
      return 'Yesterday';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} days ago';
    } else {
      return formatMedium(date);
    }
  }
}
