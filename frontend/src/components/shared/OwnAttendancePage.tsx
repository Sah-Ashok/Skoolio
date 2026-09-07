"use client";

/**
 * OwnAttendancePage — shared attendance calendar used by both
 * StudentOwnAttendancePage and TeacherOwnAttendancePage.
 */

import { useState, useMemo, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, BS_MONTH_NAMES, bsToAD, daysInBSMonth, isoToBS } from "@/lib/bs-ad";
import { useAppSelector } from "@/store/hooks";

export interface StatusCfg {
  label: string;
  short: string;
  color: string;
  bg:    string;
  border: string;
}

export interface SummaryFields {
  total_present:      number;
  total_absent:       number;
  total_leave:        number;
  total_late:         number;
  total_half_day:     number;
  total_working_days: number;
  attendance_percentage: number;
}

export interface OwnAttendancePageProps {
  monthlyApiUrl:    (year: number, month: number) => string | null;
  summaryApiUrl:    string | null;
  academicYearId:   number | null;
  activeYearName:   string;
  topbarTitle:      string;
  topbarSub:        string;
  statusConfig:     Record<string, StatusCfg>;
  getRecordStatus:  (record: any) => string;
  getRecordDate:    (record: any) => string;
  getSummaryFields: (data: any) => SummaryFields;
  todayCard?:       React.ReactNode;
}

const MONTH_NAMES_AD = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_HEADERS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const OFF_COLOR  = "#94a3b8"; const OFF_BG  = "#f1f5f9"; const OFF_BORDER  = "#e2e8f0";
const HOL_COLOR  = "#b42318"; const HOL_BG  = "#fde7e7"; const HOL_BORDER  = "#fca5a5";
const REM_COLOR  = "#1a73e8"; const REM_BG  = "#e8f0fe"; const REM_BORDER  = "#a8c7fa";

