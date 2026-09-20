import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

final teacherSalaryHistoryProvider = FutureProvider<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.teacherSalary);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['salaries'] is List) {
      return res['salaries'] as List;
    }
  } catch (_) {}
  return [];
});

class TeacherSalaryScreen extends ConsumerStatefulWidget {
  const TeacherSalaryScreen({super.key});

  @override
  ConsumerState<TeacherSalaryScreen> createState() => _TeacherSalaryScreenState();
}

class _TeacherSalaryScreenState extends ConsumerState<TeacherSalaryScreen> {
  final Set<int> _expandedIds = {};

  final List<String> _monthNames = const [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  String _formatMonth(dynamic m) {
    if (m is int && m >= 1 && m <= 12) {
      return _monthNames[m - 1];
    }
    final numVal = int.tryParse(m?.toString() ?? '');
    if (numVal != null && numVal >= 1 && numVal <= 12) {
      return _monthNames[numVal - 1];
    }
    return m?.toString() ?? 'Month';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final currencySymbol = user?.currencySymbol ?? '\$';
    final salaryAsync = ref.watch(teacherSalaryHistoryProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('My Salary & Slips', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: RefreshIndicator(
        color: const Color(0xFFF97316),
        onRefresh: () async => ref.refresh(teacherSalaryHistoryProvider.future),
        child: salaryAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFFF97316))),
          error: (err, _) => Center(child: Text('Error loading salary records: $err')),
          data: (salaries) {
            if (salaries.isEmpty) {
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                  Center(
                    child: Column(
                      children: const [
                        Icon(Icons.receipt_long_outlined, size: 48, color: Color(0xFF94A3B8)),
                        SizedBox(height: 12),
                        Text('No salary slips found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text(
                          'Salary slips will appear here once processed by your school administration.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }

            // Calculate summaries
            double totalEarned = 0;
            int pendingCount = 0;

            for (final s in salaries) {
              final status = s['status']?.toString().toLowerCase() ?? 'paid';
              final net = (s['net_salary'] is num ? s['net_salary'] : num.tryParse(s['net_salary']?.toString() ?? '0'))?.toDouble() ?? 0.0;
              if (status == 'paid') {
                totalEarned += net;
              } else if (status == 'pending') {
                pendingCount++;
              }
            }

            return SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── 3 KPI Cards (Next.js layout) ──
                  Row(
                    children: [
                      Expanded(
                        child: _buildKpiCard(
                          icon: Icons.receipt_outlined,
                          title: 'TOTAL SLIPS',
                          value: '${salaries.length}',
                          color: const Color(0xFF0F172A),
                          bgColor: const Color(0xFFF1F5F9),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildKpiCard(
                          icon: Icons.payments_outlined,
                          title: 'TOTAL EARNED',
                          value: CurrencyFormatter.format(totalEarned, symbol: currencySymbol),
                          color: const Color(0xFF16A34A),
                          bgColor: const Color(0xFFDCFCE7),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _buildKpiCard(
                          icon: Icons.schedule_rounded,
                          title: 'PENDING',
                          value: '$pendingCount',
                          color: const Color(0xFFF59E0B),
                          bgColor: const Color(0xFFFEF3C7),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // ── Slips Section Header ──
                  Row(
                    children: const [
                      Icon(Icons.feed_outlined, size: 16, color: Color(0xFF94A3B8)),
                      SizedBox(width: 6),
                      Text(
                        'SALARY SLIPS',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF94A3B8),
                          letterSpacing: 0.8,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  // ── Slips List ──
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: salaries.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final item = salaries[index];
                      final id = item['id'] is int ? item['id'] as int : (int.tryParse(item['id']?.toString() ?? '') ?? index);
                      final monthStr = _formatMonth(item['month'] ?? item['salary_month']);
                      final yearStr = item['year']?.toString() ?? item['salary_year']?.toString() ?? '';
                      final basic = (item['basic_salary'] is num ? item['basic_salary'] : num.tryParse(item['basic_salary']?.toString() ?? '0'))?.toDouble() ?? 0.0;
                      final bonus = (item['bonus'] is num ? item['bonus'] : num.tryParse(item['bonus']?.toString() ?? '0'))?.toDouble() ?? 0.0;
                      final deduction = (item['deduction'] is num ? item['deduction'] : num.tryParse(item['deduction']?.toString() ?? '0'))?.toDouble() ?? 0.0;
                      final net = (item['net_salary'] is num ? item['net_salary'] : num.tryParse(item['net_salary']?.toString() ?? '0'))?.toDouble() ?? (basic + bonus - deduction);
                      final status = item['status']?.toString().toLowerCase() ?? 'paid';
                      final isPaid = status == 'paid';
                      final isExpanded = _expandedIds.contains(id);
                      final payDate = item['payment_date']?.toString();
                      final method = item['payment_method']?.toString().replaceAll('_', ' ') ?? 'Bank Transfer';

                      final tax = item['tax_amount'] ?? item['tax'];
                      final pf = item['provident_fund'] ?? item['pf'];
                      final otherDed = item['other_deduction'];
                      final remarks = item['remarks']?.toString();

                      return Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isExpanded ? const Color(0xFFF97316) : const Color(0xFFE2E8F0),
                            width: isExpanded ? 1.5 : 1.0,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () {
                                setState(() {
                                  if (isExpanded) {
                                    _expandedIds.remove(id);
                                  } else {
                                    _expandedIds.add(id);
                                  }
                                });
                              },
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  children: [
                                    Row(
                                      children: [
                                        // Month Badge
                                        Container(
                                          width: 48,
                                          height: 48,
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: const Color(0xFFE2E8F0)),
                                          ),
                                          child: Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                monthStr,
                                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A)),
                                              ),
                                              Text(
                                                yearStr,
                                                style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w600),
                                              ),
                                            ],
                                          ),
                                        ),
                                        const SizedBox(width: 12),

                                        // Status & Date
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                                    decoration: BoxDecoration(
                                                      color: isPaid ? const Color(0xFFDCFCE7) : const Color(0xFFFEF3C7),
                                                      borderRadius: BorderRadius.circular(8),
                                                    ),
                                                    child: Text(
                                                      status.toUpperCase(),
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.bold,
                                                        color: isPaid ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                                                      ),
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    method.toUpperCase(),
                                                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8)),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                payDate != null
                                                    ? 'Paid on ${DateFormatter.formatString(payDate, pattern: 'MMM dd, yyyy')}'
                                                    : 'Disbursement pending',
                                                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                              ),
                                            ],
                                          ),
                                        ),

                                        // Net Salary
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            Text(
                                              CurrencyFormatter.format(net, symbol: currencySymbol),
                                              style: TextStyle(
                                                fontSize: 17,
                                                fontWeight: FontWeight.w900,
                                                color: isPaid ? const Color(0xFF16A34A) : const Color(0xFF0F172A),
                                              ),
                                            ),
                                            const Text('Net Salary', style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                                          ],
                                        ),
                                        const SizedBox(width: 6),
                                        Icon(
                                          isExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                                          color: const Color(0xFF94A3B8),
                                          size: 20,
                                        ),
                                      ],
                                    ),

                                    // Quick earnings summary
                                    const SizedBox(height: 10),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF8FAFC),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                                        children: [
                                          _buildMiniBreakdown('BASIC', CurrencyFormatter.format(basic, symbol: currencySymbol)),
                                          if (bonus > 0)
                                            _buildMiniBreakdown('BONUS', '+${CurrencyFormatter.format(bonus, symbol: currencySymbol)}', color: const Color(0xFF16A34A)),
                                          if (deduction > 0)
                                            _buildMiniBreakdown('DEDUCTIONS', '-${CurrencyFormatter.format(deduction, symbol: currencySymbol)}', color: const Color(0xFFEF4444)),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Expandable Breakdown Details
                            if (isExpanded) ...[
                              const Divider(height: 1, color: Color(0xFFE2E8F0)),
                              Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Deduction Details', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                                    const SizedBox(height: 8),
                                    _buildDetailRow('Tax Withheld', tax != null ? CurrencyFormatter.format(tax, symbol: currencySymbol) : '—'),
                                    _buildDetailRow('Provident Fund', pf != null ? CurrencyFormatter.format(pf, symbol: currencySymbol) : '—'),
                                    _buildDetailRow('Other Deductions', otherDed != null ? CurrencyFormatter.format(otherDed, symbol: currencySymbol) : '—'),
                                    if (remarks != null && remarks.isNotEmpty)
                                      _buildDetailRow('Admin Remarks', remarks),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required IconData icon,
    required String title,
    required String value,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: color),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF94A3B8), letterSpacing: 0.5),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniBreakdown(String label, String value, {Color? color}) {
    return Row(
      children: [
        Text('$label: ', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF94A3B8))),
        Text(value, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: color ?? const Color(0xFF334155))),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }
}
