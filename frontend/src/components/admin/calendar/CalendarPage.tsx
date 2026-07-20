"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./calendar.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { apiRequest } from "@/lib/api";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES, BSDate } from "@/lib/bs-ad";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

type WeekendType = "sunday_only" | "saturday_only" | "saturday_sunday";
type EventType   = "off" | "holiday" | "event" | "exam" | "early_closing" | "working";

type CalendarDay = {
  date:     Date;
  day:      number;
  muted?:   boolean;
  type?:    EventType;
  label?:   string;
  eventId?: number;
};

type WeeklyOffRow = {
  id?: number;
  day_of_week:  number;   // 0=Sun … 6=Sat
  week_pattern: string;   // 'all' | '1st' | '2nd' | '3rd' | '4th' | '5th'
};

const weekDays   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/** Format a Date as YYYY-MM-DD — the key used in fixedEntries and fmt() */
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const weekendDayNums: Record<WeekendType, number[]> = {
  sunday_only:     [0],
  saturday_only:   [6],
  saturday_sunday: [0, 6],
};

const weekendFallbackLabel: Record<WeekendType, string> = {
  sunday_only:     "Every Sunday",
  saturday_only:   "Every Saturday",
  saturday_sunday: "Every Saturday & Sunday",
};

const ordinals = ["1st", "2nd", "3rd", "4th", "5th"];
const nthWeekdayOfMonth = (date: Date) => ordinals[Math.ceil(date.getDate() / 7) - 1] ?? "5th";

const isWeeklyOffDay = (date: Date, weeklyOffs: WeeklyOffRow[], fallbackType: WeekendType): boolean => {
  if (weeklyOffs.length > 0) {
    const day = date.getDay();
    const nth = nthWeekdayOfMonth(date);
    return weeklyOffs.some((w) => w.day_of_week === day && (w.week_pattern === "all" || w.week_pattern === nth));
  }
  return weekendDayNums[fallbackType].includes(date.getDay());
};

const dayLabels        = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const weekPatternOpts  = ["1st","2nd","3rd","4th","5th"];

type DayDraft    = { off: boolean; weeks: string[] };
type WeeklyDraft = Record<number, DayDraft>;

const blankDraft = (): WeeklyDraft => {
  const d: WeeklyDraft = {};
  for (let i = 0; i < 7; i++) d[i] = { off: false, weeks: ["all"] };
  return d;
};

const rowsToDraft = (rows: WeeklyOffRow[]): WeeklyDraft => {
  const draft = blankDraft();
  rows.forEach((r) => {
    draft[r.day_of_week].off = true;
    if (r.week_pattern === "all") {
      draft[r.day_of_week].weeks = ["all"];
    } else {
      if (draft[r.day_of_week].weeks[0] === "all") draft[r.day_of_week].weeks = [];
      if (!draft[r.day_of_week].weeks.includes(r.week_pattern))
        draft[r.day_of_week].weeks.push(r.week_pattern);
    }
  });
  return draft;
};

const draftToRows = (draft: WeeklyDraft): WeeklyOffRow[] => {
  const rows: WeeklyOffRow[] = [];
  Object.entries(draft).forEach(([day, cfg]) => {
    if (!cfg.off) return;
    if (cfg.weeks.length === 0 || cfg.weeks[0] === "all") {
      rows.push({ day_of_week: Number(day), week_pattern: "all" });
    } else {
      cfg.weeks.forEach((w) => rows.push({ day_of_week: Number(day), week_pattern: w }));
    }
  });
  return rows;
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: "5px 11px", borderRadius: 999, fontSize: 11, fontWeight: 900, cursor: "pointer",
  border: `1.5px solid ${active ? "#ff9b51" : "#d4dde2"}`,
  background: active ? "#ffe9d6" : "#fff",
  color: active ? "#c46a14" : "#6a7882",
});

