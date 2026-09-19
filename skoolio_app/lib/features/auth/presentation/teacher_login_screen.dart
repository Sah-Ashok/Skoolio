// Teacher-only login screen — used by the `teacher` flavor APK.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import 'auth_providers.dart';

// Teacher accent: teal/green palette to visually distinguish from student (blue)
const _teacherColor = Color(0xFF0D9488); // teal-600
const _teacherColorBg = Color(0xFFF0FDFA);
const _teacherColorBorder = Color(0xFF99F6E4);

class TeacherLoginScreen extends ConsumerStatefulWidget {
  const TeacherLoginScreen({super.key});

  @override
  ConsumerState<TeacherLoginScreen> createState() =>
      _TeacherLoginScreenState();
}

class _TeacherLoginScreenState extends ConsumerState<TeacherLoginScreen> {
  final _formKey            = GlobalKey<FormState>();
  final _emailController    = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword     = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    await ref.read(authStateProvider.notifier).loginTeacher(
          email:    _emailController.text.trim(),
          password: _passwordController.text,
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
                            color: _teacherColor,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: _teacherColor.withValues(alpha: 0.25),
                                blurRadius: 20,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: Image.asset('assets/Logo.png',
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => const Icon(
                                    Icons.co_present_rounded,
                                    color: Colors.white,
                                    size: 38,
                                  )),
                        ),
                        const SizedBox(height: 18),
                        Text('Skoolio Teacher',
                            style: GoogleFonts.dmSans(
                                fontSize: 28,
                                fontWeight: FontWeight.w800,
                                color: _teacherColor,
                                letterSpacing: -0.8)),
                        const SizedBox(height: 6),
                        Text('Sign in to your faculty portal',
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
                              const Icon(Icons.co_present_rounded,
                                  color: _teacherColor, size: 22),
                              const SizedBox(width: 8),
                              Text('Teacher Login',
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
                            controller: _emailController,
                            keyboardType: TextInputType.emailAddress,
                            style: GoogleFonts.dmSans(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: AppColors.textPrimary),
                            decoration: const InputDecoration(
                              labelText: 'Email Address',
                              hintText: 'teacher@school.com',
                              prefixIcon: Icon(Icons.email_outlined,
                                  color: AppColors.textMuted),
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty)
                                ? 'Please enter your email address'
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
                            style: ElevatedButton.styleFrom(
                                backgroundColor: _teacherColor,
                                foregroundColor: Colors.white),
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
                                      Text('Sign In as Teacher',
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

                  // ── Faculty badge ─────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                        color: _teacherColorBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: _teacherColorBorder)),
                    child: Row(
                      children: [
                        const Icon(Icons.verified_outlined,
                            color: _teacherColor, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'This app is exclusively for faculty members. '
                            'Students: use the Skoolio Student app.',
                            style: GoogleFonts.dmSans(
                                fontSize: 12, color: _teacherColor),
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