const parseLocal = (s: string) => {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export default function OwnAttendancePage({
  monthlyApiUrl, summaryApiUrl, academicYearId, activeYearName,
  topbarTitle, topbarSub, statusConfig,
  getRecordStatus, getRecordDate, getSummaryFields, todayCard,
}: OwnAttendancePageProps) {
  const { isBS } = useDateFormat();
  const now      = new Date();
  const todayBS  = adToBS(now);
  const activeYear = useAppSelector((s: any) => s.academicYear?.activeYear);

  // ── Month options ─────────────────────────────────────────────────────────
  type MonthOption = { value: string; year: number; month: number; label: string };
  const monthOptions = useMemo((): MonthOption[] => {
    if (!activeYear) return [];
    const opts: MonthOption[] = [];
    if (isBS) {
      const bsStart = isoToBS(String(activeYear.start_date).slice(0, 10));
      let y = bsStart.year, m = bsStart.month;
      const capY = todayBS.year, capM = todayBS.month;
      while (y < capY || (y === capY && m <= capM)) {
        opts.push({ value: `${y}-${m}`, year: y, month: m, label: `${BS_MONTH_NAMES[m - 1]} ${y}` });
        m++; if (m > 12) { m = 1; y++; }
      }
    } else {
      const d = new Date(String(activeYear.start_date).slice(0, 10) + "T00:00:00");
      d.setDate(1);
      const cap = new Date(now.getFullYear(), now.getMonth(), 1);
      while (d <= cap) {
        const y = d.getFullYear(), m = d.getMonth() + 1;
        opts.push({ value: `${y}-${m}`, year: y, month: m, label: `${MONTH_NAMES_AD[m - 1]} ${y}` });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return opts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeYear, isBS]);

  const [selectedValue, setSelectedValue] = useState("");
  useEffect(() => {
    if (!monthOptions.length || selectedValue) return;
    const key = isBS
      ? `${todayBS.year}-${todayBS.month}`
      : `${now.getFullYear()}-${now.getMonth() + 1}`;
    const found = monthOptions.find(o => o.value === key);
    setSelectedValue(found ? key : monthOptions[monthOptions.length - 1].value);
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

  const monthLabel = isBS
    ? `${BS_MONTH_NAMES[month - 1]} ${year}`
    : `${MONTH_NAMES_AD[month - 1]} ${year}`;

  // ── AD API params ─────────────────────────────────────────────────────────
  const adDate1  = isBS ? bsToAD({ year, month, day: 1 }) : new Date(year, month - 1, 1);
  const apiYear  = adDate1.getFullYear();
  const apiMonth = adDate1.getMonth() + 1;
  const bsLastDay = isBS ? daysInBSMonth(year, month) : 0;
  const adDate2   = isBS ? bsToAD({ year, month, day: bsLastDay }) : null;
  const apiYear2  = adDate2 && (adDate2.getFullYear() !== apiYear || adDate2.getMonth() + 1 !== apiMonth)
    ? adDate2.getFullYear() : null;
  const apiMonth2 = adDate2 && apiYear2 ? adDate2.getMonth() + 1 : null;

  // ── Monthly records ───────────────────────────────────────────────────────
  const url1 = monthlyApiUrl(apiYear, apiMonth);
  const url2 = apiYear2 ? monthlyApiUrl(apiYear2, apiMonth2!) : null;
  const { data: rawRecords1, loading: l1 } = useApi<any>(url1 ?? "", [url1]);
  const { data: rawRecords2, loading: l2 } = useApi<any>(url2 ?? "", [url2]);
  const loading = l1 || (!!url2 && l2);

  const normalise = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.records)) return raw.records;
    return [];
  };
  const allRecords = useMemo(
    () => [...normalise(rawRecords1), ...normalise(rawRecords2)],
    [rawRecords1, rawRecords2]
  );

  // ── Yearly summary ────────────────────────────────────────────────────────
  const { data: rawSummary, loading: sumLoading } = useApi<any>(summaryApiUrl ?? "", [summaryApiUrl]);
  const summary: SummaryFields = useMemo(
    () => rawSummary ? getSummaryFields(rawSummary) : {
      total_present: 0, total_absent: 0, total_leave: 0,
      total_late: 0, total_half_day: 0,
      total_working_days: 0, attendance_percentage: 0,
    },
    [rawSummary, getSummaryFields]
  );

  // ── School calendar ───────────────────────────────────────────────────────
  const { data: calendarData } = useApi<any>(
    academicYearId ? `/calendar?academic_year_id=${academicYearId}` : "", [academicYearId]
  );
  const calendarId = calendarData?.id ?? null;
  const { data: weeklyOffsData } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/weekly-offs` : "", [calendarId]
  );
  const { data: eventsData } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/events` : "", [calendarId]
  );

  // Helper: is a given AD Date a weekly off?
  const makeIsOff = (wOffs: any[], wType: string) => (date: Date): boolean => {
    const dow = date.getDay();
    if (wOffs.length > 0) {
      const ord = ["1st","2nd","3rd","4th","5th"];
      const nth = ord[Math.ceil(date.getDate() / 7) - 1] ?? "5th";
      return wOffs.some((w: any) => w.day_of_week === dow && (w.week_pattern === "all" || w.week_pattern === nth));
    }
    if (wType === "sunday_only")   return dow === 0;
    if (wType === "saturday_only") return dow === 6;
    return dow === 0 || dow === 6;
  };

  // Weekly-off dates for current displayed month only
  const weeklyOffDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    const isOff = makeIsOff(weeklyOffsData ?? [], calendarData?.weekend_type ?? "sunday_only");
    if (isBS) {
      const total = daysInBSMonth(year, month);
      for (let bsD = 1; bsD <= total; bsD++) {
        const ad = bsToAD({ year, month, day: bsD });
        if (isOff(ad))
          set.add(`${ad.getFullYear()}-${String(ad.getMonth()+1).padStart(2,"0")}-${String(ad.getDate()).padStart(2,"0")}`);
      }
    } else {
      const last = new Date(year, month, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const dt = new Date(year, month - 1, d);
        if (isOff(dt)) set.add(`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
      }
    }
    return set;
  }, [weeklyOffsData, calendarData, isBS, year, month]);

  // Holiday dates (attendance-affecting events)
  const holidayDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const ev of eventsData ?? []) {
      if (!ev.affects_attendance) continue;
      const start = parseLocal(ev.event_date);
      const end   = ev.end_date ? parseLocal(ev.end_date) : new Date(start);
      const cur   = new Date(start);
      while (cur <= end) {
        set.add(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  }, [eventsData]);

  // ── Record maps ───────────────────────────────────────────────────────────
  const recordsByAdDate = useMemo(() => {
    const map = new Map<string, string>();
    allRecords.forEach(r => map.set(getRecordDate(r), getRecordStatus(r)));
    return map;
  }, [allRecords, getRecordDate, getRecordStatus]);

  const mCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    allRecords.forEach(r => { const s = getRecordStatus(r); acc[s] = (acc[s] ?? 0) + 1; });
    return acc;
  }, [allRecords, getRecordStatus]);

  // ── Monthly working days (suspended = class off = not working) ────────────
  const workingDaysInMonth = useMemo(() => {
    let count = 0;
    if (isBS) {
      const total = daysInBSMonth(year, month);
      for (let bsD = 1; bsD <= total; bsD++) {
        const ad = bsToAD({ year, month, day: bsD });
        const ds = `${ad.getFullYear()}-${String(ad.getMonth()+1).padStart(2,"0")}-${String(ad.getDate()).padStart(2,"0")}`;
        if (!weeklyOffDates.has(ds) && !holidayDates.has(ds) && recordsByAdDate.get(ds) !== "suspended") count++;
      }
    } else {
      const last = new Date(year, month, 0).getDate();
      for (let d = 1; d <= last; d++) {
        const ds = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        if (!weeklyOffDates.has(ds) && !holidayDates.has(ds) && recordsByAdDate.get(ds) !== "suspended") count++;
      }
    }
    return count;
  }, [isBS, year, month, weeklyOffDates, holidayDates, recordsByAdDate]);

  // ── Calendar cells ────────────────────────────────────────────────────────
  type Cell = { displayDay: number | null; adStr: string | null; isToday: boolean; isPast: boolean };
  const cells = useMemo<Cell[]>(() => {
    const result: Cell[] = [];
    if (isBS) {
      const total   = daysInBSMonth(year, month);
      const firstAd = bsToAD({ year, month, day: 1 });
      const leading = (firstAd.getDay() + 6) % 7;
      for (let i = 0; i < leading; i++) result.push({ displayDay: null, adStr: null, isToday: false, isPast: false });
      for (let bsD = 1; bsD <= total; bsD++) {
        const ad  = bsToAD({ year, month, day: bsD });
        const adStr = `${ad.getFullYear()}-${String(ad.getMonth()+1).padStart(2,"0")}-${String(ad.getDate()).padStart(2,"0")}`;
        const isToday = year === todayBS.year && month === todayBS.month && bsD === todayBS.day;
        const isPast  = year < todayBS.year || (year === todayBS.year && month < todayBS.month)
          || (year === todayBS.year && month === todayBS.month && bsD < todayBS.day);
        result.push({ displayDay: bsD, adStr, isToday, isPast });
      }
    } else {
      const daysInM = new Date(year, month, 0).getDate();
      const leading = (new Date(year, month - 1, 1).getDay() + 6) % 7;
      const [tD, tM, tY] = [now.getDate(), now.getMonth() + 1, now.getFullYear()];
      for (let i = 0; i < leading; i++) result.push({ displayDay: null, adStr: null, isToday: false, isPast: false });
      for (let d = 1; d <= daysInM; d++) {
        const adStr   = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
        const isToday = d === tD && month === tM && year === tY;
        const isPast  = year < tY || (year === tY && month < tM) || (year === tY && month === tM && d < tD);
        result.push({ displayDay: d, adStr, isToday, isPast });
      }
    }
    while (result.length % 7 !== 0) result.push({ displayDay: null, adStr: null, isToday: false, isPast: false });
    return result;
  }, [isBS, year, month, todayBS, now]);

  // ── Yearly donut — declared before yearlyWorkingDays ──────────────────────
  const yPresent = summary.total_present;
  const yAbsent  = summary.total_absent;
  const yLeave   = summary.total_leave;
  const yHalfDay = summary.total_half_day;
  const yLate    = summary.total_late;
  const yWorking = summary.total_working_days; // raw backend (may be inflated)

  // ── All holiday dates across full academic year ───────────────────────────
  // eventsData already contains ALL events for the calendar (not month-scoped)
  // so we build a full-year holiday set once here for use in yearly calc.
  const allHolidayDates = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    for (const ev of eventsData ?? []) {
      if (!ev.affects_attendance) continue;
      const start = parseLocal(ev.event_date);
      const end   = ev.end_date ? parseLocal(ev.end_date) : new Date(start);
      const cur   = new Date(start);
      while (cur <= end) {
        set.add(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return set;
  }, [eventsData]);

  // ── Yearly working days split: elapsed vs remaining ───────────────────────
  // "elapsed"   = working days from year start up to and including today
  // "remaining" = working days from tomorrow to year end (future)
  // Total = elapsed + remaining
  const yearlyDaySplit = useMemo(() => {
    if (!activeYear || !calendarData) return { elapsed: 0, remaining: 0, total: yWorking };
    const isOff = makeIsOff(weeklyOffsData ?? [], calendarData?.weekend_type ?? "sunday_only");

    const start   = parseLocal(String(activeYear.start_date).slice(0, 10));
    const end     = parseLocal(String(activeYear.end_date).slice(0, 10));
    const todayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let elapsed = 0, remaining = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
      if (!isOff(cur) && !allHolidayDates.has(ds)) {
        if (cur.getTime() <= todayMs) elapsed++;
        else remaining++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return { elapsed, remaining, total: elapsed + remaining };
  }, [activeYear, calendarData, weeklyOffsData, allHolidayDates, now]);

  const yTotalMarked = yPresent + yAbsent + yLate + yLeave + yHalfDay;
  const yDenominator = yearlyDaySplit.elapsed > 0 ? yearlyDaySplit.elapsed : yTotalMarked;
  const yPct = yDenominator > 0
    ? Math.max(0, Math.round(((yDenominator - yAbsent) / yDenominator) * 100))
    : 100;

  const circ   = 2 * Math.PI * 38;
  const presArc = yDenominator > 0 ? ((yDenominator - yAbsent) / yDenominator) * circ : circ;
  const absArc  = yDenominator > 0 ? (yAbsent / yDenominator) * circ : 0;
  const absDeg  = ((yDenominator - yAbsent) / (yDenominator || 1)) * 360 - 90;

  // ── Derived lists ─────────────────────────────────────────────────────────
  const monthlySummaryItems = useMemo(() =>
    Object.entries(statusConfig).map(([key, cfg]) => ({
      key, symbol: cfg.short, label: cfg.label,
      val: mCounts[key] ?? 0, color: cfg.color, bg: cfg.bg, border: cfg.border,
    })),
  [statusConfig, mCounts]);

  // Legend: only calendar-state indicators — status symbols already shown in monthly summary
  const legendItems = [
    { symbol: "R",   label: "Remaining",  color: REM_COLOR, bg: REM_BG, border: REM_BORDER },
    { symbol: "Off", label: "Weekly Off", color: OFF_COLOR, bg: OFF_BG, border: OFF_BORDER },
    { symbol: "H",   label: "Holiday",    color: HOL_COLOR, bg: HOL_BG, border: HOL_BORDER },
  ];

  return (
    <>
      <style>{`
        .oa-page  { min-height: 100vh; background: #f8fafc; }
        .oa-main  { padding: 20px 24px 48px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
        
        .oa-page-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 2px; }
        .oa-page-head h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
        .oa-page-head p  { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; }
        
        .oa-year-badge { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 9px; background: #fff; border: 1px solid #e2e8f0; font-size: 12.5px; font-weight: 700; color: #475569; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .oa-year-badge i { color: #ff9148; font-size: 13px; }
        .oa-year-badge strong { color: #0f172a; }

        .oa-card  { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.02); }
        .oa-head  { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .oa-title { font-size: 15px; font-weight: 900; color: #0f172a; margin: 0; }
        .oa-sub   { font-size: 11.5px; font-weight: 700; color: #64748b; margin: 2px 0 0; }
        .oa-body  { padding: 18px; }
        .oa-grid2 { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 18px; align-items: start; }
        
        @media (max-width: 900px) { .oa-grid2 { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { 
          .oa-main { padding: 14px 12px 32px; gap: 14px; }
          .oa-page-head { flex-direction: column; align-items: flex-start; gap: 8px; }
          .oa-year-badge { width: 100%; }
        }
      `}</style>

      <div className="oa-page">
        <main className="oa-main">
          
          {/* ── Page Header ── */}
          <section className="oa-page-head">
            <div>
              <h1>{topbarTitle}</h1>
              <p>{topbarSub}</p>
            </div>
            {activeYearName && (
              <div className="oa-year-badge">
                <i className="fa-solid fa-calendar-check" />
                <span>Academic Year: <strong>{activeYearName}</strong></span>
              </div>
            )}
          </section>

          <div className="oa-grid2">

            {/* ── Left: Calendar ── */}
            <div className="oa-card">
              <div className="oa-head">
                <div>
                  <p className="oa-title">{monthLabel}</p>
                  <p className="oa-sub">Daily attendance calendar</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button type="button" onClick={() => goToMonth(-1)} disabled={selectedIdx <= 0}
                    aria-label="Previous Month"
                    style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #cbd5e1", background: selectedIdx <= 0 ? "#f8fafc" : "#fff", color: selectedIdx <= 0 ? "#cbd5e1" : "#1e293b", cursor: selectedIdx <= 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, transition: "all 0.15s ease" }}>
                    <i className="fa-solid fa-chevron-left" />
                  </button>
                  <select value={selectedValue} onChange={e => setSelectedValue(e.target.value)}
                    style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12.5, fontWeight: 800, cursor: "pointer", background: "#fff", color: "#0f172a", outline: "none" }}>
                    {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button type="button" onClick={() => goToMonth(1)} disabled={selectedIdx >= monthOptions.length - 1}
                    aria-label="Next Month"
                    style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #cbd5e1", background: selectedIdx >= monthOptions.length - 1 ? "#f8fafc" : "#fff", color: selectedIdx >= monthOptions.length - 1 ? "#cbd5e1" : "#1e293b", cursor: selectedIdx >= monthOptions.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, transition: "all 0.15s ease" }}>
                    <i className="fa-solid fa-chevron-right" />
                  </button>
                </div>
              </div>

              <div className="oa-body">
                {/* Day headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                  {DAY_HEADERS.map(d => (
                    <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 900, color: "#94a3b8", padding: "4px 0", textTransform: "uppercase" }}>{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                {loading ? (
                  <div style={{ padding: "3rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading calendar…" /></div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {cells.map((cell, i) => {
                      if (!cell.displayDay) return <div key={`e${i}`} />;
                      const adStr     = cell.adStr!;
                      const status    = recordsByAdDate.get(adStr) ?? null;
                      const cfg       = status ? (statusConfig[status] ?? null) : null;
                      const isWeekOff = weeklyOffDates.has(adStr);
                      const isHoliday = !isWeekOff && holidayDates.has(adStr);
                      const isRemain  = !status && !isWeekOff && !isHoliday && (cell.isPast || cell.isToday);

                      const bg = isWeekOff ? OFF_BG : isHoliday ? HOL_BG : isRemain ? REM_BG : cfg ? cfg.bg : "#f8fafc";
                      const border = cell.isToday ? "2px solid #ea580c"
                        : isWeekOff ? `1px solid ${OFF_BORDER}`
                        : isHoliday ? `1px solid ${HOL_BORDER}`
                        : isRemain  ? `1px solid ${REM_BORDER}`
                        : cfg       ? `1px solid ${cfg.border}`
                        : "1px solid #e2e8f0";
                      const numColor = cell.isToday ? "#ea580c"
                        : isWeekOff ? OFF_COLOR
                        : isHoliday ? HOL_COLOR
                        : isRemain  ? REM_COLOR
                        : cfg       ? cfg.color
                        : "#0f172a";
                      const badge = cfg ? cfg.short : isWeekOff ? "Off" : isHoliday ? "H" : isRemain ? "R" : null;

                      return (
                        <div key={`d${i}`} style={{ borderRadius: 8, border, background: bg, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minHeight: 52 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: numColor }}>{cell.displayDay}</span>
                          {badge && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: cfg ? cfg.color : numColor, padding: "1px 4px", borderRadius: 4, background: cfg ? cfg.bg : bg, border: `1px solid ${cfg ? cfg.border : border}` }}>
                              {badge}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Monthly Summary */}
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
                  <p style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>Monthly Summary</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                    {[
                      ...monthlySummaryItems.map(i => ({ ...i, icon: undefined as string | undefined })),
                      { symbol: "WD", icon: "fa-calendar-check", label: "Working Days", val: workingDaysInMonth, color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
                    ].map(item => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: item.color, background: item.bg, border: `1px solid ${item.border}`, padding: "2px 6px", borderRadius: 4, flexShrink: 0, minWidth: 26, textAlign: "center" }}>
                          {item.icon ? <i className={`fa-solid ${item.icon}`} style={{ fontSize: 10 }} /> : item.symbol}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#475569" }}>{item.label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#94a3b8" }}>:</span>
                        <span style={{ fontSize: 13.5, fontWeight: 900, color: item.color }}>{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: Sidebar ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {todayCard}

              {/* Yearly Summary */}
              <div className="oa-card">
                <div className="oa-head">
                  <div>
                    <p className="oa-title">Yearly Summary</p>
                    <p className="oa-sub">{activeYearName} — full year</p>
                  </div>
                </div>
                <div className="oa-body">
                  {sumLoading ? (
                    <div style={{ textAlign: "center", padding: "1.5rem 1rem" }}><Loader fullScreen={false} size="sm" text="Loading summary…" /></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {/* Donut */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <svg viewBox="0 0 100 100" width={84} height={84}>
                            <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="14" />
                            {yAbsent > 0 && yDenominator > 0 && (
                              <circle cx="50" cy="50" r="38" fill="none" stroke="#dc2626" strokeWidth="14"
                                strokeDasharray={`${absArc} ${circ - absArc}`}
                                strokeDashoffset={0} strokeLinecap="butt"
                                style={{ transform: `rotate(${absDeg}deg)`, transformOrigin: "50px 50px" }} />
                            )}
                            <circle cx="50" cy="50" r="38" fill="none" stroke="#059669" strokeWidth="14"
                              strokeDasharray={`${presArc} ${circ - presArc}`}
                              strokeDashoffset={0} strokeLinecap="butt"
                              style={{ transform: "rotate(-90deg)", transformOrigin: "50px 50px" }} />
                          </svg>
                          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{`${yPct}%`}</span>
                            <span style={{ fontSize: 8.5, fontWeight: 700, color: "#64748b" }}>attend.</span>
                          </div>
                        </div>
                        {/* Legend rows */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                          {[
                            { label: "Present",   val: yPresent, color: "#059669" },
                            { label: "Absent",    val: yAbsent,  color: "#dc2626" },
                            { label: "Leave",     val: yLeave,   color: "#7c3aed" },
                            ...(yLate    > 0 ? [{ label: "Suspended", val: yLate,    color: "#0369a1" }] : []),
                            ...(yHalfDay > 0 ? [{ label: "Half Day",  val: yHalfDay, color: "#d97706" }] : []),
                          ].map(it => (
                            <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: 2, background: it.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>{it.label}</span>
                              <span style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", marginLeft: "auto" }}>{it.val}</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 4, padding: "5px 8px", borderRadius: 6, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#64748b" }}>% = (days − absent) ÷ days × 100</span>
                          </div>
                        </div>
                      </div>

                      {yearlyDaySplit.total > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 9, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#475569" }}>Total Working Days</span>
                            <strong style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{yearlyDaySplit.total}</strong>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            <div style={{ padding: "8px 12px", borderRadius: 8, background: "#e2f6ee", border: "1px solid #a7f3d0", textAlign: "center" }}>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#12805c" }}>{yearlyDaySplit.elapsed}</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#12805c", opacity: 0.85 }}>Elapsed</div>
                            </div>
                            <div style={{ padding: "8px 12px", borderRadius: 8, background: "#e8f0fe", border: "1px solid #a8c7fa", textAlign: "center" }}>
                              <div style={{ fontSize: 14, fontWeight: 900, color: "#1a73e8" }}>{yearlyDaySplit.remaining}</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#1a73e8", opacity: 0.85 }}>Remaining</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Legend */}
              <div className="oa-card">
                <div className="oa-head">
                  <div>
                    <p className="oa-title">Legend</p>
                    <p className="oa-sub">Calendar colour codes</p>
                  </div>
                </div>
                <div className="oa-body">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {legendItems.map(item => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", flex: 1 }}>{item.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: item.color, background: item.bg, border: `1px solid ${item.border}`, padding: "1px 7px", borderRadius: 5 }}>{item.symbol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, color: "#c2410c", marginTop: 2, fontSize: 13 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e", lineHeight: 1.5 }}>
              For any discrepancies in your attendance records, contact your class teacher or school administration.
            </span>
          </div>
        </main>
      </div>
    </>
  );
}