// ── WeekendSettingsCard (unchanged logic) ─────────────────────────────────────
function WeekendSettingsCard({ calendarId, rows, fallbackType, onSaved }: {
  calendarId:   number;
  rows:         WeeklyOffRow[];
  fallbackType: WeekendType;
  onSaved:      () => void;
}) {
  const dispatch = useAppDispatch();
  const { execute: saveWeeklyOffs, loading: saving } = useMutation("/calendar", "PUT");
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState<WeeklyDraft>(() => rowsToDraft(rows));

  useEffect(() => { if (!editing) setDraft(rowsToDraft(rows)); }, [rows, editing]);

  const toggleDayOff = (day: number) =>
    setDraft((p) => ({ ...p, [day]: { ...p[day], off: !p[day].off, weeks: p[day].off ? p[day].weeks : ["all"] } }));
  const setAllWeeks = (day: number) =>
    setDraft((p) => ({ ...p, [day]: { ...p[day], weeks: ["all"] } }));
  const toggleWeekPattern = (day: number, pattern: string) =>
    setDraft((p) => {
      const cur  = p[day].weeks[0] === "all" ? [] : p[day].weeks;
      const next = cur.includes(pattern) ? cur.filter((w) => w !== pattern) : [...cur, pattern];
      return { ...p, [day]: { ...p[day], weeks: next.length ? next : ["all"] } };
    });

  const summaryLabel = useMemo(() => {
    const active = Object.entries(draft).filter(([, cfg]) => cfg.off);
    if (active.length === 0) return `${weekendFallbackLabel[fallbackType]} (default — not customised yet)`;
    return active.map(([day, cfg]) => {
      const label = dayLabels[Number(day)];
      return cfg.weeks[0] === "all" ? `Every ${label}` : `${cfg.weeks.join(" & ")} ${label}`;
    }).join(", ");
  }, [draft, fallbackType]);

  const handleSave = async () => {
    const offRows = draftToRows(draft);
    if (offRows.length === 0) { dispatch(showToast({ type: "error", title: "Error", message: "Select at least one weekly off day." })); return; }
    const result = await saveWeeklyOffs({ offs: offRows }, `/calendar/${calendarId}/weekly-offs`);
    if (result) {
      dispatch(showToast({ type: "success", title: "Weekly Off Updated", message: "Your weekly off schedule has been saved." }));
      onSaved(); setEditing(false);
    } else {
      dispatch(showToast({ type: "error", title: "Error", message: "Failed to update weekly off days." }));
    }
  };

  return (
    <article className={s("card")}>
      <div className={s("cardHead")}>
        <div><h2>Weekly Off Days</h2><p>Set which days — and which weeks — are off for your school.</p></div>
        {!editing && (
          <button className={cx(s("btn"), s("btnOutline"))} style={{ minHeight: 32, padding: "6px 14px", fontSize: 12 }}
            onClick={() => setEditing(true)} disabled={!calendarId}>
            <i className="fa-solid fa-pen" /> Change
          </button>
        )}
      </div>
      {!editing ? (
        <div className={s("rules")}>
          <span style={{ border: 0, paddingBottom: 0, alignItems: "flex-start" }}>
            <b>Current Schedule</b>
            <strong style={{ color: "#ff9b51", textAlign: "right", maxWidth: 230 }}>{summaryLabel}</strong>
          </span>
        </div>
      ) : (
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, margin: 0 }}>
            Tick the days that are off. A ticked day is off every week by default.
          </p>
          {Array.from({ length: 7 }, (_, day) => {
            const cfg = draft[day];
            return (
              <div key={day} style={{
                padding: "10px 12px",
                border: `2px solid ${cfg.off ? "#ff9b51" : "#d4dde2"}`,
                borderRadius: 9, background: cfg.off ? "#fff8f2" : "#fbfcfd",
                transition: "border-color 0.15s, background 0.15s",
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={cfg.off} onChange={() => toggleDayOff(day)}
                    style={{ accentColor: "#ff9b51", width: 16, height: 16, flexShrink: 0 }} />
                  <span style={{ fontSize: 13.5, fontWeight: 900, color: "#1f2d36" }}>{dayLabels[day]}</span>
                </label>
                {cfg.off && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, marginLeft: 26 }}>
                    <button type="button" onClick={() => setAllWeeks(day)} style={chipStyle(cfg.weeks[0] === "all")}>Every week</button>
                    {weekPatternOpts.map((w) => (
                      <button key={w} type="button" onClick={() => toggleWeekPattern(day, w)} style={chipStyle(cfg.weeks.includes(w))}>{w}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className={cx(s("btn"), s("btnSoft"))} style={{ flex: 1 }} onClick={() => { setDraft(rowsToDraft(rows)); setEditing(false); }} disabled={saving}>Cancel</button>
            <button className={cx(s("btn"), s("btnPrimary"))} style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size={15} /> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── DeleteEventModal ──────────────────────────────────────────────────────────
function DeleteEventModal({ event, onClose, onDeleted }: {
  event:     { id: number; title: string };
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const dispatch = useAppDispatch();
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiRequest(`/calendar/events/${event.id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: `"${event.title}" removed from calendar.` }));
      onDeleted();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to delete event." }));
    } finally { setDeleting(false); }
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:80, padding:"1rem" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:420, padding:"24px", boxShadow:"0 24px 64px rgba(15,23,42,0.22)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ width:44, height:44, borderRadius:12, background:"#fde7e7", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
          <i className="fa-solid fa-trash" style={{ color:"#b42318", fontSize:18 }} />
        </div>
        <h3 style={{ fontSize:16, fontWeight:900, margin:"0 0 6px" }}>Delete Event?</h3>
        <p style={{ fontSize:13, color:"#6a7882", margin:"0 0 20px" }}>
          <strong style={{ color:"#1f2d36" }}>"{event.title}"</strong> will be permanently removed.
        </p>
        <div style={{ display:"flex", gap:10 }}>
          <button className={cx(s("btn"), s("btnSoft"))} style={{ flex:1 }} onClick={onClose} disabled={deleting}>Cancel</button>
          <button className={cx(s("btn"))} style={{ flex:1, background:"#b42318", color:"#fff" }} onClick={handleDelete} disabled={deleting}>
            {deleting ? <Spinner size={15} /> : <><i className="fa-solid fa-trash" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MONTH OPTION TYPE
//  value is always "YYYY-MM" in AD for AD schools.
//  For BS schools, value is "BSYYYY-MM" (e.g. "2082-04" = Shrawan 2082).
//  This keeps the select value stable and unique regardless of calendar system.
// ─────────────────────────────────────────────────────────────────────────────
type MonthOption = {
  value:   string;   // "YYYY-MM" — AD for AD schools, BS for BS schools
  label:   string;   // display name
  adYear:  number;   // actual AD year for building the grid
  adMonth: number;   // actual AD month (0-based) for building the grid
};

// ── Main CalendarPage ─────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { formatDate, isBS } = useDateFormat();
  const { data: activeYear } = useApi<any>("/academic-years/active");

  const { data: calendarData, loading: calendarLoading } = useApi<any>(
    activeYear ? `/calendar?academic_year_id=${activeYear.id}` : ""
  );

  const weekendType: WeekendType = calendarData?.weekend_type ?? "sunday_only";
  const calendarId: number | null = calendarData?.id ?? null;

  const { data: eventsData,    refetch: refetchEvents    } = useApi<any[]>(calendarId ? `/calendar/${calendarId}/events`      : "");
  const { data: weeklyOffsData, refetch: refetchWeeklyOffs } = useApi<WeeklyOffRow[]>(calendarId ? `/calendar/${calendarId}/weekly-offs` : "");

  const [deletingEvent, setDeletingEvent] = useState<{ id: number; title: string } | null>(null);

  // ── event lookup: AD ISO date string → event data ─────────────────────────
  const fixedEntries = useMemo(() => {
    const entries: Record<string, { type: EventType; label: string; scope: string; eventId: number }> = {};
    (eventsData ?? [])
      .filter((ev) => ev.event_type !== "exam")
      .forEach((ev) => {
        const d   = new Date(ev.event_date);
        const end = ev.end_date ? new Date(ev.end_date) : new Date(ev.event_date);
        while (d <= end) {
          entries[fmt(d)] = {
            type:    ev.event_type as EventType,
            label:   ev.title,
            scope:   ev.class_id ? "Specific class" : "All classes",
            eventId: ev.id,
          };
          d.setDate(d.getDate() + 1);
        }
      });
    return entries;
  }, [eventsData]);

  // ── build month options ───────────────────────────────────────────────────
  //
  //  For AD schools: one option per AD calendar month in the academic year.
  //  For BS schools: one option per BS month that overlaps the academic year.
  //
  //  BS months do NOT align with AD months. We iterate BS months from the BS
  //  date of the academic year start to the BS date of the end. Each BS month
  //  option knows its AD representation so the grid can be built correctly.
  //
  const monthOptions = useMemo((): MonthOption[] => {
    if (!activeYear) return [];

    if (!isBS) {
      // AD: simple — one option per AD month
      const start = new Date(activeYear.start_date);
      const end   = new Date(activeYear.end_date);
      const opts: MonthOption[] = [];
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      while (d <= end) {
        const adYear  = d.getFullYear();
        const adMonth = d.getMonth(); // 0-based
        opts.push({
          value:   `${adYear}-${String(adMonth + 1).padStart(2, "0")}`,
          label:   `${monthNames[adMonth]} ${adYear}`,
          adYear,
          adMonth,
        });
        d.setMonth(d.getMonth() + 1);
      }
      return opts;
    }

    // BS: iterate BS months from the BS start date to the BS end date
    const startBS = adToBS(new Date(activeYear.start_date));
    const endBS   = adToBS(new Date(activeYear.end_date));

    const opts: MonthOption[] = [];
    let curYear  = startBS.year;
    let curMonth = startBS.month;

    while (
      curYear < endBS.year ||
      (curYear === endBS.year && curMonth <= endBS.month)
    ) {
      // Convert BS month 1st to AD to get the adYear/adMonth for grid building
      const adDate  = new Date(bsToISO({ year: curYear, month: curMonth, day: 1 }) + "T00:00:00");
      const adYear  = adDate.getFullYear();
      const adMonth = adDate.getMonth(); // 0-based

      opts.push({
        value:  `${curYear}-${String(curMonth).padStart(2, "0")}`,   // BS YYYY-MM
        label:  `${BS_MONTH_NAMES[curMonth - 1]} ${curYear}`,
        adYear,
        adMonth,
      });

      // Advance to next BS month
      if (curMonth === 12) { curYear++; curMonth = 1; }
      else curMonth++;
    }
    return opts;
  }, [activeYear, isBS]);

  // ── selected month state ──────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    if (monthOptions.length === 0 || selectedMonth) return;

    // Find today in the options
    let todayValue: string;
    if (isBS) {
      const todayBS = adToBS(new Date());
      todayValue = `${todayBS.year}-${String(todayBS.month).padStart(2, "0")}`;
    } else {
      const now = new Date();
      todayValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    const found = monthOptions.find((o) => o.value === todayValue);
    setSelectedMonth(found ? todayValue : monthOptions[0].value);
  }, [monthOptions, selectedMonth, isBS]);

  const selectedOption = monthOptions.find((o) => o.value === selectedMonth) ?? monthOptions[0];
  const selectedIndex  = monthOptions.findIndex((o) => o.value === selectedMonth);

  // For building the grid: always use the AD year/month
  const gridAdYear  = selectedOption?.adYear  ?? new Date().getFullYear();
  const gridAdMonth = selectedOption?.adMonth ?? new Date().getMonth(); // 0-based

  const monthLabel = selectedOption?.label ?? "";

  // ── build calendar grid ───────────────────────────────────────────────────
  //
  //  For both AD and BS schools the grid is built from AD dates.
  //  The BS month option stores the AD date of the BS month's 1st day, so we
  //  build the AD month that STARTS on BS month 1 — this correctly covers all
  //  the AD dates that fall within that BS month.
  //
  //  For BS schools:
  //    - gridAdMonth is the 0-based AD month of BS month 1st
  //    - daysInBSMonth gives the correct day count
  //    - We iterate days starting from the BS month's 1st AD date
  //
  const buildCalendarDays = (adYear: number, adMonth0: number): CalendarDay[] => {
    const days: CalendarDay[] = [];

    if (!isBS) {
      // Standard AD grid
      const firstDate   = new Date(adYear, adMonth0, 1);
      const daysInMonth = new Date(adYear, adMonth0 + 1, 0).getDate();
      let leading       = firstDate.getDay() - 1;
      if (leading === -1) leading = 6;

      for (let i = leading; i > 0; i--) {
        const date = new Date(adYear, adMonth0, 1 - i);
        days.push({ date, day: date.getDate(), muted: true });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const date  = new Date(adYear, adMonth0, d);
        const entry = fixedEntries[fmt(date)];
        const isOff = isWeeklyOffDay(date, weeklyOffsData ?? [], weekendType);
        days.push({ date, day: d, type: entry?.type ?? (isOff ? "off" : undefined), label: entry?.label ?? (isOff ? "Weekly Off" : undefined), eventId: entry?.eventId });
      }
      const trail = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
      for (let d = 1; d <= trail; d++) {
        const date = new Date(adYear, adMonth0 + 1, d);
        days.push({ date, day: date.getDate(), muted: true });
      }
      return days;
    }

    // ── BS grid ──────────────────────────────────────────────────────────────
    //
    //  selectedOption.value = "BSYYYY-MM", e.g. "2082-04" for Shrawan 2082.
    //  We parse the BS year and month from the value, then iterate from BS 1st
    //  to the last day of that BS month — each day is converted to an AD Date
    //  for rendering and for looking up events (which are stored in AD).
    //
    const [bsYearStr, bsMonthStr] = (selectedMonth || selectedOption?.value || "").split("-");
    const bsYear  = parseInt(bsYearStr,  10);
    const bsMonth = parseInt(bsMonthStr, 10);

    if (isNaN(bsYear) || isNaN(bsMonth)) return [];

    const totalDays = daysInBSMonth(bsYear, bsMonth);

    // First day of this BS month as AD Date — get its day-of-week for grid alignment
    const firstAD = new Date(bsToISO({ year: bsYear, month: bsMonth, day: 1 }) + "T00:00:00");
    let leading   = firstAD.getDay() - 1; // Monday-first
    if (leading === -1) leading = 6;

    // Leading muted cells (end of previous BS month)
    for (let i = leading; i > 0; i--) {
      const date = new Date(firstAD);
      date.setDate(date.getDate() - i);
      days.push({ date, day: date.getDate(), muted: true });
    }

    // Actual BS month days
    for (let bsDay = 1; bsDay <= totalDays; bsDay++) {
      const date  = new Date(bsToISO({ year: bsYear, month: bsMonth, day: bsDay }) + "T00:00:00");
      const key   = fmt(date);
      const entry = fixedEntries[key];
      const isOff = isWeeklyOffDay(date, weeklyOffsData ?? [], weekendType);
      days.push({
        date,
        day:     bsDay,   // show BS day number, not AD
        type:    entry?.type ?? (isOff ? "off" : undefined),
        label:   entry?.label ?? (isOff ? "Weekly Off" : undefined),
        eventId: entry?.eventId,
      });
    }

    // Trailing muted cells to complete the last row
    const trail = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
    const lastAD = new Date(bsToISO({ year: bsYear, month: bsMonth, day: totalDays }) + "T00:00:00");
    for (let d = 1; d <= trail; d++) {
      const date = new Date(lastAD);
      date.setDate(date.getDate() + d);
      days.push({ date, day: d, muted: true });
    }

    return days;
  };

  const calendarDays = useMemo(
    () => buildCalendarDays(gridAdYear, gridAdMonth),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridAdYear, gridAdMonth, selectedMonth, fixedEntries, weekendType, weeklyOffsData, isBS]
  );

  // ── stats ─────────────────────────────────────────────────────────────────
  const visibleDays  = calendarDays.filter((d) => !d.muted);
  const offCount     = visibleDays.filter((d) => d.type === "off").length;
  const holidayCount = visibleDays.filter((d) => d.type === "holiday").length;
  const eventCount   = visibleDays.filter((d) => d.type === "event" || d.type === "early_closing").length;
  const workingDays  = visibleDays.length - offCount - holidayCount;
  const monthEntries = visibleDays.filter((d) => d.type && d.type !== "off");

  const goToMonth = (dir: -1 | 1) => {
    const next = monthOptions[selectedIndex + dir];
    if (next) setSelectedMonth(next.value);
  };

  return (
    <div className={s("page")}>
      <Topbar title="Academic Calendar" subtitle="Manage working days, holidays, events, and exam dates" />
      <main className={s("content")}>
        {/* Header */}
        <section className={s("head")}>
          <div>
            <h1>Academic Calendar</h1>
            <p>{monthLabel} — working-day setup for attendance calculation.</p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnPrimary"))} href="/calendar/add">
              <i className="fa-solid fa-plus" /> Add Holiday / Event
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          <article className={s("green")}>
            <i className="fa-solid fa-calendar-check" />
            <span>Working Days</span>
            <strong>{workingDays}</strong>
            <small>{monthLabel}</small>
          </article>
          <article className={s("red")}>
            <i className="fa-solid fa-umbrella-beach" />
            <span>Holidays / Off</span>
            <strong>{offCount + holidayCount}</strong>
            <small>Weekly off + declared</small>
          </article>
          <article className={s("blue")}>
            <i className="fa-solid fa-bullhorn" />
            <span>Events</span>
            <strong>{eventCount}</strong>
            <small>School activities</small>
          </article>
        </section>

        <section className={s("layout")}>
          {/* Calendar grid */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div>
                <h2>{monthLabel}</h2>
                <p>
                  Attendance counts only working days.&nbsp;
                  <span style={{ color: "#b42318" }}>■</span> Off/Holiday &nbsp;
                  <span style={{ color: "#3b5bdb" }}>■</span> Event &nbsp;
                  <span style={{ color: "#7c3aed" }}>■</span> Early Closing
                  &nbsp;— Exams shown in <strong>Exams &amp; Results</strong>
                </p>
              </div>
              <div className={s("monthControls")}>
                <button type="button" onClick={() => goToMonth(-1)} disabled={selectedIndex <= 0}>
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {monthOptions.map((o) => (
                    <option value={o.value} key={o.value}>{o.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => goToMonth(1)} disabled={selectedIndex === monthOptions.length - 1}>
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>

            <div className={s("calendarGrid")}>
              {weekDays.map((d) => <div className={s("weekday")} key={d}>{d}</div>)}
              {calendarDays.map((item, i) => (
                <div
                  key={`${fmt(item.date)}-${i}`}
                  className={cx(s("day"), item.muted && s("muted"), item.type && s(item.type))}
                >
                  <span>{item.day}</span>
                  {item.label && <em>{item.label}</em>}
                  {!item.muted && item.type && item.type !== "off" && item.eventId && (
                    <button
                      className="day-delete-btn"
                      onClick={() => setDeletingEvent({ id: item.eventId!, title: item.label! })}
                      title="Remove event"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </article>

          {/* Sidebar */}
          <aside className={s("sideStack")}>
            {calendarLoading && !calendarData ? (
              <article className={s("card")}>
                <div className={s("cardHead")}><div><h2>Weekly Off Days</h2><p>Loading…</p></div></div>
                <div style={{ padding: 20, display: "flex", justifyContent: "center" }}><Spinner size={24} color="#ff9b51" /></div>
              </article>
            ) : (
              <WeekendSettingsCard
                calendarId={calendarData?.id ?? 0}
                rows={weeklyOffsData ?? []}
                fallbackType={weekendType}
                onSaved={refetchWeeklyOffs}
              />
            )}

            <article className={s("card")}>
              <div className={s("cardHead")}><div><h2>Academic Year</h2><p>Currently active year.</p></div></div>
              <div className={s("rules")}>
                <span><b>Year</b><strong>{activeYear?.year_name ?? "—"}</strong></span>
                <span><b>From</b><strong>{activeYear?.start_date ? formatDate(activeYear.start_date) : "—"}</strong></span>
                <span><b>To</b><strong>{activeYear?.end_date ? formatDate(activeYear.end_date) : "—"}</strong></span>
              </div>
            </article>

            <article className={s("card")}>
              <div className={s("cardHead")}><div><h2>{monthLabel} Entries</h2><p>Holidays and events.</p></div></div>
              <div className={s("eventList")}>
                {monthEntries.length ? (
                  monthEntries.map((item, i) => {
                    const entry = fixedEntries[fmt(item.date)];
                    return (
                      <div className={s("eventItem")} key={`${fmt(item.date)}-${i}`}>
                        <i className={s(item.type ?? "event")} />
                        <div style={{ flex: 1 }}>
                          <strong>{item.label}</strong>
                          <span>{String(item.day).padStart(2, "0")} {monthLabel} | {entry?.scope ?? "All classes"}</span>
                        </div>
                        {item.eventId && (
                          <button
                            onClick={() => setDeletingEvent({ id: item.eventId!, title: item.label! })}
                            style={{ background: "#fde7e7", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#b42318", fontSize: 11, flexShrink: 0 }}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={s("emptyState")}>
                    <i className="fa-solid fa-calendar-check" />
                    <strong>No special entries</strong>
                    <span>Only regular working days and weekly off are set.</span>
                  </div>
                )}
              </div>
            </article>
          </aside>
        </section>
      </main>

      {deletingEvent && (
        <DeleteEventModal
          event={deletingEvent}
          onClose={() => setDeletingEvent(null)}
          onDeleted={() => { setDeletingEvent(null); refetchEvents(); }}
        />
      )}

      <style>{`
        .${s("day")} { position: relative; }
        .${s("day")} .day-delete-btn {
          position: absolute; top: 5px; right: 5px;
          width: 18px; height: 18px; border-radius: 4px;
          border: none; background: rgba(180,35,24,0.12);
          color: #b42318; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; opacity: 0; transition: opacity 0.15s;
        }
        .${s("day")}:hover .day-delete-btn { opacity: 1; }
      `}</style>
    </div>
  );
}
