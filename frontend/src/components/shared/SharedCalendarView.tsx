"use client";

import { useMemo, useState, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";

// ── Types ──────────────────────────────────────────────────────────────────
type EventType = "off" | "holiday" | "event" | "exam" | "early_closing" | "working";
type WeekendType = "sunday_only" | "saturday_only" | "saturday_sunday";

type WeeklyOffRow = {
  id?: number;
  day_of_week: number;
  week_pattern: string;
};

type CalendarDay = {
  date:   Date;
  day:    number;
  muted?: boolean;
  type?:  EventType;
  label?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────
const WEEK_DAYS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January","February","March","April","May","June",
                     "July","August","September","October","November","December"];
const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const WEEKEND_DAYS: Record<WeekendType, number[]> = {
  sunday_only:     [0],
  saturday_only:   [6],
  saturday_sunday: [0, 6],
};

const EVENT_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  off:           { bg: "#fde7e7", color: "#b42318", dot: "#b42318" },
  holiday:       { bg: "#fde7e7", color: "#b42318", dot: "#b42318" },
  exam:          { bg: "#fff1df", color: "#c46a14", dot: "#c46a14" },
  event:         { bg: "#e8edff", color: "#3b5bdb", dot: "#3b5bdb" },
  early_closing: { bg: "#f3e8ff", color: "#7c3aed", dot: "#7c3aed" },
  working:       { bg: "#e2f6ee", color: "#12805c", dot: "#12805c" },
};

