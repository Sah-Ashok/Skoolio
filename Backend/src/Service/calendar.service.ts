import {
  createCalendar, getCalendarByAcademicYear, getCalendarById, updateCalendar,
  createCalendarEvent, getEventsByCalendar, getEventById,
  updateCalendarEvent, deleteCalendarEvent, getHolidayDates,
  getEventByExamId, updateCalendarEventByExamId,
  getWeeklyOffsByCalendar, replaceWeeklyOffs,
} from '../Repositories/calendar.repository';
import {
  ICreateCalendar, IUpdateCalendar, ICreateCalendarEvent, IUpdateCalendarEvent,
  IWorkingDaysResult, ICreateWeeklyOff, WeekPattern,
} from '../types/calendar.types';
import AppError from '../utils/AppError';

// ── CALENDAR SERVICES ──

export const createCalendarService = async (
  school_id: number,
  data: ICreateCalendar
) => {
  // Idempotent — if a calendar already exists for this year, return it
  const existing = await getCalendarByAcademicYear(school_id, data.academic_year_id);
  if (existing) return existing;

  const calendar = await createCalendar(school_id, school_id, data);
  return calendar;
};

export const getCalendarService = async (
  school_id: number,
  academic_year_id: number
) => {
  // Auto-create a default calendar on first visit so the frontend never
  // receives a 404 just because the admin hasn't manually initialised one yet.
  let calendar = await getCalendarByAcademicYear(school_id, academic_year_id);
  if (!calendar) {
    calendar = await createCalendar(school_id, school_id, {
      academic_year_id,
      weekend_type: 'sunday_only', // sensible default for South Asian schools
    });
  }
  return calendar;
};

export const updateCalendarService = async (
  id: number,
  school_id: number,
  data: IUpdateCalendar
) => {
  const calendar = await updateCalendar(id, school_id, data);
  if (!calendar) throw new AppError('Calendar not found.', 404);
  return calendar;
};

// ── CALENDAR EVENT SERVICES ──

export const createCalendarEventService = async (
  school_id: number,
  data: ICreateCalendarEvent
) => {
  // Check calendar exists
  const calendar = await getCalendarById(data.calendar_id, school_id);
  if (!calendar) throw new AppError('Calendar not found.', 404);

  // Validate dates
  if (data.end_date && new Date(data.end_date) < new Date(data.event_date)) {
    throw new AppError('End date cannot be before event date.', 400);
  }

  const event = await createCalendarEvent(school_id, school_id, data);
  return event;
};

export const getCalendarEventsService = async (
  calendar_id: number,
  school_id: number
) => {
  const calendar = await getCalendarById(calendar_id, school_id);
  if (!calendar) throw new AppError('Calendar not found.', 404);

  const events = await getEventsByCalendar(calendar_id, school_id);
  return events;
};

export const updateCalendarEventService = async (
  id: number,
  school_id: number,
  data: IUpdateCalendarEvent
) => {
  const event = await updateCalendarEvent(id, school_id, data);
  if (!event) throw new AppError('Calendar event not found.', 404);
  return event;
};

export const deleteCalendarEventService = async (
  id: number,
  school_id: number
) => {
  const event = await getEventById(id, school_id);
  if (!event) throw new AppError('Calendar event not found.', 404);

  const deleted = await deleteCalendarEvent(id, school_id);
  if (!deleted) throw new AppError('Failed to delete calendar event.', 500);
};

// ── EXAM ↔ CALENDAR SYNC ──
// Called from exam.service.ts on exam create/update so exam dates show up on
// the school calendar automatically — admin never has to enter them twice.
// Idempotent (create-or-update): looks up any existing linked event by
// exam_id first, updates it in place if found, otherwise creates a new one.
//
// affects_attendance is always false here — exam days are still working
// days (students attend, attendance gets marked), so they shouldn't be
// excluded from the working-days count the way real holidays are.
// class_id is left null — exams are school-wide at this level; per-class
// scheduling detail lives in exam_schedules, not the calendar.
export const syncExamCalendarEventService = async (
  school_id: number,
  exam: { id: number; academic_year_id: number; name: string; start_date: Date | string; end_date: Date | string }
) => {
  // Ensure a calendar exists for this academic year (auto-creates if missing)
  const calendar = await getCalendarService(school_id, exam.academic_year_id);

  const existing = await getEventByExamId(exam.id, school_id);

  if (existing) {
    return await updateCalendarEventByExamId(exam.id, school_id, {
      title: exam.name,
      event_date: exam.start_date,
      end_date: exam.end_date,
    });
  }

  return await createCalendarEvent(school_id, school_id, {
    calendar_id: calendar.id,
    academic_year_id: exam.academic_year_id,
    title: exam.name,
    event_date: exam.start_date as Date,
    end_date: exam.end_date as Date,
    event_type: 'exam',
    affects_attendance: false,
    exam_id: exam.id,
  });
};

