import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_loader.dart';
import '../../../core/utils/date_formatter.dart';
import '../../attendance/data/teacher_attendance_repository.dart';
import '../../attendance/domain/attendance_models.dart';
import '../../auth/domain/models.dart';
import '../../auth/presentation/auth_providers.dart';

final noticesListProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final client = ref.watch(apiClientProvider);
  final user = ref.watch(authStateProvider).user;
  final isTeacher = user?.role == UserRole.faculty;

  final endpoint = isTeacher ? ApiConstants.teacherNotices : ApiConstants.studentNotices;

  try {
    final res = await client.get(endpoint);
    if (res is List) return res;
    if (res is Map<String, dynamic> && res['notices'] is List) {
      return res['notices'] as List;
    }
    if (res is Map<String, dynamic> && res['data'] is List) {
      return res['data'] as List;
    }
  } catch (_) {}
  return [];
});

class NoticesScreen extends ConsumerStatefulWidget {
  const NoticesScreen({super.key});

  @override
  ConsumerState<NoticesScreen> createState() => _NoticesScreenState();
}

class _NoticesScreenState extends ConsumerState<NoticesScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _filterType = 'all'; // 'all', 'school', 'section', 'mine'

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  bool _isExpired(String? expiresAt) {
    if (expiresAt == null || expiresAt.isEmpty) return false;
    final exp = DateTime.tryParse(expiresAt);
    if (exp == null) return false;
    return exp.isBefore(DateTime.now());
  }

  bool _canEdit(dynamic notice, UserModel? user) {
    if (user == null) return false;
    final role = notice['created_by_role']?.toString();
    final authorId = notice['created_by_id'];
    return role == 'faculty' && authorId != null && authorId == user.id;
  }

  List<dynamic> _filterNotices(List<dynamic> allNotices, UserModel? user) {
    return allNotices.where((n) {
      final targetType = n['target_type']?.toString();
      final isMine = _canEdit(n, user);

      if (_filterType == 'school' && targetType != null && targetType.isNotEmpty) {
        return false;
      }
      if (_filterType == 'section' && targetType != 'section') {
        return false;
      }
      if (_filterType == 'mine' && !isMine) {
        return false;
      }

      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final title = (n['title']?.toString() ?? '').toLowerCase();
        final content = (n['content']?.toString() ?? n['description']?.toString() ?? '').toLowerCase();
        if (!title.contains(query) && !content.contains(query)) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  // ── Modal: Post Notice ──────────────────────────────────────────────────
  Future<void> _showCreateNoticeDialog(List<TeacherSection> sections) async {
    if (sections.isEmpty) return;

    final titleController = TextEditingController();
    final contentController = TextEditingController();
    TeacherSection selectedSec = sections.first;
    bool isPinned = false;
    DateTime? expiryDate;
    bool isSubmitting = false;

    final messenger = ScaffoldMessenger.of(context);

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        final navigator = Navigator.of(dialogContext);

        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: const [
                  Icon(Icons.campaign_rounded, color: AppColors.accent, size: 22),
                  SizedBox(width: 8),
                  Text(
                    'Post Notice to Section',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Target Section Picker
                      const Text(
                        'Target Section *',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<TeacherSection>(
                            isExpanded: true,
                            value: selectedSec,
                            items: sections.map((sec) {
                              return DropdownMenuItem(
                                value: sec,
                                child: Text(
                                  '${sec.className} - Section ${sec.name}',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                ),
                              );
                            }).toList(),
                            onChanged: (newVal) {
                              if (newVal != null) {
                                setModalState(() => selectedSec = newVal);
                              }
                            },
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Title
                      const Text(
                        'Notice Title *',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: titleController,
                        decoration: InputDecoration(
                          hintText: 'e.g. Unit Test 2 Schedule',
                          filled: true,
                          fillColor: AppColors.surface,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                        ),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 14),

                      // Content
                      const Text(
                        'Notice Content *',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: contentController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Write the complete notice details...',
                          filled: true,
                          fillColor: AppColors.surface,
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                        ),
                        style: const TextStyle(fontSize: 13),
                      ),
                      const SizedBox(height: 14),

                      // Expiry Date (Optional)
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Expiry Date (Optional)',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
                                ),
                                const SizedBox(height: 6),
                                InkWell(
                                  onTap: () async {
                                    final picked = await showDatePicker(
                                      context: context,
                                      initialDate: expiryDate ?? DateTime.now().add(const Duration(days: 7)),
                                      firstDate: DateTime.now(),
                                      lastDate: DateTime.now().add(const Duration(days: 365)),
                                    );
                                    if (picked != null) {
                                      setModalState(() => expiryDate = picked);
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textSecondary),
                                        const SizedBox(width: 8),
                                        Text(
                                          expiryDate != null
                                              ? DateFormat('yyyy-MM-dd').format(expiryDate!)
                                              : 'No expiry',
                                          style: TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w600,
                                            color: expiryDate != null ? AppColors.textPrimary : AppColors.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (expiryDate != null)
                            IconButton(
                              icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textMuted),
                              tooltip: 'Clear expiry',
                              onPressed: () => setModalState(() => expiryDate = null),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Pin Switch
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: isPinned,
                        activeTrackColor: AppColors.accent,
                        title: Row(
                          children: const [
                            Icon(Icons.push_pin_rounded, size: 16, color: Colors.amber),
                            SizedBox(width: 6),
                            Text(
                              'Pin this notice',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        onChanged: (val) => setModalState(() => isPinned = val),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => navigator.pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final title = titleController.text.trim();
                          final content = contentController.text.trim();
                          if (title.isEmpty || content.isEmpty) {
                            messenger.showSnackBar(
                              const SnackBar(content: Text('Please enter both title and content')),
                            );
                            return;
                          }

                          setModalState(() => isSubmitting = true);
                          try {
                            final client = ref.read(apiClientProvider);
                            await client.post('/notices/teacher', data: {
                              'title': title,
                              'content': content,
                              'target_type': 'section',
                              'target_section_id': selectedSec.id,
                              'is_pinned': isPinned,
                              'expires_at': expiryDate != null
                                  ? DateFormat('yyyy-MM-dd').format(expiryDate!)
                                  : null,
                            });
                            navigator.pop();
                            ref.invalidate(noticesListProvider);
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Notice posted successfully to section.'),
                                backgroundColor: AppColors.success,
                              ),
                            );
                          } catch (e) {
                            setModalState(() => isSubmitting = false);
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text('Failed to post notice: $e'),
                                backgroundColor: AppColors.error,
                              ),
                            );
                          }
                        },
                  child: isSubmitting
                      ? AppLoader.spinner(color: Colors.white)
                      : const Text('Post Notice', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── Modal: Edit Notice ────────────────────────────────────────────────────
  Future<void> _showEditNoticeDialog(dynamic notice) async {
    final titleController = TextEditingController(text: notice['title']?.toString() ?? '');
    final contentController = TextEditingController(
      text: notice['content']?.toString() ?? notice['description']?.toString() ?? '',
    );
    bool isPinned = notice['is_pinned'] == true;
    DateTime? expiryDate = notice['expires_at'] != null ? DateTime.tryParse(notice['expires_at']) : null;
    bool isSubmitting = false;

    final messenger = ScaffoldMessenger.of(context);

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        final navigator = Navigator.of(dialogContext);

        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: const [
                  Icon(Icons.edit_note_rounded, color: AppColors.accent, size: 22),
                  SizedBox(width: 8),
                  Text('Edit Notice', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ],
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Title *',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: titleController,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: AppColors.surface,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                        ),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 14),

                      const Text(
                        'Content *',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 6),
                      TextField(
                        controller: contentController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: AppColors.surface,
                          contentPadding: const EdgeInsets.all(12),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(color: AppColors.border),
                          ),
                        ),
                        style: const TextStyle(fontSize: 13),
                      ),
                      const SizedBox(height: 14),

                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Expiry Date',
                                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary),
                                ),
                                const SizedBox(height: 6),
                                InkWell(
                                  onTap: () async {
                                    final picked = await showDatePicker(
                                      context: context,
                                      initialDate: expiryDate ?? DateTime.now().add(const Duration(days: 7)),
                                      firstDate: DateTime.now(),
                                      lastDate: DateTime.now().add(const Duration(days: 365)),
                                    );
                                    if (picked != null) {
                                      setModalState(() => expiryDate = picked);
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: AppColors.border),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textSecondary),
                                        const SizedBox(width: 8),
                                        Text(
                                          expiryDate != null
                                              ? DateFormat('yyyy-MM-dd').format(expiryDate!)
                                              : 'No expiry',
                                          style: TextStyle(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w600,
                                            color: expiryDate != null ? AppColors.textPrimary : AppColors.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (expiryDate != null)
                            IconButton(
                              icon: const Icon(Icons.clear_rounded, size: 18, color: AppColors.textMuted),
                              tooltip: 'Clear expiry',
                              onPressed: () => setModalState(() => expiryDate = null),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: isPinned,
                        activeTrackColor: AppColors.accent,
                        title: Row(
                          children: const [
                            Icon(Icons.push_pin_rounded, size: 16, color: Colors.amber),
                            SizedBox(width: 6),
                            Text('Pin this notice', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          ],
                        ),
                        onChanged: (val) => setModalState(() => isPinned = val),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => navigator.pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final title = titleController.text.trim();
                          final content = contentController.text.trim();
                          if (title.isEmpty || content.isEmpty) {
                            messenger.showSnackBar(
                              const SnackBar(content: Text('Please enter both title and content')),
                            );
                            return;
                          }

                          setModalState(() => isSubmitting = true);
                          try {
                            final client = ref.read(apiClientProvider);
                            await client.patch('/notices/${notice['id']}', data: {
                              'title': title,
                              'content': content,
                              'is_pinned': isPinned,
                              'expires_at': expiryDate != null
                                  ? DateFormat('yyyy-MM-dd').format(expiryDate!)
                                  : null,
                            });
                            navigator.pop();
                            ref.invalidate(noticesListProvider);
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Notice updated successfully.'),
                                backgroundColor: AppColors.success,
                              ),
                            );
                          } catch (e) {
                            setModalState(() => isSubmitting = false);
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text('Failed to update notice: $e'),
                                backgroundColor: AppColors.error,
                              ),
                            );
                          }
                        },
                  child: isSubmitting
                      ? AppLoader.spinner(color: Colors.white)
                      : const Text('Save Changes', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  // ── Modal: Delete Notice Confirm ──────────────────────────────────────────
  Future<void> _confirmDeleteNotice(dynamic notice) async {
    final messenger = ScaffoldMessenger.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Notice', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        content: Text(
          'Are you sure you want to delete "${notice['title']}"? This action cannot be undone.',
          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Delete Notice', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final client = ref.read(apiClientProvider);
        await client.delete('/notices/${notice['id']}');
        ref.invalidate(noticesListProvider);
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Notice deleted.'),
            backgroundColor: AppColors.success,
          ),
        );
      } catch (e) {
        messenger.showSnackBar(
          SnackBar(
            content: Text('Failed to delete notice: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  // ── Modal: Notice Detail View ─────────────────────────────────────────────
  void _showNoticeDetailDialog(dynamic notice, UserModel? user) {
    final title = notice['title']?.toString() ?? 'Notice';
    final content = notice['content']?.toString() ?? notice['description']?.toString() ?? '';
    final date = notice['created_at']?.toString() ?? '';
    final expiresAt = notice['expires_at']?.toString();
    final isPinned = notice['is_pinned'] == true;
    final targetType = notice['target_type']?.toString();
    final className = notice['class_name']?.toString();
    final sectionName = notice['section_name']?.toString();
    final author = notice['created_by_name']?.toString() ?? '';
    final isEditable = _canEdit(notice, user);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.65,
          minChildSize: 0.4,
          maxChildSize: 0.9,
          builder: (_, scrollController) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              child: ListView(
                controller: scrollController,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Header with badges
                  Row(
                    children: [
                      if (isPinned) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.push_pin_rounded, size: 12, color: Colors.amber.shade900),
                              const SizedBox(width: 4),
                              Text(
                                'PINNED',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.amber.shade900,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: targetType == 'section' ? const Color(0xFFFFF7ED) : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: targetType == 'section' ? const Color(0xFFFED7AA) : const Color(0xFFBFDBFE),
                          ),
                        ),
                        child: Text(
                          targetType == 'section'
                              ? [className, sectionName].whereType<String>().join(' - ').toUpperCase()
                              : 'SCHOOL-WIDE',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: targetType == 'section' ? const Color(0xFFC2410C) : const Color(0xFF1D4ED8),
                          ),
                        ),
                      ),
                      if (_isExpired(expiresAt)) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: const Color(0xFFFECDD3)),
                          ),
                          child: const Text(
                            'EXPIRED',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFDC2626),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 14),

                  // Title
                  Text(
                    title,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 10),

                  // Metadata row
                  Wrap(
                    spacing: 16,
                    runSpacing: 8,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.person_outline_rounded, size: 14, color: AppColors.textMuted),
                          const SizedBox(width: 4),
                          Text(
                            isEditable ? 'Posted by You' : (author.isNotEmpty ? author : 'School Admin'),
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      if (date.isNotEmpty)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.calendar_today_outlined, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              DateFormatter.formatString(date, pattern: 'MMM dd, yyyy'),
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      if (expiresAt != null && expiresAt.isNotEmpty)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.timer_outlined, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              'Expires: ${DateFormatter.formatString(expiresAt, pattern: 'MMM dd, yyyy')}',
                              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                    ],
                  ),
                  const Divider(height: 24, color: AppColors.border),

                  // Full Content
                  SelectableText(
                    content,
                    style: const TextStyle(fontSize: 14, height: 1.6, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 24),

                  // Actions if editable
                  if (isEditable)
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.accent,
                              side: const BorderSide(color: AppColors.accent),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: const Icon(Icons.edit_outlined, size: 18),
                            label: const Text('Edit Notice', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () {
                              Navigator.of(ctx).pop();
                              _showEditNoticeDialog(notice);
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.error,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            icon: const Icon(Icons.delete_outline_rounded, size: 18),
                            label: const Text('Delete', style: TextStyle(fontWeight: FontWeight.bold)),
                            onPressed: () {
                              Navigator.of(ctx).pop();
                              _confirmDeleteNotice(notice);
                            },
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).user;
    final isTeacher = user?.role == UserRole.faculty;
    final noticesAsync = ref.watch(noticesListProvider);
    final sectionsAsync = isTeacher ? ref.watch(teacherSectionsProvider) : null;
    final teacherSections = sectionsAsync?.value ?? <TeacherSection>[];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text(
          'Notice Board',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh notices',
            onPressed: () => ref.invalidate(noticesListProvider),
          ),
        ],
      ),
      floatingActionButton: (isTeacher && teacherSections.isNotEmpty)
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Post Notice', style: TextStyle(fontWeight: FontWeight.bold)),
              onPressed: () => _showCreateNoticeDialog(teacherSections),
            )
          : null,
      body: noticesAsync.when(
        loading: () => const AppLoader(text: 'Loading notice board...', size: AppLoaderSize.lg),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline_rounded, size: 48, color: AppColors.error),
                const SizedBox(height: 12),
                const Text('Error loading notices', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 6),
                Text(err.toString(), textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.invalidate(noticesListProvider),
                  child: const Text('Try Again'),
                ),
              ],
            ),
          ),
        ),
        data: (allNotices) {
          final filtered = _filterNotices(allNotices, user);

          // Calculate KPI counts
          final totalSchool = allNotices.where((n) => n['target_type'] == null || (n['target_type']?.toString().isEmpty ?? true)).length;
          final totalSection = allNotices.where((n) => n['target_type'] == 'section').length;
          final totalPinned = allNotices.where((n) => n['is_pinned'] == true).length;
          final totalMine = isTeacher ? allNotices.where((n) => _canEdit(n, user)).length : 0;

          return RefreshIndicator(
            color: AppColors.accent,
            onRefresh: () async => ref.refresh(noticesListProvider.future),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Column(
                    children: [
                      // ── KPI Summary Cards ──
                      Container(
                        color: Colors.white,
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                        child: Row(
                          children: [
                            _buildKpiCard(
                              label: 'School-Wide',
                              count: totalSchool,
                              sublabel: 'From Admin',
                              icon: Icons.school_outlined,
                              accentColor: const Color(0xFF1D4ED8),
                              bgColor: const Color(0xFFEFF6FF),
                              borderColor: const Color(0xFFBFDBFE),
                              isSelected: _filterType == 'school',
                              onTap: () => setState(() => _filterType = _filterType == 'school' ? 'all' : 'school'),
                            ),
                            const SizedBox(width: 8),
                            _buildKpiCard(
                              label: 'Section',
                              count: totalSection,
                              sublabel: 'Targeted',
                              icon: Icons.groups_outlined,
                              accentColor: const Color(0xFF0D9488),
                              bgColor: const Color(0xFFF0FDFA),
                              borderColor: const Color(0xFF99F6E4),
                              isSelected: _filterType == 'section',
                              onTap: () => setState(() => _filterType = _filterType == 'section' ? 'all' : 'section'),
                            ),
                            const SizedBox(width: 8),
                            _buildKpiCard(
                              label: 'Pinned',
                              count: totalPinned,
                              sublabel: 'Important',
                              icon: Icons.push_pin_outlined,
                              accentColor: const Color(0xFFC2410C),
                              bgColor: const Color(0xFFFFF7ED),
                              borderColor: const Color(0xFFFED7AA),
                              isSelected: false,
                              onTap: null,
                            ),
                            if (isTeacher) ...[
                              const SizedBox(width: 8),
                              _buildKpiCard(
                                label: 'My Notices',
                                count: totalMine,
                                sublabel: 'Posted by me',
                                icon: Icons.edit_note_rounded,
                                accentColor: const Color(0xFF7C3AED),
                                bgColor: const Color(0xFFFAF5FF),
                                borderColor: const Color(0xFFE9D5FF),
                                isSelected: _filterType == 'mine',
                                onTap: () => setState(() => _filterType = _filterType == 'mine' ? 'all' : 'mine'),
                              ),
                            ],
                          ],
                        ),
                      ),

                      // ── Search Bar ──
                      Container(
                        color: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: TextField(
                          controller: _searchController,
                          onChanged: (val) => setState(() => _searchQuery = val),
                          decoration: InputDecoration(
                            hintText: 'Search notices by title or content...',
                            hintStyle: const TextStyle(fontSize: 13, color: AppColors.textMuted),
                            prefixIcon: const Icon(Icons.search_rounded, size: 20, color: AppColors.textSecondary),
                            suffixIcon: _searchQuery.isNotEmpty
                                ? IconButton(
                                    icon: const Icon(Icons.clear_rounded, size: 18),
                                    onPressed: () {
                                      _searchController.clear();
                                      setState(() => _searchQuery = '');
                                    },
                                  )
                                : null,
                            filled: true,
                            fillColor: AppColors.surface,
                            contentPadding: const EdgeInsets.symmetric(vertical: 8),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: AppColors.border),
                            ),
                          ),
                          style: const TextStyle(fontSize: 13),
                        ),
                      ),

                      // ── Filter Chips Row ──
                      Container(
                        color: Colors.white,
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: [
                              _buildFilterChip('all', 'All Notices (${allNotices.length})'),
                              const SizedBox(width: 8),
                              _buildFilterChip('school', 'School-Wide ($totalSchool)'),
                              const SizedBox(width: 8),
                              _buildFilterChip('section', 'Section Notices ($totalSection)'),
                              if (isTeacher) ...[
                                const SizedBox(width: 8),
                                _buildFilterChip('mine', 'My Notices ($totalMine)'),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const Divider(height: 1, color: AppColors.border),
                    ],
                  ),
                ),

                // ── Notice List ──
                if (filtered.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.campaign_outlined, size: 48, color: AppColors.textMuted),
                            SizedBox(height: 12),
                            Text(
                              'No notices found',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Try changing your filter or search query.',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final notice = filtered[index];
                          final title = notice['title']?.toString() ?? 'Notice';
                          final content = notice['content']?.toString() ?? notice['description']?.toString() ?? '';
                          final date = notice['created_at']?.toString() ?? '';
                          final expiresAt = notice['expires_at']?.toString();
                          final isPinned = notice['is_pinned'] == true;
                          final targetType = notice['target_type']?.toString();
                          final className = notice['class_name']?.toString();
                          final sectionName = notice['section_name']?.toString();
                          final author = notice['created_by_name']?.toString() ?? '';
                          final isMine = _canEdit(notice, user);
                          final isExpired = _isExpired(expiresAt);

                          // Scope badge label
                          final isSectionScoped = targetType == 'section';
                          final scopeLabel = isSectionScoped
                              ? ([className, sectionName].where((s) => s != null && s.isNotEmpty).join(' - ').isNotEmpty
                                  ? [className, sectionName].where((s) => s != null && s.isNotEmpty).join(' - ')
                                  : 'Section Notice')
                              : 'School-Wide';

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: isPinned ? const Color(0xFFF97316) : AppColors.border,
                                width: isPinned ? 1.5 : 1.0,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.02),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              borderRadius: BorderRadius.circular(14),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(14),
                                onTap: () => _showNoticeDetailDialog(notice, user),
                                child: Padding(
                                  padding: const EdgeInsets.all(14),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Top badges row
                                      Row(
                                        children: [
                                          if (isPinned) ...[
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: Colors.amber.shade100,
                                                borderRadius: BorderRadius.circular(5),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.push_pin_rounded, size: 11, color: Colors.amber.shade900),
                                                  const SizedBox(width: 3),
                                                  Text(
                                                    'PINNED',
                                                    style: TextStyle(
                                                      fontSize: 9.5,
                                                      fontWeight: FontWeight.bold,
                                                      color: Colors.amber.shade900,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                          ],
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: isSectionScoped ? const Color(0xFFFFF7ED) : const Color(0xFFEFF6FF),
                                              borderRadius: BorderRadius.circular(5),
                                              border: Border.all(
                                                color: isSectionScoped ? const Color(0xFFFED7AA) : const Color(0xFFBFDBFE),
                                              ),
                                            ),
                                            child: Text(
                                              scopeLabel.toUpperCase(),
                                              style: TextStyle(
                                                fontSize: 9.5,
                                                fontWeight: FontWeight.bold,
                                                color: isSectionScoped ? const Color(0xFFC2410C) : const Color(0xFF1D4ED8),
                                              ),
                                            ),
                                          ),
                                          if (isMine) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFDCFCE7),
                                                borderRadius: BorderRadius.circular(5),
                                                border: Border.all(color: const Color(0xFFBBF7D0)),
                                              ),
                                              child: const Text(
                                                'YOU',
                                                style: TextStyle(
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF15803D),
                                                ),
                                              ),
                                            ),
                                          ],
                                          if (isExpired) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFFEF2F2),
                                                borderRadius: BorderRadius.circular(5),
                                              ),
                                              child: const Text(
                                                'EXPIRED',
                                                style: TextStyle(
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFFDC2626),
                                                ),
                                              ),
                                            ),
                                          ],
                                          const Spacer(),
                                          if (isMine) ...[
                                            IconButton(
                                              icon: const Icon(Icons.edit_outlined, size: 16, color: AppColors.textSecondary),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                              tooltip: 'Edit notice',
                                              onPressed: () => _showEditNoticeDialog(notice),
                                            ),
                                            IconButton(
                                              icon: const Icon(Icons.delete_outline_rounded, size: 16, color: AppColors.error),
                                              padding: EdgeInsets.zero,
                                              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                                              tooltip: 'Delete notice',
                                              onPressed: () => _confirmDeleteNotice(notice),
                                            ),
                                          ],
                                        ],
                                      ),
                                      const SizedBox(height: 8),

                                      // Title
                                      Text(
                                        title,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),

                                      // Content snippet
                                      if (content.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          content,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12.5,
                                            color: AppColors.textSecondary,
                                            height: 1.4,
                                          ),
                                        ),
                                      ],

                                      // Footer info: Author & date
                                      const SizedBox(height: 10),
                                      Row(
                                        children: [
                                          const Icon(Icons.person_outline_rounded, size: 13, color: AppColors.textMuted),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              isMine ? 'You' : (author.isNotEmpty ? author : 'School Admin'),
                                              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                            ),
                                          ),
                                          if (date.isNotEmpty)
                                            Text(
                                              DateFormatter.formatString(date, pattern: 'MMM dd, yyyy'),
                                              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                                            ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                        childCount: filtered.length,
                      ),
                    ),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildKpiCard({
    required String label,
    required int count,
    required String sublabel,
    required IconData icon,
    required Color accentColor,
    required Color bgColor,
    required Color borderColor,
    required bool isSelected,
    VoidCallback? onTap,
  }) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
          decoration: BoxDecoration(
            color: isSelected ? accentColor.withValues(alpha: 0.08) : bgColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? accentColor : borderColor,
              width: isSelected ? 1.5 : 1.0,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    count.toString(),
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                      color: accentColor,
                    ),
                  ),
                  Icon(icon, size: 16, color: accentColor),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                sublabel,
                style: const TextStyle(
                  fontSize: 9,
                  color: AppColors.textSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _filterType == key;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppColors.accent,
      backgroundColor: AppColors.surface,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppColors.textSecondary,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
        fontSize: 12,
      ),
      onSelected: (selected) {
        if (selected) {
          setState(() => _filterType = key);
        }
      },
    );
  }
}
