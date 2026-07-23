"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";

// ── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Always English day headers
const DAY_HEADERS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const STATUS_COLOR: Record<string, string> = {
  present: "#12805c",
  absent:  "#b42318",
  late:    "#c46a14",
  leave:   "#3b5bdb",
};
const STATUS_BG: Record<string, string> = {
  present: "#e2f6ee",
  absent:  "#fde7e7",
  late:    "#fff1df",
  leave:   "#e8edff",
};

/** Parse "YYYY-MM-DD" without timezone shift */
const parseLocal = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// ── Calendar Grid ─────────────────────────────────────────────────────────────
function CalendarGrid({
  year, month, recordsByDay,
}: {
  year: number; month: number; recordsByDay: Map<number, any>;
}) {
  const firstDay    = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const startOffset = (firstDay + 6) % 7; // shift so Mon=0
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayD = new Date().getDate();
  const todayM = new Date().getMonth() + 1;
  const todayY = new Date().getFullYear();

  return (
    <div>
      {/* Day headers — always English */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {DAY_HEADERS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 900, color: "#94a3b8", padding: "4px 0" }}>
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const rec     = recordsByDay.get(day);
          const status  = rec?.status ?? null;
          const isToday = day === todayD && month === todayM && year === todayY;
          return (
            <div key={day} style={{
              borderRadius: 8,
              border: isToday
                ? "2px solid #FF9B51"
                : `1px solid ${status ? STATUS_COLOR[status] + "60" : "#e2e8f0"}`,
              background: status ? STATUS_BG[status] : "#f8fafc",
              padding: "6px 4px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              minHeight: 52,
            }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: isToday ? "#FF9B51" : "#1e293b" }}>
                {day}
              </span>
              {status ? (
                <span style={{
                  fontSize: 9, fontWeight: 800, textTransform: "uppercase",
                  color: STATUS_COLOR[status],
                  padding: "1px 4px", borderRadius: 4,
                  background: STATUS_BG[status],
                  border: `1px solid ${STATUS_COLOR[status]}40`,
                }}>
                  {status === "present" ? "P" : status === "absent" ? "A" : status === "late" ? "L" : "Lv"}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#c6d0d7", fontWeight: 900 }}>—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentOwnAttendancePage() {
  const activeYear     = useAppSelector(s => s.academicYear?.activeYear);
  const academicYearId = activeYear?.id ?? null;

  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Full-year summary
  const { data: summary, loading: sumLoading } = useApi<any>(
    academicYearId
      ? `/attendance/me/summary?academic_year_id=${academicYearId}`
      : "",
    [academicYearId]
  );

  // Monthly calendar data
  const { data: monthlyRecords, loading: monthLoading } = useApi<any[]>(
    academicYearId
      ? `/attendance/me/monthly?year=${year}&month=${month}&academic_year_id=${academicYearId}`
      : "",
    [year, month, academicYearId]
  );

  // Build day → record map
  const recordsByDay = new Map<number, any>();
  (monthlyRecords ?? []).forEach(r => {
    const day = parseLocal(r.date).getDate();
    recordsByDay.set(day, r);
  });

  // Monthly counts
  const mCounts = (monthlyRecords ?? []).reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  // Month selector: last 12 months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      year:  d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    };
  });

  const pct       = Number(summary?.attendance_percentage ?? 100);
  const present   = Number(summary?.total_present         ?? 0);
  const absent    = Number(summary?.total_absent          ?? 0);
  const late      = Number(summary?.total_late            ?? 0);
  const leave     = Number(summary?.total_leave           ?? 0);
  const working   = Number(summary?.total_working_days    ?? 0);
  const remaining = Number(summary?.total_remaining       ?? 0);
  const marked    = Number(summary?.total_marked_days     ?? 0);

  const pctColor = pct >= 85 ? "#12805c" : pct >= 70 ? "#c46a14" : "#b42318";
  const pctBg    = pct >= 85 ? "#e2f6ee" : pct >= 70 ? "#fff1df" : "#fde7e7";

  return (
    <>
      <style>{`
        .soa-page  { min-height:100vh; background:#eef2f3; }
        .soa-main  { padding:20px; max-width:960px; margin:0 auto; display:flex; flex-direction:column; gap:16px; }
        .soa-card  { background:#fff; border-radius:14px; border:1px solid #dce5e9; overflow:hidden; box-shadow:0 2px 8px rgba(31,45,54,.05); }
        .soa-head  { padding:14px 18px; border-bottom:1px solid #eef2f3; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .soa-title { font-size:14px; font-weight:900; color:#1f2d36; margin:0; }
        .soa-sub   { font-size:11px; font-weight:700; color:#6a7882; margin:2px 0 0; }
        .soa-body  { padding:18px; }
        .soa-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        @media(max-width:640px){
          .soa-grid2 { grid-template-columns:1fr; }
          .soa-main  { padding:14px; gap:12px; }
        }
      `}</style>

      <div className="soa-page">
        <Topbar title="My Attendance" subtitle="Monthly calendar and full-year summary" />

        <div className="soa-main">
          {sumLoading ? (
            <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
          ) : (
            <>
              {/* ── Summary hero — stats only, no donut ── */}
              <div className="soa-card">
                <div className="soa-body">
                  {/* Top row: year + pct badge */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: "#94a3b8", letterSpacing: "0.8px", textTransform: "uppercase" }}>Academic Year</p>
                      <h2 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 900, color: "#1e293b" }}>{activeYear?.year_name ?? "—"}</h2>
                    </div>
                    <div style={{ padding: "8px 20px", borderRadius: 999, background: pctBg, border: `1.5px solid ${pctColor}40` }}>
                      <span style={{ fontSize: 26, fontWeight: 900, color: pctColor }}>{pct}%</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: pctColor, marginLeft: 6 }}>attendance</span>
                    </div>
                  </div>

                  {/* Stat boxes — same layout as the old profileMetrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
                    {/* Working Days */}
                    <div style={{ padding: "13px 14px", borderRadius: 11, background: "#f7fafb", border: "1px solid #e2e8f0", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#6a7882", marginBottom: 6, textTransform: "uppercase" }}>Working</span>
                      <strong style={{ fontSize: 24, fontWeight: 900, color: "#1e293b" }}>{working}</strong>
                    </div>
                    {/* Present */}
                    <div style={{ padding: "13px 14px", borderRadius: 11, background: "#e2f6ee", border: "1px solid #a7f3d0", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#12805c", marginBottom: 6, textTransform: "uppercase" }}>Present</span>
                      <strong style={{ fontSize: 24, fontWeight: 900, color: "#12805c" }}>{present}</strong>
                    </div>
                    {/* Absent */}
                    <div style={{ padding: "13px 14px", borderRadius: 11, background: "#fde7e7", border: "1px solid #fca5a5", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#b42318", marginBottom: 6, textTransform: "uppercase" }}>Absent</span>
                      <strong style={{ fontSize: 24, fontWeight: 900, color: "#b42318" }}>{absent}</strong>
                    </div>
                    {/* Late */}
                    <div style={{ padding: "13px 14px", borderRadius: 11, background: "#fff1df", border: "1px solid #fde68a", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#c46a14", marginBottom: 6, textTransform: "uppercase" }}>Late</span>
                      <strong style={{ fontSize: 24, fontWeight: 900, color: "#c46a14" }}>{late}</strong>
                    </div>
                    {/* On Leave */}
                    <div style={{ padding: "13px 14px", borderRadius: 11, background: "#e8edff", border: "1px solid #c7d2fe", textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#3b5bdb", marginBottom: 6, textTransform: "uppercase" }}>Leave</span>
                      <strong style={{ fontSize: 24, fontWeight: 900, color: "#3b5bdb" }}>{leave}</strong>
                    </div>
                    {/* Remaining — shown with R badge */}
                    <div style={{ padding: "13px 14px", borderRadius: 11, background: "#f7fafb", border: "1px solid #e2e8f0", textAlign: "center", position: "relative" }}>
                      <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#6a7882", marginBottom: 6, textTransform: "uppercase" }}>Not Marked</span>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <strong style={{ fontSize: 24, fontWeight: 900, color: "#6a7882" }}>{remaining}</strong>
                        {remaining > 0 && (
                          <span style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: "#e2e8f0", color: "#6a7882",
                            fontSize: 10, fontWeight: 900,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                          }}>R</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remaining note */}
                  {remaining > 0 && (
                    <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 9, background: "#f0f9ff", border: "1px solid #bae6fd", fontSize: 12, fontWeight: 700, color: "#0369a1", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#bae6fd", color: "#0369a1", fontSize: 10, fontWeight: 900, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>R</span>
                      {remaining} working day{remaining !== 1 ? "s" : ""} not yet marked by teacher — excluded from the attendance percentage.
                    </div>
                  )}
                </div>
              </div>

              {/* ── Calendar + monthly stats ── */}
              <div className="soa-grid2">
                {/* Calendar */}
                <div className="soa-card">
                  <div className="soa-head">
                    <div>
                      <p className="soa-title">{MONTH_NAMES[month - 1]} {year}</p>
                      <p className="soa-sub">Daily attendance calendar</p>
                    </div>
                    <select
                      value={`${year}-${month}`}
                      onChange={e => {
                        const [y, m] = e.target.value.split("-").map(Number);
                        setYear(y); setMonth(m);
                      }}
                      style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #d4dde2", fontSize: 12, fontWeight: 800, cursor: "pointer", background: "#fff", outline: "none" }}
                    >
                      {monthOptions.map(o => (
                        <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="soa-body">
                    {monthLoading ? (
                      <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={24} color="#FF9B51" /></div>
                    ) : (
                      <CalendarGrid year={year} month={month} recordsByDay={recordsByDay} />
                    )}
                  </div>
                </div>

                {/* Monthly stats + legend */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* This month counts */}
                  <div className="soa-card">
                    <div className="soa-head">
                      <div>
                        <p className="soa-title">{MONTH_NAMES[month - 1]} Summary</p>
                        <p className="soa-sub">Stats for selected month</p>
                      </div>
                    </div>
                    <div className="soa-body">
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "Days Recorded", value: (monthlyRecords ?? []).length, color: "#6a7882", bg: "#f7fafb", border: "#e2e8f0" },
                          { label: "Present",        value: mCounts.present || 0,         color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
                          { label: "Absent",         value: mCounts.absent  || 0,         color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
                          { label: "Late",           value: mCounts.late    || 0,         color: "#c46a14", bg: "#fff1df", border: "#fde68a" },
                          { label: "On Leave",       value: mCounts.leave   || 0,         color: "#3b5bdb", bg: "#e8edff", border: "#c7d2fe" },
                        ].map(row => (
                          <div key={row.label} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: 9,
                            background: row.bg, border: `1px solid ${row.border}`,
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{row.label}</span>
                            <strong style={{ fontSize: 16, fontWeight: 900, color: row.color }}>{row.value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="soa-card">
                    <div className="soa-head">
                      <div>
                        <p className="soa-title">Legend</p>
                        <p className="soa-sub">Calendar colour codes</p>
                      </div>
                    </div>
                    <div className="soa-body">
                      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                        {[
                          { symbol: "P",  label: "P — Present",  color: "#12805c", bg: "#e2f6ee" },
                          { symbol: "A",  label: "A — Absent",   color: "#b42318", bg: "#fde7e7" },
                          { symbol: "L",  label: "L — Late",     color: "#c46a14", bg: "#fff1df" },
                          { symbol: "Lv", label: "Lv — Leave",   color: "#3b5bdb", bg: "#e8edff" },
                          { symbol: "—",  label: "— Not marked", color: "#c6d0d7", bg: "#f8fafc" },
                        ].map(item => (
                          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 7,
                              background: item.bg,
                              border: `1px solid ${item.color}60`,
                              flexShrink: 0,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              <span style={{ fontSize: 10, fontWeight: 900, color: item.color }}>{item.symbol}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Records table ── */}
              <div className="soa-card">
                <div className="soa-head">
                  <div>
                    <p className="soa-title">Attendance Records — {MONTH_NAMES[month - 1]} {year}</p>
                    <p className="soa-sub">{(monthlyRecords ?? []).length} records found</p>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f7fafb" }}>
                        {["Date", "Day", "Status", "Remarks"].map(h => (
                          <th key={h} style={{
                            padding: "10px 16px", textAlign: "left",
                            fontSize: 10, fontWeight: 900, color: "#94a3b8",
                            letterSpacing: "0.4px", textTransform: "uppercase",
                            borderBottom: "1px solid #eef2f3",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(monthlyRecords ?? []).length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
                            <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 26, display: "block", marginBottom: 8, opacity: 0.25 }} />
                            No attendance marked for {MONTH_NAMES[month - 1]} {year}.
                          </td>
                        </tr>
                      ) : (monthlyRecords ?? []).map((r: any) => {
                        const d = parseLocal(r.date);
                        return (
                          <tr key={r.id} style={{ borderBottom: "1px solid #f0f4f5" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 800, fontSize: 13 }}>
                              {d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: 13, color: "#6a7882", fontWeight: 700 }}>
                              {d.toLocaleDateString("en-IN", { weekday: "short" })}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{
                                padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                                textTransform: "capitalize",
                                background: STATUS_BG[r.status]    || "#f1f5f9",
                                color:      STATUS_COLOR[r.status] || "#6a7882",
                              }}>
                                {r.status}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: 13, color: "#6a7882", fontWeight: 600 }}>
                              {r.remarks || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer note */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 9, alignItems: "flex-start" }}>
                <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, color: "#c2410c", marginTop: 1, fontSize: 13 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                  For any discrepancies in your attendance records, contact your class teacher or school administration.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
