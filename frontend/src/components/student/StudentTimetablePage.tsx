"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";

// ─── Constants & Subject Palette ──────────────────────────────────────────────

const DAYS = [
  { key: "sunday",    label: "Sunday",    abbr: "Sun", num: 0 },
  { key: "monday",    label: "Monday",    abbr: "Mon", num: 1 },
  { key: "tuesday",   label: "Tuesday",   abbr: "Tue", num: 2 },
  { key: "wednesday", label: "Wednesday", abbr: "Wed", num: 3 },
  { key: "thursday",  label: "Thursday",  abbr: "Thu", num: 4 },
  { key: "friday",    label: "Friday",    abbr: "Fri", num: 5 },
  { key: "saturday",  label: "Saturday",  abbr: "Sat", num: 6 },
];

const SUBJECT_COLORS = [
  { accent: "#ff9148", bg: "#fff7ed", border: "#fed7aa", icon: "fa-book-open" },
  { accent: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", icon: "fa-calculator" },
  { accent: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: "fa-flask" },
  { accent: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe", icon: "fa-laptop-code" },
  { accent: "#e11d48", bg: "#fff1f2", border: "#fecdd3", icon: "fa-language" },
  { accent: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", icon: "fa-globe" },
  { accent: "#d97706", bg: "#fefce8", border: "#fef08a", icon: "fa-palette" },
  { accent: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe", icon: "fa-shapes" },
];

const getSubjectTheme = (id?: number | null, name?: string) => {
  const seed = id ?? (name ? name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) : 0);
  return SUBJECT_COLORS[Math.abs(seed) % SUBJECT_COLORS.length];
};

const fmtTime = (t?: string) => t?.slice(0, 5) ?? "—";

const formatMinutesDiff = (start?: string, end?: string) => {
  if (!start || !end) return null;
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff > 0 ? `${diff}m` : null;
};

// ─── Main Timetable Component ─────────────────────────────────────────────────

export default function StudentTimetablePage() {
  const { data: scheduleData, loading } = useApi<any>("/timetable/student/my-schedule");
  const [activeDay, setActiveDay] = useState<string>("today");

  const todayKey = useMemo(() => {
    const d = new Date().getDay();
    return DAYS.find(day => day.num === d)?.key ?? "sunday";
  }, []);

  const scheduleByDay   = useMemo(() => scheduleData?.schedule_by_day ?? {}, [scheduleData]);
  const section         = scheduleData?.section;
  const allSlots: any[] = useMemo(() => scheduleData?.slots ?? [], [scheduleData]);

  // Which days actually have scheduled slots
  const activeDays = useMemo(() =>
    DAYS.filter(d => (scheduleByDay[d.key] ?? []).length > 0), [scheduleByDay]);

  // Today's slots
  const todaySlots: any[] = useMemo(() => scheduleByDay[todayKey] ?? [], [scheduleByDay, todayKey]);

  // Displayed day key
  const displayKey = activeDay === "today" ? todayKey : activeDay;
  const displaySlots: any[] = useMemo(() =>
    activeDay === "week" ? [] : (scheduleByDay[displayKey] ?? []),
    [activeDay, displayKey, scheduleByDay]
  );

  // ─── Loading State ───
  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader fullScreen={false} size="md" text="Loading your timetable…" />
      </div>
    );
  }

  // ─── Empty State ───
  if (allSlots.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px 48px" }}>
          <section className="st-head">
            <div>
              <h1>My Timetable</h1>
              <p>View your class schedule and daily routine.</p>
            </div>
          </section>

          <div style={{ maxWidth: 440, margin: "60px auto", textAlign: "center", background: "#fff", padding: "36px 24px", borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#ff9148", fontSize: 24 }}>
              <i className="fa-solid fa-calendar-xmark" />
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>No Timetable Published</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", fontWeight: 600, lineHeight: 1.5 }}>
              Your section routine hasn&apos;t been published yet. Check back later or contact your class teacher.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .st-page { min-height: 100vh; background: #f8fafc; font-family: 'Nunito', 'Inter', sans-serif; }
        .st-content { padding: 20px 24px 48px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
        
        .st-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .st-head h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
        .st-head p  { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; }
        
        .st-meta-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .st-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 9px; background: #fff; border: 1px solid #e2e8f0; font-size: 12.5px; font-weight: 700; color: #475569; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .st-badge i { color: #ff9148; font-size: 12px; }

        /* Hero Banner */
        .st-hero { background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px 22px; box-shadow: 0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.02); display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
        .st-hero-left { display: flex; flex-direction: column; gap: 4px; }
        .st-hero-date { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; color: #ea580c; text-transform: uppercase; letter-spacing: 0.04em; }
        .st-hero-title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px; margin: 0; }
        .st-hero-sub { font-size: 12.5px; font-weight: 600; color: #64748b; margin: 0; }
        
        .st-hero-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .st-up-next { padding: 10px 16px; border-radius: 11px; background: #fff7ed; border: 1px solid #fed7aa; display: flex; align-items: center; gap: 12px; min-width: 180px; }
        .st-up-next-icon { width: 34px; height: 34px; border-radius: 9px; background: #ea580c; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .st-up-next-label { font-size: 10px; font-weight: 800; color: #c2410c; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
        .st-up-next-name  { font-size: 13.5px; font-weight: 800; color: #0f172a; margin: 1px 0 0; text-transform: capitalize; }
        .st-up-next-time  { font-size: 11px; font-weight: 700; color: #9a3412; margin: 1px 0 0; }

        /* Day Tabs */
        .st-tabs-wrapper { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; }
        .st-tab { padding: 8px 16px; border-radius: 9px; font-size: 13px; font-weight: 800; border: 1px solid #e2e8f0; background: #fff; color: #475569; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; gap: 7px; transition: all 0.15s ease; }
        .st-tab:hover { background: #f8fafc; color: #0f172a; border-color: #cbd5e1; }
        .st-tab-active { background: #0f172a !important; color: #fff !important; border-color: #0f172a !important; box-shadow: 0 2px 8px rgba(15,23,42,0.15); }
        .st-tab-badge { padding: 1px 6px; border-radius: 99px; font-size: 10.5px; font-weight: 800; }
        .st-tab-badge-active { background: #ff9148; color: #fff; }
        .st-tab-badge-inactive { background: #f1f5f9; color: #64748b; }

        /* Cards & Rows */
        .st-slot-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(15,23,42,0.03); display: flex; align-items: center; gap: 14px; padding: 12px 16px; transition: all 0.15s ease; position: relative; overflow: hidden; }
        .st-slot-card:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(15,23,42,0.06); transform: translateY(-1px); }
        .st-slot-strip { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        
        .st-slot-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .st-slot-info { flex: 1; min-width: 0; }
        .st-slot-name { font-size: 14.5px; font-weight: 800; color: #0f172a; text-transform: capitalize; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .st-slot-meta { display: flex; align-items: center; gap: 10px; font-size: 11.5px; font-weight: 600; color: #64748b; margin-top: 2px; flex-wrap: wrap; }
        .st-slot-meta-item { display: inline-flex; align-items: center; gap: 4px; }
        
        .st-slot-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
        .st-slot-period { font-size: 11px; font-weight: 800; color: #0f172a; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 6px; }
        .st-slot-time { font-size: 11.5px; font-weight: 700; color: #64748b; display: inline-flex; align-items: center; gap: 4px; }

        /* Break Row */
        .st-break-card { background: #fdfaf6; border-radius: 11px; border: 1px solid #fed7aa; padding: 9px 16px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .st-break-title { font-size: 12.5px; font-weight: 800; color: #9a3412; display: inline-flex; align-items: center; gap: 6px; }
        .st-break-time { font-size: 11.5px; font-weight: 700; color: #c2410c; display: inline-flex; align-items: center; gap: 5px; }

        @media (max-width: 768px) {
          .st-content { padding: 14px 12px 32px; gap: 14px; }
          .st-head { flex-direction: column; align-items: flex-start; gap: 8px; }
          .st-hero { padding: 16px; gap: 14px; }
          .st-up-next { width: 100%; }
          .st-slot-card { padding: 10px 12px; gap: 10px; }
          .st-slot-icon { width: 34px; height: 34px; font-size: 13px; }
        }
      `}</style>

      <div className="st-page">
        <main className="st-content">

          {/* ── Page Header ── */}
          <section className="st-head">
            <div>
              <h1>My Timetable</h1>
              <p>
                {section ? `Daily class schedule and routine for Section ${section.name}` : "View your weekly routine and class schedule."}
              </p>
            </div>
            {section && (
              <div className="st-meta-badges">
                <span className="st-badge">
                  <i className="fa-solid fa-users" /> Section {section.name}
                </span>
                {section.room_no && (
                  <span className="st-badge">
                    <i className="fa-solid fa-door-open" /> Room {section.room_no}
                  </span>
                )}
              </div>
            )}
          </section>

          {/* ── Hero Card ── */}
          <TodayHeroBanner todayKey={todayKey} todaySlots={todaySlots} />

          {/* ── Day Tabs ── */}
          <div className="st-tabs-wrapper">
            {[
              { key: "today", label: "Today" },
              { key: "week",  label: "Full Week" },
              ...activeDays.map(d => ({ key: d.key, label: d.abbr })),
            ].map(tab => {
              const active = activeDay === tab.key;
              const periodCount = tab.key === "today"
                ? todaySlots.filter(s => !s.is_break).length
                : 0;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveDay(tab.key)}
                  className={`st-tab ${active ? "st-tab-active" : ""}`}
                >
                  <span>{tab.label}</span>
                  {tab.key === "today" && periodCount > 0 && (
                    <span className={`st-tab-badge ${active ? "st-tab-badge-active" : "st-tab-badge-inactive"}`}>
                      {periodCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Content View ── */}
          {activeDay === "week" ? (
            <WeekView scheduleByDay={scheduleByDay} todayKey={todayKey} />
          ) : (
            <DayView
              slots={displaySlots}
              dayLabel={activeDay === "today" ? "Today" : (DAYS.find(d => d.key === displayKey)?.label ?? displayKey)}
              isToday={displayKey === todayKey}
            />
          )}

        </main>
      </div>
    </>
  );
}

// ─── Today Hero Banner ────────────────────────────────────────────────────────

function TodayHeroBanner({ todayKey, todaySlots }: { todayKey: string; todaySlots: any[] }) {
  const teachPeriods = todaySlots.filter(s => !s.is_break);
  const nextSlot = useMemo(() => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return todaySlots.find(s => {
      if (!s.start_time) return false;
      const [h, m] = s.start_time.split(":").map(Number);
      return h * 60 + m > nowMins;
    });
  }, [todaySlots]);

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="st-hero">
      <div className="st-hero-left">
        <div className="st-hero-date">
          <i className="fa-solid fa-calendar-day" />
          <span>{dateStr}</span>
        </div>
        <h2 className="st-hero-title">
          {teachPeriods.length > 0 ? `${teachPeriods.length} Classes Scheduled Today` : "No Classes Scheduled Today"}
        </h2>
        <p className="st-hero-sub">
          {teachPeriods.length > 0
            ? `${teachPeriods.length} teaching periods · ${todaySlots.filter(s => s.is_break).length} break intervals`
            : "Enjoy your day off or check the full week schedule."}
        </p>
      </div>

      {nextSlot && (
        <div className="st-hero-right">
          <div className="st-up-next">
            <div className="st-up-next-icon">
              <i className={nextSlot.is_break ? "fa-solid fa-mug-hot" : "fa-solid fa-bell"} />
            </div>
            <div>
              <p className="st-up-next-label">Up Next</p>
              <p className="st-up-next-name">
                {nextSlot.is_break ? (nextSlot.title || "Break") : nextSlot.subject_name}
              </p>
              <p className="st-up-next-time">
                <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />
                {fmtTime(nextSlot.start_time)}
                {nextSlot.room_no && ` · Room ${nextSlot.room_no}`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Day View Component ───────────────────────────────────────────────────────

function DayView({ slots, dayLabel, isToday }: { slots: any[]; dayLabel: string; isToday: boolean }) {
  if (slots.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "3.5rem 1.5rem", textAlign: "center", boxShadow: "0 1px 3px rgba(15,23,42,0.03)" }}>
        <div style={{ width: 50, height: 50, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#94a3b8", fontSize: 20 }}>
          <i className="fa-regular fa-calendar" />
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: "#0f172a" }}>No Classes on {dayLabel}</h3>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>There are no periods scheduled for this day.</p>
      </div>
    );
  }

  // Calculate teaching period number (skipping breaks)
  let pCount = 0;
  const labelMap: Record<number | string, number> = {};
  for (const s of slots) {
    if (!s.is_break) {
      pCount++;
      labelMap[s.id] = pCount;
    }
  }

  const teachingCount = slots.filter(s => !s.is_break).length;
  const breakCount    = slots.filter(s => s.is_break).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Section Subhead */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{dayLabel} Routine</span>
          {isToday && (
            <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#ff9148", padding: "2px 7px", borderRadius: 6 }}>
              TODAY
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
          {teachingCount} period{teachingCount !== 1 ? "s" : ""}{breakCount > 0 ? ` · ${breakCount} break${breakCount !== 1 ? "s" : ""}` : ""}
        </span>
      </div>

      {/* Slots List */}
      {slots.map((s: any, i: number) => {
        if (s.is_break) return <BreakCard key={s.id ?? i} slot={s} />;
        const theme = getSubjectTheme(s.subject_id, s.subject_name);
        return <SubjectCard key={s.id ?? i} slot={s} theme={theme} pNum={labelMap[s.id]} />;
      })}
    </div>
  );
}

// ─── Week View Component ──────────────────────────────────────────────────────

function WeekView({ scheduleByDay, todayKey }: { scheduleByDay: Record<string, any[]>; todayKey: string }) {
  const activeDays = DAYS.filter(d => (scheduleByDay[d.key] ?? []).length > 0);

  if (activeDays.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "3rem", textAlign: "center", color: "#64748b", fontSize: 13, fontWeight: 600 }}>
        No weekly timetable records found.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
      {activeDays.map(day => {
        const slots   = scheduleByDay[day.key] ?? [];
        const isToday = day.key === todayKey;

        let pCount = 0;
        const labelMap: Record<number | string, number> = {};
        for (const s of slots) {
          if (!s.is_break) {
            pCount++;
            labelMap[s.id] = pCount;
          }
        }

        return (
          <div
            key={day.key}
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1.5px solid ${isToday ? "#ff9148" : "#e2e8f0"}`,
              overflow: "hidden",
              boxShadow: isToday ? "0 4px 16px rgba(255,145,72,0.12)" : "0 1px 3px rgba(15,23,42,0.03)",
            }}
          >
            {/* Day Card Head */}
            <div style={{
              padding: "12px 16px",
              background: isToday ? "#fff7ed" : "#f8fafc",
              borderBottom: `1px solid ${isToday ? "#fed7aa" : "#e2e8f0"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: isToday ? "#9a3412" : "#0f172a" }}>
                  {day.label}
                </span>
                {isToday && (
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: "#ff9148", padding: "1px 6px", borderRadius: 5 }}>
                    TODAY
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>
                {slots.filter((s: any) => !s.is_break).length} Periods
              </span>
            </div>

            {/* Day Card Slots */}
            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {slots.map((s: any, i: number) => {
                if (s.is_break) return <BreakCard key={s.id ?? i} slot={s} compact />;
                const theme = getSubjectTheme(s.subject_id, s.subject_name);
                return <SubjectCard key={s.id ?? i} slot={s} theme={theme} pNum={labelMap[s.id]} compact />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Row Card Components ──────────────────────────────────────────────────────

function SubjectCard({ slot, theme, pNum, compact = false }: {
  slot: any;
  theme: { accent: string; bg: string; border: string; icon: string };
  pNum: number;
  compact?: boolean;
}) {
  return (
    <div className="st-slot-card" style={{ padding: compact ? "10px 12px" : "12px 16px" }}>
      {/* Accent left indicator bar */}
      <div className="st-slot-strip" style={{ background: theme.accent }} />

      {/* Subject Icon Box */}
      <div
        className="st-slot-icon"
        style={{
          background: theme.bg,
          color: theme.accent,
          border: `1px solid ${theme.border}`,
          width: compact ? 34 : 40,
          height: compact ? 34 : 40,
        }}
      >
        <i className={`fa-solid ${theme.icon}`} style={{ fontSize: compact ? 12.5 : 15 }} />
      </div>

      {/* Center Info */}
      <div className="st-slot-info">
        <p className="st-slot-name" style={{ fontSize: compact ? 13.5 : 15 }}>
          {slot.subject_name || "Subject"}
        </p>
        <div className="st-slot-meta" style={{ fontSize: compact ? 11 : 12 }}>
          <span className="st-slot-meta-item">
            <i className="fa-solid fa-user-tie" style={{ opacity: 0.7, color: theme.accent }} />
            {slot.teacher_name === "TBA" || !slot.teacher_name ? "Teacher: TBA" : slot.teacher_name}
          </span>
          {slot.room_no && (
            <span className="st-slot-meta-item">
              <i className="fa-solid fa-door-open" style={{ opacity: 0.7, color: "#64748b" }} />
              Room {slot.room_no}
            </span>
          )}
        </div>
      </div>

      {/* Right Period & Time */}
      <div className="st-slot-right">
        <span className="st-slot-period">
          Period {pNum}
        </span>
        <span className="st-slot-time">
          <i className="fa-regular fa-clock" style={{ fontSize: 10.5, opacity: 0.7 }} />
          {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
        </span>
      </div>
    </div>
  );
}

function BreakCard({ slot, compact = false }: { slot: any; compact?: boolean }) {
  const duration = formatMinutesDiff(slot.start_time, slot.end_time);

  return (
    <div className="st-break-card" style={{ padding: compact ? "6px 10px" : "8px 14px" }}>
      <span className="st-break-title" style={{ fontSize: compact ? 11.5 : 12.5 }}>
        <i className="fa-solid fa-mug-hot" style={{ color: "#ea580c" }} />
        <span>{slot.title || "Break"}</span>
        {duration && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#b45309", background: "#fef3c7", padding: "1px 6px", borderRadius: 4, marginLeft: 4 }}>
            {duration}
          </span>
        )}
      </span>
      <span className="st-break-time" style={{ fontSize: compact ? 11 : 11.5 }}>
        <i className="fa-regular fa-clock" style={{ fontSize: 10.5, opacity: 0.7 }} />
        {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
      </span>
    </div>
  );
}
