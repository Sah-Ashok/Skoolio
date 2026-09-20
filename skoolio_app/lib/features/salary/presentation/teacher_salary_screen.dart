import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
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

class TeacherSalaryScreen extends ConsumerWidget {
  const TeacherSalaryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).user;
    final currencySymbol = user?.currencySymbol ?? '\$';
    final salaryAsync = ref.watch(teacherSalaryHistoryProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('My Payroll & Salary', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async => ref.refresh(teacherSalaryHistoryProvider.future),
        child: salaryAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error loading salary records: $err')),
          data: (salaries) {
            if (salaries.isEmpty) {
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                  Center(
                    child: Column(
                      children: const [
                        Icon(Icons.payments_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No salary slips found', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text('Payroll records will appear once processed by administration.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: salaries.length,
              itemBuilder: (context, index) {
                final item = salaries[index];
                final month = item['month'] ?? item['salary_month'] ?? 'Month';
                final year = item['year'] ?? item['salary_year'] ?? '';
                final net = item['net_salary'] ?? item['amount'] ?? 0;
                final status = item['status']?.toString() ?? 'paid';
                final isPaid = status.toLowerCase() == 'paid';

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
                          isPaid ? Icons.check_circle_rounded : Icons.pending_rounded,
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
                              '$month $year'.trim(),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Disbursement Status: ${status.toUpperCase()}',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        CurrencyFormatter.format(net, symbol: currencySymbol),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isPaid ? AppColors.success : AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
