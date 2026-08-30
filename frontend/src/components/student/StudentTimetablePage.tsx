"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { key: "sunday",    label: "Sunday",    abbr: "Sun", num: 0 },
  { key: "monday",    label: "Monday",    abbr: "Mon", num: 1 },
  { key: "tuesday",   label: "Tuesday",   abbr: "Tue", num: 2 },
  { key: "wednesday", label: "Wednesday", abbr: "Wed", num: 3 },
  { key: "thursday",  label: "Thursday",  abbr: "Thu", num: 4 },
  { key: "friday",    label: "Friday",    abbr: "Fri", num: 5 },
  { key: "saturday",  label: "Saturday",  abbr: "Sat", num: 6 },
];

const PALETTE = [
  { bg: "#fff7ed", fg: "#9A3412", accent: "#FF9B51", light: "#fed7aa" },
  { bg: "#ECFDF5", fg: "#065F46", accent: "#10B981", light: "#A7F3D0" },
  { bg: "#FFF7ED", fg: "#9A3412", accent: "#F97316", light: "#FED7AA" },
  { bg: "#FDF4FF", fg: "#6B21A8", accent: "#A855F7", light: "#E9D5FF" },
  { bg: "#F0F9FF", fg: "#0C4A6E", accent: "#0EA5E9", light: "#BAE6FD" },
  { bg: "#FFF1F2", fg: "#9F1239", accent: "#F43F5E", light: "#FECDD3" },
  { bg: "#FEFCE8", fg: "#713F12", accent: "#EAB308", light: "#FEF08A" },
  { bg: "#F0FDF4", fg: "#14532D", accent: "#22C55E", light: "#BBF7D0" },
];

const subjectPalette = (id?: number | null) =>
  id ? PALETTE[id % PALETTE.length] : { bg: "#F8FAFC", fg: "#475569", accent: "#94A3B8", light: "#CBD5E1" };

