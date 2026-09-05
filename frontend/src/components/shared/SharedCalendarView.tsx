"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import styles from "@/components/admin/calendar/calendar.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { adToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";

const s = (name: string) => styles[name] || name;
const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

// ── Types ──────────────────────────────────────────────────────────────────
type EventType   = "off" | "holiday" | "event" | "exam" | "early_closing" | "working";
type WeekendType = "sunday_only" | "saturday_only" | "saturday_sunday";

type WeeklyOffRow = {
  id?: number;
  day_of_week:  number;
  week_pattern: string;
};

type CalendarDay = {
  date:   Date;
  day:    number;   // BS day number for BS schools, AD day number for AD schools
  muted?: boolean;
  type?:  EventType;
  label?: string;
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
  role: "teacher" | "student";
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SharedCalendarView({ role: _role }: Props) {
  const { formatDate, isBS } = useDateFormat();

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: calendarData, loading: calLoading } = useApi<any>(
    activeYear ? `/calendar?academic_year_id=${activeYear.id}` : null
  );

  const calendarId: number | null = calendarData?.id ?? null;
  const fallback: WeekendType     = calendarData?.weekend_type ?? (isBS ? "saturday_only" : "sunday_only");

  const { data: eventsRaw  } = useApi<any[]>(calendarId ? `/calendar/${calendarId}/events` : null);
  const { data: weeklyOffs } = useApi<WeeklyOffRow[]>(calendarId ? `/calendar/${calendarId}/weekly-offs` : null);

  // ── Month options ─────────────────────────────────────────────────────────
  const monthOptions = useMemo((): MonthOption[] => {
    if (!activeYear) return [];

    if (!isBS) {
      const start = new Date(activeYear.start_date);
      const end   = new Date(activeYear.end_date);
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

    const startBS = adToBS(new Date(activeYear.start_date));
    const endBS   = adToBS(new Date(activeYear.end_date));
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
    const map: Record<string, { type: EventType; label: string }> = {};
    (eventsRaw ?? []).filter((ev) => ev.event_type !== "exam").forEach((ev) => {
      const start = new Date(ev.event_date + "T00:00:00");
      const end   = ev.end_date ? new Date(ev.end_date + "T00:00:00") : new Date(ev.event_date + "T00:00:00");
      const d     = new Date(start);
      while (d <= end) {
        map[fmt(d)] = { type: ev.event_type as EventType, label: ev.title };
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
    type Group = { label: string; type: EventType; startDate: Date; endDate: Date };
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
        groups.push({ label: cell.label ?? "", type: cell.type, startDate: cell.date, endDate: cell.date });
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
    <div className={s("page")}>
      <main className={s("content")}>
        
        {/* ── Page Header ── */}
        <section className={s("head")}>
          <div>
            <h1>Academic Calendar</h1>
            <p>{moLabel} — school events, holidays, and schedule.</p>
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
                    Attendance counts only working days:
                  </span>
                  <span className={s("legendItem")}>
                    <span style={{ background: "#b42318" }} />
                    Off / Holiday
                  </span>
                  <span className={s("legendItem")}>
                    <span style={{ background: "#3b5bdb" }} />
                    Event
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
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>

            {calLoading ? (
              <div style={{ padding: "4rem", textAlign: "center" }}>
                <Spinner size={32} color="#ff9b51" />
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
                  <p>Set which days — and which weeks — are off for your school.</p>
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
                  <p>Holidays and events.</p>
                </div>
              </div>
              <div className={s("eventList")}>
                {monthEvents.length ? (
                  monthEvents.map((group, i) => (
                    <div className={s("eventItem")} key={i}>
                      <i className={s(group.type ?? "event")} />
                      <div style={{ flex: 1 }}>
                        <strong>{group.label}</strong>
                        <span>
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

      </main>
    </div>
  );
}