// ── CALENDAR WEEKLY OFF SERVICES ──

const VALID_WEEK_PATTERNS: WeekPattern[] = ['all', '1st', '2nd', '3rd', '4th', '5th'];

export const getWeeklyOffsService = async (
  calendar_id: number,
  school_id: number
) => {
  const calendar = await getCalendarById(calendar_id, school_id);
  if (!calendar) throw new AppError('Calendar not found.', 404);

  return await getWeeklyOffsByCalendar(calendar_id, school_id);
};

export const setWeeklyOffsService = async (
  calendar_id: number,
  school_id: number,
  offs: ICreateWeeklyOff[]
) => {
  const calendar = await getCalendarById(calendar_id, school_id);
  if (!calendar) throw new AppError('Calendar not found.', 404);

  if (!offs || offs.length === 0) {
    throw new AppError('Select at least one weekly off day.', 400);
  }

  // Fail fast with a clear message — the DB CHECK/enum also guards this,
  // but a 400 here is far more useful to the frontend than a raw DB error.
  for (const off of offs) {
    if (off.day_of_week < 0 || off.day_of_week > 6) {
      throw new AppError('day_of_week must be between 0 (Sunday) and 6 (Saturday).', 400);
    }
    if (off.week_pattern && !VALID_WEEK_PATTERNS.includes(off.week_pattern)) {
      throw new AppError(`Invalid week_pattern "${off.week_pattern}".`, 400);
    }
  }

  return await replaceWeeklyOffs(calendar_id, school_id, offs);
};

// ── WORKING DAYS CALCULATION ──

// Which "occurrence in the month" a date's weekday is — 1st Saturday, 2nd
// Saturday, etc. Used to match week_pattern values other than 'all'.
const nthWeekdayOfMonth = (date: Date): WeekPattern => {
  const ordinals: WeekPattern[] = ['1st', '2nd', '3rd', '4th', '5th'];
  const n = Math.ceil(date.getDate() / 7); // 1-5
  return ordinals[n - 1] ?? '5th';
};

export const calculateWorkingDays = async (
  school_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<IWorkingDaysResult> => {
  // 1. Get calendar (needed for legacy weekend_type fallback)
  const calendar = await getCalendarByAcademicYear(school_id, academic_year_id);
  if (!calendar) throw new AppError('Calendar not found.', 404);

  // 2. Get explicit weekly-off rows for this calendar, if configured
  const weeklyOffs = await getWeeklyOffsByCalendar(calendar.id, school_id);

  // 3. Get all holiday dates in range
  const holidayDates = await getHolidayDates(
    school_id,
    academic_year_id,
    start_date,
    end_date
  );

  // 4. Loop through all days and count
  let total_days = 0;
  let weekend_days = 0;
  let holiday_days = 0;
  let working_days = 0;

  const current = new Date(start_date);
  const end = new Date(end_date);

  while (current <= end) {
    total_days++;
    const day = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = current.toISOString().split('T')[0];

    let isWeekend: boolean;

    if (weeklyOffs.length > 0) {
      // New flexible system — matches "every <day>" (week_pattern='all') or
      // a specific occurrence (e.g. '2nd', '4th') for that day in this month.
      const nth = nthWeekdayOfMonth(current);
      isWeekend = weeklyOffs.some(
        (w) => w.day_of_week === day && (w.week_pattern === 'all' || w.week_pattern === nth)
      );
    } else {
      // Legacy fallback for calendars that haven't configured explicit
      // weekly-offs yet — keeps old schools working exactly as before.
      // All three weekend_type cases are explicit — saturday_only was
      // previously falling through to the saturday_sunday branch.
      if (calendar.weekend_type === 'sunday_only')        isWeekend = day === 0;
      else if (calendar.weekend_type === 'saturday_only') isWeekend = day === 6;
      else /* saturday_sunday */                          isWeekend = day === 0 || day === 6;
    }

    // Only non-weekend days can be holidays — avoids double-counting
    const isHoliday = !isWeekend && holidayDates.includes(dateStr);

    if (isWeekend) {
      weekend_days++;
    } else if (isHoliday) {
      holiday_days++;
    } else {
      working_days++;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    total_days,
    working_days,
    weekend_days,
    holidays: holiday_days,
  };
};
