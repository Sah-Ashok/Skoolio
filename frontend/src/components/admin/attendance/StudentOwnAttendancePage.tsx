"use client";

import { useState, useMemo, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, BS_MONTH_NAMES, bsToAD, daysInBSMonth, isoToBS } from "@/lib/bs-ad";

// ── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Always English day headers
const DAY_HEADERS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const STATUS_COLOR: Record<string, string> = {
  present:   "#12805c",
  absent:    "#b42318",
  late:      "#0369a1",   // "late" in DB = Suspended in display — blue-slate
  leave:     "#7c3aed",  // distinct purple for leave
};
const STATUS_BG: Record<string, string> = {
  present:   "#e2f6ee",
  absent:    "#fde7e7",
  late:      "#e0f2fe",   // light blue for suspended
  leave:     "#f3eeff",
};

// Label shown inside the badge for each status
const STATUS_LABEL: Record<string, string> = {
  present:  "P",
  absent:   "A",
  late:     "Su",   // late in DB = Suspended on display
  leave:    "Lv",
};

// Blue used for "remaining" (past working days with no record)
const REMAINING_COLOR = "#1a73e8";
const REMAINING_BG    = "#e8f0fe";

// Weekly-off day style (grey)
const OFF_COLOR = "#94a3b8";
const OFF_BG    = "#f1f5f9";

// Holiday style (red-tinted)
const HOL_COLOR = "#b42318";
const HOL_BG    = "#fde7e7";

