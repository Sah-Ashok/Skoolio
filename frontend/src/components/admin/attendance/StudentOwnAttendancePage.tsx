"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const FONT = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');`;

const C = {
  brand:      "#ff9b51",
  brandLight: "#fff7ed",
  brandDark:  "#c2410c",
  dark:       "#1f2d36",
  mid:        "#6a7882",
  light:      "#eef2f3",
  white:      "#ffffff",
  border:     "#dce5e9",
  green:      "#059669",
  greenBg:    "#ecfdf5",
  red:        "#dc2626",
  redBg:      "#fef2f2",
  amber:      "#d97706",
  amberBg:    "#fffbeb",
  blue:       "#3b82f6",
  blueBg:     "#eff6ff",
};

const WEEKLY_OFF_STRIPE = "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(148,163,184,0.2) 4px, rgba(148,163,184,0.2) 5px)";

const STATUS: Record<string, { label: string; color: string; bg: string; border: string; short: string }> = {
  present:    { label: "Present",    color: C.green,   bg: C.greenBg, border: "#bbf7d0", short: "P"  },
  absent:     { label: "Absent",     color: C.red,     bg: C.redBg,   border: "#fecaca", short: "A"  },
  late:       { label: "Late",       color: C.amber,   bg: C.amberBg, border: "#fde68a", short: "L"  },
  leave:      { label: "Leave",      color: C.mid,     bg: C.light,   border: C.border,  short: "Lv" },
  remaining:  { label: "Remaining",  color: C.blue,    bg: C.blueBg,  border: "#bfdbfe", short: "R"  },
  weekly_off: { label: "Weekly Off", color: "#94a3b8", bg: "#f1f5f9", border: "#cbd5e1", short: "–"  },
  holiday:    { label: "Holiday",    color: C.red,     bg: "#fff0f0", border: "#fca5a5", short: "H"  },
  off:        { label: "—",          color: "#b0bec5", bg: "#f8fafc", border: "#e9ecef", short: "–"  },
};

const MONTHS     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS       = ["M","T","W","T","F","S","S"];
type WeekPattern = "all" | "1st" | "2nd" | "3rd" | "4th" | "5th";

function grade(pct: number) {
  if (pct >= 90) return { label: "Excellent", color: C.green,  bg: C.greenBg   };
  if (pct >= 75) return { label: "Good",      color: C.brand,  bg: C.brandLight };
  if (pct >= 60) return { label: "Average",   color: C.amber,  bg: C.amberBg   };
  return               { label: "Low",        color: C.red,    bg: C.redBg     };
}

function nthWeekdayOfMonth(date: Date): WeekPattern {
  const ordinals: WeekPattern[] = ["1st","2nd","3rd","4th","5th"];
  return ordinals[Math.ceil(date.getDate() / 7) - 1] ?? "5th";
}

function isWeeklyOffDay(
  date: Date,
  weeklyOffs: { day_of_week: number; week_pattern: WeekPattern }[],
  weekendType: string
): boolean {
  const day = date.getDay();
  if (weeklyOffs.length > 0) {
    const nth = nthWeekdayOfMonth(date);
    return weeklyOffs.some(w => w.day_of_week === day && (w.week_pattern === "all" || w.week_pattern === nth));
  }
  if (weekendType === "sunday_only")   return day === 0;
  if (weekendType === "saturday_only") return day === 6;
  return day === 0 || day === 6;
}

