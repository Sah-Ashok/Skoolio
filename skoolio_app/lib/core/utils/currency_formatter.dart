import 'package:intl/intl.dart';

class CurrencyFormatter {
  static String format(
    dynamic amount, {
    String symbol = '\$',
    int decimalDigits = 0,
  }) {
    if (amount == null) return '${symbol}0';
    final num value = amount is num ? amount : (num.tryParse(amount.toString()) ?? 0);

    final formatter = NumberFormat.currency(
      symbol: symbol,
      decimalDigits: decimalDigits,
    );

    return formatter.format(value);
  }

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
