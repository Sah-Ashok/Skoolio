import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
import '../../auth/presentation/auth_providers.dart';

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key});

  @override
  ConsumerState<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends ConsumerState<CalendarScreen> {
  bool _isLoading = true;
  String? _error;
  List<dynamic> _events = [];

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    final client = ref.read(apiClientProvider);

    try {
      // Step 1: Resolve active academic year
      int? yearId;
      try {
        final yearRes = await client.get(ApiConstants.activeAcademicYear);
        if (yearRes is Map) {
          final raw = yearRes['id'] ?? yearRes['academic_year_id'];
          yearId = raw is int ? raw : int.tryParse(raw?.toString() ?? '');
        }
      } catch (_) {}

      if (yearId == null) {
        setState(() {
          _events = [];
          _isLoading = false;
        });
        return;
      }

      // Step 2: Fetch calendar config for active year
      final calRes = await client.get(
        ApiConstants.calendarBase,
        queryParameters: {'academic_year_id': yearId},
      );

      final calId = calRes is Map ? (calRes['id'] ?? (calRes['data'] is Map ? calRes['data']['id'] : null)) : null;

      if (calId == null) {
        setState(() {
          _events = [];
          _isLoading = false;
        });
        return;
      }

      // Step 3: Fetch events for this calendar
      final eventsRes = await client.get('/api/calendar/$calId/events');
      List<dynamic> list = [];
      if (eventsRes is List) {
        list = eventsRes;
      } else if (eventsRes is Map && eventsRes['data'] is List) {
        list = eventsRes['data'] as List;
      }

      setState(() {
        _events = list;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('School Calendar & Events'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _loadEvents,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 48),
                        const SizedBox(height: 12),
                        const Text('Could not load calendar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 8),
                        Text(_error!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                        const SizedBox(height: 16),
                        ElevatedButton(onPressed: _loadEvents, child: const Text('Try Again')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadEvents,
                  child: _events.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.25),
                            Center(
                              child: Padding(
                                padding: const EdgeInsets.all(32),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(16),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary.withValues(alpha: 0.08),
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.event_available_outlined, size: 40, color: AppColors.primary),
                                    ),
                                    const SizedBox(height: 14),
                                    const Text(
                                      'No scheduled events',
                                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                    const SizedBox(height: 4),
                                    const Text(
                                      'School calendar activities, exams, and holidays will appear here.',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(16),
                      itemCount: _events.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final item = _events[index];
                        final title = item['title'] ?? item['name'] ?? 'School Event';
                        final eventDate = item['event_date'] ?? item['start_date'] ?? '';
                        final type = item['event_type']?.toString().toLowerCase() ?? 'event';
                        final isHoliday = type == 'holiday';
                        final isExam = type == 'exam';

                        return Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: (isHoliday ? AppColors.error : isExam ? AppColors.warning : AppColors.primary).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  isHoliday ? Icons.beach_access_rounded : isExam ? Icons.edit_calendar_rounded : Icons.event_rounded,
                                  color: isHoliday ? AppColors.error : isExam ? AppColors.warning : AppColors.primary,
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      title,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      DateFormatter.formatString(eventDate.toString()),
                                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceVariant,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  type.toUpperCase(),
                                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                ),
    );
  }
}
