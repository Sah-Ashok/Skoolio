"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";

// ── colour tokens ──────────────────────────────────────────────────────────────
const C = {
  navy:     "#25343F",
  orange:   "#FF9B51",
  bg:       "#EAEFEF",
  card:     "#ffffff",
  border:   "#e0e8ec",
  muted:    "#6a7882",
  present:  { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  absent:   { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
  late:     { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  leave:    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  holiday:  { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
  unmarked: { bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0" },
};

const STATUS_LABEL: Record<string, string> = {
  present: "P", absent: "A", late: "L", leave: "Lv",
};

// ── helpers ───────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const monthLabel  = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const dayLabel = (year: number, month: number, day: number) =>
  new Date(year, month, day).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
const isWeekend = (year: number, month: number, day: number) => {
  const dow = new Date(year, month, day).getDay();
  return dow === 0 || dow === 6;
};
const todayStr = new Date().toISOString().split("T")[0];

// ── StatusPill ────────────────────────────────────────────────────────────────
function Pill({ status }: { status: string | null }) {
  if (!status) return <span style={{ fontSize: 9, fontWeight: 700, color: C.unmarked.color }}>—</span>;
  const c   = C[status as keyof typeof C] as { bg: string; color: string; border: string } | undefined;
  const cfg = c ?? C.unmarked;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      minWidth: 22, height: 22, borderRadius: 5,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontSize: 9.5, fontWeight: 900, lineHeight: 1,
    }}>
      {STATUS_LABEL[status] ?? status.slice(0, 2).toUpperCase()}
    </span>
  );
}

function Legend() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      {Object.entries({ present: "Present", absent: "Absent", late: "Late", leave: "Leave" }).map(([k, label]) => {
        const cfg = C[k as keyof typeof C] as { bg: string; color: string; border: string };
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 5, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: 9, fontWeight: 900 }}>
              {STATUS_LABEL[k]}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{label}</span>
          </div>
        );
      })}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 5, background: C.unmarked.bg, color: C.unmarked.color, border: `1px solid ${C.unmarked.border}`, fontSize: 9, fontWeight: 700 }}>—</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>Not marked</span>
      </div>
    </div>
  );
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? C.present.color : pct >= 75 ? C.late.color : C.absent.color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 70 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: color, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 900, color, minWidth: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

