import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

final studentFeesListProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentFees);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['collections'] is List) {
      return res['collections'] as List;
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
        title: const Text('Fee Invoices & Dues', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_balance_wallet_outlined),
            tooltip: 'Pay via Bank Transfer',
            onPressed: () => context.push('/student/fees/bank-payment'),
          ),
          IconButton(
            icon: const Icon(Icons.history_edu_rounded),
            tooltip: 'Payment Submissions',
            onPressed: () => context.push('/student/fees/my-submissions'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async => ref.refresh(studentFeesListProvider.future),
        child: feesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error loading fee records: $err')),
          data: (invoices) {
            if (invoices.isEmpty) {
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                  Center(
                    child: Column(
                      children: const [
                        Icon(Icons.receipt_long_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No fee invoices found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text('All fees are cleared or not yet generated.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: invoices.length,
              itemBuilder: (context, index) {
                final inv = invoices[index];
                final title = inv['fee_name'] ?? inv['title'] ?? inv['fee_structure_name'] ?? 'Tuition Fee';
                final total = inv['total_amount'] ?? inv['amount'] ?? 0;
                final paid = inv['paid_amount'] ?? 0;
                final due = inv['remaining_amount'] ?? inv['due_amount'] ?? (total - paid);
                final isPaid = (num.tryParse(due.toString()) ?? 0) <= 0 || inv['status']?.toString().toLowerCase() == 'paid';

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: isPaid ? AppColors.successLight : AppColors.warningLight,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          isPaid ? Icons.check_circle_rounded : Icons.pending_actions_rounded,
                          color: isPaid ? AppColors.success : AppColors.warning,
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title.toString(),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Paid: ${CurrencyFormatter.format(paid, symbol: currencySymbol)}  •  Total: ${CurrencyFormatter.format(total, symbol: currencySymbol)}',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            CurrencyFormatter.format(due, symbol: currencySymbol),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: isPaid ? AppColors.success : AppColors.error,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isPaid ? 'Paid' : 'Pending',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: isPaid ? AppColors.success : AppColors.error,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.payment_rounded),
        label: const Text('Pay via Bank / Online', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: () => context.push('/student/fees/bank-payment'),
      ),
    );
  }
}
