import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

const _months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

class TeacherSalaryScreen extends ConsumerStatefulWidget {
  const TeacherSalaryScreen({super.key});

  @override
  ConsumerState<TeacherSalaryScreen> createState() => _TeacherSalaryScreenState();
}

class _TeacherSalaryScreenState extends ConsumerState<TeacherSalaryScreen> {
  List<dynamic> _records = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final res = await ref.read(apiClientProvider).get('/api/teachers/me/salary');
      final list = res is List ? res : (res is Map && res['data'] is List ? res['data'] as List : []);
      setState(() { _records = list; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user           = ref.watch(authStateProvider).user;
    final currencySymbol = user?.currencySymbol ?? 'Rs.';

    final totalEarned   = _records
        .where((r) => r['status']?.toString() == 'paid')
        .fold<double>(0, (s, r) => s + _toDouble(r['net_salary'] ?? r['basic_salary']));
    final pendingCount  = _records.where((r) => r['status']?.toString() == 'pending').length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('My Salary', style: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_rounded), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : _error != null
              ? Center(child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 40),
                    const SizedBox(height: 12),
                    Text(_error!, textAlign: TextAlign.center,
                        style: GoogleFonts.dmSans(fontSize: 13, color: AppColors.textSecondary)),
                    const SizedBox(height: 12),
                    ElevatedButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Summary cards ───────────────────────────────
                        Row(children: [
                          Expanded(child: _SummaryCard(
                            icon: Icons.receipt_long_rounded,
                            label: 'Records',
                            value: '${_records.length}',
                            color: AppColors.primary,
                          )),
                          const SizedBox(width: 10),
                          Expanded(child: _SummaryCard(
                            icon: Icons.payments_rounded,
                            label: 'Total Earned',
                            value: CurrencyFormatter.format(totalEarned, symbol: currencySymbol),
                            color: AppColors.success,
                          )),
                          const SizedBox(width: 10),
                          Expanded(child: _SummaryCard(
                            icon: Icons.hourglass_top_rounded,
                            label: 'Pending',
                            value: '$pendingCount',
                            color: AppColors.warning,
                          )),
                        ]),
                        const SizedBox(height: 20),

                        Text('Salary Slips',
                            style: GoogleFonts.dmSans(fontSize: 17, fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary)),
                        const SizedBox(height: 12),

                        if (_records.isEmpty)
                          Container(
                            padding: const EdgeInsets.all(32),
                            decoration: BoxDecoration(color: AppColors.surface,
                                borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
                            child: Column(
                              children: [
                                const Icon(Icons.receipt_long_outlined, size: 40, color: AppColors.textMuted),
                                const SizedBox(height: 8),
                                Text('No salary records yet.',
                                    style: GoogleFonts.dmSans(fontSize: 13, color: AppColors.textSecondary)),
                                const SizedBox(height: 4),
                                Text('Your school admin will record payments here.',
                                    style: GoogleFonts.dmSans(fontSize: 12, color: AppColors.textMuted)),
                              ],
                            ),
                          )
                        else
                          ..._records.map((rec) => _SalarySlip(record: rec, currencySymbol: currencySymbol)),
                      ],
                    ),
                  ),
                ),
    );
  }
}

double _toDouble(dynamic v) => v is double ? v : double.tryParse(v?.toString() ?? '0') ?? 0.0;

// ── Summary Card ──────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final Color color;
  const _SummaryCard({required this.icon, required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: AppColors.surface,
        borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 8),
        Text(value, style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w800,
            color: AppColors.textPrimary, letterSpacing: -0.3)),
        const SizedBox(height: 2),
        Text(label, style: GoogleFonts.dmSans(fontSize: 10, color: AppColors.textSecondary)),
      ],
    ),
  );
}

// ── Salary Slip (expandable) ──────────────────────────────────────────────────

class _SalarySlip extends StatefulWidget {
  final dynamic record;
  final String currencySymbol;
  const _SalarySlip({required this.record, required this.currencySymbol});

  @override
  State<_SalarySlip> createState() => _SalarySlipState();
}