interface RegisterRow {
  student_id:       number;
  full_name:        string;
  admission_number: string;
  date:             string | null;
  status:           string | null;
  year_present:     number;
  year_absent:      number;
  year_late:        number;
  year_leave:       number;
  year_total:       number;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TeacherAttendanceOverviewPage() {
  const today = new Date();
  const [year,      setYear]      = useState(today.getFullYear());
  const [month,     setMonth]     = useState(today.getMonth()); // 0-indexed
  const [sectionId, setSectionId] = useState<number | null>(null);

  const { activeYear, academicYearId }              = useAcademicYear();
  const { data: mySections, loading: secLoading }   = useApi<any[]>(
    academicYearId ? `/teachers/me/sections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  useEffect(() => {
    if (mySections?.length && !sectionId) setSectionId(mySections[0].id);
  }, [mySections]);

  const selectedSection = mySections?.find((s: any) => s.id === sectionId);

  // ── ONE API call per month — replaces 22+ serial calls ───────────────────
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [regLoading,   setRegLoading]   = useState(false);

  const loadRegister = useCallback(async () => {
    if (!sectionId || !academicYearId) return;
    setRegLoading(true);
    try {
      const res = await apiRequest<{ data: RegisterRow[] }>(
        `/attendance/section/${sectionId}/register?academic_year_id=${academicYearId}&year=${year}&month=${month + 1}`
      );
      const rows = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? (res as any[]) : []);
      setRegisterRows(rows);
    } catch {
      setRegisterRows([]);
    } finally {
      setRegLoading(false);
    }
  }, [sectionId, academicYearId, year, month]);

  useEffect(() => { loadRegister(); }, [loadRegister]);

  // ── Derive all data from register rows ────────────────────────────────────
  const students = useMemo(() => {
    const seen = new Set<number>();
    const list: { student_id: number; full_name: string; admission_number: string }[] = [];
    for (const row of registerRows) {
      if (!seen.has(row.student_id)) {
        seen.add(row.student_id);
        list.push({ student_id: row.student_id, full_name: row.full_name, admission_number: row.admission_number });
      }
    }
    return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [registerRows]);

  // dayMap[student_id][date] = status  — O(n) build, O(1) lookup
  const dayMap = useMemo(() => {
    const map: Record<number, Record<string, string>> = {};
    for (const row of registerRows) {
      if (!row.date || !row.status) continue;
      if (!map[row.student_id]) map[row.student_id] = {};
      map[row.student_id][row.date] = row.status;
    }
    return map;
  }, [registerRows]);

  // Year totals — SQL pre-computes these; we just read first row per student
  const yearTotals = useMemo(() => {
    const t: Record<number, { P: number; A: number; L: number; Lv: number; total: number }> = {};
    for (const row of registerRows) {
      if (!t[row.student_id]) {
        t[row.student_id] = {
          P: Number(row.year_present ?? 0), A: Number(row.year_absent ?? 0),
          L: Number(row.year_late   ?? 0), Lv: Number(row.year_leave ?? 0),
          total: Number(row.year_total ?? 0),
        };
      }
    }
    return t;
  }, [registerRows]);

  const markedDatesSet = useMemo(() => {
    const s = new Set<string>();
    for (const row of registerRows) if (row.date) s.add(row.date);
    return s;
  }, [registerRows]);

  const monthSummary = useMemo(() => {
    let P = 0, A = 0, L = 0, Lv = 0;
    for (const row of registerRows) {
      if (row.status === "present") P++;
      else if (row.status === "absent") A++;
      else if (row.status === "late") L++;
      else if (row.status === "leave") Lv++;
    }
    return { P, A, L, Lv, marked: markedDatesSet.size };
  }, [registerRows, markedDatesSet]);

  const days = useMemo(() => {
    const total = daysInMonth(year, month);
    return Array.from({ length: total }, (_, i) => i + 1);
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const ny = month === 11 ? year + 1 : year;
    const nm = month === 11 ? 0 : month + 1;
    if (new Date(ny, nm, 1) > new Date(today.getFullYear(), today.getMonth(), 1)) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const isAtStart = activeYear?.start_date
    ? new Date(year, month, 1) <= new Date(activeYear.start_date) : false;

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <Topbar title="Attendance Register" subtitle="Month-by-month view of your section's attendance" />
      <main style={{ padding: "24px 28px 48px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: C.navy, margin: 0 }}>Attendance Register</h1>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, margin: "4px 0 0" }}>
              {activeYear?.year_name ?? "…"}
            </p>
          </div>
          <Link href="/teacher/attendance/class" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: C.orange, color: "#fff", fontWeight: 900, fontSize: 13, textDecoration: "none", boxShadow: "0 3px 12px rgba(255,155,81,0.32)" }}>
            <i className="fa-solid fa-clipboard-check" /> Mark Today's Attendance
          </Link>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "14px 18px", boxShadow: "0 2px 10px rgba(37,52,63,0.05)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px" }}>
            <label style={{ fontSize: 11, fontWeight: 900, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Section</label>
            {secLoading ? <Spinner size={18} color={C.orange} />
              : !mySections?.length ? <span style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>No sections assigned</span>
              : (
              <select value={sectionId ?? ""} onChange={e => setSectionId(Number(e.target.value))}
                style={{ minHeight: 40, padding: "0 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13.5, fontWeight: 800, color: C.navy, background: "#fafcfd", fontFamily: "inherit", outline: "none" }}>
                {mySections.map((sec: any) => <option key={sec.id} value={sec.id}>{sec.class_name} — Section {sec.name}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={prevMonth} disabled={isAtStart} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.navy, cursor: "pointer", fontWeight: 900, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", opacity: isAtStart ? 0.4 : 1 }}>
              <i className="fa-solid fa-chevron-left" />
            </button>
            <div style={{ minWidth: 150, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.navy }}>{monthLabel(year, month)}</div>
            <button onClick={nextMonth} disabled={isCurrentMonth} style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.navy, cursor: "pointer", fontWeight: 900, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", opacity: isCurrentMonth ? 0.4 : 1 }}>
              <i className="fa-solid fa-chevron-right" />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                style={{ padding: "0 12px", height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>
                Today
              </button>
            )}
          </div>
          <div style={{ marginLeft: "auto" }}><Legend /></div>
        </div>

        {/* Summary strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[
            { label: "Students",     value: students.length,     color: C.navy,           bg: "#f1f5f9" },
            { label: "Days Marked",  value: monthSummary.marked, color: "#0284c7",        bg: "#eff6ff" },
            { label: "Present",      value: monthSummary.P,      color: C.present.color,  bg: C.present.bg },
            { label: "Absent",       value: monthSummary.A,      color: C.absent.color,   bg: C.absent.bg },
            { label: "Late + Leave", value: monthSummary.L + monthSummary.Lv, color: C.late.color, bg: C.late.bg },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid rgba(0,0,0,0.05)` }}>
              <p style={{ fontSize: 10.5, fontWeight: 900, color: C.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>{c.label}</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: c.color, margin: "3px 0 0" }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Register table */}
        {(secLoading || regLoading) ? (
          <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={36} color={C.orange} /></div>
        ) : !sectionId || !mySections?.length ? (
          <div style={{ padding: "4rem", textAlign: "center", background: C.card, borderRadius: 14, border: `1.5px dashed ${C.border}` }}>
            <i className="fa-solid fa-person-chalkboard" style={{ fontSize: 36, color: "#d4dde2", display: "block", marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>No sections assigned. Ask admin to assign you as Section Coordinator.</p>
          </div>
        ) : (
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(37,52,63,0.06)", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 900, color: C.navy, margin: 0 }}>
                  {selectedSection ? `${selectedSection.class_name} — Section ${selectedSection.name}` : "Register"}
                </h2>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: "3px 0 0" }}>
                  {monthLabel(year, month)} · {students.length} student{students.length !== 1 ? "s" : ""}
                </p>
              </div>
              {monthSummary.marked === 0 && !regLoading && (
                <span style={{ padding: "5px 12px", borderRadius: 8, background: "#fff7ed", color: "#c2410c", fontSize: 12, fontWeight: 800, border: "1px solid #fed7aa" }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 5 }} />No attendance marked this month
                </span>
              )}
            </div>

            {students.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: C.muted }}>
                <i className="fa-solid fa-users" style={{ fontSize: 32, display: "block", marginBottom: 10, opacity: 0.3 }} />
                <p style={{ fontWeight: 700, fontSize: 14 }}>No students enrolled in this section.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th rowSpan={2} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 900, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: `2px solid ${C.border}`, borderRight: `1px solid ${C.border}`, whiteSpace: "nowrap", minWidth: 160, position: "sticky", left: 0, background: "#f8fafc", zIndex: 2 }}>
                        Student
                      </th>
                      {days.map(d => {
                        const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
                        const hasData = markedDatesSet.has(dateStr);
                        const wknd    = isWeekend(year, month, d);
                        const isToday = dateStr === todayStr;
                        return (
                          <th key={d} style={{ padding: "6px 3px", textAlign: "center", fontWeight: 900, fontSize: 10, color: isToday ? C.orange : wknd ? "#94a3b8" : C.muted, borderBottom: `1px solid ${C.border}`, background: isToday ? "#fff7ed" : "#f8fafc", minWidth: 30 }}>
                            {d}
                            {hasData && <span style={{ display: "block", width: 6, height: 6, borderRadius: "50%", background: C.present.color, margin: "2px auto 0" }} />}
                          </th>
                        );
                      })}
                      <th colSpan={4} style={{ padding: "6px 8px", textAlign: "center", fontWeight: 900, fontSize: 10, color: C.muted, borderBottom: `1px solid ${C.border}`, borderLeft: `2px solid ${C.border}`, background: "#f8fafc", whiteSpace: "nowrap" }}>YEAR TOTALS</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontWeight: 900, fontSize: 10, color: C.muted, borderBottom: `1px solid ${C.border}`, background: "#f8fafc", whiteSpace: "nowrap" }}>ATT %</th>
                    </tr>
                    <tr style={{ background: "#f8fafc" }}>
                      {days.map(d => {
                        const wknd    = isWeekend(year, month, d);
                        const isToday = `${year}-${pad(month + 1)}-${pad(d)}` === todayStr;
                        return (
                          <th key={d} style={{ padding: "3px 2px 6px", textAlign: "center", fontWeight: 700, fontSize: 9, color: wknd ? "#cbd5e1" : C.muted, borderBottom: `2px solid ${C.border}`, background: isToday ? "#fff7ed" : "#f8fafc" }}>
                            {dayLabel(year, month, d)}
                          </th>
                        );
                      })}
                      {["P","A","L","Lv"].map(l => (
                        <th key={l} style={{ padding: "3px 6px 6px", textAlign: "center", fontWeight: 900, fontSize: 10, color: C.muted, borderBottom: `2px solid ${C.border}`, borderLeft: l === "P" ? `2px solid ${C.border}` : undefined, background: "#f8fafc" }}>{l}</th>
                      ))}
                      <th style={{ padding: "3px 6px 6px", borderBottom: `2px solid ${C.border}`, background: "#f8fafc" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((stu, idx) => {
                      const { student_id } = stu;
                      const totals  = yearTotals[student_id] ?? { P: 0, A: 0, L: 0, Lv: 0, total: 0 };
                      const pct     = totals.total > 0 ? Math.round((totals.P / totals.total) * 100) : 100;
                      const stuDays = dayMap[student_id] ?? {};
                      return (
                        <tr key={student_id} style={{ borderBottom: `1px solid #f1f5f9`, background: idx % 2 === 0 ? "#fff" : "#fafcfd" }}>
                          <td style={{ padding: "10px 16px", borderRight: `1px solid ${C.border}`, position: "sticky", left: 0, background: idx % 2 === 0 ? "#fff" : "#fafcfd", zIndex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `hsl(${(student_id * 47) % 360},65%,92%)`, color: `hsl(${(student_id * 47) % 360},55%,35%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900 }}>
                                {(stu.full_name ?? "?").charAt(0)}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: 12.5, fontWeight: 900, color: C.navy, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{stu.full_name}</p>
                                <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, margin: "1px 0 0" }}>{stu.admission_number ?? `#${student_id}`}</p>
                              </div>
                            </div>
                          </td>
                          {days.map(d => {
                            const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
                            const wknd    = isWeekend(year, month, d);
                            const isToday = dateStr === todayStr;
                            return (
                              <td key={d} style={{ padding: "6px 3px", textAlign: "center", background: isToday ? "#fffbf2" : wknd ? "#f8fafc" : "inherit", opacity: wknd ? 0.5 : 1 }}>
                                {wknd ? <span style={{ fontSize: 9, color: "#cbd5e1", fontWeight: 700 }}>—</span> : <Pill status={stuDays[dateStr] ?? null} />}
                              </td>
                            );
                          })}
                          <td style={{ padding: "6px 8px", textAlign: "center", borderLeft: `2px solid ${C.border}`, background: idx % 2 === 0 ? "#f0fdf4" : "#e8fdf1" }}><span style={{ fontSize: 11.5, fontWeight: 900, color: C.present.color }}>{totals.P}</span></td>
                          <td style={{ padding: "6px 8px", textAlign: "center", background: idx % 2 === 0 ? "#fef2f2" : "#fee8e8" }}><span style={{ fontSize: 11.5, fontWeight: 900, color: C.absent.color }}>{totals.A}</span></td>
                          <td style={{ padding: "6px 8px", textAlign: "center", background: idx % 2 === 0 ? "#fffbeb" : "#fef8e0" }}><span style={{ fontSize: 11.5, fontWeight: 900, color: C.late.color }}>{totals.L}</span></td>
                          <td style={{ padding: "6px 8px", textAlign: "center", background: idx % 2 === 0 ? "#eff6ff" : "#e8f2ff" }}><span style={{ fontSize: 11.5, fontWeight: 900, color: C.leave.color }}>{totals.Lv}</span></td>
                          <td style={{ padding: "6px 12px", minWidth: 90 }}><PctBar pct={pct} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f8fafc", borderTop: `2px solid ${C.border}` }}>
                      <td style={{ padding: "10px 16px", fontWeight: 900, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", borderRight: `1px solid ${C.border}`, position: "sticky", left: 0, background: "#f8fafc", zIndex: 1 }}>Daily Total</td>
                      {days.map(d => {
                        const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
                        const wknd    = isWeekend(year, month, d);
                        if (wknd) return <td key={d} style={{ background: "#f8fafc" }} />;
                        let p = 0, ab = 0;
                        for (const row of registerRows) {
                          if (row.date === dateStr) {
                            if (row.status === "present" || row.status === "late") p++;
                            else if (row.status === "absent") ab++;
                          }
                        }
                        const hasData = markedDatesSet.has(dateStr);
                        return (
                          <td key={d} style={{ padding: "8px 3px", textAlign: "center" }}>
                            {hasData ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
                                <span style={{ fontSize: 9, fontWeight: 900, color: C.present.color }}>{p}</span>
                                <span style={{ fontSize: 8, fontWeight: 700, color: C.absent.color }}>{ab}</span>
                              </div>
                            ) : <span style={{ fontSize: 9, color: "#cbd5e1" }}>·</span>}
                          </td>
                        );
                      })}
                      <td colSpan={5} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 900, fontSize: 11, color: C.muted, borderLeft: `2px solid ${C.border}` }}>
                        {monthSummary.marked} day{monthSummary.marked !== 1 ? "s" : ""} marked
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Monthly records list */}
        {markedDatesSet.size > 0 && (
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 10px rgba(37,52,63,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "13px 18px", borderBottom: `1px solid ${C.border}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: C.navy, margin: 0 }}>
                <i className="fa-solid fa-list-check" style={{ marginRight: 8, color: C.orange }} />
                Attendance Records — {monthLabel(year, month)}
              </h3>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Date","Day","Present","Absent","Late","Leave","Action"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 900, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from(markedDatesSet).sort().map(dateStr => {
                    const d = new Date(dateStr + "T00:00:00");
                    let p = 0, ab = 0, l = 0, lv = 0;
                    for (const row of registerRows) {
                      if (row.date !== dateStr) continue;
                      if (row.status === "present") p++;
                      else if (row.status === "absent") ab++;
                      else if (row.status === "late") l++;
                      else if (row.status === "leave") lv++;
                    }
                    return (
                      <tr key={dateStr} style={{ borderBottom: `1px solid #f1f5f9` }}>
                        <td style={{ padding: "11px 14px", fontWeight: 900, color: C.navy }}>{dateStr}</td>
                        <td style={{ padding: "11px 14px", color: C.muted, fontWeight: 700 }}>{d.toLocaleDateString("en-US", { weekday: "long" })}</td>
                        <td style={{ padding: "11px 14px" }}><span style={{ fontWeight: 900, color: C.present.color }}>{p}</span></td>
                        <td style={{ padding: "11px 14px" }}><span style={{ fontWeight: 900, color: C.absent.color }}>{ab}</span></td>
                        <td style={{ padding: "11px 14px" }}><span style={{ fontWeight: 900, color: C.late.color }}>{l}</span></td>
                        <td style={{ padding: "11px 14px" }}><span style={{ fontWeight: 900, color: C.leave.color }}>{lv}</span></td>
                        <td style={{ padding: "11px 14px" }}>
                          <Link href="/teacher/attendance/class" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, fontSize: 11, textDecoration: "none", border: "1px solid #bfdbfe" }}>
                            <i className="fa-solid fa-pen" style={{ fontSize: 9 }} /> Edit
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <style>{`@media (max-width: 768px) { main { padding: 14px 10px 40px !important; } }`}</style>
      </main>
    </div>
  );
}
