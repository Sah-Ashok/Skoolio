import 'package:intl/intl.dart';

/// Universal currency formatter for global schools.
/// Dynamically formats amount with school's currency symbol ($ by default, or €, £, ₹, etc.)
class CurrencyFormatter {
  static String format(
    dynamic amount, {
    String symbol = '\$',
    int? decimalDigits,
  }) {
    if (amount == null) return '${symbol}0';
    final num value = amount is num ? amount : (num.tryParse(amount.toString()) ?? 0);

    final decimals = decimalDigits ?? (value % 1 != 0 ? 2 : 0);

    final formatter = NumberFormat.currency(
      symbol: symbol,
      decimalDigits: decimals,
    );

    return formatter.format(value);
  }

  /// Compact format for large numbers (e.g. $1.2K, $45.0M)
  static String formatCompact(
    dynamic amount, {
    String symbol = '\$',
  }) {
    if (amount == null) return '${symbol}0';
    final num value = amount is num ? amount : (num.tryParse(amount.toString()) ?? 0);

    final formatter = NumberFormat.compact();
    return '$symbol${formatter.format(value)}';
  }
}
