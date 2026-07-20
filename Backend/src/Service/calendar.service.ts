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
export const syncExamCalendarEventService = async (
  school_id: number,
  exam: { id: number; academic_year_id: number; name: string; start_date: Date | string; end_date: Date | string }
) => {
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

// ── SHARED HELPERS ──

const nthWeekdayOfMonth = (date: Date): WeekPattern => {
  const ordinals: WeekPattern[] = ['1st', '2nd', '3rd', '4th', '5th'];
  const n = Math.ceil(date.getDate() / 7);
  return ordinals[n - 1] ?? '5th';
};

const isWeekendDay = (
  date: Date,
  weeklyOffs: { day_of_week: number; week_pattern: WeekPattern }[],
  weekendType: string
): boolean => {
  const day = date.getDay();

  if (weeklyOffs.length > 0) {
    const nth = nthWeekdayOfMonth(date);
    return weeklyOffs.some(
      (w) => w.day_of_week === day && (w.week_pattern === 'all' || w.week_pattern === nth)
    );
  }

  if (weekendType === 'sunday_only')   return day === 0;
  if (weekendType === 'saturday_only') return day === 6;
  return day === 0 || day === 6;
};

// ── IS WORKING DAY ──
// Uses getCalendarService (auto-creates) so attendance marking never crashes
// with 404 for schools that haven't manually set up a calendar yet.
export const isWorkingDayService = async (
  school_id: number,
  academic_year_id: number,
  date: string
): Promise<{ isWorking: boolean; reason?: string }> => {
  const calendar = await getCalendarService(school_id, academic_year_id);

  const weeklyOffs = await getWeeklyOffsByCalendar(calendar.id, school_id);

  // Parse as LOCAL date to avoid UTC timezone shift (e.g. Nepal UTC+5:45)
  const [y, m, d] = date.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);

  if (isWeekendDay(dateObj, weeklyOffs, calendar.weekend_type)) {
    return { isWorking: false, reason: 'weekly_off' };
  }

  const holidays = await getHolidayDates(school_id, academic_year_id, date, date);
  if (holidays.length > 0) {
    return { isWorking: false, reason: 'holiday' };
  }

  return { isWorking: true };
};

// ── WORKING DAYS CALCULATION ──
// Uses getCalendarService (auto-creates default calendar if missing) so this
// never throws "Calendar not found" for schools that haven't set one up yet.
export const calculateWorkingDays = async (
  school_id: number,
  academic_year_id: number,
  start_date: string,
  end_date: string
): Promise<IWorkingDaysResult> => {
  // Auto-create calendar if missing — prevents 404 crashing attendance summary
  const calendar = await getCalendarService(school_id, academic_year_id);

  const weeklyOffs = await getWeeklyOffsByCalendar(calendar.id, school_id);

  const holidayDates = await getHolidayDates(
    school_id,
    academic_year_id,
    start_date,
    end_date
  );

  let total_days   = 0;
  let weekend_days = 0;
  let holiday_days = 0;
  let working_days = 0;

  // Parse YYYY-MM-DD as LOCAL date (not UTC) to avoid timezone shift.
  // new Date("2026-07-01") in UTC+5:45 gives June 30 via toISOString().
  // Parsing parts directly keeps the date in local wall-clock time.
  const parseLocalDate = (s: string): Date => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d); // local midnight
  };

  // Format a local Date back to YYYY-MM-DD without UTC conversion.
  const toLocalDateStr = (dt: Date): string =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const current = parseLocalDate(start_date);
  const end     = parseLocalDate(end_date);

  while (current <= end) {
    total_days++;
    const dateStr = toLocalDateStr(current); // stays in local time — no UTC shift

    const isWeekend = isWeekendDay(current, weeklyOffs, calendar.weekend_type);
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