/** Parse "YYYY-MM-DD" without timezone shift */
const parseLocal = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ── Calendar Grid ─────────────────────────────────────────────────────────────
// Supports both AD and BS calendars.
// - AD mode:  uses adYear/adMonth to build grid of AD day numbers.
// - BS mode:  uses bsYear/bsMonth to build grid of BS day numbers (1..daysInBSMonth);
//             each BS day is converted to its AD date string to look up attendance.
// weeklyOffDates: set of AD ISO strings that are weekly-off days
// holidayDates:   set of AD ISO strings that are holidays/suspended school days
function CalendarGrid({
  adYear, adMonth, recordsByDay, isBS, bsYear, bsMonth, recordsByAdDate,
  weeklyOffDates, holidayDates,
}: {
  adYear: number; adMonth: number;
  recordsByDay: Map<number, any>;
  isBS?: boolean;
  bsYear?: number; bsMonth?: number;
  recordsByAdDate?: Map<string, any>;
  weeklyOffDates: Set<string>;  // AD ISO strings of weekly-off days
  holidayDates:   Set<string>;  // AD ISO strings of holidays
}) {
  // ── Build cell list ─────────────────────────────────────────────────────────
  type Cell = {
    displayDay: number;          // BS day or AD day shown in the cell
    adDateStr:  string | null;   // AD ISO string for record lookup
    adDay:      number | null;   // AD day-of-month (AD mode)
    isToday:    boolean;
    isPast:     boolean;
  };

  const todayD = new Date().getDate();
  const todayM = new Date().getMonth() + 1;
  const todayY = new Date().getFullYear();
  const todayBS = adToBS(new Date());

  let cells: Cell[];

  if (isBS && bsYear && bsMonth) {
    // ── BS grid ──────────────────────────────────────────────────────────────
    const totalDays = daysInBSMonth(bsYear, bsMonth);
    const firstAd   = bsToAD({ year: bsYear, month: bsMonth, day: 1 });
    const firstDow  = firstAd.getDay();
    const leading   = (firstDow + 6) % 7;

    cells = Array(leading).fill(null).map(() => ({
      displayDay: 0, adDateStr: null, adDay: null, isToday: false, isPast: false,
    }));

    for (let bsD = 1; bsD <= totalDays; bsD++) {
      const ad  = bsToAD({ year: bsYear, month: bsMonth, day: bsD });
      const adY = ad.getFullYear();
      const adMStr = String(ad.getMonth() + 1).padStart(2, "0");
      const adDStr = String(ad.getDate()).padStart(2, "0");
      const adStr  = `${adY}-${adMStr}-${adDStr}`;

      // Is this BS day today?
      const cellIsToday = bsYear === todayBS.year && bsMonth === todayBS.month && bsD === todayBS.day;
      // Is this BS day in the past?
      const cellIsPast = bsYear < todayBS.year
        || (bsYear === todayBS.year && bsMonth < todayBS.month)
        || (bsYear === todayBS.year && bsMonth === todayBS.month && bsD < todayBS.day);

      cells.push({
        displayDay: bsD,
        adDateStr:  adStr,
        adDay:      null,
        isToday:    cellIsToday,
        isPast:     cellIsPast,
      });
    }
  } else {
    // ── AD grid ───────────────────────────────────────────────────────────────
    const firstDay    = new Date(adYear, adMonth - 1, 1).getDay();
    const startOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(adYear, adMonth, 0).getDate();

    const adCells: (number | null)[] = [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (adCells.length % 7 !== 0) adCells.push(null);

    cells = adCells.map(d => {
      if (!d) return { displayDay: 0, adDateStr: null, adDay: null, isToday: false, isPast: false };
      const cellIsToday = d === todayD && adMonth === todayM && adYear === todayY;
      const cellIsPast  = adYear < todayY
        || (adYear === todayY && adMonth < todayM)
        || (adYear === todayY && adMonth === todayM && d < todayD);
      return { displayDay: d, adDateStr: null, adDay: d, isToday: cellIsToday, isPast: cellIsPast };
    });
  }

  while (cells.length % 7 !== 0) cells.push({ displayDay: 0, adDateStr: null, adDay: null, isToday: false, isPast: false });

  return (
    <div>
      {/* Day headers — always English */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {DAY_HEADERS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 900, color: "#94a3b8", padding: "4px 0" }}>
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((cell, i) => {
          if (!cell.displayDay) return <div key={`empty-${i}`} />;

          // Look up attendance record
          let rec: any = null;
          let cellAdStr: string | null = null;
          if (isBS && cell.adDateStr && recordsByAdDate) {
            rec = recordsByAdDate.get(cell.adDateStr) ?? null;
            cellAdStr = cell.adDateStr;
          } else if (!isBS && cell.adDay !== null) {
            rec = recordsByDay.get(cell.adDay) ?? null;
            cellAdStr = `${adYear}-${String(adMonth).padStart(2,"0")}-${String(cell.adDay).padStart(2,"0")}`;
          }
          const status = rec?.status ?? null;

          // Determine day type from calendar
          const isWeeklyOff = cellAdStr ? weeklyOffDates.has(cellAdStr) : false;
          const isHoliday   = !isWeeklyOff && (cellAdStr ? holidayDates.has(cellAdStr) : false);

          // Only show "R" on past WORKING days with no record
          const isRemaining = !status && !isWeeklyOff && !isHoliday && cell.isPast && !cell.isToday;

          // Visual styles
          const bgColor = isWeeklyOff
            ? OFF_BG
            : isHoliday
              ? HOL_BG
              : isRemaining
                ? REMAINING_BG
                : status ? STATUS_BG[status] : "#f8fafc";

          const borderColor = cell.isToday
            ? "2px solid #FF9B51"
            : isWeeklyOff
              ? `1px solid ${OFF_COLOR}40`
              : isHoliday
                ? `1px solid ${HOL_COLOR}40`
                : isRemaining
                  ? `1px solid ${REMAINING_COLOR}40`
                  : status ? `1px solid ${STATUS_COLOR[status]}60` : "1px solid #e2e8f0";

          return (
            <div key={`${cell.displayDay}-${i}`} style={{
              borderRadius: 8,
              border: borderColor,
              background: bgColor,
              padding: "6px 4px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              minHeight: 52,
            }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: cell.isToday ? "#FF9B51" : isWeeklyOff ? OFF_COLOR : isHoliday ? HOL_COLOR : "#1e293b" }}>
                {cell.displayDay}
              </span>
              {status ? (
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: "uppercase",
                  color: STATUS_COLOR[status],
                  padding: "1px 4px", borderRadius: 4,
                  background: STATUS_BG[status],
                  border: `1px solid ${STATUS_COLOR[status]}40`,
                }}>
                  {STATUS_LABEL[status] ?? status}
                </span>
              ) : isWeeklyOff ? (
                <span style={{
                  fontSize: 8, fontWeight: 800, color: OFF_COLOR,
                  padding: "1px 4px", borderRadius: 4,
                  background: OFF_BG, border: `1px solid ${OFF_COLOR}40`,
                }}>Off</span>
              ) : isHoliday ? (
                <span style={{
                  fontSize: 8, fontWeight: 800, color: HOL_COLOR,
                  padding: "1px 4px", borderRadius: 4,
                  background: HOL_BG, border: `1px solid ${HOL_COLOR}40`,
                }}>H</span>
              ) : isRemaining ? (
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  color: REMAINING_COLOR,
                  padding: "1px 4px", borderRadius: 4,
                  background: REMAINING_BG,
                  border: `1px solid ${REMAINING_COLOR}40`,
                }}>R</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function StudentOwnAttendancePage() {
  const activeYear     = useAppSelector(s => s.academicYear?.activeYear);
  const academicYearId = activeYear?.id ?? null;

  const { isBS } = useDateFormat();
  const now = new Date();
  const todayBS = adToBS(now);

  // ── Build month options from academic year (same as calendar module) ───────────────
  type MonthOption = { value: string; year: number; month: number; label: string };

  const monthOptions = useMemo((): MonthOption[] => {
    if (!activeYear) return [];
    const opts: MonthOption[] = [];

    if (isBS) {
      const startStr = String(activeYear.start_date).slice(0, 10);
      const bsStart  = isoToBS(startStr);
      // Cap at today
      let capY = todayBS.year, capM = todayBS.month;
      let y = bsStart.year, m = bsStart.month;
      while (y < capY || (y === capY && m <= capM)) {
        opts.push({ value: `${y}-${m}`, year: y, month: m, label: `${BS_MONTH_NAMES[m - 1]} ${y}` });
        m++;
        if (m > 12) { m = 1; y++; }
      }
    } else {
      const startStr = String(activeYear.start_date).slice(0, 10);
      const d = new Date(startStr + "T00:00:00");
      d.setDate(1);
      const cap = new Date(now.getFullYear(), now.getMonth(), 1);
      while (d <= cap) {
        const y = d.getFullYear(), m = d.getMonth() + 1;
        opts.push({ value: `${y}-${m}`, year: y, month: m, label: `${MONTH_NAMES[d.getMonth()]} ${y}` });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return opts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear, isBS]);

  // ── Selected month (string key "year-month") ────────────────────────────────
  const [selectedValue, setSelectedValue] = useState("");

  // Auto-select current month once options are ready (same logic as CalendarPage)
  useEffect(() => {
    if (!monthOptions.length || selectedValue) return;
    let todayKey: string;
    if (isBS) {
      todayKey = `${todayBS.year}-${todayBS.month}`;
    } else {
      todayKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
    }
    const found = monthOptions.find(o => o.value === todayKey);
    setSelectedValue(found ? todayKey : monthOptions[monthOptions.length - 1].value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOptions, selectedValue, isBS]);

  const selectedIdx    = monthOptions.findIndex(o => o.value === selectedValue);
  const selectedOption = monthOptions[selectedIdx] ?? monthOptions[monthOptions.length - 1];
  const year  = selectedOption?.year  ?? (isBS ? todayBS.year  : now.getFullYear());
  const month = selectedOption?.month ?? (isBS ? todayBS.month : now.getMonth() + 1);

  const goToMonth = (dir: -1 | 1) => {
    const next = monthOptions[selectedIdx + dir];
    if (next) setSelectedValue(next.value);
  };

  // ── AD API params ──────────────────────────────────────────────────────────────
  const _adDate1 = isBS ? bsToAD({ year, month, day: 1 }) : new Date(year, month - 1, 1);
  const apiYear  = _adDate1.getFullYear();
  const apiMonth = _adDate1.getMonth() + 1;

  // Check if BS month ends in a different AD month
  const _bsLastDay = isBS ? daysInBSMonth(year, month) : 0;
  const _adDate2   = isBS ? bsToAD({ year, month, day: _bsLastDay }) : null;
  const apiYear2   = _adDate2 && (_adDate2.getFullYear() !== apiYear || _adDate2.getMonth() + 1 !== apiMonth)
    ? _adDate2.getFullYear() : null;
  const apiMonth2  = _adDate2 && apiYear2 ? _adDate2.getMonth() + 1 : null;

  // Full-year summary
  const { data: summary, loading: sumLoading } = useApi<any>(
    academicYearId
      ? `/attendance/me/summary?academic_year_id=${academicYearId}`
      : "",
    [academicYearId]
  );

  // Monthly calendar data — fetch first AD month, and second if needed (BS month spans 2 AD months)
  const { data: monthlyRecords, loading: monthLoading } = useApi<any[]>(
    academicYearId
      ? `/attendance/me/monthly?year=${apiYear}&month=${apiMonth}&academic_year_id=${academicYearId}`
      : "",
    [apiYear, apiMonth, academicYearId]
  );
  const { data: monthlyRecords2 } = useApi<any[]>(
    academicYearId && apiYear2
      ? `/attendance/me/monthly?year=${apiYear2}&month=${apiMonth2}&academic_year_id=${academicYearId}`
      : "",
    [apiYear2, apiMonth2, academicYearId]
  );

  const allRecords = [...(monthlyRecords ?? []), ...(monthlyRecords2 ?? [])];

  // ── Fetch school calendar to detect weekly-off and holiday days ───────────────
  const { data: calendarData } = useApi<any>(
    academicYearId ? `/calendar?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );
  const calendarId = calendarData?.id ?? null;

  const { data: weeklyOffsData } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/weekly-offs` : "",
    [calendarId]
  );
  const { data: eventsData } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/events` : "",
    [calendarId]
  );

  // Build a set of all weekly-off AD ISO dates for the displayed month(s)
  const weeklyOffDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    const weeklyOffs: { day_of_week: number; week_pattern: string }[] = weeklyOffsData ?? [];
    const weekendType: string = calendarData?.weekend_type ?? "sunday_only";

    const nthWeekdayOfMonth = (date: Date): string => {
      const ordinals = ["1st","2nd","3rd","4th","5th"];
      return ordinals[Math.ceil(date.getDate() / 7) - 1] ?? "5th";
    };

    const isWeeklyOff = (date: Date): boolean => {
      const day = date.getDay();
      if (weeklyOffs.length > 0) {
        const nth = nthWeekdayOfMonth(date);
        return weeklyOffs.some(w => w.day_of_week === day && (w.week_pattern === "all" || w.week_pattern === nth));
      }
      if (weekendType === "sunday_only")   return day === 0;
      if (weekendType === "saturday_only") return day === 6;
      return day === 0 || day === 6; // saturday_sunday
    };

    // Iterate over all AD days in the displayed month(s)
    const months: [number, number][] = [[apiYear, apiMonth]];
    if (apiYear2 && apiMonth2) months.push([apiYear2, apiMonth2]);
    for (const [y, m] of months) {
      const last = new Date(y, m, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const date = new Date(y, m - 1, d);
        if (isWeeklyOff(date)) {
          set.add(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
        }
      }
    }
    return set;
  }, [weeklyOffsData, calendarData, apiYear, apiMonth, apiYear2, apiMonth2]);

  // Build a set of holiday AD ISO dates (affects_attendance = true events)
  const holidayDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    const events: any[] = calendarData?.events ?? [];
    for (const ev of events) {
      if (!ev.affects_attendance) continue;
      // Expand multi-day events
      const start = parseLocal(String(ev.event_date).slice(0, 10));
      const end   = ev.end_date ? parseLocal(String(ev.end_date).slice(0, 10)) : start;
      const cur   = new Date(start);
      while (cur <= end) {
        set.add(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  }, [calendarData]);

  // Build lookup maps for attendance records
  // AD mode: day-of-month → record
  const recordsByDay = new Map<number, any>();
  // BS mode: AD date string → record
  const recordsByAdDate = new Map<string, any>();
  allRecords.forEach(r => {
    const d = parseLocal(r.date);
    recordsByDay.set(d.getDate(), r);
    const adStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    recordsByAdDate.set(adStr, r);
  });

  // Monthly counts (from allRecords for accurate stats)
  const mCounts = allRecords.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  // Month selector: academic year months (same as calendar module)
  // (monthOptions + selectedValue built above)

  const pct       = Number(summary?.attendance_percentage ?? 100);
  const present   = Number(summary?.total_present         ?? 0);
  const absent    = Number(summary?.total_absent          ?? 0);
  const late      = Number(summary?.total_late            ?? 0);
  const leave     = Number(summary?.total_leave           ?? 0);
  const working   = Number(summary?.total_working_days    ?? 0);
  const remaining = Number(summary?.total_remaining       ?? 0);
  const marked    = Number(summary?.total_marked_days     ?? 0);

  const pctColor = pct >= 85 ? "#12805c" : pct >= 70 ? "#c46a14" : "#b42318";
  const pctBg    = pct >= 85 ? "#e2f6ee" : pct >= 70 ? "#fff1df" : "#fde7e7";

  return (
    <>
      <style>{`
        .soa-page  { min-height:100vh; background:#eef2f3; }
        .soa-main  { padding:20px; max-width:960px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        .soa-card  { background:#fff; border-radius:14px; border:1px solid #dce5e9; overflow:hidden; box-shadow:0 2px 8px rgba(31,45,54,.05); }
        .soa-head  { padding:14px 18px; border-bottom:1px solid #eef2f3; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .soa-title { font-size:14px; font-weight:900; color:#1f2d36; margin:0; }
        .soa-sub   { font-size:11px; font-weight:700; color:#6a7882; margin:2px 0 0; }
        .soa-body  { padding:18px; }
        .soa-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:640px){
          .soa-grid2 { grid-template-columns:1fr; }
          .soa-main  { padding:14px; gap:12px; }
        }
      `}</style>

      <div className="soa-page">
        <Topbar title="My Attendance" subtitle="Monthly calendar and full-year summary" />

        <div className="soa-main">
          <>

              {/* ── Calendar + monthly stats ── */}
              <div className="soa-grid2">
                {/* Calendar */}
                <div className="soa-card">
                  <div className="soa-head">
                    <div>
                      <p className="soa-title">
                        {isBS ? `${BS_MONTH_NAMES[month - 1]} ${year}` : `${MONTH_NAMES[month - 1]} ${year}`}
                      </p>
                      <p className="soa-sub">Daily attendance calendar</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => goToMonth(-1)}
                        disabled={selectedIdx <= 0}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "1px solid #d4dde2",
                          background: selectedIdx <= 0 ? "#f8fafc" : "#fff",
                          color: selectedIdx <= 0 ? "#c6d0d7" : "#1f2d36",
                          cursor: selectedIdx <= 0 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                        }}
                      >
                        <i className="fa-solid fa-chevron-left" />
                      </button>
                      <select
                        value={selectedValue}
                        onChange={e => setSelectedValue(e.target.value)}
                        style={{ padding: "5px 8px", borderRadius: 8, border: "1px solid #d4dde2", fontSize: 12, fontWeight: 800, cursor: "pointer", background: "#fff", outline: "none" }}
                      >
                        {monthOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => goToMonth(1)}
                        disabled={selectedIdx >= monthOptions.length - 1}
                        style={{
                          width: 28, height: 28, borderRadius: 7, border: "1px solid #d4dde2",
                          background: selectedIdx >= monthOptions.length - 1 ? "#f8fafc" : "#fff",
                          color: selectedIdx >= monthOptions.length - 1 ? "#c6d0d7" : "#1f2d36",
                          cursor: selectedIdx >= monthOptions.length - 1 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                        }}
                      >
                        <i className="fa-solid fa-chevron-right" />
                      </button>
                    </div>
                  </div>
                  <div className="soa-body">
                    {monthLoading ? (
                      <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} color="#FF9B51" /></div>
                    ) : (
                      <CalendarGrid
                        adYear={apiYear} adMonth={apiMonth}
                        recordsByDay={recordsByDay}
                        isBS={isBS}
                        bsYear={isBS ? year : undefined}
                        bsMonth={isBS ? month : undefined}
                        recordsByAdDate={isBS ? recordsByAdDate : undefined}
                        weeklyOffDates={weeklyOffDates}
                        holidayDates={holidayDates}
                      />
                    )}
                  </div>
                </div>

                {/* Monthly stats + legend */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* This month counts */}
                  <div className="soa-card">
                    <div className="soa-head">
                      <div>
                        <p className="soa-title">
                          {isBS ? `${BS_MONTH_NAMES[month - 1]} ${year}` : `${MONTH_NAMES[month - 1]} ${year}`} Summary
                        </p>
                        <p className="soa-sub">Stats for selected month</p>
                      </div>
                    </div>
                    <div className="soa-body">
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Days Recorded", value: (monthlyRecords ?? []).length, color: "#6a7882", bg: "#f7fafb", border: "#e2e8f0" },
                          { label: "Present",        value: mCounts.present || 0,         color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
                          { label: "Absent",         value: mCounts.absent  || 0,         color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
                          { label: "Suspended",      value: mCounts.late    || 0,         color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
                          { label: "On Leave",       value: mCounts.leave   || 0,         color: "#7c3aed", bg: "#f3eeff", border: "#ddd6fe" },
                        ].map(row => (
                          <div key={row.label} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: 9,
                            background: row.bg, border: `1px solid ${row.border}`,
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{row.label}</span>
                            <strong style={{ fontSize: 16, fontWeight: 900, color: row.color }}>{row.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="soa-card">
                    <div className="soa-head">
                      <div>
                        <p className="soa-title">Legend</p>
                        <p className="soa-sub">Calendar colour codes</p>
                      </div>
                    </div>
                    <div className="soa-body">
                      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                        {[
                          { symbol: "P",   label: "P — Present",    color: "#12805c", bg: "#e2f6ee" },
                          { symbol: "A",   label: "A — Absent",     color: "#b42318", bg: "#fde7e7" },
                          { symbol: "Su",  label: "Su — Suspended", color: "#0369a1", bg: "#e0f2fe" },
                          { symbol: "Lv",  label: "Lv — Leave",     color: "#7c3aed", bg: "#f3eeff" },
                          { symbol: "R",   label: "R — Remaining",  color: REMAINING_COLOR, bg: REMAINING_BG },
                          { symbol: "Off", label: "Off — Weekly Off",color: OFF_COLOR,        bg: OFF_BG },
                          { symbol: "H",   label: "H — Holiday",    color: HOL_COLOR,        bg: HOL_BG },
                        ].map(item => (
                          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 7,
                              background: item.bg,
                              border: `1px solid ${item.color}60`,
                              flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <span style={{ fontSize: 10, fontWeight: 900, color: item.color }}>{item.symbol}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

         

              {/* Footer note */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 9, alignItems: "flex-start" }}>
                <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, color: "#c2410c", marginTop: 1, fontSize: 13 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                  For any discrepancies in your attendance records, contact your class teacher or school administration.
                </span>
              </div>
          </>
        </div>
      </div>
    </>
  );
}