class _SalarySlipState extends State<_SalarySlip> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final rec    = widget.record;
    final sym    = widget.currencySymbol;

    final monthIdx   = (_toInt(rec['month']) - 1).clamp(0, 11);
    final monthLabel = '${_months[monthIdx]} ${rec['year']}';
    final status     = rec['status']?.toString().toLowerCase() ?? 'pending';
    final isPaid     = status == 'paid';

    final basic      = _toDouble(rec['basic_salary']);
    final bonus      = _toDouble(rec['bonus'] ?? 0);
    final deduction  = _toDouble(rec['deduction'] ?? 0);
    final net        = _toDouble(rec['net_salary'] ?? (basic + bonus - deduction));
    final paidDate   = rec['payment_date']?.toString();
    final method     = rec['payment_method']?.toString().replaceAll('_', ' ') ?? '';
    final remarks    = rec['remarks']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: AppColors.surface,
          borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.border)),
      child: Column(
        children: [
          // ── Header row ──────────────────────────────────────────────
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: (isPaid ? AppColors.success : AppColors.warning).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isPaid ? Icons.check_circle_outline_rounded : Icons.access_time_rounded,
                      color: isPaid ? AppColors.success : AppColors.warning,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(monthLabel, style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary)),
                        const SizedBox(height: 2),
                        Text(paidDate != null && paidDate.isNotEmpty
                            ? 'Paid ${DateFormatter.formatString(paidDate)}'
                            : 'Not paid yet',
                            style: GoogleFonts.dmSans(fontSize: 11, color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(CurrencyFormatter.format(net, symbol: sym),
                          style: GoogleFonts.dmSans(fontSize: 15, fontWeight: FontWeight.w800,
                              color: AppColors.textPrimary)),
                      const SizedBox(height: 3),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: isPaid ? AppColors.successLight : AppColors.warningLight,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(isPaid ? 'PAID' : 'PENDING',
                            style: GoogleFonts.dmSans(fontSize: 10, fontWeight: FontWeight.w700,
                                color: isPaid ? AppColors.success : AppColors.warning)),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Icon(_expanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                      color: AppColors.textMuted),
                ],
              ),
            ),
          ),

          // ── Expanded detail ──────────────────────────────────────────
          if (_expanded) ...[
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Earnings
                      Expanded(
                        child: _DetailSection(
                          label: 'Earnings',
                          color: AppColors.success,
                          rows: [
                            _Row('Basic Salary', CurrencyFormatter.format(basic, symbol: sym)),
                            if (bonus > 0) _Row('Bonus', CurrencyFormatter.format(bonus, symbol: sym)),
                            _Row('Gross', CurrencyFormatter.format(basic + bonus, symbol: sym), bold: true),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Deductions
                      Expanded(
                        child: _DetailSection(
                          label: 'Deductions',
                          color: AppColors.error,
                          rows: [
                            if (_toDouble(rec['tax_amount']) > 0)
                              _Row('Tax / TDS',      CurrencyFormatter.format(_toDouble(rec['tax_amount']), symbol: sym)),
                            if (_toDouble(rec['provident_fund']) > 0)
                              _Row('PF',             CurrencyFormatter.format(_toDouble(rec['provident_fund']), symbol: sym)),
                            if (_toDouble(rec['other_deduction']) > 0)
                              _Row('Other',          CurrencyFormatter.format(_toDouble(rec['other_deduction']), symbol: sym)),
                            if (deduction > 0)
                              _Row('Total',          CurrencyFormatter.format(deduction, symbol: sym), bold: true),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Net pay banner
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.successLight,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('NET SALARY', style: GoogleFonts.dmSans(fontSize: 10, fontWeight: FontWeight.w800,
                                color: AppColors.success, letterSpacing: 0.5)),
                            Text(CurrencyFormatter.format(net, symbol: sym),
                                style: GoogleFonts.dmSans(fontSize: 20, fontWeight: FontWeight.w900,
                                    color: AppColors.success)),
                          ],
                        ),
                        if (method.isNotEmpty)
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('Method', style: GoogleFonts.dmSans(fontSize: 10, color: AppColors.textMuted)),
                              Text(method, style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary)),
                            ],
                          ),
                      ],
                    ),
                  ),

                  if (remarks != null && remarks.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: AppColors.surfaceVariant,
                          borderRadius: BorderRadius.circular(8)),
                      child: Row(
                        children: [
                          const Icon(Icons.notes_rounded, size: 14, color: AppColors.textMuted),
                          const SizedBox(width: 8),
                          Expanded(child: Text(remarks,
                              style: GoogleFonts.dmSans(fontSize: 12, color: AppColors.textSecondary))),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

int    _toInt(dynamic v) => v is int ? v : int.tryParse(v?.toString() ?? '0') ?? 0;

class _Row {
  final String label, value;
  final bool bold;
  const _Row(this.label, this.value, {this.bold = false});
}

class _DetailSection extends StatelessWidget {
  final String label;
  final Color color;
  final List<_Row> rows;
  const _DetailSection({required this.label, required this.color, required this.rows});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: color.withValues(alpha: 0.2)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w800, color: color)),
        const SizedBox(height: 8),
        ...rows.map((r) => Padding(
          padding: const EdgeInsets.only(bottom: 5),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(r.label, style: GoogleFonts.dmSans(fontSize: 11,
                  fontWeight: r.bold ? FontWeight.w700 : FontWeight.w500, color: AppColors.textSecondary)),
              Text(r.value, style: GoogleFonts.dmSans(fontSize: 11,
                  fontWeight: r.bold ? FontWeight.w800 : FontWeight.w600, color: AppColors.textPrimary)),
            ],
          ),
        )),
      ],
    ),
  );
}