const fmtTime = (t?: string) => t?.slice(0, 5) ?? "—";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentTimetablePage() {
  const { data: scheduleData, loading } = useApi<any>("/timetable/student/my-schedule");
  const [activeDay, setActiveDay] = useState<string>("today");

  const todayKey = useMemo(() => {
    const d = new Date().getDay();
    return DAYS.find(day => day.num === d)?.key ?? "sunday";
  }, []);

  const scheduleByDay = useMemo(() => scheduleData?.schedule_by_day ?? {}, [scheduleData]);
  const section       = scheduleData?.section;
  const allSlots: any[] = useMemo(() => scheduleData?.slots ?? [], [scheduleData]);

  // Which days actually have data
  const activeDays = useMemo(() =>
    DAYS.filter(d => (scheduleByDay[d.key] ?? []).length > 0), [scheduleByDay]);

  // Today's slots
  const todaySlots: any[] = useMemo(() => scheduleByDay[todayKey] ?? [], [scheduleByDay, todayKey]);

  // Displayed day key
  const displayKey = activeDay === "today" ? todayKey : activeDay;
  const displaySlots: any[] = useMemo(() =>
    activeDay === "week"
      ? []
      : (scheduleByDay[displayKey] ?? []),
    [activeDay, displayKey, scheduleByDay]
  );

  // Build teaching period labels (skip breaks from count)
  const teachingLabel = (slots: any[], slot: any): number => {
    let count = 0;
    for (const s of slots) {
      if (!s.is_break) count++;
      if (s.id === slot.id) break;
    }
    return count;
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <Spinner size={36} color="#FF9B51" />
        <p style={{ margin: 0, fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>Loading your timetable…</p>
      </div>
    );
  }

  if (allSlots.length === 0) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center", padding: "0 20px" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 26, color: "#94A3B8" }} />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800, color: "#1E293B" }}>No Timetable Yet</h2>
        <p style={{ margin: 0, fontSize: 13.5, color: "#64748B", fontWeight: 500, lineHeight: 1.6 }}>
          Your section routine hasn't been published yet. Check back later or contact your class teacher.
        </p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="fa-solid fa-calendar-week" style={{ color: "#fff", fontSize: 16 }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.4px" }}>
                My Timetable
              </h1>
              {section && (
                <p style={{ margin: 0, fontSize: 12.5, color: "#64748B", fontWeight: 600 }}>
                  Section {section.name}{section.room_no ? ` · Room ${section.room_no}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Today's highlight banner ── */}
        <TodayBanner todayKey={todayKey} todaySlots={todaySlots} />

        {/* ── Day tabs ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
          {[
            { key: "today", label: "Today" },
            { key: "week",  label: "Full Week" },
            ...activeDays.map(d => ({ key: d.key, label: d.abbr })),
          ].map(tab => {
            const active = activeDay === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveDay(tab.key)}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  border: `1.5px solid ${active ? "#FF9B51" : "#E2E8F0"}`,
                  background: active ? "#FF9B51" : "#fff",
                  color: active ? "#fff" : "#475569",
                  cursor: "pointer", whiteSpace: "nowrap",
                  boxShadow: active ? "0 2px 8px rgba(255,155,81,0.3)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
                {tab.key === "today" && todaySlots.filter(s => !s.is_break).length > 0 && (
                  <span style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 99, background: active ? "rgba(255,255,255,0.25)" : "#fff7ed", color: active ? "#fff" : "#c2680a", fontSize: 10, fontWeight: 800 }}>
                    {todaySlots.filter(s => !s.is_break).length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        {activeDay === "week" ? (
          <WeekView scheduleByDay={scheduleByDay} todayKey={todayKey} />
        ) : (
          <DayView slots={displaySlots} dayLabel={activeDay === "today" ? "Today" : DAYS.find(d => d.key === displayKey)?.label ?? displayKey} isToday={displayKey === todayKey} />
        )}
      </div>
    </div>
  );
}

// ─── Today Banner ─────────────────────────────────────────────────────────────

function TodayBanner({ todayKey, todaySlots }: { todayKey: string; todaySlots: any[] }) {
  const teachPeriods = todaySlots.filter(s => !s.is_break);
  const nextSlot     = useMemo(() => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return todaySlots.find(s => {
      if (!s.start_time) return false;
      const [h, m] = s.start_time.split(":").map(Number);
      return h * 60 + m > nowMins;
    });
  }, [todaySlots]);

  return (
    <div style={{
      background: "#25343F",
      borderRadius: 14, padding: "20px 22px", marginBottom: 20,
      color: "#fff", boxShadow: "0 8px 24px rgba(37,52,63,0.25)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#fcd9af", marginBottom: 4 }}>
            <i className="fa-solid fa-sun" style={{ marginRight: 5 }} />
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" }}>
            {teachPeriods.length > 0 ? `${teachPeriods.length} Class${teachPeriods.length !== 1 ? "es" : ""} Today` : "No Classes Today"}
          </div>
        </div>
        {nextSlot && (
          <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "10px 14px", minWidth: 140 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: "#fed7aa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Up Next</div>
            <div style={{ fontSize: 13.5, fontWeight: 800 }}>{nextSlot.is_break ? (nextSlot.title || "Break") : nextSlot.subject_name}</div>
            <div style={{ fontSize: 11, color: "#fed7aa", marginTop: 2 }}>
              <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />
              {fmtTime(nextSlot.start_time)}
            </div>
          </div>
        )}
      </div>

      {/* Mini timeline */}
      {todaySlots.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", gap: 4, flexWrap: "wrap" }}>
          {todaySlots.map((s: any, i: number) => (
            <div
              key={s.id ?? i}
              style={{
                padding: "4px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: s.is_break ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.12)",
                border: `1px solid ${s.is_break ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.18)"}`,
                color: s.is_break ? "#FDE68A" : "#fff7ed",
                whiteSpace: "nowrap",
              }}
            >
              {s.is_break ? "☕" : ""} {s.is_break ? (s.title || "Break") : s.subject_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ slots, dayLabel, isToday }: { slots: any[]; dayLabel: string; isToday: boolean }) {
  if (slots.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "4rem 2rem", textAlign: "center" }}>
        <i className="fa-regular fa-calendar" style={{ fontSize: 28, color: "#CBD5E1", display: "block", marginBottom: 10 }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>No periods scheduled for {dayLabel}</p>
      </div>
    );
  }

  // Build teaching label counter
  let pCount = 0;
  const labelMap: Record<number | string, number> = {};
  for (const s of slots) {
    if (!s.is_break) { pCount++; labelMap[s.id] = pCount; }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Day header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>{dayLabel}</span>
        {isToday && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "#FF9B51", padding: "2px 7px", borderRadius: 99 }}>TODAY</span>}
        <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600, marginLeft: "auto" }}>
          {slots.filter(s => !s.is_break).length} periods · {slots.filter(s => s.is_break).length} break{slots.filter(s => s.is_break).length !== 1 ? "s" : ""}
        </span>
      </div>

      {slots.map((s: any, i: number) => {
        if (s.is_break) return <BreakRow key={s.id ?? i} slot={s} />;
        const pal = subjectPalette(s.subject_id);
        return <SubjectRow key={s.id ?? i} slot={s} palette={pal} pNum={labelMap[s.id]} />;
      })}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ scheduleByDay, todayKey }: { scheduleByDay: Record<string, any[]>; todayKey: string }) {
  const activeDays = DAYS.filter(d => (scheduleByDay[d.key] ?? []).length > 0);

  if (activeDays.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "4rem", textAlign: "center", color: "#94A3B8", fontSize: 13, fontWeight: 600 }}>
        No timetable data found.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
      {activeDays.map(day => {
        const slots  = scheduleByDay[day.key] ?? [];
        const isToday = day.key === todayKey;
        let pCount = 0;
        const labelMap: Record<number | string, number> = {};
        for (const s of slots) { if (!s.is_break) { pCount++; labelMap[s.id] = pCount; } }

        return (
          <div key={day.key} style={{
            background: "#fff",
            borderRadius: 12,
            border: `1.5px solid ${isToday ? "#FF9B51" : "#E2E8F0"}`,
            overflow: "hidden",
            boxShadow: isToday ? "0 4px 16px rgba(255,155,81,0.12)" : "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            {/* Day header */}
            <div style={{
              padding: "10px 14px",
              background: isToday ? "#fff7ed" : "#FAFAFA",
              borderBottom: `1px solid ${isToday ? "#fed7aa" : "#F1F5F9"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? "#9A3412" : "#1E293B" }}>{day.label}</span>
                {isToday && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: "#FF9B51", padding: "2px 6px", borderRadius: 99 }}>TODAY</span>}
              </div>
              <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>
                {slots.filter((s: any) => !s.is_break).length}P
              </span>
            </div>

            {/* Slots */}
            <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
              {slots.map((s: any, i: number) => {
                if (s.is_break) return <BreakRow key={s.id ?? i} slot={s} compact />;
                const pal = subjectPalette(s.subject_id);
                return <SubjectRow key={s.id ?? i} slot={s} palette={pal} pNum={labelMap[s.id]} compact />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Row Components ───────────────────────────────────────────────────────────

function SubjectRow({ slot, palette, pNum, compact = false }: {
  slot: any;
  palette: { bg: string; fg: string; accent: string; light: string };
  pNum: number;
  compact?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "stretch", borderRadius: compact ? 8 : 10,
      overflow: "hidden", border: `1px solid ${palette.light}`,
      background: palette.bg,
    }}>
      {/* Left accent strip */}
      <div style={{ width: 4, background: palette.accent, flexShrink: 0 }} />

      <div style={{ flex: 1, padding: compact ? "8px 10px" : "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 12.5 : 14, fontWeight: 800, color: palette.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {slot.subject_name || "Subject"}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginTop: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <i className="fa-solid fa-user" style={{ fontSize: 9.5, opacity: 0.6 }} />
            {slot.teacher_name || "Unassigned"}
            {slot.room_no && (
              <>
                <span style={{ opacity: 0.4 }}>·</span>
                <i className="fa-solid fa-door-open" style={{ fontSize: 9, opacity: 0.6 }} />
                {slot.room_no}
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: palette.accent, background: palette.light + "55", border: `1px solid ${palette.light}`, padding: "2px 6px", borderRadius: 5, marginBottom: 3 }}>
            P {pNum}
          </div>
          <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 600, whiteSpace: "nowrap" }}>
            {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
          </div>
        </div>
      </div>
    </div>
  );
}

function BreakRow({ slot, compact = false }: { slot: any; compact?: boolean }) {
  return (
    <div style={{
      borderRadius: compact ? 7 : 9, border: "1.5px dashed #FCD34D",
      background: "#FFFBEB", padding: compact ? "6px 10px" : "8px 14px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    }}>
      <span style={{ fontSize: compact ? 12 : 12.5, fontWeight: 700, color: "#92400E", display: "flex", alignItems: "center", gap: 5 }}>
        ☕ <span>{slot.title || "Break"}</span>
      </span>
      <span style={{ fontSize: 10.5, color: "#B45309", fontWeight: 700, whiteSpace: "nowrap" }}>
        {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
      </span>
    </div>
  );
}