const EVENT_ICONS: Record<string, string> = {
  off:           "fa-moon",
  holiday:       "fa-umbrella-beach",
  exam:          "fa-pen-to-square",
  event:         "fa-bullhorn",
  early_closing: "fa-clock",
  working:       "fa-calendar-check",
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

const ordinals = ["1st","2nd","3rd","4th","5th"];
const nthWeekday = (d: Date) => ordinals[Math.ceil(d.getDate() / 7) - 1] ?? "5th";

const isWeeklyOff = (date: Date, offs: WeeklyOffRow[], fallback: WeekendType): boolean => {
  if (offs.length > 0) {
    const day = date.getDay();
    const nth = nthWeekday(date);
    return offs.some((w) => w.day_of_week === day && (w.week_pattern === "all" || w.week_pattern === nth));
  }
  return WEEKEND_DAYS[fallback].includes(date.getDay());
};

const buildGrid = (
  yr: number,
  mo: number,
  events: Record<string, { type: EventType; label: string }>,
  offs: WeeklyOffRow[],
  fallback: WeekendType
): CalendarDay[] => {
  const first      = new Date(yr, mo, 1);
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  let lead         = first.getDay() - 1;
  if (lead === -1) lead = 6;

  const days: CalendarDay[] = [];

  for (let i = lead; i > 0; i--) {
    const d = new Date(yr, mo, 1 - i);
    days.push({ date: d, day: d.getDate(), muted: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date  = new Date(yr, mo, d);
    const entry = events[fmt(date)];
    const off   = isWeeklyOff(date, offs, fallback);
    days.push({
      date,
      day:   d,
      type:  entry?.type ?? (off ? "off" : undefined),
      label: entry?.label ?? (off ? "Weekly Off" : undefined),
    });
  }

  const trail = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
  for (let d = 1; d <= trail; d++) {
    const date = new Date(yr, mo + 1, d);
    days.push({ date, day: date.getDate(), muted: true });
  }

  return days;
};

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  role: "teacher" | "student";
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SharedCalendarView({ role }: Props) {
  const { formatDate, formatMonth, isBS } = useDateFormat();
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: calendarData, loading: calLoading } = useApi<any>(
    activeYear ? `/calendar?academic_year_id=${activeYear.id}` : ""
  );

  const calendarId: number | null   = calendarData?.id ?? null;
  const fallback: WeekendType       = calendarData?.weekend_type ?? "sunday_only";

  const { data: eventsRaw  } = useApi<any[]>(calendarId ? `/calendar/${calendarId}/events`      : "");
  const { data: weeklyOffs } = useApi<WeeklyOffRow[]>(calendarId ? `/calendar/${calendarId}/weekly-offs` : "");

  // Month picker state
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = useMemo(() => {
    if (!activeYear) return [];
    const start = new Date(activeYear.start_date);
    const end   = new Date(activeYear.end_date);
    const opts: { value: string; label: string }[] = [];
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      opts.push({
        value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
        label: isBS
          ? formatMonth(d.getFullYear(), d.getMonth() + 1)
          : `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      });
      d.setMonth(d.getMonth() + 1);
    }
    return opts;
  }, [activeYear, isBS]);

  // Auto-select current month
  useEffect(() => {
    if (!monthOptions.length || selectedMonth) return;
    const now     = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const found   = monthOptions.find((o) => o.value === current);
    setSelectedMonth(found ? current : monthOptions[0].value);
  }, [monthOptions, selectedMonth]);

  const selIdx    = monthOptions.findIndex((o) => o.value === selectedMonth);
  const year      = selectedMonth ? Number(selectedMonth.split("-")[0]) : new Date().getFullYear();
  const moIdx     = selectedMonth ? Number(selectedMonth.split("-")[1]) - 1 : new Date().getMonth();
  const moLabel   = isBS ? formatMonth(year, moIdx + 1) : `${MONTH_NAMES[moIdx]} ${year}`;

  // Build date → event lookup
  const eventMap = useMemo(() => {
    const map: Record<string, { type: EventType; label: string }> = {};
    (eventsRaw ?? []).forEach((ev) => {
      const start = new Date(ev.event_date);
      const end   = ev.end_date ? new Date(ev.end_date) : new Date(ev.event_date);
      const d     = new Date(start);
      while (d <= end) {
        map[fmt(d)] = { type: ev.event_type as EventType, label: ev.title };
        d.setDate(d.getDate() + 1);
      }
    });
    return map;
  }, [eventsRaw]);

  const grid = useMemo(
    () => buildGrid(year, moIdx, eventMap, weeklyOffs ?? [], fallback),
    [year, moIdx, eventMap, weeklyOffs, fallback]
  );

  // Stats
  const visible    = grid.filter((d) => !d.muted);
  const offDays    = visible.filter((d) => d.type === "off" || d.type === "holiday").length;
  const examDays   = visible.filter((d) => d.type === "exam").length;
  const eventDays  = visible.filter((d) => d.type === "event").length;
  const workDays   = visible.length - offDays;

  // Month events for sidebar list
  const monthEvents = visible.filter((d) => d.type && d.type !== "off");

  const goMonth = (dir: -1 | 1) => {
    const next = monthOptions[selIdx + dir];
    if (next) setSelectedMonth(next.value);
  };

  const topbarTitle    = role === "teacher" ? "School Calendar" : "School Calendar";
  const topbarSubtitle = "View holidays, events, and exam days";

  return (
    <>
      <style>{`
        .cal-page-wrap {
          min-height: 100vh;
          background: #eef2f3;
        }
        .cal-main {
          padding: 24px 28px 48px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cal-stats-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .cal-content-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 20px;
          align-items: start;
        }
        
        .cal-day-cell {
          min-height: 56px;
          border-radius: 8px;
          padding: 6px 5px 5px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .cal-day-label {
          font-size: 9px;
          font-weight: 900;
          line-height: 1.3;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        /* ── Mobile Responsive ── */
        @media (max-width: 1024px) {
          .cal-content-grid {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .cal-main {
            padding: 16px;
          }
          .cal-stats-strip {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 480px) {
          .cal-day-cell {
            min-height: 48px;
            padding: 4px 2px;
          }
          .cal-day-label {
            font-size: 8px;
            -webkit-line-clamp: 1;
          }
        }
      `}</style>
      <div className="cal-page-wrap">
        <Topbar title={topbarTitle} subtitle={topbarSubtitle} />

        <main className="cal-main">
          {/* Page head */}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Academic Calendar</h1>
            <p style={{ color: "#6a7882", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              {activeYear?.year_name ?? "Loading…"} — school events, holidays, and exam schedule
            </p>
          </div>

          {/* Stats strip */}
          <div className="cal-stats-strip">
            {[
              { label: "Working Days",   value: workDays,  color: "#12805c", bg: "#e2f6ee", icon: "fa-calendar-check"   },
              { label: "Holidays / Off", value: offDays,   color: "#b42318", bg: "#fde7e7", icon: "fa-umbrella-beach"   },
              { label: "Events",         value: eventDays, color: "#3b5bdb", bg: "#e8edff", icon: "fa-bullhorn"         },
              { label: "Exam Days",      value: examDays,  color: "#c46a14", bg: "#fff1df", icon: "fa-pen-to-square"    },
            ].map((c) => (
              <div key={c.label} style={{ padding: "14px 16px", borderRadius: 12, background: c.bg, border: "1px solid rgba(191,201,209,0.4)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: c.color, fontSize: 16, boxShadow: "0 1px 4px rgba(0,0,0,.07)", flexShrink: 0 }}>
                  <i className={`fa-solid ${c.icon}`} />
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 900, color: "#6a7882", margin: 0 }}>{c.label}</p>
                  <strong style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</strong>
                </div>
              </div>
            ))}
          </div>

          <div className="cal-content-grid">
            {/* ── Calendar grid ── */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>

              {/* Grid header */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8eef0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>{moLabel}</h2>
                  <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
                    {[
                      { color: "#b42318", label: "Holiday/Off" },
                      { color: "#c46a14", label: "Exam"        },
                      { color: "#3b5bdb", label: "Event"       },
                      { color: "#7c3aed", label: "Early Close" },
                      { color: "#12805c", label: "Special"     },
                    ].map(({ color, label }) => (
                      <span key={label} style={{ fontSize: 11, fontWeight: 700, color: "#6a7882", display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Month navigation */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => goMonth(-1)}
                    disabled={selIdx <= 0}
                    style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6a7882" }}
                  >
                    <i className="fa-solid fa-chevron-left" style={{ fontSize: 12 }} />
                  </button>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{ minHeight: 34, padding: "0 10px", border: "1px solid #d4dde2", borderRadius: 8, fontSize: 13, fontWeight: 800, color: "#1f2d36", background: "#fff", fontFamily: "inherit", outline: "none" }}
                  >
                    {monthOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button
                    onClick={() => goMonth(1)}
                    disabled={selIdx >= monthOptions.length - 1}
                    style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#6a7882" }}
                  >
                    <i className="fa-solid fa-chevron-right" style={{ fontSize: 12 }} />
                  </button>
                </div>
              </div>

              {calLoading ? (
                <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#ff9b51" /></div>
              ) : (
                <div style={{ padding: "0 12px 16px" }}>
                  {/* Weekday labels */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, padding: "12px 0 8px" }}>
                    {WEEK_DAYS.map((d) => (
                      <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                    {grid.map((cell, i) => {
                      const isToday = !cell.muted && fmt(cell.date) === fmt(new Date());
                      const cs      = cell.type ? EVENT_COLORS[cell.type] : null;
                      return (
                        <div
                          key={`${fmt(cell.date)}-${i}`}
                          title={cell.label ?? undefined}
                          className="cal-day-cell"
                          style={{
                            background:   cell.muted ? "transparent" : (cs?.bg ?? "#f7fafb"),
                            border:       isToday ? "2px solid #ff9b51" : "1px solid transparent",
                            opacity:      cell.muted ? 0.25 : 1,
                          }}
                        >
                          {/* Day number */}
                          <span style={{
                            fontSize:   12,
                            fontWeight: isToday ? 900 : 700,
                            color:      isToday ? "#ff9b51" : (cs?.color ?? "#1f2d36"),
                            lineHeight: 1,
                          }}>
                            {cell.day}
                          </span>

                          {/* Event label */}
                          {cell.label && !cell.muted && (
                            <span 
                              className="cal-day-label"
                              style={{ color: cs?.color ?? "#6a7882" }}
                            >
                              {cell.label}
                            </span>
                          )}

                          {/* Color dot */}
                          {cs && !cell.muted && (
                            <span style={{
                              position:    "absolute",
                              bottom:      5,
                              right:       5,
                              width:       6,
                              height:      6,
                              borderRadius:"50%",
                              background:  cs.dot,
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Sidebar ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Academic year info */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.04)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8eef0" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 900, margin: 0 }}>Academic Year</h3>
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    ["Year",  activeYear?.year_name ?? "—"],
                    ["From",  activeYear?.start_date ? formatDate(activeYear.start_date.slice(0,10)) : "—"],
                    ["To",    activeYear?.end_date   ? formatDate(activeYear.end_date.slice(0,10))   : "—"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#6a7882", fontWeight: 700 }}>{label}</span>
                      <strong>{val}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Events this month */}
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.04)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid #e8eef0" }}>
                  <h3 style={{ fontSize: 14, fontWeight: 900, margin: 0 }}>{SHORT_MONTHS[moIdx]} Events</h3>
                  <p style={{ fontSize: 11, color: "#6a7882", fontWeight: 700, marginTop: 3 }}>Holidays, exams &amp; events</p>
                </div>
                <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
                  {monthEvents.length === 0 ? (
                    <div style={{ padding: "16px 0", textAlign: "center", color: "#94a3b8" }}>
                      <i className="fa-solid fa-calendar-check" style={{ fontSize: 24, display: "block", marginBottom: 8, opacity: 0.4 }} />
                      <p style={{ fontSize: 12, fontWeight: 700 }}>No special entries this month</p>
                    </div>
                  ) : (
                    monthEvents.map((cell, i) => {
                      const cs = cell.type ? EVENT_COLORS[cell.type] : null;
                      const ic = cell.type ? EVENT_ICONS[cell.type]  : "fa-circle";
                      return (
                        <div key={`${fmt(cell.date)}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", borderRadius: 8, background: cs?.bg ?? "#f8fafc", border: "1px solid rgba(191,201,209,0.4)" }}>
                          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: cs?.color ?? "#6a7882", fontSize: 12, flexShrink: 0, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
                            <i className={`fa-solid ${ic}`} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 900, margin: 0, color: "#1f2d36", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cell.label}
                            </p>
                            <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6a7882", margin: "2px 0 0" }}>
                              {String(cell.day).padStart(2,"0")} {SHORT_MONTHS[moIdx]} {year}
                              {" · "}
                              <span style={{ textTransform: "capitalize", color: cs?.color }}>{cell.type}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
