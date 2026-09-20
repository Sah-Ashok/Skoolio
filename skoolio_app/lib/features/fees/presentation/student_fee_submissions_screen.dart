import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

final feeSubmissionsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentMyPaymentRequests);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['requests'] is List) {
      return res['requests'] as List;
    }
  } catch (_) {}
  return [];
});

class StudentFeeSubmissionsScreen extends ConsumerWidget {
  const StudentFeeSubmissionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).user;
    final currencySymbol = user?.currencySymbol ?? '\$';
    final submissionsAsync = ref.watch(feeSubmissionsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Payment Submissions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async => ref.refresh(feeSubmissionsProvider.future),
        child: submissionsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error loading submissions: $err')),
          data: (items) {
            if (items.isEmpty) {
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                  Center(
                    child: Column(
                      children: const [
                        Icon(Icons.upload_file_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No payment slips submitted', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text('Online or bank payment submissions will appear here.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final bankName = item['bank_name'] ?? item['account_name'] ?? 'Bank Transfer';
                final amount = item['amount'] ?? 0;
                final status = item['status']?.toString().toLowerCase() ?? 'pending';
                final date = item['created_at']?.toString() ?? '';
                final remarks = item['remarks']?.toString();

                Color statusColor;
                Color statusBg;
                String statusLabel;

                switch (status) {
                  case 'verified':
                  case 'approved':
                    statusColor = AppColors.success;
                    statusBg = AppColors.successLight;
                    statusLabel = 'Verified';
                    break;
                  case 'rejected':
                    statusColor = AppColors.error;
                    statusBg = AppColors.errorLight;
                    statusLabel = 'Rejected';
                    break;
                  case 'pending':
                  default:
                    statusColor = AppColors.warning;
                    statusBg = AppColors.warningLight;
                    statusLabel = 'Pending Review';
                    break;
                }

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            bankName.toString(),
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: statusBg,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              statusLabel,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: statusColor,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            date.length > 10 ? date.substring(0, 10) : date,
                            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                          ),
                          Text(
                            CurrencyFormatter.format(amount, symbol: currencySymbol),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                          ),
                        ],
                      ),
                      if (remarks != null && remarks.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Note: $remarks',
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontStyle: FontStyle.italic),
                        ),
                      ],
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
        icon: const Icon(Icons.add_rounded),
        label: const Text('New Submission', style: TextStyle(fontWeight: FontWeight.bold)),
        onPressed: () => context.push('/student/fees/bank-payment'),
      ),
    );
  }
}
