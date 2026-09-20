import 'package:flutter_test/flutter_test.dart';
import 'package:skoolio_app/core/utils/currency_formatter.dart';
import 'package:skoolio_app/core/utils/date_formatter.dart';

void main() {
  group('CurrencyFormatter', () {
    test('formats default USD currency correctly', () {
      expect(CurrencyFormatter.format(1250, symbol: '\$'), '\$1,250');
      expect(CurrencyFormatter.format(0, symbol: '\$'), '\$0');
    });

    test('formats international currency symbols', () {
      expect(CurrencyFormatter.format(500, symbol: '€'), '€500');
      expect(CurrencyFormatter.format(750, symbol: '£'), '£750');
      expect(CurrencyFormatter.format(1000, symbol: '₹'), '₹1,000');
    });

    test('formats compact representations correctly', () {
      expect(CurrencyFormatter.formatCompact(1500, symbol: '\$'), '\$1.5K');
      expect(CurrencyFormatter.formatCompact(2500000, symbol: '\$'), '\$2.5M');
    });
  });

  group('DateFormatter', () {
    test('formats ISO dates into readable medium date', () {
      final date = DateTime(2026, 9, 20);
      expect(DateFormatter.formatMedium(date), 'Sep 20, 2026');
      expect(DateFormatter.formatIso(date), '2026-09-20');
    });

    test('formats relative dates accurately', () {
      final now = DateTime.now();
      expect(DateFormatter.formatRelative(now), 'Just now');
    });
  });
}
