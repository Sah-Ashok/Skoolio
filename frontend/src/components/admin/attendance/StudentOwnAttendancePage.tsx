"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

/* ── Font ─────────────────────────────────────────────────────────── */
const FONT = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');`;

/* ── Design tokens — two-tone palette ────────────────────────────── */
const C = {
  brand:      "#ff9b51",   // Skoolio orange
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
  slate:      "#64748b",
  slateBg:    "#f8fafc",
};

/* ── Status config — minimal, two accents each ───────────────────── */
const STATUS: Record<string, { label: string; color: string; bg: string; border: string; short: string }> = {
  present: { label: "Present", color: C.green,  bg: C.greenBg, border: "#bbf7d0", short: "P" },
  absent:  { label: "Absent",  color: C.red,    bg: C.redBg,   border: "#fecaca", short: "A" },
  late:    { label: "Late",    color: C.amber,  bg: C.amberBg, border: "#fde68a", short: "L" },
  leave:   { label: "Leave",   color: C.mid,    bg: C.light,   border: C.border,  short: "Lv"},
  off:     { label: "—",       color: "#b0bec5",bg: "#f8fafc",  border: "#e9ecef", short: "–" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["M","T","W","T","F","S","S"];

function grade(pct: number) {
  if (pct >= 90) return { label: "Excellent", color: C.green,  bg: C.greenBg };
  if (pct >= 75) return { label: "Good",       color: C.brand,  bg: C.brandLight };
  if (pct >= 60) return { label: "Average",    color: C.amber,  bg: C.amberBg };
  return               { label: "Low",         color: C.red,    bg: C.redBg };
}

/* ── Reusable card wrapper ───────────────────────────────────────── */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.white, borderRadius: 14,
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
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: me }         = useApi<any>("/auth/me");
  const { data: activeYear } = useApi<any>("/academic-years/active");

  const startOfYear = activeYear?.start_date ?? `${year}-01-01`;
  const today       = now.toISOString().split("T")[0];

  const { data: summary, loading: summaryLoading } = useApi<any>(
    activeYear?.id
      ? `/attendance/me/summary?academic_year_id=${activeYear.id}&start_date=${startOfYear}&end_date=${today}`
      : "",
    [activeYear?.id]
  );

  const { data: monthly, loading: monthlyLoading } = useApi<any[]>(
    `/attendance/me/monthly?year=${year}&month=${month}`,
    [year, month]
  );

  /* ── Data ── */
  const attPct  = Number(summary?.attendance_percentage ?? 100);
  const present = Number(summary?.total_present ?? 0);
  const absent  = Number(summary?.total_absent  ?? 0);
  const late    = Number(summary?.total_late    ?? 0);
  const leave   = Number(summary?.total_leave   ?? 0);
  const wDays   = Number(summary?.total_working_days ?? 0);
  const g       = grade(attPct);

  const recordsByDay = new Map<number, string>();
  (monthly ?? []).forEach(r => {
    recordsByDay.set(new Date(r.date + "T00:00:00").getDate(), r.status);
  });

  const monthPresent = (monthly ?? []).filter(r => r.status === "present").length;
  const monthAbsent  = (monthly ?? []).filter(r => r.status === "absent").length;
  const monthTotal   = (monthly ?? []).length;
  const monthPct     = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : 0;

  /* ── Calendar cells ── */
  const daysInMonth   = new Date(year, month, 0).getDate();
  const firstDow      = new Date(year, month - 1, 1).getDay();
  const leadingBlanks = (firstDow + 6) % 7;
  const cells: { day: number | null; status?: string }[] = [
    ...Array(leadingBlanks).fill({ day: null }),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, status: recordsByDay.get(i + 1) })),
  ];
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const todayDay    = now.getMonth() + 1 === month ? now.getDate() : null;
  const todayStatus = todayDay ? (recordsByDay.get(todayDay) ?? "off") : null;

  /* ── Month options ── */
  const monthOptions = (() => {
    if (!activeYear) return [];
    const opts: { label: string; value: string }[] = [];
    const d = new Date(activeYear.start_date);
    d.setDate(1);
    while (d <= now) {
      opts.push({ value: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
      d.setMonth(d.getMonth() + 1);
    }
    return opts.reverse();
  })();

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

        /* Hero */
        .att-hero { display: flex; align-items: center; gap: 16px; }

        /* Stats row — 2 cols on mobile, 4 on desktop */
        .att-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (min-width: 540px) { .att-stats { grid-template-columns: repeat(4, 1fr); } }

        /* Main layout — single col mobile, 2-col desktop */
        .att-body { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 780px) { .att-body { grid-template-columns: 1fr 260px; align-items: start; } }

        /* Calendar grid */
        .att-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 12px; }
        @media (min-width: 420px) { .att-cal { gap: 6px; padding: 14px; } }

        /* Day cell */
        .att-day {
          aspect-ratio: 1;
          border-radius: 8px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          border: 1.5px solid transparent;
          transition: transform 0.1s;
          cursor: default;
          min-height: 36px;
        }
        @media (min-width: 420px) { .att-day { font-size: 13px; min-height: 44px; } }
        .att-day:active { transform: scale(0.94); }

        /* Sidebar stacks below on mobile */
        .att-side { display: flex; flex-direction: column; gap: 14px; }

        /* Today status row */
        .att-today-status {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: 10px;
        }

        /* Year stat rows */
        .att-stat-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 0; border-bottom: 1px solid ${C.border};
          gap: 8px;
        }
        .att-stat-row:last-child { border-bottom: none; }

        /* Legend grid 2-col */
        .att-legend { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px 18px; }

        /* Progress bar */
        .att-bar { height: 8px; border-radius: 999px; background: #e9ecef; overflow: hidden; }
        .att-bar-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
      `}</style>

      <div className="att-root">
        <Topbar title="My Attendance" subtitle="Academic year attendance record" />

        <div className="att-main">
          {summaryLoading ? (
            <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color={C.brand} /></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── Hero ── */}
              <Card>
                <div style={{ padding: "18px 18px 14px" }}>
                  <div className="att-hero">
                    {/* Avatar */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                      background: C.dark, color: C.brand,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 900,
                    }}>
                      {initials}
                    </div>
                    {/* Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.mid, letterSpacing: 0.5, textTransform: "uppercase" }}>My Attendance</p>
                      <h1 style={{ margin: "3px 0 4px", fontSize: 18, fontWeight: 900, color: C.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {me?.full_name ?? "Student"}
                      </h1>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {me?.admission_number && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.mid }}>{me.admission_number}</span>
                        )}
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: g.bg, color: g.color }}>
                          {g.label}
                        </span>
                      </div>
                    </div>
                    {/* Big % */}
                    <div style={{
                      width: 62, height: 62, borderRadius: "50%", flexShrink: 0,
                      background: `conic-gradient(${C.brand} ${attPct * 3.6}deg, ${C.border} ${attPct * 3.6}deg)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: "50%",
                        background: C.white,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      }}>
                        <strong style={{ fontSize: 13, fontWeight: 900, color: C.dark, lineHeight: 1 }}>{attPct}%</strong>
                        <span style={{ fontSize: 8, fontWeight: 700, color: C.mid }}>overall</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: 14 }}>
                    <div className="att-bar">
                      <div className="att-bar-fill" style={{ width: `${attPct}%`, background: attPct >= 75 ? C.green : attPct >= 60 ? C.amber : C.red }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>0%</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>Required: 75%</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>100%</span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ padding: "0 18px 16px" }}>
                  <div className="att-stats">
                    {[
                      { label: "Working Days", val: wDays,   color: C.dark  },
                      { label: "Present",      val: present, color: C.green  },
                      { label: "Absent",       val: absent,  color: C.red   },
                      { label: "Late / Leave", val: `${late}/${leave}`, color: C.amber },
                    ].map(st => (
                      <div key={st.label} style={{
                        padding: "10px 12px", borderRadius: 10,
                        background: C.light, border: `1px solid ${C.border}`,
                        display: "flex", flexDirection: "column", gap: 3,
                      }}>
                        <strong style={{ fontSize: 20, fontWeight: 900, color: st.color }}>{st.val}</strong>
                        <span style={{ fontSize: 10, fontWeight: 700, color: C.mid }}>{st.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* ── Body: Calendar + Sidebar ── */}
              <div className="att-body">

                {/* Calendar */}
                <Card>
                  {/* Header */}
                  <div style={{
                    padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                  }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.dark }}>
                      {MONTH_FULL[month - 1]} {year}
                    </p>
                    <select
                      value={`${year}-${month}`}
                      onChange={e => { const [y,m] = e.target.value.split("-").map(Number); setYear(y); setMonth(m); }}
                      style={{
                        padding: "6px 10px", borderRadius: 8,
                        border: `1px solid ${C.border}`, background: C.light,
                        fontSize: 12, fontWeight: 700, color: C.dark,
                        outline: "none", cursor: "pointer",
                      }}
                    >
                      {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>

                  {/* Day headers */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
                    background: C.light, borderBottom: `1px solid ${C.border}`,
                  }}>
                    {DAYS.map((d, i) => (
                      <div key={i} style={{ padding: "8px 0", textAlign: "center", fontSize: 10, fontWeight: 800, color: C.mid }}>
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Cells */}
                  {monthlyLoading ? (
                    <div style={{ padding: "2.5rem", textAlign: "center" }}>
                      <Spinner size={24} color={C.brand} />
                    </div>
                  ) : (
                    <div className="att-cal">
                      {cells.map((cell, i) => {
                        if (!cell.day) return <div key={`b${i}`} style={{ aspectRatio: "1", minHeight: 36 }} />;
                        const st  = cell.status ?? "off";
                        const cfg = STATUS[st] ?? STATUS.off;
                        const isToday = cell.day === todayDay;
                        return (
                          <div
                            key={cell.day}
                            className="att-day"
                            style={{
                              background: isToday ? C.brandLight : cfg.bg,
                              borderColor: isToday ? C.brand : cfg.border,
                              color: isToday ? C.brandDark : cfg.color,
                              fontWeight: isToday ? 900 : 700,
                              outline: isToday ? `2px solid ${C.brand}` : "none",
                              outlineOffset: 1,
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: isToday ? 900 : 700 }}>{cell.day}</span>
                            {cell.status && (
                              <span style={{ fontSize: 8, fontWeight: 900, marginTop: 1 }}>{cfg.short}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Month footer */}
                  <div style={{
                    borderTop: `1px solid ${C.border}`,
                    padding: "12px 16px",
                    display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
                  }}>
                    {[
                      { label: "Present", val: monthPresent, color: C.green  },
                      { label: "Absent",  val: monthAbsent,  color: C.red    },
                      { label: "Marked",  val: monthTotal,   color: C.dark   },
                      { label: "Rate",    val: `${monthPct}%`, color: attPct >= 75 ? C.green : C.amber },
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
                          <div className="att-today-status" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                              background: C.white, border: `1px solid ${cfg.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 15, fontWeight: 900, color: cfg.color,
                            }}>
                              {cfg.short}
                            </div>
                            <div>
                              <strong style={{ display: "block", fontSize: 14, fontWeight: 900, color: cfg.color }}>{cfg.label}</strong>
                              <span style={{ fontSize: 11, fontWeight: 600, color: C.mid }}>Today's status</span>
                            </div>
                          </div>
                        );
                      })() : (
                        <div style={{ padding: "14px", borderRadius: 10, background: C.light, textAlign: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Not marked yet</span>
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* Full year stats */}
                  <Card>
                    <CardHead title="Year Summary" sub={activeYear?.year_name ?? "Current year"} />
                    <div style={{ padding: "6px 18px 14px" }}>
                      {[
                        { label: "Working Days", val: wDays,   color: C.dark,  note: "Total"     },
                        { label: "Present",      val: present, color: C.green,  note: "Attended"  },
                        { label: "Absent",       val: absent,  color: C.red,   note: "Missed"    },
                        { label: "Late",         val: late,    color: C.amber, note: "Arrivals"  },
                        { label: "Leave",        val: leave,   color: C.mid,   note: "Approved"  },
                      ].map(row => (
                        <div key={row.label} className="att-stat-row">
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{row.label}</span>
                            <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: C.mid }}>{row.note}</span>
                          </div>
                          <strong style={{ fontSize: 17, fontWeight: 900, color: row.color }}>{row.val}</strong>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Legend */}
                  <Card>
                    <CardHead title="Color Guide" />
                    <div className="att-legend">
                      {Object.entries(STATUS).map(([key, cfg]) => (
                        <div key={key} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 10px", borderRadius: 8,
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                        }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                            background: C.white, border: `1px solid ${cfg.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 900, color: cfg.color,
                          }}>
                            {cfg.short}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                        </div>
                      ))}
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