// Donut uses present+absent+late as the effective total (not working days).
// This way: if teacher has marked 6P+1A → pct = 6/7 = 86%, chart shows real arc.
// If nothing is marked yet → effective=0 → shows "100%" with full blue ring.
function DonutChart({ pct, present, absent, effective, yearName }: {
  pct: number; present: number; absent: number; effective: number; yearName: string;
}) {
  const r       = 52;
  const circ    = 2 * Math.PI * r;
  const presArc = (pct / 100) * circ;
  const absArc  = circ - presArc;
  const hasData = effective > 0;

  const displayPct = hasData ? pct : 100;
  const displayArc = hasData ? presArc : circ;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <div style={{ flexShrink: 0, position: "relative" }}>
        <svg viewBox="0 0 140 140" width={110} height={110} style={{ transform: "rotate(-90deg)" }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          {/* Absent arc (red) — only if there's data */}
          {hasData && absArc > 0 && (
            <circle cx="70" cy="70" r={r} fill="none" stroke="#ff9a9e" strokeWidth="18"
              strokeDasharray={`${absArc} ${presArc}`}
              strokeDashoffset={-presArc} strokeLinecap="round" />
          )}
          {/* Present arc (blue) */}
          <circle cx="70" cy="70" r={r} fill="none"
            stroke={hasData ? "#4b8ff7" : "#e2e8f0"}
            strokeWidth="18"
            strokeDasharray={`${displayArc} ${circ - displayArc}`}
            strokeDashoffset={0} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ fontSize: 20, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{displayPct}%</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: C.mid, marginTop: 2 }}>
            {hasData ? "present" : "so far"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[
          { color: "#4b8ff7", label: "Present", value: `${present} days` },
          { color: "#ff9a9e", label: "Absent",  value: `${absent} days`  },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: item.color, flexShrink: 0, marginTop: 3 }} />
            <div>
              <div style={{ fontSize: 11, color: C.mid, fontWeight: 600 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginTop: 1 }}>{item.value}</div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: C.mid, fontWeight: 500 }}>
          {hasData ? `Out of ${effective} marked days` : "No attendance marked yet"}
        </div>
      </div>
    </div>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 14,
      border: `1px solid ${C.border}`,
      boxShadow: "0 1px 8px rgba(31,45,54,.06)",
      overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.dark }}>{title}</p>
      {sub && <p style={{ margin: "3px 0 0", fontSize: 12, color: C.mid, fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

export default function StudentOwnAttendancePage() {
  const now   = new Date();
  // Build todayStr in local browser time and memoize it so it's stable
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // computed once on mount — date won't change mid-session

  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: me }         = useApi<any>("/auth/me");
  const { data: activeYear, loading: yearLoading } = useApi<any>("/academic-years/active");

  const { data: summary, loading: summaryLoading } = useApi<any>(
    activeYear?.id ? `/attendance/me/summary?academic_year_id=${activeYear.id}` : null,
    [activeYear?.id]
  );

  const { data: monthly, loading: monthlyLoading } = useApi<any[]>(
    `/attendance/me/monthly?year=${year}&month=${month}`,
    [year, month]
  );

  const { data: calendarData } = useApi<any>(
    activeYear?.id ? `/calendar?academic_year_id=${activeYear.id}` : null,
    [activeYear?.id]
  );

  const calendarId  = calendarData?.id ?? null;
  const weekendType = calendarData?.weekend_type ?? "sunday_only";

  const { data: weeklyOffsRaw } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/weekly-offs` : null,
    [calendarId]
  );

  const { data: eventsRaw } = useApi<any[]>(
    calendarId ? `/calendar/${calendarId}/events` : null,
    [calendarId]
  );

  const weeklyOffs: { day_of_week: number; week_pattern: WeekPattern }[] = useMemo(
    () => (weeklyOffsRaw ?? []).map(w => ({ day_of_week: w.day_of_week, week_pattern: w.week_pattern as WeekPattern })),
    [weeklyOffsRaw]
  );

  const holidayTitles = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    (eventsRaw ?? [])
      .filter(e => e.affects_attendance === true || e.affects_attendance === "true")
      .forEach(e => {
        const start = new Date(e.event_date + "T00:00:00");
        const end   = e.end_date ? new Date(e.end_date + "T00:00:00") : new Date(start);
        const cur   = new Date(start);
        while (cur <= end) {
          const ds = cur.toISOString().split("T")[0];
          if (!map.has(ds)) map.set(ds, e.title);
          cur.setDate(cur.getDate() + 1);
        }
      });
    return map;
  }, [eventsRaw]);

  const attPct    = Number(summary?.attendance_percentage ?? 100);
  const present   = Number(summary?.total_present         ?? 0);
  const absent    = Number(summary?.total_absent          ?? 0);
  const late      = Number(summary?.total_late            ?? 0);
  const leave     = Number(summary?.total_leave           ?? 0);
  const remaining = Number(summary?.total_remaining       ?? 0);
  const wDays     = Number(summary?.total_working_days    ?? 0);

  // Effective = days that actually affect percentage (present+late+absent)
  const effective = present + late + absent;
  const g = grade(attPct);

  const recordsByDay = useMemo(() => {
    const m = new Map<number, string>();
    (monthly ?? []).forEach(r => m.set(new Date(r.date + "T00:00:00").getDate(), r.status));
    return m;
  }, [monthly]);

  const monthPresent = (monthly ?? []).filter(r => r.status === "present").length;
  const monthAbsent  = (monthly ?? []).filter(r => r.status === "absent").length;
  const monthLate    = (monthly ?? []).filter(r => r.status === "late").length;
  const monthTotal   = (monthly ?? []).length;
  const monthEffective = monthPresent + monthAbsent + monthLate;
  const monthPct     = monthEffective > 0 ? Math.round(((monthPresent + monthLate) / monthEffective) * 100) : 100;

  type Cell = {
    day: number | null;
    status?: string;
    isWeeklyOff?: boolean;
    isHoliday?: boolean;
    holidayName?: string;
    isRemaining?: boolean; // past working day with no attendance record
  };

  const cells = useMemo<Cell[]>(() => {
    const daysInMonth   = new Date(year, month, 0).getDate();
    const firstDow      = new Date(year, month - 1, 1).getDay();
    const leadingBlanks = (firstDow + 6) % 7;
    const result: Cell[] = Array(leadingBlanks).fill({ day: null });

    // Admission date: use start of year as fallback if not available
    const admDateStr = me?.admission_date
      ? String(me.admission_date).slice(0, 10)
      : (activeYear ? String(activeYear.start_date).slice(0, 10) : null);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const wOff    = isWeeklyOffDay(dateObj, weeklyOffs, weekendType);
      const hName   = !wOff ? holidayTitles.get(dateStr) : undefined;
      const hasRec  = recordsByDay.has(d);
      const isPast  = dateStr < todayStr; // strictly before today
      const afterAdm = admDateStr ? dateStr >= admDateStr : true;

      // Remaining: past working day, after admission, no attendance record
      const isRemaining = isPast && afterAdm && !wOff && !hName && !hasRec;

      result.push({
        day:         d,
        status:      recordsByDay.get(d),
        isWeeklyOff: wOff,
        isHoliday:   !!hName,
        holidayName: hName,
        isRemaining,
      });
    }

    while (result.length % 7 !== 0) result.push({ day: null });
    return result;
  }, [year, month, weeklyOffs, weekendType, holidayTitles, recordsByDay, todayStr, me, activeYear]);

  const todayDay    = now.getMonth() + 1 === month ? now.getDate() : null;
  const todayCell   = todayDay ? cells.find(c => c.day === todayDay) : null;
  const todayStatus = todayCell
    ? (todayCell.isWeeklyOff ? "weekly_off" : todayCell.isHoliday ? "holiday" : (todayCell.status ?? null))
    : null;

  const monthOptions = useMemo(() => {
    if (!activeYear) return [];
    const opts: { label: string; value: string }[] = [];
    const d = new Date(String(activeYear.start_date).slice(0, 10) + "T00:00:00");
    d.setDate(1);
    const cap = new Date(Math.min(now.getTime(), new Date(String(activeYear.end_date).slice(0, 10) + "T00:00:00").getTime()));
    while (d <= cap) {
      opts.push({ value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
      d.setMonth(d.getMonth() + 1);
    }
    return opts.reverse();
  }, [activeYear]);

  function getCellCfg(cell: Cell) {
    if (cell.isWeeklyOff)  return STATUS.weekly_off;
    if (cell.isHoliday)    return STATUS.holiday;
    if (cell.status)       return STATUS[cell.status] ?? STATUS.off;
    if (cell.isRemaining)  return STATUS.remaining;
    return STATUS.off;
  }

  const initials = me?.full_name
    ? me.full_name.split(" ").map((p: string) => p[0]).join("").substring(0, 2).toUpperCase()
    : "S";

  return (
    <>
      <style>{FONT}</style>
      <style>{`
        .att-root * { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif !important; box-sizing: border-box; }
        .att-root { min-height: 100vh; background: ${C.light}; }
        .att-main { padding: 16px; max-width: 960px; margin: 0 auto; }
        @media (min-width: 640px) { .att-main { padding: 24px 28px 48px; } }
        .att-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        @media (min-width: 540px) { .att-stats { grid-template-columns: repeat(6, 1fr); } }
        .att-body { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 780px) { .att-body { grid-template-columns: 1fr 260px; align-items: start; } }
        .att-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 12px; }
        @media (min-width: 420px) { .att-cal { gap: 6px; padding: 14px; } }
        .att-day {
          aspect-ratio: 1; border-radius: 8px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; border: 1.5px solid transparent;
          transition: transform 0.1s; cursor: default; min-height: 36px; position: relative;
        }
        @media (min-width: 420px) { .att-day { font-size: 13px; min-height: 44px; } }
        .att-day:active { transform: scale(0.94); }
        .att-day[data-holiday]:hover::after {
          content: attr(data-holiday);
          position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
          background: #1f2d36; color: #fff; font-size: 10px; font-weight: 700;
          white-space: nowrap; padding: 4px 8px; border-radius: 6px; z-index: 10; pointer-events: none;
        }
        .att-day.weekly-off {
          background-color: #f1f5f9;
          background-image: ${WEEKLY_OFF_STRIPE};
        }
        .att-side { display: flex; flex-direction: column; gap: 14px; }
        .att-today-status { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; }
        .att-bar { height: 8px; border-radius: 999px; background: #e9ecef; overflow: hidden; }
        .att-bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
        .att-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px 18px; }
        .att-legend-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; }
        .att-legend-item.weekly-off { background-image: ${WEEKLY_OFF_STRIPE}; }
      `}</style>

      <div className="att-root">
        <Topbar title="My Attendance" subtitle="Academic year attendance record" />

        <div className="att-main">
          {(yearLoading || summaryLoading) ? (
            <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color={C.brand} /></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Hero summary bar */}
              <Card>
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                      backgroundColor: C.dark, color: C.brand,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, fontWeight: 900,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.mid, textTransform: "uppercase", letterSpacing: 0.5 }}>My Attendance</p>
                      <h1 style={{ margin: "2px 0 3px", fontSize: 17, fontWeight: 900, color: C.dark }}>{me?.full_name ?? "Student"}</h1>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {me?.admission_number && <span style={{ fontSize: 11, fontWeight: 700, color: C.mid }}>{me.admission_number}</span>}
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, backgroundColor: g.bg, color: g.color }}>
                          {g.label} · {attPct}%
                        </span>
                      </div>
                    </div>
                    <div style={{
                      width: 58, height: 58, borderRadius: "50%", flexShrink: 0,
                      background: `conic-gradient(${effective > 0 ? (attPct >= 75 ? C.green : attPct >= 60 ? C.amber : C.red) : C.border} ${attPct * 3.6}deg, ${C.border} ${attPct * 3.6}deg)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{ width: 42, height: 42, borderRadius: "50%", backgroundColor: C.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <strong style={{ fontSize: 12, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{attPct}%</strong>
                        <span style={{ fontSize: 8, fontWeight: 700, color: C.mid }}>year</span>
                      </div>
                    </div>
                  </div>

                  <div className="att-bar" style={{ marginBottom: 6 }}>
                    <div className="att-bar-fill" style={{
                      width: `${attPct}%`,
                      backgroundColor: attPct >= 75 ? C.green : attPct >= 60 ? C.amber : C.red,
                    }} />
                    <div style={{ position: "relative", height: 0 }}>
                      <div style={{ position: "absolute", left: "75%", bottom: 10, width: 1, height: 14, backgroundColor: C.red, opacity: 0.5 }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>0%</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.red }}>Min: 75%</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>100%</span>
                  </div>

                  <div className="att-stats">
                    {[
                      { label: "Working Days", val: wDays,     color: C.dark  },
                      { label: "Present",      val: present,   color: C.green  },
                      { label: "Absent",       val: absent,    color: C.red   },
                      { label: "Late",         val: late,      color: C.amber },
                      { label: "Leave",        val: leave,     color: C.mid   },
                      { label: "Remaining",    val: remaining, color: C.blue  },
                    ].map(st => (
                      <div key={st.label} style={{
                        padding: "10px 6px", borderRadius: 10,
                        backgroundColor: C.light, border: `1px solid ${C.border}`,
                        display: "flex", flexDirection: "column", gap: 3, textAlign: "center",
                      }}>
                        <strong style={{ fontSize: 17, fontWeight: 900, color: st.color }}>{st.val}</strong>
                        <span style={{ fontSize: 9, fontWeight: 700, color: C.mid }}>{st.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <div className="att-body">

                {/* Calendar */}
                <Card>
                  <div style={{
                    padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.dark }}>
                      {MONTH_FULL[month - 1]} {year}
                    </p>
                    <select
                      value={`${year}-${month}`}
                      onChange={e => { const [y, m] = e.target.value.split("-").map(Number); setYear(y); setMonth(m); }}
                      style={{
                        padding: "6px 10px", borderRadius: 8,
                        border: `1px solid ${C.border}`, backgroundColor: C.light,
                        fontSize: 12, fontWeight: 700, color: C.dark,
                        outline: "none", cursor: "pointer",
                      }}
                    >
                      {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", backgroundColor: C.light, borderBottom: `1px solid ${C.border}` }}>
                    {DAYS.map((d, i) => (
                      <div key={i} style={{ padding: "8px 0", textAlign: "center", fontSize: 10, fontWeight: 800, color: C.mid }}>{d}</div>
                    ))}
                  </div>

                  {monthlyLoading ? (
                    <div style={{ padding: "2.5rem", textAlign: "center" }}><Spinner size={24} color={C.brand} /></div>
                  ) : (
                    <div className="att-cal">
                      {cells.map((cell, i) => {
                        if (!cell.day) return <div key={`b${i}`} style={{ aspectRatio: "1", minHeight: 36 }} />;
                        const isToday = cell.day === todayDay;
                        const cfg     = getCellCfg(cell);
                        const dayClass = `att-day${cell.isWeeklyOff ? " weekly-off" : ""}`;
                        return (
                          <div
                            key={cell.day}
                            className={dayClass}
                            data-holiday={cell.isHoliday ? cell.holidayName : undefined}
                            style={{
                              backgroundColor: isToday ? C.brandLight : (cell.isWeeklyOff ? undefined : cfg.bg),
                              borderColor:     isToday ? C.brand      : cfg.border,
                              color:           isToday ? C.brandDark  : cfg.color,
                              fontWeight:      isToday ? 900          : 700,
                              outline:         isToday ? `2px solid ${C.brand}` : "none",
                              outlineOffset:   1,
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: isToday ? 900 : 700 }}>{cell.day}</span>
                            {(cell.status || cell.isWeeklyOff || cell.isHoliday || cell.isRemaining) && (
                              <span style={{ fontSize: 8, fontWeight: 900, marginTop: 1 }}>
                                {cell.isWeeklyOff
                                  ? "–"
                                  : cell.isHoliday
                                  ? "H"
                                  : cell.status
                                  ? (STATUS[cell.status]?.short ?? "")
                                  : "R"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Month footer stats */}
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {[
                      { label: "Present", val: monthPresent,   color: C.green  },
                      { label: "Absent",  val: monthAbsent,    color: C.red    },
                      { label: "Marked",  val: monthTotal,     color: C.dark   },
                      { label: "Rate",    val: `${monthPct}%`, color: monthPct >= 75 ? C.green : C.amber },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center" }}>
                        <strong style={{ display: "block", fontSize: 15, fontWeight: 900, color: s.color }}>{s.val}</strong>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Sidebar */}
                <div className="att-side">

                  {/* Today */}
                  <Card>
                    <CardHead
                      title="Today"
                      sub={now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
                    />
                    <div style={{ padding: "14px 18px" }}>
                      {todayStatus ? (() => {
                        const cfg = STATUS[todayStatus] ?? STATUS.off;
                        return (
                          <div className="att-today-status" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                              backgroundColor: C.white, border: `1px solid ${cfg.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 15, fontWeight: 900, color: cfg.color,
                            }}>
                              {cfg.short}
                            </div>
                            <div>
                              <strong style={{ display: "block", fontSize: 14, fontWeight: 900, color: cfg.color }}>
                                {todayStatus === "holiday" && todayCell?.holidayName
                                  ? todayCell.holidayName
                                  : cfg.label}
                              </strong>
                              <span style={{ fontSize: 11, fontWeight: 600, color: C.mid }}>Today's status</span>
                            </div>
                          </div>
                        );
                      })() : (
                        <div style={{ padding: "14px", borderRadius: 10, backgroundColor: C.light, textAlign: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Not marked yet</span>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Year Summary donut */}
                  <Card>
                    <CardHead title="Year Summary" sub={activeYear?.year_name ?? "Current year"} />
                    <div style={{ padding: "18px" }}>
                      <DonutChart
                        pct={attPct}
                        present={present + late}
                        absent={absent}
                        effective={effective}
                        yearName={activeYear?.year_name ?? ""}
                      />
                    </div>
                    {remaining > 0 && (
                      <div style={{
                        margin: "0 16px 14px",
                        padding: "8px 12px", borderRadius: 8,
                        backgroundColor: C.blueBg, border: `1px solid #bfdbfe`,
                        fontSize: 11, fontWeight: 700, color: C.blue,
                      }}>
                        ⏳ {remaining} day{remaining !== 1 ? "s" : ""} not yet marked by teacher
                      </div>
                    )}
                  </Card>

                  {/* Color guide */}
                  <Card>
                    <CardHead title="Color Guide" />
                    <div className="att-legend">
                      {(["present","absent","late","leave","remaining","weekly_off","holiday"] as const).map(key => {
                        const cfg = STATUS[key];
                        const itemClass = `att-legend-item${key === "weekly_off" ? " weekly-off" : ""}`;
                        return (
                          <div
                            key={key}
                            className={itemClass}
                            style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
                          >
                            <div style={{
                              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                              backgroundColor: C.white, border: `1px solid ${cfg.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 10, fontWeight: 900, color: cfg.color,
                            }}>
                              {cfg.short}
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
