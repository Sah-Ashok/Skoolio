"use client";

/**
 * CalendarDayStatus
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable hook + banner for checking whether an AD date is a school holiday
 * or weekly-off day. Consumed by:
 *   • Teacher portal  →  faculty/TeacherMarkAttendancePage
 *   • Admin portal    →  attendance/TeacherMarkAttendancePage
 *   • Staff portal    →  staff/StaffAttendancePage
 *
 * Usage:
 *   const { isNonWorkingDay, holidayEvent, isWeeklyOff } =
 *     useCalendarDayStatus(adDate, activeYearId);
 *
 *   <CalendarDayStatusBanner adDate={date} academicYearId={activeYear?.id} />
 */

import { useApi } from "@/lib/useApi";
import { useDateFormat } from "@/lib/useDateFormat";

// ── Types ────────────────────────────────────────────────────────────────────

type WeekendType  = "sunday_only" | "saturday_only" | "saturday_sunday";
type WeeklyOffRow = { day_of_week: number; week_pattern: string };

const ordinals = ["1st", "2nd", "3rd", "4th", "5th"];
const nthWeekdayOfMonth = (d: Date) =>
  ordinals[Math.ceil(d.getDate() / 7) - 1] ?? "5th";

/** Whether `date` is a configured weekly-off day */
function checkWeeklyOff(
  date: Date,
  weeklyOffs: WeeklyOffRow[],
  fallback: WeekendType
): boolean {
  const weekendNums: Record<WeekendType, number[]> = {
    sunday_only:      [0],
    saturday_only:    [6],
    saturday_sunday:  [0, 6],
  };
  if (weeklyOffs.length > 0) {
    const day = date.getDay();
    const nth = nthWeekdayOfMonth(date);
    return weeklyOffs.some(
      w => w.day_of_week === day &&
           (w.week_pattern === "all" || w.week_pattern === nth)
    );
  }
  return weekendNums[fallback].includes(date.getDay());
}

/** Returns the holiday/off event whose range includes `adDate`, or null */
function findHolidayEvent(adDate: string, events: any[]): any | null {
  const d = new Date(adDate + "T00:00:00");
  for (const ev of events) {
    if (ev.event_type !== "holiday" && ev.event_type !== "off") continue;
    const start = new Date(ev.event_date + "T00:00:00");
    const end   = ev.end_date
      ? new Date(ev.end_date + "T00:00:00")
      : new Date(ev.event_date + "T00:00:00");
    if (d >= start && d <= end) return ev;
  }
  return null;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface CalendarDayStatusResult {
  /** True when the date is a holiday or weekly-off — attendance should be blocked */
  isNonWorkingDay: boolean;
  /** The holiday/off event object from the calendar, if any */
  holidayEvent: any | null;
  /** True when the date is a weekly-off (not a named holiday) */
  isWeeklyOff: boolean;
  /** Still loading calendar data */
  loading: boolean;
}

/**
 * Fetches calendar data for the given academic year and derives whether
 * `adDate` (ISO YYYY-MM-DD) is a working day, holiday, or weekly-off.
 */
export function useCalendarDayStatus(
  adDate: string,
  academicYearId?: number | null
): CalendarDayStatusResult {
  const { data: calendarData, loading: calLoad } = useApi<any>(
    academicYearId ? `/calendar?academic_year_id=${academicYearId}` : ""
  );

  const calendarId: number | null = calendarData?.id ?? null;
  const weekendType: WeekendType  = calendarData?.weekend_type ?? "sunday_only";

  const { data: eventsData,     loading: evLoad } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/events` : ""
  );
  const { data: weeklyOffsData, loading: woLoad } = useApi<WeeklyOffRow[]>(
    calendarId ? `/calendar/${calendarId}/weekly-offs` : ""
  );

  const loading      = calLoad || evLoad || woLoad;
  const events       = eventsData    ?? [];
  const weeklyOffs   = weeklyOffsData ?? [];

  const dateObj      = new Date(adDate + "T00:00:00");
  const holidayEvent = findHolidayEvent(adDate, events);
  const isWeeklyOff  = !holidayEvent && checkWeeklyOff(dateObj, weeklyOffs, weekendType);
  const isNonWorkingDay = Boolean(holidayEvent) || isWeeklyOff;

  return { isNonWorkingDay, holidayEvent, isWeeklyOff, loading };
}

// ── Banner component ──────────────────────────────────────────────────────────

interface CalendarDayStatusBannerProps {
  /** AD date string (YYYY-MM-DD) to check */
  adDate: string;
  /** Academic year ID; if omitted the banner is not rendered */
  academicYearId?: number | null;
}

/**
 * Renders a red holiday banner or a grey weekly-off banner when the given
 * `adDate` is not a working day. Renders nothing on working days.
 *
 * Dates are displayed in the school configured calendar format (BS or AD)
 * using the `useDateFormat` hook — so Nepal schools see BS dates.
 */
export function CalendarDayStatusBanner({
  adDate,
  academicYearId,
}: CalendarDayStatusBannerProps) {
  const { isNonWorkingDay, holidayEvent, isWeeklyOff } =
    useCalendarDayStatus(adDate, academicYearId);
  const { formatDate } = useDateFormat();

  if (!isNonWorkingDay) return null;

  const hasDateRange =
    holidayEvent &&
    holidayEvent.end_date &&
    holidayEvent.end_date !== holidayEvent.event_date;

  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: 12,
        background: isWeeklyOff ? "#f8fafc" : "#fde7e7",
        border: `1.5px solid ${isWeeklyOff ? "#d4dde2" : "#fca5a5"}`,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      {/* Icon badge */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: isWeeklyOff ? "#e2e8f0" : "#ffe4e4",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <i
          className={`fa-solid ${isWeeklyOff ? "fa-umbrella-beach" : "fa-calendar-xmark"}`}
          style={{ fontSize: 18, color: isWeeklyOff ? "#64748b" : "#b42318" }}
        />
      </div>

      {/* Label + description */}
      <div>
        <p
          style={{
            margin: 0,
            fontWeight: 900,
            fontSize: 15,
            color: isWeeklyOff ? "#1f2d36" : "#b42318",
          }}
        >
          {isWeeklyOff
            ? "Weekly Off Day"
            : `Holiday \u2014 ${holidayEvent?.title ?? "School Holiday"}`}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            fontWeight: 600,
            color: "#6a7882",
            lineHeight: 1.55,
          }}
        >
          {isWeeklyOff ? (
            "Attendance cannot be marked on a weekly off day. Please select a working day."
          ) : (
            <>
              This date is marked as a holiday on the school calendar
              {hasDateRange ? (
                <>
                  {" ("}
                  <strong style={{ color: "#b42318" }}>
                    {formatDate(holidayEvent.event_date)}
                  </strong>
                  {" \u2013 "}
                  <strong style={{ color: "#b42318" }}>
                    {formatDate(holidayEvent.end_date)}
                  </strong>
                  {")"}
                </>
              ) : null}
              . No attendance is recorded.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
