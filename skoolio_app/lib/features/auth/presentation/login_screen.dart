import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../app/app.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/models.dart';
import 'auth_providers.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  // forcedRole locks the tab on flavor builds; null = both tabs visible.
  UserRole _selectedRole = UserRole.student;

  @override
  void initState() {
    super.initState();
    final forced = ref.read(appForcedRoleProvider);
    if (forced == 'teacher') _selectedRole = UserRole.faculty;
  }

  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _switchRole(UserRole role) {
    if (_selectedRole == role) return;
    setState(() {
      _selectedRole = role;
      _identifierController.clear();
      _passwordController.clear();
    });
    ref.read(authStateProvider.notifier).clearError();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    final notifier = ref.read(authStateProvider.notifier);

    // FIX: do not manually call context.go() after login.
    // GoRouter's redirect (routes.dart) detects the auth state change
    // via _AuthRouterNotifier and navigates automatically.
    // Calling context.go() here would race with that redirect.
    if (_selectedRole == UserRole.student) {
      await notifier.loginStudent(
        identifier: _identifierController.text.trim(),
        password: _passwordController.text,
      );
    } else {
      await notifier.loginTeacher(
        email: _identifierController.text.trim(),
        password: _passwordController.text,
      );
    }
    // Navigation happens automatically via GoRouter redirect.
  }

  void _showServerSettingsDialog() {
    final client = ref.read(apiClientProvider);
    final currentUrl = client.dio.options.baseUrl;
    final controller = TextEditingController(text: currentUrl);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Server Configuration',
          style: GoogleFonts.dmSans(fontWeight: FontWeight.w700),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Set the API server address for testing or local development:',
              style: GoogleFonts.dmSans(
                  fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              style: GoogleFonts.dmSans(fontSize: 14),
              decoration: const InputDecoration(
                labelText: 'Server URL',
                hintText: 'e.g. http://10.0.2.2:5001',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              controller.text = ApiConstants.defaultBaseUrl;
            },
            child: const Text('Reset Default'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(minimumSize: Size.zero),
            onPressed: () {
              final newUrl = controller.text.trim();
              client.updateBaseUrl(newUrl);
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                    content:
                        Text('Server updated to: $newUrl')),
              );
            },
            child: const Text('Save'),
          ),
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
            onPressed: _showServerSettingsDialog,
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Branding Header ────────────────────────────────────
                  Center(
                    child: Column(
                      children: [
                        // Real logo with graceful fallback
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
                          child: Image.asset(
                            'assets/Logo.png',
                            fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.school_rounded,
                              color: AppColors.accent,
                              size: 38,
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          'Skoolio',
                          style: GoogleFonts.dmSans(
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                            letterSpacing: -0.8,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Sign in to access your school portal',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.dmSans(
                            fontSize: 14,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),

                  // ── Role Switcher ──────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceVariant,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: _RoleTab(
                            title: 'Student / Parent',
                            icon: Icons.person_rounded,
                            isSelected: _selectedRole == UserRole.student,
                            onTap: () => _switchRole(UserRole.student),
                          ),
                        ),
                        Expanded(
                          child: _RoleTab(
                            title: 'Teacher',
                            icon: Icons.co_present_rounded,
                            isSelected: _selectedRole == UserRole.faculty,
                            onTap: () => _switchRole(UserRole.faculty),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // ── Error Banner ───────────────────────────────────────
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
                            child: Text(
                              authState.errorMessage!,
                              style: GoogleFonts.dmSans(
                                color: AppColors.error,
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // ── Form Card ──────────────────────────────────────────
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
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Card heading with Nepali rupee icon when relevant
                          Row(
                            children: [
                              Text(
                                _selectedRole == UserRole.student
                                    ? 'Student / Parent Login'
                                    : 'Teacher Login',
                                style: GoogleFonts.dmSans(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const Spacer(),
                              // Nepali rupee SVG — decorative currency indicator
                              SvgPicture.asset(
                                'assets/icons/nepali-currency.svg',
                                width: 20,
                                height: 20,
                                colorFilter: const ColorFilter.mode(
                                  AppColors.textMuted,
                                  BlendMode.srcIn,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),

                          // Identifier field
                          TextFormField(
                            controller: _identifierController,
                            keyboardType:
                                _selectedRole == UserRole.student
                                    ? TextInputType.text
                                    : TextInputType.emailAddress,
                            style: GoogleFonts.dmSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textPrimary,
                            ),
                            decoration: InputDecoration(
                              labelText: _selectedRole == UserRole.student
                                  ? 'Admission No. or Email'
                                  : 'Email Address',
                              hintText: _selectedRole == UserRole.student
                                  ? 'Enter admission number or email'
                                  : 'teacher@school.com',
                              prefixIcon: Icon(
                                _selectedRole == UserRole.student
                                    ? Icons.badge_outlined
                                    : Icons.email_outlined,
                                color: AppColors.textMuted,
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.trim().isEmpty) {
                                return _selectedRole == UserRole.student
                                    ? 'Please enter your admission number or email'
                                    : 'Please enter your email address';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),

                          // Password field
                          TextFormField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            style: GoogleFonts.dmSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textPrimary,
                            ),
                            decoration: InputDecoration(
                              labelText: 'Password',
                              hintText: 'Enter your password',
                              prefixIcon: const Icon(
                                Icons.lock_outline_rounded,
                                color: AppColors.textMuted,
                              ),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off_outlined
                                      : Icons.visibility_outlined,
                                  color: AppColors.textMuted,
                                ),
                                onPressed: () => setState(
                                    () => _obscurePassword = !_obscurePassword),
                              ),
                            ),
                            validator: (val) {
                              if (val == null || val.isEmpty) {
                                return 'Please enter your password';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 22),

                          // Sign In button
                          ElevatedButton(
                            onPressed: authState.isLoading ? null : _submit,
                            child: authState.isLoading
                                ? const SizedBox(
                                    height: 22,
                                    width: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.5,
                                      color: Colors.white,
                                    ),
                                  )
                                : Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        'Sign In as '
                                        '${_selectedRole == UserRole.student ? "Student" : "Teacher"}',
                                        style: GoogleFonts.dmSans(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
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

                  // ── Admin Notice ────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline_rounded,
                            color: AppColors.info, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Are you a School Administrator? '
                            'Please use the Web Portal on your browser.',
                            style: GoogleFonts.dmSans(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // ── Powered-by footer ───────────────────────────────────
                  Center(
                    child: Text(
                      'Powered by Skoolio • Nepal & India',
                      style: GoogleFonts.dmSans(
                        fontSize: 11,
                        color: AppColors.textMuted,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
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

// ── Role Tab ──────────────────────────────────────────────────────────────────

class _RoleTab extends StatelessWidget {
  final String title;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _RoleTab({
    required this.title,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 17,
              color:
                  isSelected ? AppColors.primary : AppColors.textMuted,
            ),
            const SizedBox(width: 7),
            Text(
              title,
              style: GoogleFonts.dmSans(
                fontSize: 13,
                fontWeight:
                    isSelected ? FontWeight.w600 : FontWeight.w500,
                color: isSelected
                    ? AppColors.primary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
