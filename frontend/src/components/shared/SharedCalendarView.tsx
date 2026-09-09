"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import styles from "@/components/admin/calendar/calendar.module.css";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { adToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES, todayLocalISO } from "@/lib/bs-ad";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

// ── Types ──────────────────────────────────────────────────────────────────
type EventType   = "off" | "holiday" | "event" | "early_closing" | "working";
type WeekendType = "sunday_only" | "saturday_only" | "saturday_sunday";

type WeeklyOffRow = {
  id?: number;
  day_of_week:  number;
  week_pattern: string;
};

type CalendarDay = {
  date:         Date;
  day:          number;   // BS day number for BS schools, AD day number for AD schools
  muted?:       boolean;
  type?:        EventType;
  label?:       string;
  description?: string;
};

type MonthOption = {
  value:   string;   // "YYYY-MM" — AD for AD schools, BS for BS schools
  label:   string;   // display name
  adYear:  number;   // AD year for grid building
  adMonth: number;   // AD month 0-based for grid building
};

// ── Constants ──────────────────────────────────────────────────────────────
const WEEK_DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AD_MONTHS  = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKEND_DAYS: Record<WeekendType, number[]> = {
  sunday_only:     [0],
  saturday_only:   [6],
  saturday_sunday: [0, 6],
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const ordinals = ["1st", "2nd", "3rd", "4th", "5th"];
const nthWeekday = (dayOfMonth: number) => ordinals[Math.ceil(dayOfMonth / 7) - 1] ?? "5th";

const isWeeklyOff = (date: Date, dayOfMonth: number, offs: WeeklyOffRow[], fallback: WeekendType): boolean => {
  if (offs.length > 0) {
    const day = date.getDay();
    const nth = nthWeekday(dayOfMonth);
    return offs.some((w) => w.day_of_week === day && (w.week_pattern === "all" || w.week_pattern === nth));
  }
  return WEEKEND_DAYS[fallback].includes(date.getDay());
};

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  role?: "teacher" | "student" | "admin" | "finance" | string;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SharedCalendarView({ role: _role }: Props) {
  const { formatDate, isBS } = useDateFormat();
  const { activeYear } = useAcademicYear();

  const { data: calendarData, loading: calLoading } = useApi<any>(
    activeYear?.id ? `/calendar?academic_year_id=${activeYear.id}` : null
  );

  const calendarId: number | null = calendarData?.id ?? null;
  const fallback: WeekendType     = calendarData?.weekend_type ?? (isBS ? "saturday_only" : "sunday_only");

  const { data: eventsRaw  } = useApi<any[]>(calendarId ? `/calendar/${calendarId}/events` : null);
  const { data: weeklyOffs } = useApi<WeeklyOffRow[]>(calendarId ? `/calendar/${calendarId}/weekly-offs` : null);

  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  // ── Month options ─────────────────────────────────────────────────────────
  const monthOptions = useMemo((): MonthOption[] => {
    if (!activeYear?.start_date || !activeYear?.end_date) return [];

    const startStr = String(activeYear.start_date).slice(0, 10);
    const endStr   = String(activeYear.end_date).slice(0, 10);
    if (!startStr || !endStr) return [];

    if (!isBS) {
      const start = new Date(startStr + "T00:00:00");
      const end   = new Date(endStr   + "T00:00:00");
      const opts: MonthOption[] = [];
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      while (d <= end) {
        const adYear  = d.getFullYear();
        const adMonth = d.getMonth();
        opts.push({
          value:  `${adYear}-${String(adMonth + 1).padStart(2, "0")}`,
          label:  `${AD_MONTHS[adMonth]} ${adYear}`,
          adYear,
          adMonth,
        });
        d.setMonth(d.getMonth() + 1);
      }
      return opts;
    }

    const startBS = adToBS(new Date(startStr + "T00:00:00"));
    const endBS   = adToBS(new Date(endStr   + "T00:00:00"));
    const opts: MonthOption[] = [];
    let curYear  = startBS.year;
    let curMonth = startBS.month;

    while (
      curYear < endBS.year ||
      (curYear === endBS.year && curMonth <= endBS.month)
    ) {
      const adDate  = new Date(bsToISO({ year: curYear, month: curMonth, day: 1 }) + "T00:00:00");
      const adYear  = adDate.getFullYear();
      const adMonth = adDate.getMonth();
      opts.push({
        value:  `${curYear}-${String(curMonth).padStart(2, "0")}`,
        label:  `${BS_MONTH_NAMES[curMonth - 1]} ${curYear}`,
        adYear,
        adMonth,
      });
      if (curMonth === 12) {
        curYear++;
        curMonth = 1;
      } else {
        curMonth++;
      }
    }
    return opts;
  }, [activeYear, isBS]);

  // ── Auto-select current month once ────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState("");
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!monthOptions.length || autoSelectedRef.current) return;
    autoSelectedRef.current = true;

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
  }, [monthOptions, isBS]);

  const selIdx         = monthOptions.findIndex((o) => o.value === selectedMonth);
  const selectedOption = monthOptions[selIdx] ?? monthOptions[0];
  const gridAdYear     = selectedOption?.adYear  ?? new Date().getFullYear();
  const gridAdMonth    = selectedOption?.adMonth ?? new Date().getMonth();
  const moLabel        = selectedOption?.label ?? "";

  // ── Event map: AD ISO date → event ────────────────────────────────────────
  const eventMap = useMemo(() => {
    const map: Record<string, { type: EventType; label: string; description?: string }> = {};
    (eventsRaw ?? []).filter((ev) => ev.event_type !== "exam").forEach((ev) => {
      const startStr = String(ev.event_date || "").slice(0, 10);
      if (!startStr) return;
      const endStr = ev.end_date ? String(ev.end_date).slice(0, 10) : startStr;
      const start  = new Date(startStr + "T00:00:00");
      const end    = new Date(endStr   + "T00:00:00");
      const d      = new Date(start);
      while (d <= end) {
        map[fmt(d)] = {
          type: ev.event_type as EventType,
          label: ev.title,
          description: ev.description,
        };
        d.setDate(d.getDate() + 1);
      }
    });
    return map;
  }, [eventsRaw]);

  // ── Build calendar grid ───────────────────────────────────────────────────
  const grid = useMemo((): CalendarDay[] => {
    const days: CalendarDay[] = [];

    if (!isBS) {
      const firstDate   = new Date(gridAdYear, gridAdMonth, 1);
      const daysInMonth = new Date(gridAdYear, gridAdMonth + 1, 0).getDate();
      let lead = firstDate.getDay() - 1;
      if (lead === -1) lead = 6;

      for (let i = lead; i > 0; i--) {
        const d = new Date(gridAdYear, gridAdMonth, 1 - i);
        days.push({ date: d, day: d.getDate(), muted: true });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const date  = new Date(gridAdYear, gridAdMonth, d);
        const entry = eventMap[fmt(date)];
        const off   = isWeeklyOff(date, d, weeklyOffs ?? [], fallback);
        days.push({
          date,
          day: d,
          type: entry?.type ?? (off ? "off" : undefined),
          label: entry?.label ?? (off ? "Weekly Off" : undefined),
          description: entry?.description,
        });
      }
      const trail = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
      for (let d = 1; d <= trail; d++) {
        const date = new Date(gridAdYear, gridAdMonth + 1, d);
        days.push({ date, day: date.getDate(), muted: true });
      }
      return days;
    }

    const [bsYearStr, bsMonthStr] = (selectedMonth || selectedOption?.value || "").split("-");
    const bsYear  = parseInt(bsYearStr,  10);
    const bsMonth = parseInt(bsMonthStr, 10);
    if (isNaN(bsYear) || isNaN(bsMonth)) return [];

    const totalDays = daysInBSMonth(bsYear, bsMonth);
    const firstAD   = new Date(bsToISO({ year: bsYear, month: bsMonth, day: 1 }) + "T00:00:00");
    let lead = firstAD.getDay() - 1;
    if (lead === -1) lead = 6;

    // Leading muted cells
    for (let i = lead; i > 0; i--) {
      const d = new Date(firstAD);
      d.setDate(d.getDate() - i);
      const prevBS = adToBS(d);
      days.push({ date: d, day: prevBS.day, muted: true });
    }

    // BS month days
    for (let bsDay = 1; bsDay <= totalDays; bsDay++) {
      const date  = new Date(bsToISO({ year: bsYear, month: bsMonth, day: bsDay }) + "T00:00:00");
      const entry = eventMap[fmt(date)];
      const off   = isWeeklyOff(date, bsDay, weeklyOffs ?? [], fallback);
      days.push({
        date,
        day: bsDay,
        type: entry?.type ?? (off ? "off" : undefined),
        label: entry?.label ?? (off ? "Weekly Off" : undefined),
        description: entry?.description,
      });
    }

    // Trailing muted cells
    const trail  = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
    const lastAD = new Date(bsToISO({ year: bsYear, month: bsMonth, day: totalDays }) + "T00:00:00");
    for (let d = 1; d <= trail; d++) {
      const date = new Date(lastAD);
      date.setDate(date.getDate() + d);
      const nextBS = adToBS(date);
      days.push({ date, day: nextBS.day, muted: true });
    }

    return days;
  }, [isBS, gridAdYear, gridAdMonth, selectedMonth, selectedOption, eventMap, weeklyOffs, fallback]);

  const todayFmt = fmt(new Date());

  // ── Stats ─────────────────────────────────────────────────────────────────
  const visible   = grid.filter((d) => !d.muted);
  const offDays   = visible.filter((d) => d.type === "off" || d.type === "holiday").length;
  const eventDays = visible.filter((d) => d.type === "event").length;
  const workDays  = visible.length - offDays;

  // ── Month Events (grouped) ────────────────────────────────────────────────
  const monthEvents = useMemo(() => {
    type Group = { label: string; type: EventType; startDate: Date; endDate: Date; description?: string };
    const groups: Group[] = [];
    for (const cell of grid) {
      if (cell.muted || !cell.type || cell.type === "off") continue;
      const last = groups[groups.length - 1];
      if (
        last &&
        last.label === cell.label &&
        last.type  === cell.type  &&
        cell.date.getTime() - last.endDate.getTime() <= 86_400_000
      ) {
        last.endDate = cell.date;
      } else {
        groups.push({
          label: cell.label ?? "",
          type: cell.type,
          startDate: cell.date,
          endDate: cell.date,
          description: cell.description,
        });
      }
    }
    return groups;
  }, [grid]);

  // ── Weekly Off Schedule Summary ───────────────────────────────────────────
  const weeklyOffSummary = useMemo(() => {
    if (!weeklyOffs || weeklyOffs.length === 0) {
      return fallback === "saturday_only"
        ? "Every Saturday"
        : fallback === "saturday_sunday"
        ? "Every Saturday & Sunday"
        : "Every Sunday";
    }
    const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const grouped: Record<number, string[]> = {};
    weeklyOffs.forEach((r) => {
      if (!grouped[r.day_of_week]) grouped[r.day_of_week] = [];
      grouped[r.day_of_week].push(r.week_pattern);
    });
    const parts: string[] = [];
    [0, 1, 2, 3, 4, 5, 6].forEach((dayNum) => {
      if (!grouped[dayNum]) return;
      const patterns = grouped[dayNum];
      if (patterns.includes("all")) {
        parts.push(`Every ${dayLabels[dayNum]}`);
      } else {
        parts.push(`${patterns.join(" & ")} ${dayLabels[dayNum]}`);
      }
    });
    return parts.length > 0 ? parts.join(", ") : "None";
  }, [weeklyOffs, fallback]);

  const goToMonth = (dir: -1 | 1) => {
    const next = monthOptions[selIdx + dir];
    if (next) setSelectedMonth(next.value);
  };


  return (
    <div className={s("page")} style={{ background: "transparent", minHeight: "auto" }}>
      <main className={s("content")} style={{ padding: "16px 20px 36px" }}>
        
        {/* ── Page Header ── */}
        <section className={s("head")} style={{ marginBottom: 20 }}>
          <div>
            <h1>Academic Calendar</h1>
            <p>{moLabel} — school schedule, holidays, and events.</p>
          </div>
        </section>

        {/* ── Top Stats Strip ── */}
        <section className={s("stats")}>
          <article className={s("green")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Working Days</span>
              <strong>{workDays}</strong>
              <small>{moLabel}</small>
            </div>
            <i className="fa-solid fa-calendar-check" />
          </article>
          
          <article className={s("red")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Holidays / Off</span>
              <strong>{offDays}</strong>
              <small>Weekly off + declared</small>
            </div>
            <i className="fa-solid fa-umbrella-beach" />
          </article>
          
          <article className={s("blue")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span>Events</span>
              <strong>{eventDays}</strong>
              <small>School activities</small>
            </div>
            <i className="fa-solid fa-bullhorn" />
          </article>
        </section>

        {/* ── Main Layout: Calendar Grid + Sidebar ── */}
        <section className={s("layout")}>
          
          {/* Calendar Card */}
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div>
                <h2>{moLabel}</h2>
                <div className={s("legendRow")}>
                  <span style={{ color: "#6a7882", fontSize: 11.5, fontWeight: 700 }}>
                    Calendar Key:
                  </span>
                  <span className={s("legendItem")}>
                    <span style={{ background: "#b42318" }} />
                    Off / Holiday
                  </span>
                  <span className={s("legendItem")}>
                    <span style={{ background: "#3b5bdb" }} />
                    School Event
                  </span>
                  <span className={s("legendItem")}>
                    <span style={{ background: "#7c3aed" }} />
                    Early Closing
                  </span>
                </div>
              </div>
              <div className={s("monthControls")}>
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  disabled={selIdx <= 0}
                  aria-label="Previous Month"
                  title="Previous Month"
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {monthOptions.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  disabled={selIdx === monthOptions.length - 1}
                  aria-label="Next Month"
                  title="Next Month"
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>

            {calLoading ? (
              <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
                <Loader fullScreen={false} size="md" text="Loading calendar…" />
              </div>
            ) : (
              <div className={s("calendarGrid")}>
                {WEEK_DAYS.map((d) => (
                  <div className={s("weekday")} key={d}>
                    {d}
                  </div>
                ))}
                {grid.map((item, i) => {
                  const isToday = !item.muted && fmt(item.date) === todayFmt;
                  return (
                    <div
                      key={`${fmt(item.date)}-${i}`}
                      onClick={() => !item.muted && setSelectedDay(item)}
                      style={{ cursor: item.muted ? "default" : "pointer" }}
                      className={cx(
                        s("day"),
                        item.muted && s("muted"),
                        item.type && s(item.type),
                        isToday && s("today")
                      )}
                    >
                      <span>{item.day}</span>
                      {item.label && !item.muted && <em>{item.label}</em>}
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className={s("sideStack")}>
            
            {/* Weekly Off Days Card */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2>Weekly Off Days</h2>
                  <p>Weekly schedule set for your school.</p>
                </div>
              </div>
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>Current Schedule</span>
                  <strong style={{ fontSize: 13, fontWeight: 800, color: "#ff9b51" }}>
                    {weeklyOffSummary}
                  </strong>
                </div>
              </div>
            </article>

            {/* Monthly Entries Card */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2>{moLabel} Entries</h2>
                  <p>Holidays and school activities.</p>
                </div>
              </div>
              <div className={s("eventList")}>
                {monthEvents.length ? (
                  monthEvents.map((group, i) => (
                    <div
                      className={s("eventItem")}
                      key={i}
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setSelectedDay({
                          date: group.startDate,
                          day: group.startDate.getDate(),
                          type: group.type,
                          label: group.label,
                          description: group.description,
                        });
                      }}
                      title="Click to view details"
                    >
                      <i className={s(group.type ?? "event")} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {group.label}
                        </strong>
                        <span style={{ fontSize: 11, color: "#6a7882" }}>
                          {formatDate(fmt(group.startDate))}
                          {fmt(group.startDate) !== fmt(group.endDate) ? ` – ${formatDate(fmt(group.endDate))}` : ""}
                        </span>
                      </div>
                    </div>
                  ))
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

        {/* ── Day Details Modal ── */}
        {selectedDay && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.45)",
              backdropFilter: "blur(3px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
            onClick={() => setSelectedDay(null)}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: 16,
                padding: "22px 24px",
                maxWidth: 440,
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                    {formatDate(fmt(selectedDay.date))}
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                    {selectedDay.date.toLocaleDateString("en-US", { weekday: "long" })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  style={{
                    border: "none",
                    background: "#f1f5f9",
                    color: "#64748b",
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Close"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background:
                    selectedDay.type === "holiday" || selectedDay.type === "off"
                      ? "#fee2e2"
                      : selectedDay.type === "early_closing"
                      ? "#f3e8ff"
                      : selectedDay.type === "event"
                      ? "#e0e7ff"
                      : "#ecfdf5",
                  color:
                    selectedDay.type === "holiday" || selectedDay.type === "off"
                      ? "#991b1b"
                      : selectedDay.type === "early_closing"
                      ? "#6b21a8"
                      : selectedDay.type === "event"
                      ? "#3730a3"
                      : "#065f46",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <i
                  className={
                    selectedDay.type === "holiday" || selectedDay.type === "off"
                      ? "fa-solid fa-umbrella-beach"
                      : selectedDay.type === "early_closing"
                      ? "fa-solid fa-clock"
                      : selectedDay.type === "event"
                      ? "fa-solid fa-bullhorn"
                      : "fa-solid fa-circle-check"
                  }
                />
                <span>
                  {selectedDay.type === "holiday" || selectedDay.type === "off"
                    ? "School Closed (Holiday / Off Day)"
                    : selectedDay.type === "early_closing"
                    ? "Early Closing Day"
                    : selectedDay.type === "event"
                    ? "Special School Event / Activity"
                    : "Regular School Working Day"}
                </span>
              </div>

              {selectedDay.label && (
                <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>
                    Event / Entry
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>
                    {selectedDay.label}
                  </div>
                  {selectedDay.description && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#475569", lineHeight: 1.45 }}>
                      {selectedDay.description}
                    </p>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(null)}
                  className={cx(s("btn"), s("btnPrimary"))}
                  style={{ minHeight: 34, padding: "6px 18px", fontSize: 13, cursor: "pointer" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
