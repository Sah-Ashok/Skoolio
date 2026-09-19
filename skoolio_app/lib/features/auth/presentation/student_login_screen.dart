// Student-only login screen — used by the `student` flavor APK.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import 'auth_providers.dart';

class StudentLoginScreen extends ConsumerStatefulWidget {
  const StudentLoginScreen({super.key});

  @override
  ConsumerState<StudentLoginScreen> createState() =>
      _StudentLoginScreenState();
}

class _StudentLoginScreenState extends ConsumerState<StudentLoginScreen> {
  final _formKey              = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController   = TextEditingController();
  bool _obscurePassword       = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    await ref.read(authStateProvider.notifier).loginStudent(
          identifier: _identifierController.text.trim(),
          password:   _passwordController.text,
        );
  }

  void _showServerDialog() {
    final client     = ref.read(apiClientProvider);
    final controller = TextEditingController(text: client.dio.options.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Server Settings',
            style: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
              labelText: 'API URL', hintText: 'https://your-server.com'),
        ),
        actions: [
          TextButton(
              onPressed: () => controller.text = ApiConstants.defaultBaseUrl,
              child: const Text('Reset')),
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
              style: ElevatedButton.styleFrom(minimumSize: Size.zero),
              onPressed: () {
                client.updateBaseUrl(controller.text.trim());
                Navigator.pop(ctx);
              },
              child: const Text('Save')),
        ],
      ),
    ).whenComplete(() => controller.dispose());
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined,
                color: AppColors.textSecondary),
            tooltip: 'Server Settings',
            onPressed: _showServerDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Branding ─────────────────────────────────────────
                  Center(
                    child: Column(
                      children: [
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primary.withValues(alpha: 0.22),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Image.asset('assets/Logo.png',
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => const Icon(
                                    Icons.person_rounded,
                                    color: AppColors.accent,
                                    size: 38,
                                  )),
                        ),
                        const SizedBox(height: 18),
                        Text('Skoolio Student',
                            style: GoogleFonts.dmSans(
                                fontSize: 28,
                                fontWeight: FontWeight.w800,
                                color: AppColors.primary,
                                letterSpacing: -0.8)),
                        const SizedBox(height: 6),
                        Text('Sign in to your student portal',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.dmSans(
                                fontSize: 14,
                                color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // ── Error Banner ──────────────────────────────────────
                  if (authState.errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.errorLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: AppColors.error.withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              color: AppColors.error, size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(authState.errorMessage!,
                                style: GoogleFonts.dmSans(
                                    color: AppColors.error,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── Form Card ─────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 16,
                            offset: const Offset(0, 4))
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.school_rounded,
                                  color: AppColors.primary, size: 22),
                              const SizedBox(width: 8),
                              Text('Student / Parent Login',
                                  style: GoogleFonts.dmSans(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w700,
                                      color: AppColors.textPrimary,
                                      letterSpacing: -0.3)),
                              const Spacer(),
                              SvgPicture.asset(
                                  'assets/icons/nepali-currency.svg',
                                  width: 18,
                                  height: 18,
                                  colorFilter: const ColorFilter.mode(
                                      AppColors.textMuted, BlendMode.srcIn)),
                            ],
                          ),
                          const SizedBox(height: 20),
                          TextFormField(
                            controller: _identifierController,
                            keyboardType: TextInputType.text,
                            style: GoogleFonts.dmSans(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textPrimary),
                            decoration: const InputDecoration(
                              labelText: 'Admission No. or Email',
                              hintText: 'Enter admission number or email',
                              prefixIcon: Icon(Icons.badge_outlined,
                                  color: AppColors.textMuted),
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Please enter your admission number or email'
                                : null,
                          ),
                          const SizedBox(height: 14),
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: GoogleFonts.dmSans(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textPrimary),
                            decoration: InputDecoration(
                              labelText: 'Password',
                              hintText: 'Enter your password',
                              prefixIcon: const Icon(
                                  Icons.lock_outline_rounded,
                                  color: AppColors.textMuted),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  color: AppColors.textMuted,
                                ),
                                onPressed: () => setState(() =>
                                    _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (v) => (v == null || v.isEmpty)
                                ? 'Please enter your password'
                                : null,
                          ),
                          const SizedBox(height: 22),
                          ElevatedButton(
                            onPressed: authState.isLoading ? null : _submit,
                            child: authState.isLoading
                                ? const SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        color: Colors.white))
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text('Sign In as Student',
                                          style: GoogleFonts.dmSans(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w600)),
                                      const SizedBox(width: 8),
                                      const Icon(
                                          Icons.arrow_forward_rounded,
                                          size: 18),
                                    ],
                                  ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Footer notice ─────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.border)),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline_rounded,
                            color: AppColors.info, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Teachers & Admins: use the Skoolio Teacher app or Web Portal.',
                            style: GoogleFonts.dmSans(
                                fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Center(
                    child: Text('Powered by Skoolio • Nepal & India',
                        style: GoogleFonts.dmSans(
                            fontSize: 11, color: AppColors.textMuted)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
