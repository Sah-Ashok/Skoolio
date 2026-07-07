// Weekend types — determines which days are weekly off
export type WeekendType =
  | 'saturday_only'    // Nepal, some India schools — Saturday is weekly off
  | 'sunday_only'      // India standard — Sunday is weekly off
  | 'saturday_sunday'; // 5-day week — both Saturday and Sunday are off

export type EventType = 'holiday' | 'exam' | 'event' | 'early_closing';

// ── SCHOOL CALENDAR ──
export interface ISchoolCalendar {
  id: number;
  school_id: number;
  academic_year_id: number;
  weekend_type: WeekendType;
  created_at: Date;
  updated_at: Date;
}

export type ICreateCalendar = Pick<
  ISchoolCalendar,
  'academic_year_id' | 'weekend_type'
>;

export type IUpdateCalendar = Partial<ICreateCalendar>;

// ── CALENDAR EVENT ──
export interface ICalendarEvent {
  id: number;
  school_id: number;
  calendar_id: number;
  academic_year_id: number;
  title: string;
  event_date: Date;
  end_date?: Date;
  event_type: EventType;
  affects_attendance: boolean;
  class_id?: number;
  description?: string;
  exam_id?: number;       // set only when auto-synced from the Exams module
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

export type ICreateCalendarEvent = Pick<
  ICalendarEvent,
  'calendar_id' | 'academic_year_id' | 'title' | 'event_date' | 'event_type'
> & {
  end_date?: Date;
  affects_attendance?: boolean;
  class_id?: number;
  description?: string;
  exam_id?: number;
};

export type IUpdateCalendarEvent = Partial<ICreateCalendarEvent>;

// ── CALENDAR WEEKLY OFF ──
// Replaces the rigid weekend_type enum with per-day, per-week flexibility —
// e.g. "every Sunday" + "2nd & 4th Saturday" at the same time.
export type WeekPattern = 'all' | '1st' | '2nd' | '3rd' | '4th' | '5th';

export interface ICalendarWeeklyOff {
  id: number;
  calendar_id: number;
  school_id: number;
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  week_pattern: WeekPattern;
  created_at: Date;
}

export type ICreateWeeklyOff = {
  day_of_week: number;
  week_pattern?: WeekPattern; // defaults to 'all' if omitted
};

// ── WORKING DAYS RESULT ──
export interface IWorkingDaysResult {
  total_days: number;
  working_days: number;
  weekend_days: number;
  holidays: number;
}
