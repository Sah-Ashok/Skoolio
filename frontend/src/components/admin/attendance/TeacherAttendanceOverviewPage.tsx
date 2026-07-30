"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";

// ── colour tokens ──────────────────────────────────────────────────────────
const C = {
  navy:    "#25343F",
  orange:  "#FF9B51",
  bg:      "#EAEFEF",
  card:    "#ffffff",
  border:  "#e0e8ec",
  muted:   "#6a7882",
  present: { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  absent:  { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" },
  leave:   { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  late:    { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  remain:  { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
  weekend: { bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0" },
  holiday: { bg: "#fdf2f8", color: "#9d174d", border: "#f9a8d4" },
};

const STATUS_LABEL: Record<string, string> = {
  present: "P", absent: "A", leave: "Lv", late: "L",
};

// ── helpers ───────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const daysInMonth     = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const getWeekdayShort = (y: number, m: number, d: number) =>
  new Date(y, m, d).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
const getWeekday = (y: number, m: number, d: number) =>
  new Date(y, m, d).getDay();

// ── Cell ─────────────────────────────────────────────────────────────────
type CellType = "present" | "absent" | "leave" | "late" | "remain" | "weekend" | "holiday" | null;

function Cell({ type }: { type: CellType }) {
  if (type === "weekend") return (
    <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: C.weekend.bg, color: C.weekend.color, fontSize: 9, fontWeight: 800, margin: "0 auto" }}>—</div>
  );
  if (type === "holiday") return (
    <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: C.holiday.bg, color: C.holiday.color, fontSize: 9, fontWeight: 800, border: `1px solid ${C.holiday.border}`, margin: "0 auto" }}>H</div>
  );
  if (!type || type === "remain") return (
    <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: C.remain.bg, color: C.remain.color, fontSize: 9, fontWeight: 800, border: `1px dashed ${C.remain.border}`, margin: "0 auto" }}>R</div>
  );
  const cfg = C[type as keyof typeof C] as { bg: string; color: string; border: string };
  return (
    <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontSize: 10, fontWeight: 900, margin: "0 auto" }}>
      {STATUS_LABEL[type] ?? type.slice(0, 2).toUpperCase()}
    </div>
  );
}

function PctBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? C.present.color : pct >= 75 ? C.late.color : C.absent.color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 80 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: color, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 900, color, minWidth: 34, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

interface RegisterRow {
  student_id:       number;
  full_name:        string;
  admission_number: string;
  roll_number?:     number | null;
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
  const today  = new Date();
  const TODAY  = todayStr();

  const [year,      setYear]      = useState(today.getFullYear());
  const [month,     setMonth]     = useState(today.getMonth());
  const [sectionId, setSectionId] = useState<number | null>(null);

