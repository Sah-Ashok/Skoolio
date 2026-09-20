import 'package:intl/intl.dart';

class DateFormatter {
  static String formatMedium(DateTime? date) {
    if (date == null) return '';
    return DateFormat('MMM dd, yyyy').format(date);
  }

  static String formatFull(DateTime? date) {
    if (date == null) return '';
    return DateFormat('MMMM dd, yyyy').format(date);
  }

  static String formatIso(DateTime? date) {
    if (date == null) return '';
    return DateFormat('yyyy-MM-dd').format(date);
  }

  static String formatString(String? isoString, {String pattern = 'MMM dd, yyyy'}) {
    if (isoString == null || isoString.isEmpty) return '';
    try {
      final parsed = DateTime.parse(isoString);
      return DateFormat(pattern).format(parsed);
    } catch (_) {
      return isoString;
    }
  }

  static String formatTime(DateTime? date) {
    if (date == null) return '';
    return DateFormat('hh:mm a').format(date);
  }

  static String formatRelative(DateTime? date) {
    if (date == null) return '';
    final now = DateTime.now();
    final difference = now.difference(date);

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
