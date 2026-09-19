import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

class StudentProfileScreen extends ConsumerStatefulWidget {
  const StudentProfileScreen({super.key});

  @override
  ConsumerState<StudentProfileScreen> createState() => _StudentProfileScreenState();
}

class _StudentProfileScreenState extends ConsumerState<StudentProfileScreen> {
  Map<String, dynamic>? _profile;
  bool _loading = true;
  String? _error;

  // Password change state
  final _currentPwdCtrl  = TextEditingController();
  final _newPwdCtrl      = TextEditingController();
  final _confirmPwdCtrl  = TextEditingController();
  bool _pwdLoading = false;
  String? _pwdError;
  String? _pwdSuccess;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _currentPwdCtrl.dispose();
    _newPwdCtrl.dispose();
    _confirmPwdCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.get('/api/auth/me');
      setState(() { _profile = res is Map<String, dynamic> ? res : null; _loading = false; });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _changePassword() async {
    final cur = _currentPwdCtrl.text.trim();
    final nw  = _newPwdCtrl.text.trim();
    final cf  = _confirmPwdCtrl.text.trim();
    if (cur.isEmpty || nw.isEmpty || cf.isEmpty) {
      setState(() { _pwdError = 'All fields are required.'; _pwdSuccess = null; }); return;
    }
    if (nw.length < 6) {
      setState(() { _pwdError = 'New password must be at least 6 characters.'; _pwdSuccess = null; }); return;
    }
    if (nw != cf) {
      setState(() { _pwdError = 'New passwords do not match.'; _pwdSuccess = null; }); return;
    }
    setState(() { _pwdLoading = true; _pwdError = null; _pwdSuccess = null; });
    try {
      final client = ref.read(apiClientProvider);
      await client.post('/api/auth/change-password/student', data: {
        'current_password': cur,
        'new_password': nw,
      });
      setState(() {
        _pwdSuccess = 'Password changed successfully.';
        _pwdLoading = false;
      });
      _currentPwdCtrl.clear(); _newPwdCtrl.clear(); _confirmPwdCtrl.clear();
    } catch (e) {
      setState(() { _pwdError = e.toString(); _pwdLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final initials = (user?.fullName.isNotEmpty == true)
        ? user!.fullName.split(' ').map((p) => p.isNotEmpty ? p[0] : '').take(2).join().toUpperCase()
        : 'S';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('My Profile', style: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
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
                        // ── Hero card ───────────────────────────────────
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.primary, AppColors.primaryDark],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.28), blurRadius: 20, offset: const Offset(0, 8))],
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 32,
                                backgroundColor: AppColors.accent,
                                child: Text(initials,
                                    style: GoogleFonts.dmSans(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.textOnAccent)),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(user?.fullName ?? 'Student',
                                        style: GoogleFonts.dmSans(fontSize: 17, fontWeight: FontWeight.w700, color: Colors.white, letterSpacing: -0.3)),
                                    const SizedBox(height: 4),
                                    Text('${user?.className ?? 'Class'} · Section ${user?.sectionName ?? '—'}',
                                        style: GoogleFonts.dmSans(fontSize: 13, color: Colors.white.withValues(alpha: 0.8))),
                                    if (user?.admissionNumber != null) ...[
                                      const SizedBox(height: 2),
                                      Text('Adm: ${user!.admissionNumber}',
                                          style: GoogleFonts.dmSans(fontSize: 12, color: Colors.white.withValues(alpha: 0.6))),
                                    ],
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        // ── Info card ───────────────────────────────────
                        _InfoCard(
                          title: 'Personal Information',
                          icon: Icons.person_outline_rounded,
                          fields: [
                            _Field('Full Name',      _profile?['full_name']?.toString()),
                            _Field('Email',          _profile?['email']?.toString()),
                            _Field('Phone',          _profile?['phone']?.toString()),
                            _Field('Date of Birth',  _fmtDate(_profile?['date_of_birth']?.toString())),
                            _Field('Gender',         _cap(_profile?['gender']?.toString())),
                            _Field('School',         _profile?['school_name']?.toString()),
                          ],
                        ),
                        const SizedBox(height: 14),

                        _InfoCard(
                          title: 'Academic Information',
                          icon: Icons.school_rounded,
                          fields: [
                            _Field('Class',            user?.className),
                            _Field('Section',          user?.sectionName),
                            _Field('Admission No.',    user?.admissionNumber),
                            _Field('Roll No.',         _profile?['roll_number']?.toString()),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // ── Change Password ─────────────────────────────
                        _SectionTitle('Change Password'),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _PwdField('Current Password',     _currentPwdCtrl),
                              const SizedBox(height: 12),
                              _PwdField('New Password',         _newPwdCtrl),
                              const SizedBox(height: 12),
                              _PwdField('Confirm New Password', _confirmPwdCtrl),
                              const SizedBox(height: 14),
                              if (_pwdError != null)
                                _Alert(msg: _pwdError!, isError: true),
                              if (_pwdSuccess != null)
                                _Alert(msg: _pwdSuccess!, isError: false),
                              const SizedBox(height: 8),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton.icon(
                                  onPressed: _pwdLoading ? null : _changePassword,
                                  icon: _pwdLoading
                                      ? const SizedBox(width: 16, height: 16,
                                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                      : const Icon(Icons.lock_reset_rounded, size: 18),
                                  label: Text(_pwdLoading ? 'Updating…' : 'Update Password',
                                      style: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.primary,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // ── Logout ──────────────────────────────────────
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            onPressed: () async {
                              final confirmed = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: Text('Sign Out', style: GoogleFonts.dmSans(fontWeight: FontWeight.w700)),
                                  content: Text('Are you sure you want to sign out?',
                                      style: GoogleFonts.dmSans(fontSize: 14, color: AppColors.textSecondary)),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                    ElevatedButton(
                                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: const Text('Sign Out'),
                                    ),
                                  ],
                                ),
                              );
                              if (confirmed == true && context.mounted) {
                                await ref.read(authStateProvider.notifier).logout();
                              }
                            },
                            icon: const Icon(Icons.logout_rounded, color: AppColors.error),
                            label: Text('Sign Out', style: GoogleFonts.dmSans(fontWeight: FontWeight.w700, color: AppColors.error)),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: AppColors.error),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                ),
    );
  }

  String _fmtDate(String? d) => d != null && d.isNotEmpty ? DateFormatter.formatString(d) : '—';
  String _cap(String? s) => s != null && s.isNotEmpty ? '${s[0].toUpperCase()}${s.substring(1)}' : '—';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _Field {
  final String label;
  final String? value;
  const _Field(this.label, this.value);
}

