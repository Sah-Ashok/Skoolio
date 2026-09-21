import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/app_loader.dart';
import '../../auth/presentation/auth_providers.dart';

final studentFeesListProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentFees);
    if (res is List) return res;
    if (res is Map<String, dynamic>) {
      final list = res['collections'] ?? res['data'];
      if (list is List) return list;
    }
  } catch (_) {}
  return [];
});

class FeesScreen extends ConsumerWidget {
  const FeesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).user;
    final currencySymbol = user?.currencySymbol ?? '\$';
    final feesAsync = ref.watch(studentFeesListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Fees & Invoices',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.history_edu_rounded),
            tooltip: 'My Submissions',
            onPressed: () => context.push('/student/fees/my-submissions'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async => ref.refresh(studentFeesListProvider.future),
        child: feesAsync.when(
          loading: () => const AppLoader(text: 'Loading fee summary...', size: AppLoaderSize.lg),
          error: (err, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
                  const SizedBox(height: 12),
                  Text('Error loading fees: $err', textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => ref.refresh(studentFeesListProvider.future),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (invoices) {
            num totalAmount = 0;
            num totalPaid = 0;
            num totalDue = 0;
            num totalWaived = 0;
            int overdueCount = 0;
            int settledCount = 0;
            final now = DateTime.now();

            for (final item in invoices) {
              if (item is Map<String, dynamic>) {
                final tot = num.tryParse((item['total_amount'] ?? item['amount'] ?? 0).toString()) ?? 0;
                final pd = num.tryParse((item['paid_amount'] ?? 0).toString()) ?? 0;
                final rem = num.tryParse((item['remaining_amount'] ?? item['due_amount'] ?? (tot - pd)).toString()) ?? 0;
                final status = (item['status'] ?? '').toString().toLowerCase();

                totalAmount += tot;
                totalPaid += pd;
                totalDue += rem;

                if (status == 'waived') {
                  totalWaived += rem;
                }

                if (status == 'paid' || status == 'waived' || rem <= 0) {
                  settledCount++;
                }

                final dueDateStr = item['due_date']?.toString();
                if (dueDateStr != null && rem > 0 && status != 'paid' && status != 'waived') {
                  try {
                    final d = DateTime.parse(dueDateStr);
                    if (d.isBefore(now)) overdueCount++;
                  } catch (_) {}
                }
              }
            }

            final totalRecords = invoices.length;

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // ── Top Action Buttons ──
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF97316),
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                        ),
                        icon: const Icon(Icons.account_balance_outlined, size: 17),
                        label: const Text(
                          'Bank Info & Pay',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                        ),
                        onPressed: () => context.push('/student/fees/bank-payment'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF334155),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                        ),
                        icon: const Icon(Icons.history_rounded, size: 17),
                        label: const Text(
                          'My Submissions',
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
                        ),
                        onPressed: () => context.push('/student/fees/my-submissions'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // ── Donut Chart & Overview Hero Card ──
                _buildDonutHeroCard(
                  totalPaid: totalPaid,
                  totalDue: totalDue,
                  totalWaived: totalWaived,
                  totalAmount: totalAmount,
                  settledCount: settledCount,
                  totalRecords: totalRecords,
                  currencySymbol: currencySymbol,
                ),
                const SizedBox(height: 12),

                // ── Overdue Warning Banner (if any) ──
                if (overdueCount > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF5F5),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.warning_amber_rounded, size: 20, color: Color(0xFFB42318)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'You have $overdueCount overdue fee${overdueCount > 1 ? 's' : ''}. Please clear your dues promptly.',
                            style: const TextStyle(
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFB42318),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // ── Section Title ──
                Padding(
                  padding: const EdgeInsets.only(left: 2, bottom: 10, top: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Fee Collections',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                      ),
                      Text(
                        '$totalRecords records',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),

                // ── Invoices List ──
                if (invoices.isEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Center(
                      child: Column(
                        children: [
                          Icon(Icons.receipt_long_outlined, size: 40, color: Color(0xFF94A3B8)),
                          SizedBox(height: 10),
                          Text(
                            'No fee records found',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'All fees are cleared or not yet generated.',
                            style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ] else ...[
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: invoices.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final inv = invoices[index] as Map<String, dynamic>;
                      return _buildInvoiceCard(context, inv, currencySymbol);
                    },
                  ),
                ],
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildDonutHeroCard({
    required num totalPaid,
    required num totalDue,
    required num totalWaived,
    required num totalAmount,
    required int settledCount,
    required int totalRecords,
    required String currencySymbol,
  }) {
    final payableBase = totalPaid + totalDue;
    final int pct = totalDue == 0
        ? 100
        : (payableBase > 0 ? ((totalPaid / payableBase) * 100).round() : 0);

    final double paidPct = payableBase > 0 ? (totalPaid / payableBase).toDouble() : (totalDue == 0 ? 1.0 : 0.0);
    final double duePct = payableBase > 0 ? (totalDue / payableBase).toDouble() : 0.0;
    final double waivedPct = totalAmount > 0 ? (totalWaived / totalAmount).toDouble() : 0.0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Donut + Legend Row
          Row(
            children: [
              SizedBox(
                width: 100,
                height: 100,
                child: CustomPaint(
                  painter: _FeeDonutPainter(
                    paidPct: paidPct,
                    duePct: duePct,
                    waivedPct: waivedPct,
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$pct%',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          totalDue == 0 ? 'cleared' : 'paid',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 20),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDonutLegendItem('Paid', CurrencyFormatter.format(totalPaid, symbol: currencySymbol), const Color(0xFF059669)),
                    const SizedBox(height: 8),
                    _buildDonutLegendItem('Pending', CurrencyFormatter.format(totalDue, symbol: currencySymbol), totalDue > 0 ? const Color(0xFFDC2626) : const Color(0xFF64748B)),
                    if (totalWaived > 0) ...[
                      const SizedBox(height: 8),
                      _buildDonutLegendItem('Waived', CurrencyFormatter.format(totalWaived, symbol: currencySymbol), const Color(0xFF7C3AED)),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 14),

          // 4 Stats Grid
          Row(
            children: [
              Expanded(
                child: _buildMetricTile(
                  label: 'Total Billed',
                  value: CurrencyFormatter.format(totalAmount, symbol: currencySymbol),
                  color: const Color(0xFFF97316),
                  bg: const Color(0xFFFFF7ED),
                  icon: Icons.receipt_long_outlined,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Total Paid',
                  value: CurrencyFormatter.format(totalPaid, symbol: currencySymbol),
                  color: const Color(0xFF059669),
                  bg: const Color(0xFFDCFCE7),
                  icon: Icons.check_circle_outline,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Pending',
                  value: CurrencyFormatter.format(totalDue, symbol: currencySymbol),
                  color: totalDue > 0 ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                  bg: totalDue > 0 ? const Color(0xFFFEE2E2) : const Color(0xFFF1F5F9),
                  icon: Icons.hourglass_top_rounded,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildMetricTile(
                  label: 'Records',
                  value: '$settledCount/$totalRecords',
                  color: const Color(0xFF3B82F6),
                  bg: const Color(0xFFEFF6FF),
                  icon: Icons.checklist_rounded,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDonutLegendItem(String label, String amount, Color color) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        Text(
          '$label: ',
          style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xFF64748B)),
        ),
        Text(
          amount,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: color),
        ),
      ],
    );
  }

  Widget _buildMetricTile({
    required String label,
    required String value,
    required Color color,
    required Color bg,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Icon(icon, size: 15, color: color),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              color: color.withValues(alpha: 0.85),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInvoiceCard(BuildContext context, Map<String, dynamic> inv, String currencySymbol) {
    final title = inv['fee_name'] ?? inv['fee_type'] ?? inv['title'] ?? 'Tuition Fee';
    final type = (inv['fee_type'] ?? 'academic').toString().toLowerCase();
    final status = (inv['status'] ?? 'unpaid').toString().toLowerCase();
    final total = num.tryParse((inv['total_amount'] ?? inv['amount'] ?? 0).toString()) ?? 0;
    final paid = num.tryParse((inv['paid_amount'] ?? 0).toString()) ?? 0;
    final due = num.tryParse((inv['remaining_amount'] ?? inv['due_amount'] ?? (total - paid)).toString()) ?? 0;
    final isPaid = due <= 0 || status == 'paid';

    final dueDateStr = inv['due_date']?.toString();
    String formattedDueDate = '—';
    if (dueDateStr != null && dueDateStr.isNotEmpty) {
      try {
        final d = DateTime.parse(dueDateStr);
        formattedDueDate = DateFormat('MMM dd, yyyy').format(d);
      } catch (_) {
        formattedDueDate = dueDateStr.length >= 10 ? dueDateStr.substring(0, 10) : dueDateStr;
      }
    }

    final statusConfig = _getFeeStatusConfig(status, isPaid);
    final typeConfig = _getTypeConfig(type);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Fee title + Type badge + Status badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title.toString(),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                          decoration: BoxDecoration(
                            color: typeConfig.bg,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            typeConfig.label,
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              color: typeConfig.color,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Due: $formattedDueDate',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                decoration: BoxDecoration(
                  color: statusConfig.bg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusConfig.border),
                ),
                child: Text(
                  statusConfig.label,
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: statusConfig.color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 10),

          // Amounts row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildAmountColumn('Total Billed', CurrencyFormatter.format(total, symbol: currencySymbol), const Color(0xFF0F172A)),
              _buildAmountColumn('Amount Paid', CurrencyFormatter.format(paid, symbol: currencySymbol), const Color(0xFF059669)),
              _buildAmountColumn(
                'Remaining Due',
                CurrencyFormatter.format(due, symbol: currencySymbol),
                isPaid ? const Color(0xFF059669) : const Color(0xFFDC2626),
              ),
            ],
          ),

          // Action button if not paid
          if (!isPaid) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFFFF7ED),
                  foregroundColor: const Color(0xFFF97316),
                  elevation: 0,
                  side: const BorderSide(color: Color(0xFFFED7AA)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
                icon: const Icon(Icons.payment_rounded, size: 16),
                label: const Text(
                  'Pay via Bank Transfer',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                ),
                onPressed: () => context.push('/student/fees/bank-payment'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAmountColumn(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: color),
        ),
      ],
    );
  }

  _FeeStatusConfig _getFeeStatusConfig(String status, bool isPaid) {
    if (isPaid || status == 'paid') {
      return const _FeeStatusConfig(
        label: 'PAID',
        color: Color(0xFF059669),
        bg: Color(0xFFDCFCE7),
        border: Color(0xFF86EFAC),
      );
    }
    if (status == 'partial') {
      return const _FeeStatusConfig(
        label: 'PARTIAL',
        color: Color(0xFFD97706),
        bg: Color(0xFFFEF3C7),
        border: Color(0xFFFDE68A),
      );
    }
    if (status == 'waived') {
      return const _FeeStatusConfig(
        label: 'WAIVED',
        color: Color(0xFF7C3AED),
        bg: Color(0xFFF3EEFF),
        border: Color(0xFFDDD6FE),
      );
    }
    return const _FeeStatusConfig(
      label: 'UNPAID',
      color: Color(0xFFDC2626),
      bg: Color(0xFFFEE2E2),
      border: Color(0xFFFCA5A5),
    );
  }

  _TypeConfig _getTypeConfig(String type) {
    if (type.contains('trans')) {
      return const _TypeConfig(
        label: 'TRANSPORT',
        color: Color(0xFFC2410C),
        bg: Color(0xFFFFF1DF),
      );
    }
    if (type.contains('hostel')) {
      return const _TypeConfig(
        label: 'HOSTEL',
        color: Color(0xFF7C3AED),
        bg: Color(0xFFF3E8FF),
      );
    }
    return const _TypeConfig(
      label: 'ACADEMIC',
      color: Color(0xFF3B5BDB),
      bg: Color(0xFFE8EDFF),
    );
  }
}

class _FeeDonutPainter extends CustomPainter {
  final double paidPct;
  final double duePct;
  final double waivedPct;

  _FeeDonutPainter({
    required this.paidPct,
    required this.duePct,
    required this.waivedPct,
  });

  @override
  void paint(Canvas canvas, Size size) {
    const strokeWidth = 11.0;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    final bgPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    canvas.drawCircle(center, radius, bgPaint);

    final rect = Rect.fromCircle(center: center, radius: radius);
    double startAngle = -math.pi / 2;

    if (paidPct > 0) {
      final sweepAngle = paidPct * 2 * math.pi;
      final paidPaint = Paint()
        ..color = const Color(0xFF059669)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, startAngle, sweepAngle, false, paidPaint);
      startAngle += sweepAngle;
    }

    if (duePct > 0) {
      final sweepAngle = duePct * 2 * math.pi;
      final duePaint = Paint()
        ..color = const Color(0xFFDC2626)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, startAngle, sweepAngle, false, duePaint);
      startAngle += sweepAngle;
    }

    if (waivedPct > 0) {
      final sweepAngle = waivedPct * 2 * math.pi;
      final waivedPaint = Paint()
        ..color = const Color(0xFF7C3AED)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, startAngle, sweepAngle, false, waivedPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _FeeDonutPainter oldDelegate) =>
      oldDelegate.paidPct != paidPct ||
      oldDelegate.duePct != duePct ||
      oldDelegate.waivedPct != waivedPct;
}

class _FeeStatusConfig {
  final String label;
  final Color color;
  final Color bg;
  final Color border;

  const _FeeStatusConfig({
    required this.label,
    required this.color,
    required this.bg,
    required this.border,
  });
}

class _TypeConfig {
  final String label;
  final Color color;
  final Color bg;

  const _TypeConfig({
    required this.label,
    required this.color,
    required this.bg,
  });
}
