import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

final activeBankAccountsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.activeBankAccounts);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['accounts'] is List) {
      return res['accounts'] as List;
    }
  } catch (_) {}
  return [];
});

final unpaidFeeCollectionsProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  try {
    final res = await client.get(ApiConstants.studentFees);
    final list = res is List
        ? res
        : (res is Map<String, dynamic> && res['collections'] is List)
            ? (res['collections'] as List)
            : [];
    return list.where((c) {
      final status = c['status']?.toString().toLowerCase();
      final remaining = num.tryParse((c['remaining_amount'] ?? c['due_amount'] ?? '0').toString()) ?? 0;
      return status != 'paid' && status != 'waived' && remaining > 0;
    }).toList();
  } catch (_) {}
  return [];
});

class StudentBankPaymentScreen extends ConsumerStatefulWidget {
  const StudentBankPaymentScreen({super.key});

  @override
  ConsumerState<StudentBankPaymentScreen> createState() => _StudentBankPaymentScreenState();
}

class _StudentBankPaymentScreenState extends ConsumerState<StudentBankPaymentScreen> {
  final _formKey = GlobalKey<FormState>();
  int? _selectedFeeCollectionId;
  int? _selectedBankAccountId;
  final _amountController = TextEditingController();
  final _refController = TextEditingController();
  final _notesController = TextEditingController();
  DateTime _paymentDate = DateTime.now();

  bool _isSubmitting = false;