class _InfoCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<_Field> fields;
  const _InfoCard({required this.title, required this.icon, required this.fields});

  @override
  Widget build(BuildContext context) {
    final visible = fields.where((f) => f.value != null && f.value!.isNotEmpty).toList();
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Row(children: [
              Icon(icon, size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(title, style: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
            ]),
          ),
          const Divider(height: 1),
          ...visible.map((f) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(children: [
              Expanded(flex: 2,
                child: Text(f.label, style: GoogleFonts.dmSans(fontSize: 11, fontWeight: FontWeight.w700,
                    color: AppColors.textMuted, letterSpacing: 0.3))),
              Expanded(flex: 3,
                child: Text(f.value ?? '—', style: GoogleFonts.dmSans(fontSize: 13, fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary))),
            ]),
          )),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;
  const _SectionTitle(this.text);
  @override
  Widget build(BuildContext context) =>
      Text(text, style: GoogleFonts.dmSans(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimary));
}

class _PwdField extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  const _PwdField(this.label, this.controller);
  @override
  State<_PwdField> createState() => _PwdFieldState();
}

class _PwdFieldState extends State<_PwdField> {
  bool _obscure = true;
  @override
  Widget build(BuildContext context) => TextField(
    controller: widget.controller,
    obscureText: _obscure,
    style: GoogleFonts.dmSans(fontSize: 14),
    decoration: InputDecoration(
      labelText: widget.label,
      labelStyle: GoogleFonts.dmSans(fontSize: 13, color: AppColors.textSecondary),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      suffixIcon: IconButton(
        icon: Icon(_obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 18, color: AppColors.textMuted),
        onPressed: () => setState(() => _obscure = !_obscure),
      ),
    ),
  );
}

class _Alert extends StatelessWidget {
  final String msg;
  final bool isError;
  const _Alert({required this.msg, required this.isError});
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 10),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: isError ? AppColors.errorLight : AppColors.successLight,
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: isError ? AppColors.error.withValues(alpha: 0.4) : AppColors.success.withValues(alpha: 0.4)),
    ),
    child: Row(children: [
      Icon(isError ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded,
          size: 16, color: isError ? AppColors.error : AppColors.success),
      const SizedBox(width: 8),
      Expanded(child: Text(msg, style: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w600,
          color: isError ? AppColors.error : AppColors.success))),
    ]),
  );
}
