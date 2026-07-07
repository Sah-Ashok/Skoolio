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
  day_of_week: number;   // 0 = Sunday ... 6 = Saturday
  week_pattern: string;  // 'all' | '1st' | '2nd' | '3rd' | '4th' | '5th'
};

const weekDays   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

// Which JS getDay() values are off for each legacy weekend_type setting —
// only used as a fallback when a calendar has no explicit weekly-off rows yet.
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

// Which occurrence-in-the-month a date's weekday is (1st Saturday, 2nd
// Saturday, etc.) — mirrors the same calculation done on the backend.
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

const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const weekPatternOptions = ["1st", "2nd", "3rd", "4th", "5th"];

type DayDraft = { off: boolean; weeks: string[] }; // weeks[0] === 'all' means every week
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
      if (!draft[r.day_of_week].weeks.includes(r.week_pattern)) {
        draft[r.day_of_week].weeks.push(r.week_pattern);
      }
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
  padding: "5px 11px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
  border: `1.5px solid ${active ? "#ff9b51" : "#d4dde2"}`,
  background: active ? "#ffe9d6" : "#fff",
  color: active ? "#c46a14" : "#6a7882",
});

// ── Weekly Off Settings card ───────────────────────────────────────────────
function WeekendSettingsCard({
  calendarId,
  rows,
  fallbackType,
  onSaved,
}: {
  calendarId:   number;
  rows:         WeeklyOffRow[];
  fallbackType: WeekendType;
  onSaved:      () => void;
}) {
  const dispatch = useAppDispatch();
  const { execute: saveWeeklyOffs, loading: saving } = useMutation("/calendar", "PATCH");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<WeeklyDraft>(() => rowsToDraft(rows));

  // Keep draft in sync with fresh data whenever it (re)loads and we're not mid-edit
  useEffect(() => {
    if (!editing) setDraft(rowsToDraft(rows));
  }, [rows, editing]);

  const toggleDayOff = (day: number) => {
    setDraft((prev) => ({
      ...prev,
      [day]: { ...prev[day], off: !prev[day].off, weeks: prev[day].off ? prev[day].weeks : ["all"] },
    }));
  };

  const setAllWeeks = (day: number) => {
    setDraft((prev) => ({ ...prev, [day]: { ...prev[day], weeks: ["all"] } }));
  };

  const toggleWeekPattern = (day: number, pattern: string) => {
    setDraft((prev) => {
      const current = prev[day].weeks[0] === "all" ? [] : prev[day].weeks;
      const next = current.includes(pattern)
        ? current.filter((w) => w !== pattern)
        : [...current, pattern];
      return { ...prev, [day]: { ...prev[day], weeks: next.length ? next : ["all"] } };
    });
  };

  const summaryLabel = useMemo(() => {
    const active = Object.entries(draft).filter(([, cfg]) => cfg.off);
    if (active.length === 0) return `${weekendFallbackLabel[fallbackType]} (default — not customised yet)`;
    return active
      .map(([day, cfg]) => {
        const label = dayLabels[Number(day)];
        return cfg.weeks[0] === "all" ? `Every ${label}` : `${cfg.weeks.join(" & ")} ${label}`;
      })
      .join(", ");
  }, [draft, fallbackType]);

  const handleSave = async () => {
    const offRows = draftToRows(draft);
    if (offRows.length === 0) {
      dispatch(showToast({ type: "error", title: "Error", message: "Select at least one weekly off day." }));
      return;
    }
    const result = await saveWeeklyOffs({ offs: offRows }, `/calendar/${calendarId}/weekly-offs`);
    if (result) {
      dispatch(showToast({ type: "success", title: "Weekly Off Updated", message: "Your weekly off schedule has been saved." }));
      onSaved();
      setEditing(false);
    } else {
      dispatch(showToast({ type: "error", title: "Error", message: "Failed to update weekly off days." }));
    }
  };

  return (
    <article className={s("card")}>
      <div className={s("cardHead")}>
        <div>
          <h2>Weekly Off Days</h2>
          <p>Set which days — and which weeks of the month — are off for your school.</p>
        </div>
        {!editing && (
          <button
            className={cx(s("btn"), s("btnOutline"))}
            style={{ minHeight: 32, padding: "6px 14px", fontSize: 12 }}
            onClick={() => setEditing(true)}
            disabled={!calendarId}
            title={!calendarId ? "Calendar is initialising…" : undefined}
          >
            <i className="fa-solid fa-pen" /> Change
          </button>
        )}
      </div>

      {!editing ? (
        /* ── Display mode ── */
        <div className={s("rules")}>
          <span style={{ border: 0, paddingBottom: 0, alignItems: "flex-start" }}>
            <b>Current Schedule</b>
            <strong style={{ color: "#ff9b51", textAlign: "right", maxWidth: 230 }}>{summaryLabel}</strong>
          </span>
        </div>
      ) : (
        /* ── Edit mode ── */
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, margin: 0 }}>
            Tick the days that are off. A ticked day is off every week by default — pick specific weeks
            (e.g. 2nd &amp; 4th Saturday) if it isn't off every week.
          </p>

          {Array.from({ length: 7 }, (_, day) => {
            const cfg = draft[day];
            return (
              <div
                key={day}
                style={{
                  padding: "10px 12px",
                  border: `2px solid ${cfg.off ? "#ff9b51" : "#d4dde2"}`,
                  borderRadius: 9,
                  background: cfg.off ? "#fff8f2" : "#fbfcfd",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={cfg.off}
                    onChange={() => toggleDayOff(day)}
                    style={{ accentColor: "#ff9b51", width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13.5, fontWeight: 900, color: "#1f2d36" }}>{dayLabels[day]}</span>
                </label>

                {cfg.off && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, marginLeft: 26 }}>
                    <button type="button" onClick={() => setAllWeeks(day)} style={chipStyle(cfg.weeks[0] === "all")}>
                      Every week
                    </button>
                    {weekPatternOptions.map((w) => (
                      <button key={w} type="button" onClick={() => toggleWeekPattern(day, w)} style={chipStyle(cfg.weeks.includes(w))}>
                        {w}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              className={cx(s("btn"), s("btnSoft"))}
              style={{ flex: 1 }}
              onClick={() => { setDraft(rowsToDraft(rows)); setEditing(false); }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className={cx(s("btn"), s("btnPrimary"))}
              style={{ flex: 1 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <Spinner size={15} />
                : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>
              }
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ── Delete event confirmation modal ──────────────────────────────────────────
function DeleteEventModal({
  event,
  onClose,
  onDeleted,
}: {
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
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:80, padding:"1rem" }}
      onClick={onClose}
    >
      <div
        style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:420, padding:"24px", boxShadow:"0 24px 64px rgba(15,23,42,0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width:44, height:44, borderRadius:12, background:"#fde7e7", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:14 }}>
          <i className="fa-solid fa-trash" style={{ color:"#b42318", fontSize:18 }} />
        </div>
        <h3 style={{ fontSize:16, fontWeight:900, margin:"0 0 6px" }}>Delete Event?</h3>
        <p style={{ fontSize:13, color:"#6a7882", margin:"0 0 20px" }}>
          <strong style={{ color:"#1f2d36" }}>"{event.title}"</strong> will be permanently removed. This cannot be undone.
        </p>
        <div style={{ display:"flex", gap:10 }}>
          <button className={cx(s("btn"), s("btnSoft"))} style={{ flex:1 }} onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            className={cx(s("btn"))}
            style={{ flex:1, background:"#b42318", color:"#fff" }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Spinner size={15} /> : <><i className="fa-solid fa-trash" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main CalendarPage ─────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { data: activeYear } = useApi<any>("/academic-years/active");

  // Fetch calendar — calendarData is used directly, no derived state needed
  const { data: calendarData, loading: calendarLoading } = useApi<any>(
    activeYear ? `/calendar?academic_year_id=${activeYear.id}` : ""
  );

  // weekendType is only used as a legacy fallback for calendars that haven't
  // configured explicit weekly-off rows yet
  const weekendType: WeekendType = calendarData?.weekend_type ?? "sunday_only";

  // Fetch events + weekly offs (only once we have a calendarId)
  const calendarId: number | null = calendarData?.id ?? null;
  const { data: eventsData, refetch: refetchEvents } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/events` : ""
  );
  const { data: weeklyOffsData, refetch: refetchWeeklyOffs } = useApi<WeeklyOffRow[]>(
    calendarId ? `/calendar/${calendarId}/weekly-offs` : ""
  );

  // Delete modal
  const [deletingEvent, setDeletingEvent] = useState<{ id: number; title: string } | null>(null);

  // Build date → event lookup
  const fixedEntries = useMemo(() => {
    const entries: Record<string, { type: EventType; label: string; scope: string; eventId: number }> = {};
    (eventsData ?? []).forEach((ev) => {
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

  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState("");

  const monthOptions = useMemo(() => {
    if (!activeYear) return [];
    const start = new Date(activeYear.start_date);
    const end   = new Date(activeYear.end_date);
    const opts  = [];
    const d     = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      opts.push({ value: val, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
      d.setMonth(d.getMonth() + 1);
    }
    return opts;
  }, [activeYear]);

  useEffect(() => {
    if (monthOptions.length > 0 && !selectedMonth) {
      const now     = new Date();
      const current = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
      const found   = monthOptions.find((o) => o.value === current);
      setSelectedMonth(found ? current : monthOptions[0].value);
    }
  }, [monthOptions, selectedMonth]);

  const selectedIndex = monthOptions.findIndex((o) => o.value === selectedMonth);
  const year          = selectedMonth ? Number(selectedMonth.split("-")[0]) : new Date().getFullYear();
  const monthIndex    = selectedMonth ? Number(selectedMonth.split("-")[1]) - 1 : new Date().getMonth();
  const monthLabel    = `${monthNames[monthIndex]} ${year}`;

  // Build calendar grid
  const buildCalendarDays = (yr: number, mo: number): CalendarDay[] => {
    const firstDate   = new Date(yr, mo, 1);
    const daysInMonth = new Date(yr, mo + 1, 0).getDate();
    let leadingDays   = firstDate.getDay() - 1; // Monday-first grid
    if (leadingDays === -1) leadingDays = 6;

    const days: CalendarDay[] = [];

    for (let i = leadingDays; i > 0; i--) {
      const date = new Date(yr, mo, 1 - i);
      days.push({ date, day: date.getDate(), muted: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date  = new Date(yr, mo, d);
      const entry = fixedEntries[fmt(date)];
      const isOff = isWeeklyOffDay(date, weeklyOffsData ?? [], weekendType);

      days.push({
        date,
        day:     d,
        type:    entry?.type ?? (isOff ? "off" : undefined),
        label:   entry?.label ?? (isOff ? "Weekly Off" : undefined),
        eventId: entry?.eventId,
      });
    }

    const trail = days.length % 7 === 0 ? 0 : 7 - (days.length % 7);
    for (let d = 1; d <= trail; d++) {
      const date = new Date(yr, mo + 1, d);
      days.push({ date, day: date.getDate(), muted: true });
    }

    return days;
  };

  const calendarDays = useMemo(
    () => buildCalendarDays(year, monthIndex),
    [year, monthIndex, fixedEntries, weekendType, weeklyOffsData]
  );

  // Stats
  const visibleDays  = calendarDays.filter((d) => !d.muted);
  const offCount     = visibleDays.filter((d) => d.type === "off").length;
  const holidayCount = visibleDays.filter((d) => d.type === "holiday").length;
  const eventCount   = visibleDays.filter((d) => d.type === "event").length;
  const examCount    = visibleDays.filter((d) => d.type === "exam").length;
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
          <article className={s("orange")}>
            <i className="fa-solid fa-pen-to-square" />
            <span>Exam Days</span>
            <strong>{examCount}</strong>
            <small>Exam schedule</small>
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
                  <span style={{ color:"#b42318" }}>■</span> Off &nbsp;
                  <span style={{ color:"#3b5bdb" }}>■</span> Event &nbsp;
                  <span style={{ color:"#c46a14" }}>■</span> Exam
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
              {weekDays.map((d) => (
                <div className={s("weekday")} key={d}>{d}</div>
              ))}
              {calendarDays.map((item, i) => (
                <div
                  className={cx(s("day"), item.muted && s("muted"), item.type && s(item.type))}
                  key={`${fmt(item.date)}-${i}`}
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
            {/*
              Weekly off settings — render immediately. calendarId may still be
              null while the calendar auto-creates on the backend, so we pass
              it as nullable and the card disables editing until it's available.
            */}
            {calendarLoading && !calendarData ? (
              <article className={s("card")}>
                <div className={s("cardHead")}>
                  <div><h2>Weekly Off Days</h2><p>Loading calendar settings…</p></div>
                </div>
                <div style={{ padding: 20, display:"flex", justifyContent:"center" }}>
                  <Spinner size={24} color="#ff9b51" />
                </div>
              </article>
            ) : (
              <WeekendSettingsCard
                calendarId={calendarData?.id ?? 0}
                rows={weeklyOffsData ?? []}
                fallbackType={weekendType}
                onSaved={refetchWeeklyOffs}
              />
            )}

            {/* Academic year */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div><h2>Academic Year</h2><p>Currently active year.</p></div>
              </div>
              <div className={s("rules")}>
                <span><b>Year</b><strong>{activeYear?.year_name ?? "—"}</strong></span>
                <span>
                  <b>From</b>
                  <strong>{activeYear?.start_date ? new Date(activeYear.start_date).toLocaleDateString() : "—"}</strong>
                </span>
                <span>
                  <b>To</b>
                  <strong>{activeYear?.end_date ? new Date(activeYear.end_date).toLocaleDateString() : "—"}</strong>
                </span>
              </div>
            </article>

            {/* Month entries */}
            <article className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2>{monthLabel} Entries</h2>
                  <p>Holidays, exams, and events.</p>
                </div>
              </div>
              <div className={s("eventList")}>
                {monthEntries.length ? (
                  monthEntries.map((item, i) => {
                    const entry = fixedEntries[fmt(item.date)];
                    return (
                      <div className={s("eventItem")} key={`${fmt(item.date)}-${i}`}>
                        <i className={s(item.type ?? "event")} />
                        <div style={{ flex: 1 }}>
                          <strong>{item.label}</strong>
                          <span>{String(item.day).padStart(2,"0")} {monthLabel} | {entry?.scope ?? "All classes"}</span>
                        </div>
                        {item.eventId && (
                          <button
                            onClick={() => setDeletingEvent({ id: item.eventId!, title: item.label! })}
                            style={{ background:"#fde7e7", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#b42318", fontSize:11, flexShrink:0 }}
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