  @override
  void dispose() {
    _amountController.dispose();
    _refController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _paymentDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => _paymentDate = picked);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedFeeCollectionId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select the fee invoice to pay'), backgroundColor: AppColors.error),
      );
      return;
    }
    if (_selectedBankAccountId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select the bank account you deposited to'), backgroundColor: AppColors.error),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    final client = ref.read(apiClientProvider);

    try {
      await client.post(
        ApiConstants.studentOnlinePaymentRequests,
        data: {
          'fee_collection_id': _selectedFeeCollectionId,
          'bank_account_id': _selectedBankAccountId,
          'amount': double.parse(_amountController.text.trim()),
          'payment_date': DateFormat('yyyy-MM-dd').format(_paymentDate),
          if (_refController.text.trim().isNotEmpty) 'transaction_ref': _refController.text.trim(),
          if (_notesController.text.trim().isNotEmpty) 'notes': _notesController.text.trim(),
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Payment request submitted for school verification!'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pushReplacement('/student/fees/my-submissions');
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Submission failed: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final currencySymbol = user?.currencySymbol ?? '\$';
    final bankAccountsAsync = ref.watch(activeBankAccountsProvider);
    final unpaidFeesAsync = ref.watch(unpaidFeeCollectionsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Bank Deposit Payment', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.history_rounded),
            tooltip: 'My Submissions',
            onPressed: () => context.push('/student/fees/my-submissions'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Section 1: School Bank Accounts ──
            Row(
              children: const [
                Icon(Icons.account_balance_rounded, color: AppColors.accent, size: 20),
                SizedBox(width: 8),
                Text(
                  'School Bank Accounts',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.textPrimary),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text(
              'Deposit or transfer fees to any of the verified school accounts below:',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),

            bankAccountsAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (e, _) => Text('Error loading bank accounts: $e'),
              data: (accounts) {
                if (accounts.isEmpty) {
                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const Center(
                      child: Text(
                        'No school bank accounts currently listed. Please contact the administration.',
                        style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                      ),
                    ),
                  );
                }

                return Column(
                  children: accounts.map((acc) {
                    final bName = acc['bank_name'] ?? 'Bank';
                    final aName = acc['account_name'] ?? '';
                    final aNum = acc['account_number']?.toString() ?? '';
                    final branch = acc['branch_name'] ?? '';

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
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
                              color: const Color(0xFFEFF6FF),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.account_balance, color: Color(0xFF2563EB), size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  bName,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'A/C: $aNum',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF1E293B)),
                                ),
                                Text(
                                  'Name: $aName${branch.isNotEmpty ? ' · $branch' : ''}',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy_rounded, size: 18, color: Color(0xFF2563EB)),
                            tooltip: 'Copy Account Number',
                            onPressed: () {
                              Clipboard.setData(ClipboardData(text: aNum));
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Account number $aNum copied!'),
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                );
              },
            ),

            const SizedBox(height: 20),

            // ── Section 2: Payment Proof Submission Form ──
            Row(
              children: const [
                Icon(Icons.receipt_long_rounded, color: AppColors.accent, size: 20),
                SizedBox(width: 8),
                Text(
                  'Submit Deposit Slip / Reference',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.textPrimary),
                ),
              ],
            ),
            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Fee invoice dropdown
                    unpaidFeesAsync.when(
                      loading: () => const LinearProgressIndicator(),
                      error: (e, _) => Text('Error loading invoices: $e'),
                      data: (fees) {
                        if (fees.isEmpty) {
                          return Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.successLight,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text(
                              'You have no pending fee dues. All invoices are cleared!',
                              style: TextStyle(color: AppColors.success, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          );
                        }

                        return DropdownButtonFormField<int>(
                          initialValue: _selectedFeeCollectionId,
                          decoration: const InputDecoration(
                            labelText: 'Select Pending Fee Invoice',
                            prefixIcon: Icon(Icons.receipt_outlined, size: 20),
                          ),
                          items: fees.map<DropdownMenuItem<int>>((f) {
                            final title = f['fee_name'] ?? f['title'] ?? f['fee_structure_name'] ?? 'Fee';
                            final due = f['remaining_amount'] ?? f['due_amount'] ?? 0;
                            return DropdownMenuItem<int>(
                              value: f['id'] is int ? f['id'] : int.tryParse(f['id'].toString()),
                              child: Text(
                                '$title (${CurrencyFormatter.format(due, symbol: currencySymbol)} due)',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                              ),
                            );
                          }).toList(),
                          onChanged: (id) {
                            setState(() => _selectedFeeCollectionId = id);
                            if (id != null) {
                              final sel = fees.firstWhere((element) => element['id'] == id, orElse: () => null);
                              if (sel != null) {
                                final due = sel['remaining_amount'] ?? sel['due_amount'] ?? '';
                                _amountController.text = due.toString();
                              }
                            }
                          },
                        );
                      },
                    ),

                    const SizedBox(height: 14),

                    // Bank account dropdown
                    bankAccountsAsync.when(
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                      data: (accounts) {
                        return DropdownButtonFormField<int>(
                          initialValue: _selectedBankAccountId,
                          decoration: const InputDecoration(
                            labelText: 'Paid to Bank Account',
                            prefixIcon: Icon(Icons.account_balance_outlined, size: 20),
                          ),
                          items: accounts.map<DropdownMenuItem<int>>((a) {
                            final id = a['id'] is int ? a['id'] : int.tryParse(a['id'].toString());
                            final bName = a['bank_name'] ?? 'Bank';
                            final aNum = a['account_number'] ?? '';
                            return DropdownMenuItem<int>(
                              value: id,
                              child: Text('$bName - $aNum', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                            );
                          }).toList(),
                          onChanged: (id) => setState(() => _selectedBankAccountId = id),
                        );
                      },
                    ),

                    const SizedBox(height: 14),

                    // Amount Deposited
                    TextFormField(
                      controller: _amountController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Amount Paid ($currencySymbol)',
                        prefixIcon: const Icon(Icons.payments_outlined, size: 20),
                      ),
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Please enter amount paid';
                        final numVal = double.tryParse(v.trim());
                        if (numVal == null || numVal <= 0) return 'Please enter a valid amount';
                        return null;
                      },
                    ),

                    const SizedBox(height: 14),

                    // Payment Date
                    InkWell(
                      onTap: _pickDate,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today_outlined, size: 18, color: AppColors.textSecondary),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Payment Date', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                                  Text(
                                    DateFormat('MMMM dd, yyyy').format(_paymentDate),
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 14),

                    // Transaction / Deposit Slip Reference
                    TextFormField(
                      controller: _refController,
                      decoration: const InputDecoration(
                        labelText: 'Transaction / Reference ID',
                        hintText: 'e.g. TXN98765432 or Slip #',
                        prefixIcon: Icon(Icons.tag_rounded, size: 20),
                      ),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Transaction reference is required' : null,
                    ),

                    const SizedBox(height: 14),

                    // Notes / Remarks
                    TextFormField(
                      controller: _notesController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Remarks / Notes (Optional)',
                        hintText: 'Additional details about the deposit',
                        prefixIcon: Icon(Icons.notes_rounded, size: 20),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Submit Button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accent,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: _isSubmitting ? null : _submit,
                        icon: _isSubmitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.send_rounded, size: 20),
                        label: Text(
                          _isSubmitting ? 'Submitting...' : 'Submit Payment Request',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
