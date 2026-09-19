import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

class FeesScreen extends ConsumerStatefulWidget {
  const FeesScreen({super.key});

  @override
  ConsumerState<FeesScreen> createState() => _FeesScreenState();
}

class _FeesScreenState extends ConsumerState<FeesScreen> {
  bool _isLoading = true;
  String? _error;
  List<dynamic> _collections = [];
  String _filter = 'all'; // 'all', 'pending', 'paid'

  @override
  void initState() {
    super.initState();
    _loadFees();
  }

  Future<void> _loadFees() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final client = ref.read(apiClientProvider);

    try {
      final res = await client.get(ApiConstants.studentFeeCollections);
      final list = res is List ? res : (res is Map && res['data'] is List ? res['data'] as List : []);

      setState(() {
        _collections = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final currencySymbol = user?.currencySymbol ?? '\$';

    num totalBilled = 0;
    num totalPaid = 0;

    for (final c in _collections) {
      final total = num.tryParse(c['total_amount']?.toString() ?? c['amount']?.toString() ?? '0') ?? 0;
      final paid = num.tryParse(c['paid_amount']?.toString() ?? '0') ?? 0;
      totalBilled += total;
      totalPaid += paid;
    }
    final balanceDue = totalBilled - totalPaid;

    final filteredList = _collections.where((c) {
      final status = c['status']?.toString().toLowerCase() ?? 'pending';
      if (_filter == 'pending') return status != 'paid';
      if (_filter == 'paid') return status == 'paid';
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Fee & Invoices'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadFees,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
                        const SizedBox(height: 12),
                        Text('Could not load fees', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 8),
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadFees, child: const Text('Try Again')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadFees,
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverPadding(
                        padding: const EdgeInsets.all(16),
                        sliver: SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Summary Balance Banner
                              Container(
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [AppColors.primary, AppColors.primaryDark],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Text('Remaining Balance Due', style: TextStyle(color: Colors.white70, fontSize: 13)),
                                    const SizedBox(height: 6),
                                    Text(
                                      CurrencyFormatter.format(balanceDue, symbol: currencySymbol),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 32,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text('Total Invoiced', style: TextStyle(color: Colors.white60, fontSize: 11)),
                                              const SizedBox(height: 2),
                                              Text(
                                                CurrencyFormatter.format(totalBilled, symbol: currencySymbol),
                                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Text('Total Paid', style: TextStyle(color: Colors.white60, fontSize: 11)),
                                              const SizedBox(height: 2),
                                              Text(
                                                CurrencyFormatter.format(totalPaid, symbol: currencySymbol),
                                                style: const TextStyle(color: AppColors.successLight, fontWeight: FontWeight.bold, fontSize: 15),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 20),

                              // Filter Chips
                              Row(
                                children: [
                                  _buildFilterChip('All', 'all'),
                                  const SizedBox(width: 8),
                                  _buildFilterChip('Pending', 'pending'),
                                  const SizedBox(width: 8),
                                  _buildFilterChip('Paid', 'paid'),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      if (filteredList.isEmpty)
                        SliverPadding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          sliver: SliverToBoxAdapter(
                            child: Container(
                              padding: const EdgeInsets.all(32),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: const Column(
                                children: [
                                  Icon(Icons.receipt_long_outlined, size: 40, color: AppColors.textMuted),
                                  SizedBox(height: 8),
                                  Text('No invoices in this category', style: TextStyle(color: AppColors.textSecondary)),
                                ],
                              ),
                            ),
                          ),
                        )
                      else
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          sliver: SliverList.separated(
                            itemCount: filteredList.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 10),
                            itemBuilder: (context, index) {
                              final item = filteredList[index];
                              final name = item['fee_name'] ?? item['name'] ?? 'School Fee';
                              final total = num.tryParse(item['total_amount']?.toString() ?? item['amount']?.toString() ?? '0') ?? 0;
                              final paid = num.tryParse(item['paid_amount']?.toString() ?? '0') ?? 0;
                              final due = total - paid;
                              final dueDate = item['due_date']?.toString();
                              final status = (item['status'] ?? (due <= 0 ? 'paid' : 'pending')).toString().toLowerCase();
                              final isPaid = status == 'paid' || due <= 0;

                              return Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: (isPaid ? AppColors.success : AppColors.warning).withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Icon(
                                        isPaid ? Icons.check_circle_outline_rounded : Icons.pending_actions_rounded,
                                        color: isPaid ? AppColors.success : AppColors.warning,
                                        size: 22,
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            name,
                                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppColors.textPrimary),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            dueDate != null && dueDate.isNotEmpty
                                                ? 'Due: ${DateFormatter.formatString(dueDate)}'
                                                : 'Regular billing',
                                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          CurrencyFormatter.format(total, symbol: currencySymbol),
                                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.textPrimary),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          isPaid ? 'PAID' : 'DUE: ${CurrencyFormatter.format(due, symbol: currencySymbol)}',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                            color: isPaid ? AppColors.success : AppColors.error,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isSelected = _filter == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => setState(() => _filter = value),
      selectedColor: AppColors.primary,
      backgroundColor: AppColors.surface,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppColors.textSecondary,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
    );
  }
}