  const { activeYear, academicYearId } = useAcademicYear();
  const { data: mySections, loading: secLoading } = useApi<any[]>(
    academicYearId ? `/teachers/me/sections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  useEffect(() => {
    if (mySections?.length && !sectionId) setSectionId(mySections[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySections]);

  const selectedSection = mySections?.find((s: any) => s.id === sectionId);

  // ── register data ─────────────────────────────────────────────────────
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [regLoading,   setRegLoading]   = useState(false);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());

  const loadRegister = useCallback(async () => {
    if (!sectionId || !academicYearId) return;
    setRegLoading(true);
    try {
      const res = await apiRequest<{ data: RegisterRow[] }>(
        `/attendance/section/${sectionId}/register?academic_year_id=${academicYearId}&year=${year}&month=${month + 1}`
      );
      const rows = Array.isArray(res.data) ? res.data : [];
      setRegisterRows(rows);
    } catch {
      setRegisterRows([]);
    } finally {
      setRegLoading(false);
    }
  }, [sectionId, academicYearId, year, month]);

  const loadHolidays = useCallback(async () => {
    if (!academicYearId) return;
    try {
      const lastDay    = daysInMonth(year, month);
      const monthStart = `${year}-${pad(month + 1)}-01`;
      const monthEnd   = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
      const calRes = await apiRequest<{ data: { id: number } }>(
        `/calendar?academic_year_id=${academicYearId}`
      );
      if (calRes.data?.id) {
        const evRes = await apiRequest<{ data: any[] }>(`/calendar/${calRes.data.id}/events`);
        const events: any[] = evRes.data || [];
        const hDates = new Set<string>();
        for (let d = 1; d <= lastDay; d++) {
          const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
          const isHol = events.some((ev: any) => {
            const start = (ev.event_date ?? "").slice(0, 10);
            const end   = (ev.end_date   ?? start).slice(0, 10);
            return dateStr >= start && dateStr <= end && ev.affects_attendance === true;
          });
          if (isHol) hDates.add(dateStr);
        }
        setHolidayDates(hDates);
      }
    } catch {
      setHolidayDates(new Set());
    }
  }, [academicYearId, year, month]);

  useEffect(() => { loadRegister(); }, [loadRegister]);
  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  // ── derived data ──────────────────────────────────────────────────────
  const students = useMemo(() => {
    const seen = new Map<number, { student_id: number; full_name: string; admission_number: string; roll_number: number | null }>();
    for (const row of registerRows) {
      if (!seen.has(row.student_id)) {
        seen.set(row.student_id, {
          student_id:       row.student_id,
          full_name:        row.full_name,
          admission_number: row.admission_number,
          roll_number:      row.roll_number ?? null,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      (a.roll_number ?? 999) - (b.roll_number ?? 999) || a.full_name.localeCompare(b.full_name)
    );
  }, [registerRows]);

  // dayMap[student_id][YYYY-MM-DD] = status
  const dayMap = useMemo(() => {
    const map: Record<number, Record<string, string>> = {};
    for (const row of registerRows) {
      if (!row.date || !row.status) continue;
      const key = row.date.slice(0, 10);
      if (!map[row.student_id]) map[row.student_id] = {};
      map[row.student_id][key] = row.status;
    }
    return map;
  }, [registerRows]);

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
    for (const row of registerRows) if (row.date) s.add(row.date.slice(0, 10));
    return s;
  }, [registerRows]);

  // ── all days & working-only columns ──────────────────────────────────
  const days = useMemo(() =>
    Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1),
    [year, month]
  );

  // Only show working day columns (skip weekends + school holidays)
  const workingDayColumns = useMemo(() =>
    days.filter(d => {
      const dow = getWeekday(year, month, d);
      if (dow === 0 || dow === 6) return false;
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      if (holidayDates.has(dateStr)) return false;
      return true;
    }),
    [days, year, month, holidayDates]
  );

  type DayColType = "today" | "past_marked" | "past_unmarked" | "future" | "holiday";
  const getDayColType = (d: number): DayColType => {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    if (holidayDates.has(dateStr))  return "holiday";
    if (dateStr === TODAY)          return "today";
    if (dateStr < TODAY)            return markedDatesSet.has(dateStr) ? "past_marked" : "past_unmarked";
    return "future";
  };

  const getCellType = (studentId: number, d: number): CellType => {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    if (holidayDates.has(dateStr)) return "holiday";
    const status = dayMap[studentId]?.[dateStr];
    if (status) return status as CellType;
    return "remain";
  };

  const getDayTotal = (d: number) => {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    if (!markedDatesSet.has(dateStr)) return null;
    let p = 0, a = 0, lv = 0;
    for (const row of registerRows) {
      if (!row.date || row.date.slice(0, 10) !== dateStr) continue;
      if (row.status === "present") p++;
      else if (row.status === "absent") a++;
      else if (row.status === "leave") lv++;
    }
    return { p, a, lv };
  };

  const monthSummary = useMemo(() => {
    let P = 0, A = 0, Lv = 0;
    for (const row of registerRows) {
      if (row.status === "present") P++;
      else if (row.status === "absent") A++;
      else if (row.status === "leave") Lv++;
    }
    return { daysMarked: markedDatesSet.size, P, A, Lv };
  }, [registerRows, markedDatesSet]);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const isAtStart      = activeYear?.start_date
    ? new Date(year, month, 1) <= new Date(activeYear.start_date) : false;

  const prevMonth = () => {
    if (isAtStart) return;
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  };

  const MONTH_NAME = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Header colour helpers
  const hdrBg = (t: DayColType) =>
    t === "today" ? "#fff7ed" : t === "past_unmarked" ? "#fef2f2" : "#f0f4f7";
  const hdrColor = (t: DayColType) =>
    t === "today" ? C.orange : t === "past_unmarked" ? "#b91c1c" : C.muted;

  // ── no sections guard ─────────────────────────────────────────────────
  if (!secLoading && academicYearId && mySections?.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg }}>
        <Topbar title="Attendance Register" subtitle="No sections assigned" />
        <main style={{ padding: "32px 28px", textAlign: "center" }}>
          <i className="fa-solid fa-person-chalkboard" style={{ fontSize: 40, color: "#d4dde2", display: "block", marginBottom: 16 }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>No sections assigned. Ask admin to assign you as Section Coordinator.</p>
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <Topbar title="Attendance Register" subtitle="Month-by-month attendance for your section" />

      <main style={{ padding: "20px 24px 48px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Controls ── */}
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "14px 18px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", boxShadow: "0 2px 10px rgba(37,52,63,0.05)" }}>

          {/* Section */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px" }}>
            <label style={{ fontSize: 10, fontWeight: 900, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Section</label>
            {secLoading
              ? <Spinner size={18} />
              : !mySections?.length
                ? <span style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>No sections assigned</span>
                : (
                  <select value={sectionId ?? ""} onChange={e => setSectionId(Number(e.target.value))}
                    style={{ minHeight: 38, padding: "0 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 800, color: C.navy, background: "#fafcfd", fontFamily: "inherit", outline: "none" }}>
                    {mySections.map((sec: any) => (
                      <option key={sec.id} value={sec.id}>{sec.class_name} — Section {sec.name}</option>
                    ))}
                  </select>
                )
            }
          </div>

          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={prevMonth} disabled={isAtStart}
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.navy, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: isAtStart ? 0.4 : 1 }}>
              <i className="fa-solid fa-chevron-left" />
            </button>
            <div style={{ minWidth: 160, textAlign: "center", fontWeight: 900, fontSize: 14, color: C.navy }}>{MONTH_NAME}</div>
            <button onClick={nextMonth} disabled={isCurrentMonth}
              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.navy, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", opacity: isCurrentMonth ? 0.4 : 1 }}>
              <i className="fa-solid fa-chevron-right" />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                style={{ padding: "0 12px", height: 34, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.muted, cursor: "pointer", fontSize: 12, fontWeight: 800, fontFamily: "inherit" }}>
                Today
              </button>
            )}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginLeft: "auto" }}>
            {([
              { key: "present", abbr: "P",  label: "Present" },
              { key: "absent",  abbr: "A",  label: "Absent"  },
              { key: "leave",   abbr: "Lv", label: "Leave"   },
              { key: "remain",  abbr: "R",  label: "Remaining" },
              { key: "holiday", abbr: "H",  label: "Holiday" },
            ] as const).map(({ key, abbr, label }) => {
              const cfg = C[key] as { bg: string; color: string; border: string };
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900 }}>{abbr}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{label}</span>
                </div>
              );
            })}
          </div>

          <Link href="/teacher/attendance/class"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, background: C.orange, color: "#fff", fontWeight: 900, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap", boxShadow: "0 3px 12px rgba(255,155,81,0.3)" }}>
            <i className="fa-solid fa-clipboard-check" /> Mark Attendance
          </Link>
        </div>

        {/* ── Summary strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[
            { label: "Students",    value: students.length,         color: C.navy,          bg: "#f1f5f9",    icon: "fa-users" },
            { label: "Days Marked", value: monthSummary.daysMarked, color: "#0284c7",       bg: "#eff6ff",    icon: "fa-calendar-check" },
            { label: "Present",     value: monthSummary.P,          color: C.present.color, bg: C.present.bg, icon: "fa-circle-check" },
            { label: "Absent",      value: monthSummary.A,          color: C.absent.color,  bg: C.absent.bg,  icon: "fa-circle-xmark" },
            { label: "Leave",       value: monthSummary.Lv,         color: C.leave.color,   bg: C.leave.bg,   icon: "fa-door-open" },
          ].map(c => (
            <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", color: c.color, fontSize: 16, flexShrink: 0 }}>
                <i className={`fa-solid ${c.icon}`} />
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, color: C.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.4px" }}>{c.label}</p>
                <p style={{ fontSize: 22, fontWeight: 900, color: c.color, margin: "1px 0 0" }}>{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Register table ── */}
        {(secLoading || regLoading) ? (
          <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={36} /></div>
        ) : !sectionId || !mySections?.length ? null
        : students.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", background: C.card, borderRadius: 14, border: `1.5px dashed ${C.border}` }}>
            <i className="fa-solid fa-users" style={{ fontSize: 36, color: "#d4dde2", display: "block", marginBottom: 12 }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>No students enrolled in this section.</p>
          </div>
        ) : (
          <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: "0 2px 14px rgba(37,52,63,0.07)", overflow: "hidden" }}>

            {/* Table title */}
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 900, color: C.navy, margin: 0 }}>
                  Attendance Register — {MONTH_NAME}
                  {selectedSection && (
                    <span style={{ fontWeight: 700, color: C.muted, fontSize: 12 }}>
                      {" "}· {selectedSection.class_name} · Section {selectedSection.name}
                    </span>
                  )}
                </h2>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: "3px 0 0" }}>
                  {students.length} student{students.length !== 1 ? "s" : ""}
                  {" · "}{monthSummary.daysMarked} day{monthSummary.daysMarked !== 1 ? "s" : ""} recorded
                  {workingDayColumns.length > 0 && ` · ${workingDayColumns.length} working days this month`}
                </p>
              </div>
              {monthSummary.daysMarked === 0 && (
                <span style={{ padding: "5px 12px", borderRadius: 8, background: "#fff7ed", color: "#c2410c", fontSize: 12, fontWeight: 800, border: "1px solid #fed7aa", whiteSpace: "nowrap" }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 5 }} />No records yet
                </span>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: 12,
                tableLayout: "fixed",
                minWidth: Math.max(600, 50 + 150 + workingDayColumns.length * 38 + 4 * 44 + 90),
              }}>
                <colgroup>
                  <col style={{ width: 50 }} />
                  <col style={{ width: 150 }} />
                  {workingDayColumns.map(d => <col key={d} style={{ width: 38 }} />)}
                  <col style={{ width: 44 }} />
                  <col style={{ width: 44 }} />
                  <col style={{ width: 44 }} />
                  <col style={{ width: 44 }} />
                  <col style={{ width: 90 }} />
                </colgroup>

                <thead>
                  {/* Row 1: group headers */}
                  <tr style={{ background: C.navy }}>
                    <th colSpan={2} style={{ padding: "10px 14px", textAlign: "left", color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.5px", borderRight: `1px solid rgba(255,255,255,0.1)` }}>
                      Student
                    </th>
                    <th colSpan={workingDayColumns.length} style={{ padding: "10px 8px", textAlign: "center", color: C.orange, fontSize: 11, fontWeight: 900, letterSpacing: "0.5px", borderRight: `2px solid rgba(255,255,255,0.15)` }}>
                      {MONTH_NAME.toUpperCase()}
                    </th>
                    <th colSpan={4} style={{ padding: "10px 8px", textAlign: "center", color: C.orange, fontSize: 11, fontWeight: 900, letterSpacing: "0.5px", borderRight: `1px solid rgba(255,255,255,0.1)` }}>
                      YEAR TOTAL
                    </th>
                    <th style={{ padding: "10px 8px", textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>
                      ATT %
                    </th>
                  </tr>

                  {/* Row 2: day numbers + sub-labels */}
                  <tr style={{ background: "#f0f4f7" }}>
                    <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 900, fontSize: 10, color: C.muted, borderBottom: `2px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                      ROLL
                    </th>
                    <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 900, fontSize: 10, color: C.muted, borderBottom: `2px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                      STUDENT NAME
                    </th>
                    {workingDayColumns.map(d => {
                      const type    = getDayColType(d);
                      const isToday = `${year}-${pad(month + 1)}-${pad(d)}` === TODAY;
                      return (
                        <th key={d} style={{
                          padding: "5px 2px", textAlign: "center", fontWeight: 900, fontSize: 10,
                          color: hdrColor(type), background: hdrBg(type),
                          borderBottom: `2px solid ${isToday ? C.orange : C.border}`,
                          position: "relative",
                        }}>
                          <div style={{ lineHeight: 1.2 }}>{d}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, opacity: 0.7 }}>{getWeekdayShort(year, month, d)}</div>
                          {isToday && <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", width: 14, height: 2, background: C.orange, borderRadius: 999 }} />}
                        </th>
                      );
                    })}
                    {/* Year total sub-headers */}
                    {[
                      { l: "P",  clr: C.present.color, bg: "#f0fdf4" },
                      { l: "A",  clr: C.absent.color,  bg: "#fef2f2" },
                      { l: "Lv", clr: C.leave.color,   bg: "#eff6ff" },
                      { l: "L",  clr: C.late.color,    bg: "#fff7ed" },
                    ].map((h, i) => (
                      <th key={h.l} style={{ padding: "8px 4px", textAlign: "center", fontWeight: 900, fontSize: 10, color: h.clr, background: h.bg, borderBottom: `2px solid ${C.border}`, borderLeft: i === 0 ? `2px solid ${C.border}` : undefined }}>
                        {h.l}
                      </th>
                    ))}
                    <th style={{ padding: "8px 4px", textAlign: "center", fontWeight: 900, fontSize: 10, color: C.muted, borderBottom: `2px solid ${C.border}` }}>%</th>
                  </tr>
                </thead>

                <tbody>
                  {students.map((stu, idx) => {
                    const totals = yearTotals[stu.student_id] ?? { P: 0, A: 0, L: 0, Lv: 0, total: 0 };
                    const pct    = totals.total > 0 ? Math.round((totals.P / totals.total) * 100) : 100;
                    const rowBg  = idx % 2 === 0 ? "#fff" : "#fafcfd";
                    return (
                      <tr key={stu.student_id} style={{ background: rowBg, borderBottom: `1px solid #f1f5f9` }}>
                        <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 900, fontSize: 12, color: C.muted, borderRight: `1px solid ${C.border}` }}>
                          {stu.roll_number ?? "—"}
                        </td>
                        <td style={{ padding: "7px 14px", borderRight: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <div style={{ width: 26, height: 26, borderRadius: 7, flexShrink: 0, fontSize: 10, fontWeight: 900, background: `hsl(${(stu.student_id * 47) % 360},65%,92%)`, color: `hsl(${(stu.student_id * 47) % 360},55%,35%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {(stu.full_name ?? "?").charAt(0)}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 800, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 106 }}>
                              {stu.full_name}
                            </span>
                          </div>
                        </td>
                        {workingDayColumns.map(d => (
                          <td key={d} style={{ padding: "4px 2px", textAlign: "center" }}>
                            <Cell type={getCellType(stu.student_id, d)} />
                          </td>
                        ))}
                        <td style={{ padding: "7px 4px", textAlign: "center", borderLeft: `2px solid ${C.border}`, background: idx % 2 === 0 ? "#f0fdf4" : "#e8fdf1" }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: C.present.color }}>{totals.P}</span>
                        </td>
                        <td style={{ padding: "7px 4px", textAlign: "center", background: idx % 2 === 0 ? "#fef2f2" : "#fee8e8" }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: C.absent.color }}>{totals.A}</span>
                        </td>
                        <td style={{ padding: "7px 4px", textAlign: "center", background: idx % 2 === 0 ? "#eff6ff" : "#e8f2ff" }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: C.leave.color }}>{totals.Lv}</span>
                        </td>
                        <td style={{ padding: "7px 4px", textAlign: "center", background: idx % 2 === 0 ? "#fff7ed" : "#fef3e2" }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: C.late.color }}>{totals.L}</span>
                        </td>
                        <td style={{ padding: "7px 10px" }}>
                          <PctBar pct={pct} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Footer: day totals */}
                <tfoot>
                  <tr style={{ background: C.navy }}>
                    <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 900, fontSize: 10, color: C.orange, textTransform: "uppercase", letterSpacing: "0.4px", borderRight: `1px solid rgba(255,255,255,0.1)` }}>
                      Day Total
                    </td>
                    {workingDayColumns.map(d => {
                      const total   = getDayTotal(d);
                      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
                      const isToday = dateStr === TODAY;
                      if (!total) {
                        return (
                          <td key={d} style={{ padding: "10px 2px", textAlign: "center" }}>
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", fontWeight: 700 }}>
                              {dateStr < TODAY ? "—" : ""}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={d} style={{ padding: "6px 2px", textAlign: "center", background: isToday ? "rgba(255,155,81,0.15)" : undefined }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: "#86efac" }}>{total.p}</span>
                            <span style={{ fontSize: 9,  fontWeight: 700, color: "#fca5a5" }}>{total.a}</span>
                          </div>
                        </td>
                      );
                    })}
                    <td colSpan={5} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700, fontSize: 11, color: "rgba(255,255,255,0.45)", borderLeft: `2px solid rgba(255,255,255,0.1)` }}>
                      {monthSummary.daysMarked} day{monthSummary.daysMarked !== 1 ? "s" : ""} marked
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <style>{`
          @media (max-width: 768px) {
            main { padding: 12px 10px 40px !important; }
            div[style*="grid-template-columns: repeat(5"] { grid-template-columns: repeat(2, 1fr) !important; }
          }
        `}</style>
      </main>
    </div>
  );
}
