import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
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
  } catch (_) {}
  return [];
});

class NoticesScreen extends ConsumerWidget {
  const NoticesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final noticesAsync = ref.watch(noticesListProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('School Announcements', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: RefreshIndicator(
        color: AppColors.accent,
        onRefresh: () async => ref.refresh(noticesListProvider.future),
        child: noticesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
          error: (err, _) => Center(child: Text('Error loading notices: $err')),
          data: (notices) {
            if (notices.isEmpty) {
              return ListView(
                children: [
                  SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                  Center(
                    child: Column(
                      children: const [
                        Icon(Icons.campaign_outlined, size: 48, color: AppColors.textMuted),
                        SizedBox(height: 12),
                        Text('No announcements right now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        SizedBox(height: 4),
                        Text('Check back later for school updates.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: notices.length,
              itemBuilder: (context, index) {
                final notice = notices[index];
                final title = notice['title']?.toString() ?? 'Notice';
                final content = notice['content']?.toString() ?? notice['description']?.toString() ?? '';
                final date = notice['created_at']?.toString() ?? '';
                final isPinned = notice['is_pinned'] == true;
                final targetType = notice['target_type']?.toString();
                final className = notice['class_name']?.toString();
                final sectionName = notice['section_name']?.toString();
                final author = notice['created_by_name']?.toString() ?? '';
                final authorRole = notice['created_by_role']?.toString() ?? '';

                // Scope text
                final isSectionScoped = targetType == 'section';
                final scopeLabel = isSectionScoped
                    ? ([className, sectionName].where((s) => s != null && s.isNotEmpty).join(' - ').isNotEmpty
                        ? [className, sectionName].where((s) => s != null && s.isNotEmpty).join(' - ')
                        : 'Class Notice')
                    : 'School-Wide';

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: isPinned ? AppColors.accent.withValues(alpha: 0.6) : AppColors.border,
                      width: isPinned ? 1.5 : 1.0,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
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
                              color: isSectionScoped
                                  ? Colors.indigo.shade50
                                  : AppColors.primary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              scopeLabel.toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: isSectionScoped ? Colors.indigo.shade700 : AppColors.primary,
                              ),
                            ),
                          ),
                          const Spacer(),
                          if (date.isNotEmpty)
                            Text(
                              DateFormatter.formatString(date, pattern: 'MMM dd, yyyy'),
                              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        title,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.textPrimary),
                      ),
                      if (content.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          content,
                          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary, height: 1.45),
                        ),
                      ],
                      if (author.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.person_outline_rounded, size: 14, color: AppColors.textMuted),
                            const SizedBox(width: 4),
                            Text(
                              '$author${authorRole.isNotEmpty ? " (${authorRole.toUpperCase()})" : ""}',
                              style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontStyle: FontStyle.italic),
                            ),
                          ],
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
    );
  }
}
