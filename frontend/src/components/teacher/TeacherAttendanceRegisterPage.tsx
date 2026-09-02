"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { isoToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";
import { Spinner } from "@/components/shared/Loader";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────
interface RegisterRow {
  student_id:   number;
  full_name:    string;
  roll_number?: string | null;
  date:         string | null;
  status:       "present" | "absent" | "leave" | "late" | null;
  year_present: number;
  year_absent:  number;
  year_leave:   number;
  year_total:   number;
}

interface Student {
  id:            number;
  full_name:     string;
  roll_number:   string | null;
  byDate:        Record<string, "present" | "absent" | "leave">;
  month_present: number;
  month_absent:  number;
  month_leave:   number;
  month_total:   number;
}

interface MonthOption {
  key:       string;
  label:     string;
  startDate: string;
  endDate:   string;
}

interface DayCol {
  iso:   string;
  kind:  "working" | "weekend" | "holiday";
  label: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function localDow(iso: string) { return localDate(iso).getDay(); }
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MINI  = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  for (
    let date = localDate(startDate);
    date <= localDate(endDate);
    date.setDate(date.getDate() + 1)
  ) {
    dates.push(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    );
  }
  return dates;
}

// Parse flat API rows → per-student map
function parseRows(rows: RegisterRow[]) {
  const map = new Map<number, Student>();
  for (const r of rows) {
    if (!map.has(r.student_id)) {
      map.set(r.student_id, {
        id:            r.student_id,
        full_name:     r.full_name,
        roll_number:   r.roll_number ?? null,
        byDate:        {},
        month_present: 0,
        month_absent:  0,
        month_leave:   0,
        month_total:   0,
      });
    }
    if (r.date && r.status) {
      const st = map.get(r.student_id)!;
      const s  = r.status === "late" ? "present" : r.status;
      st.byDate[r.date.slice(0, 10)] = s as "present" | "absent" | "leave";
    }
  }

  const students = [...map.values()].sort((a, b) => {
    const ra = Number(a.roll_number) || 9999;
    const rb = Number(b.roll_number) || 9999;
    return ra !== rb ? ra - rb : a.full_name.localeCompare(b.full_name);
  });

  for (const st of students) {
    for (const s of Object.values(st.byDate)) {
      if (s === "present") st.month_present++;
      else if (s === "absent") st.month_absent++;
      else if (s === "leave") st.month_leave++;
      st.month_total++;
    }
  }

  return students;
}

// ── Cell Badge ─────────────────────────────────────────────────────────────
type CellStatus = "present" | "absent" | "leave" | "remain";

const BADGE: Record<CellStatus, { cls: string; label: string }> = {
  present: { cls: "badge-p",  label: "P" },
  absent:  { cls: "badge-a",  label: "A" },
  leave:   { cls: "badge-lv", label: "Lv" },
  remain:  { cls: "badge-r",  label: "—" },
};

function AttendanceBadge({ status }: { status: CellStatus }) {
  const b = BADGE[status];
  return <span className={`att-badge ${b.cls}`}>{b.label}</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function TeacherAttendanceRegisterPage() {
  const { activeYear, academicYearId } = useAcademicYear();
  const { isBS }                       = useDateFormat();
  const { data: mySections, loading: sectionsLoading } = useApi<any[]>(
    academicYearId ? `/teachers/me/sections?academic_year_id=${academicYearId}` : ""
  );

  const today = useMemo(() => new Date(), []);

  const [sectionId,  setSectionId]  = useState("");
  const [monthKey,   setMonthKey]   = useState("");
  const [rows,       setRows]       = useState<RegisterRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [holidayMap,  setHolidayMap]  = useState<Map<string, string>>(new Map());
  // Default weekly offs: in Nepal (isBS), Saturday (6) only; in AD, Sunday (0) only
  const [weekendDows, setWeekendDows] = useState<Set<number>>(new Set(isBS ? [6] : [0]));

  // Auto-select first section
  useEffect(() => {
    if (mySections?.length && !sectionId) setSectionId(String(mySections[0].id));
  }, [mySections, sectionId]);

  // ── Month options ──
  const monthOptions = useMemo((): MonthOption[] => {
    if (!activeYear) return [];
    const opts: MonthOption[] = [];

    if (!isBS) {
      const start = localDate(String(activeYear.start_date).slice(0, 10));
      const cur   = new Date(start.getFullYear(), start.getMonth(), 1);
      const end   = new Date(today.getFullYear(), today.getMonth(), 1);
      const AD_MONTHS = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December",
      ];
      while (cur <= end) {
        const ay = cur.getFullYear(), am = cur.getMonth() + 1;
        opts.push({
          key:       `${ay}-${am}`,
          label:     `${AD_MONTHS[am - 1]} ${ay}`,
          startDate: `${ay}-${pad(am)}-01`,
          endDate:   `${ay}-${pad(am)}-${pad(new Date(ay, am, 0).getDate())}`,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
    } else {
      const startISO = String(activeYear.start_date).slice(0, 10);
      const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      const startBS  = isoToBS(startISO);
      const todayBS  = isoToBS(todayISO);
      let bsY = startBS.year, bsM = startBS.month;
      while (bsY < todayBS.year || (bsY === todayBS.year && bsM <= todayBS.month)) {
        const lastDay = daysInBSMonth(bsY, bsM);
        opts.push({
          key:       `${bsY}-${bsM}`,
          label:     `${BS_MONTH_NAMES[bsM - 1]} ${bsY}`,
          startDate: bsToISO({ year: bsY, month: bsM, day: 1 }),
          endDate:   bsToISO({ year: bsY, month: bsM, day: lastDay }),
        });
        bsM++; if (bsM > 12) { bsM = 1; bsY++; }
      }
    }

    return opts.reverse();
  }, [activeYear, today, isBS]);

  useEffect(() => {
    if (monthOptions.length && !monthKey) setMonthKey(monthOptions[0].key);
  }, [monthOptions, monthKey]);

  const selectedMonth   = monthOptions.find(o => o.key === monthKey) ?? monthOptions[0];
  const selectedSection = mySections?.find((s: any) => String(s.id) === sectionId);

  // ── Fetch register + holidays ──
  const load = useCallback(async () => {
    if (!sectionId || !academicYearId || !selectedMonth) return;
    setLoading(true); setError(null); setRows([]); setHolidayMap(new Map());
    try {
      const fallbackDate  = localDate(selectedMonth.startDate);
      const fallbackYear  = fallbackDate.getFullYear();
      const fallbackMonth = fallbackDate.getMonth() + 1;

      const [regRes, calRes] = await Promise.all([
        apiRequest<any>(
          `/attendance/section/${sectionId}/register?academic_year_id=${academicYearId}&year=${fallbackYear}&month=${fallbackMonth}&start_date=${selectedMonth.startDate}&end_date=${selectedMonth.endDate}`
        ),
        apiRequest<{ data: { id: number; weekend_type?: string } }>(
          `/calendar?academic_year_id=${academicYearId}`
        ).catch(() => null),
      ]);

      const data: RegisterRow[] = Array.isArray(regRes) ? regRes : (regRes?.data ?? []);
      setRows(data);

      // Load calendar events (holidays) + weekly offs
      if (calRes?.data?.id) {
        const calId = calRes.data.id;
        try {
          const [evRes, offRes] = await Promise.all([
            apiRequest<{ data: any[] }>(`/calendar/${calId}/events`),
            apiRequest<{ data: any[] }>(`/calendar/${calId}/weekly-offs`).catch(() => ({ data: [] })),
          ]);

          // ── Weekly offs ──
          const offs: any[] = offRes?.data ?? [];
          if (offs.length > 0) {
            setWeekendDows(new Set(offs.map((o: any) => Number(o.day_of_week))));
          } else {
            const wt = calRes.data.weekend_type;
            if (wt === "sunday_only")        setWeekendDows(new Set([0]));
            else if (wt === "both")          setWeekendDows(new Set([0, 6]));
            else                             setWeekendDows(new Set([6])); // Default: Saturday only in Nepal
          }

          // ── Holidays ──
          const events: any[] = evRes?.data ?? [];
          const allDates = buildDateRange(selectedMonth.startDate, selectedMonth.endDate);
          const hMap = new Map<string, string>();
          for (const dateStr of allDates) {
            const matchingEvent = events.find((ev: any) => {
              const start = (ev.event_date ?? "").slice(0, 10);
              const end   = (ev.end_date   ?? start).slice(0, 10);
              return dateStr >= start && dateStr <= end && ev.affects_attendance === true;
            });
            if (matchingEvent) {
              hMap.set(dateStr, matchingEvent.title || "Holiday");
            }
          }
          setHolidayMap(hMap);
        } catch { /* non-critical */ }
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load register");
    } finally {
      setLoading(false);
    }
  }, [sectionId, academicYearId, selectedMonth?.key, isBS]);

  useEffect(() => { load(); }, [load]);

  // ── Derived Data ──
  const students = useMemo(() => parseRows(rows), [rows]);

  const TODAY = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  const allDates = useMemo(() =>
    selectedMonth ? buildDateRange(selectedMonth.startDate, selectedMonth.endDate) : [],
    [selectedMonth]
  );

  const dayCols = useMemo((): DayCol[] => {
    return allDates.map(iso => {
      if (holidayMap.has(iso)) {
        return { iso, kind: "holiday", label: holidayMap.get(iso)! };
      }
      const dow = localDow(iso);
      if (weekendDows.has(dow)) {
        return { iso, kind: "weekend", label: "Weekly Off" };
      }
      return { iso, kind: "working", label: "" };
    });
  }, [allDates, holidayMap, weekendDows]);

  const workingCols = useMemo(() => dayCols.filter(c => c.kind === "working"), [dayCols]);
  const markedDays  = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.date) s.add(r.date.slice(0, 10));
    return s;
  }, [rows]);

  const getCellStatus = (st: Student, iso: string): CellStatus => {
    const s = st.byDate[iso];
    if (s) return s;
    return "remain";
  };

  const dayTotals = useMemo(() => {
    const out: Record<string, { P: number; A: number; Lv: number }> = {};
    for (const col of workingCols) {
      out[col.iso] = { P: 0, A: 0, Lv: 0 };
      for (const st of students) {
        const s = st.byDate[col.iso];
        if (s === "present") out[col.iso].P++;
        else if (s === "absent") out[col.iso].A++;
        else if (s === "leave") out[col.iso].Lv++;
      }
    }
    return out;
  }, [workingCols, students]);

  const getDisplayDay = useCallback((iso: string) => {
    if (!isBS) return String(Number(iso.slice(8, 10)));
    return String(isoToBS(iso).day);
  }, [isBS]);

  const showEmpty = !loading && !error && students.length === 0;

  // Fixed column widths
  const W_ROLL = 46;
  const W_NAME = 195;
  const W_DAY  = 34;
  const W_OFF  = 26;
  const W_TOT  = 44;

  return (
    <>
      <style>{`
        /* Badge Styles */
        .att-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: -0.2px;
          transition: transform 0.15s ease;
        }
        .att-badge:hover {
          transform: scale(1.1);
        }
        .badge-p  { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; box-shadow: 0 1px 2px rgba(22, 163, 74, 0.08); }
        .badge-a  { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; box-shadow: 0 1px 2px rgba(220, 38, 38, 0.08); }
        .badge-lv { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 9.5px; }
        .badge-r  { background: transparent; color: #cbd5e1; border: none; font-size: 13px; font-weight: 400; }

        /* Controls Bar */
        .reg-controls {
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          padding: 14px 24px;
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: center;
        }
        .reg-filter-group {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .reg-input-card {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          background: #f8fafc;
          transition: all 0.18s ease;
        }
        .reg-input-card:focus-within {
          border-color: #ff9148;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(255, 145, 72, 0.12);
        }
        .reg-input-card i {
          color: #ff9148;
          font-size: 13px;
        }
        .reg-input-inner {
          display: flex;
          flex-direction: column;
        }
        .reg-label-txt {
          font-size: 9.5px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          line-height: 1;
        }
        .reg-select {
          border: none;
          background: transparent;
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          outline: none;
          cursor: pointer;
          font-family: inherit;
          padding: 2px 0 0 0;
        }

        /* Legend */
        .reg-legend-wrap {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .leg-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #475569;
        }
        .leg-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .leg-dot.p  { background: #16a34a; }
        .leg-dot.a  { background: #dc2626; }
        .leg-dot.lv { background: #2563eb; }
        .leg-dot.r  { background: #cbd5e1; }

        .reg-meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 8px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          color: #c2410c;
          font-size: 11.5px;
          font-weight: 800;
        }

        /* Mark Button */
        .mark-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 9px;
          background: linear-gradient(135deg, #ff9148 0%, #ff7a22 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 12.5px;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.18s ease;
          box-shadow: 0 2px 6px rgba(255, 145, 72, 0.25);
        }
        .mark-btn:hover {
          background: linear-gradient(135deg, #ff7a22 0%, #ea580c 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 145, 72, 0.35);
        }

        /* Sub-header */
        .reg-subhdr {
          padding: 12px 24px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }

        /* Table Wrapper */
        .reg-wrap {
          flex: 1;
          overflow: auto;
          margin: 16px 20px 24px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f8fafc;
        }
        .reg-wrap::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }
        .reg-wrap::-webkit-scrollbar-track {
          background: #f8fafc;
          border-radius: 4px;
        }
        .reg-wrap::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .reg-wrap::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .reg-table {
          border-collapse: separate;
          border-spacing: 0;
          width: max-content;
          min-width: 100%;
        }

        /* Sticky Columns */
        .col-roll {
          position: sticky;
          left: 0;
          z-index: 4;
        }
        .col-name {
          position: sticky;
          left: 46px;
          z-index: 4;
          box-shadow: 3px 0 6px rgba(15, 23, 42, 0.04);
        }

        /* Table Head Base */
        .th-base {
          position: sticky;
          top: 0;
          padding: 8px 4px;
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          white-space: nowrap;
          border-bottom: 1px solid #e2e8f0;
          z-index: 3;
        }
        .th-roll-name {
          z-index: 6 !important;
        }

        /* Row 1 Group Banners (Light, warm theme) */
        .th-month-banner {
          background: #fff7ed;
          color: #ea580c;
          font-size: 11.5px;
          font-weight: 900;
          letter-spacing: 0.08em;
          border-bottom: 1px solid #fed7aa;
          border-right: 2px solid #e2e8f0;
        }
        .th-total-banner {
          background: #f1f5f9;
          color: #334155;
          font-size: 10px;
          font-weight: 800;
          border-left: 2px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }

        /* Day Headers */
        .th-day-working {
          background: #f8fafc;
          color: #334155;
          padding: 6px 2px;
          border-bottom: 2px solid #e2e8f0;
        }
        .th-day-working.is-today {
          background: #fff7ed;
          color: #ea580c;
          border-bottom-color: #ff9148;
        }
        .th-day-off {
          background: #f1f5f9;
          color: #94a3b8;
          padding: 6px 2px;
          border-bottom: 2px solid #e2e8f0;
        }
        .th-day-holiday {
          background: #fdf2f8;
          color: #db2777;
          padding: 6px 2px;
          border-bottom: 2px solid #fbcfe8;
        }

        /* Body Cells */
        .td-base {
          padding: 7px 4px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          text-align: center;
        }
        .td-base.is-today {
          background: #fffbf5 !important;
        }
        .td-off-weekend {
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          text-align: center;
        }
        .td-off-holiday {
          background: #fdf2f8;
          border-bottom: 1px solid #fce7f3;
          vertical-align: middle;
          text-align: center;
        }

        /* Month Totals */
        .td-tot {
          text-align: center;
          padding: 6px 5px;
          font-size: 12.5px;
          font-weight: 800;
          border-bottom: 1px solid #f1f5f9;
          border-left: 1px solid #f1f5f9;
          vertical-align: middle;
          white-space: nowrap;
        }
        .td-tot.tot-p  { color: #16a34a; }
        .td-tot.tot-a  { color: #dc2626; }
        .td-tot.tot-lv { color: #2563eb; }
        .td-tot.tot-n  { color: #0f172a; }

        /* Footer Row */
        .tr-foot td {
          background: #f8fafc;
          border-top: 2px solid #e2e8f0;
          border-bottom: none;
          padding: 8px 4px;
          text-align: center;
          font-size: 11px;
          font-weight: 800;
        }
        .foot-pinned-label {
          position: sticky;
          left: 0;
          z-index: 5;
          background: #f8fafc;
          text-align: left;
          padding-left: 14px !important;
          color: #0f172a;
          font-size: 11px;
          font-weight: 800;
          border-right: 2px solid #e2e8f0;
          box-shadow: 3px 0 6px rgba(15, 23, 42, 0.04);
        }
        .foot-stat-p { color: #16a34a; font-size: 11px; font-weight: 800; }
        .foot-stat-a { color: #dc2626; font-size: 10px; font-weight: 800; margin-top: 1px; }

        @media (max-width: 768px) {
          .reg-controls { padding: 12px 16px; }
          .reg-legend-wrap { display: none; }
          .reg-wrap { margin: 12px 10px; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 52px)", background: "#f8fafc", minWidth: 0, maxWidth: "100%" }}>

        {/* ── 1. Controls Bar ── */}
        <div className="reg-controls">
          <div className="reg-filter-group">
            {/* Section Select */}
            <div className="reg-input-card">
              <i className="fa-solid fa-users" />
              <div className="reg-input-inner">
                <span className="reg-label-txt">Section</span>
                {sectionsLoading ? (
                  <Spinner size={14} color="#ff9148" />
                ) : (
                  <select
                    value={sectionId}
                    onChange={e => setSectionId(e.target.value)}
                    className="reg-select"
                  >
                    {(mySections ?? []).map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.class_name} — Section {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Month Select */}
            <div className="reg-input-card">
              <i className="fa-solid fa-calendar-days" />
              <div className="reg-input-inner">
                <span className="reg-label-txt">Month</span>
                <select
                  value={monthKey}
                  onChange={e => setMonthKey(e.target.value)}
                  className="reg-select"
                >
                  {monthOptions.map(o => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="reg-legend-wrap">
            <span className="leg-pill">
              <span className="leg-dot p" /> Present
            </span>
            <span className="leg-pill">
              <span className="leg-dot a" /> Absent
            </span>
            <span className="leg-pill">
              <span className="leg-dot lv" /> Leave
            </span>
            <span className="leg-pill">
              <span className="leg-dot r" /> Unmarked
            </span>

            {!loading && students.length > 0 && (
              <span className="reg-meta-badge">
                <i className="fa-solid fa-user-graduate" />
                {students.length} Students · {workingCols.length} Teaching Days
              </span>
            )}
          </div>

          {/* Action CTA */}
          <Link href="/teacher/attendance/class" className="mark-btn">
            <i className="fa-solid fa-pen-to-square" /> Mark Attendance
          </Link>
        </div>

        {/* ── 2. Content States ── */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <Spinner size={36} color="#ff9148" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Loading attendance register...</span>
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#dc2626", gap: 10 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 32 }} />
            <p style={{ fontWeight: 800, margin: 0 }}>{error}</p>
          </div>
        ) : showEmpty ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: 12, padding: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, border: "1px solid #fed7aa" }}>
              <i className="fa-solid fa-calendar-xmark" />
            </div>
            <p style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", margin: 0 }}>No attendance records found</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>No attendance has been recorded for {selectedMonth?.label}. Click &quot;Mark Attendance&quot; to begin.</p>
          </div>
        ) : (
          <>
            {/* Sub-header */}
            <div className="reg-subhdr">
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                  📋 Register Overview
                </span>
                {selectedSection && (
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 700, padding: "3px 9px", background: "#f1f5f9", borderRadius: 6 }}>
                    {selectedSection.class_name} · Section {selectedSection.name}
                  </span>
                )}
                <span style={{ fontSize: 12, color: "#ea580c", fontWeight: 700, padding: "3px 9px", background: "#fff7ed", borderRadius: 6, border: "1px solid #fed7aa" }}>
                  {selectedMonth?.label}
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: markedDays.size > 0 ? "#16a34a" : "#94a3b8" }}>
                {markedDays.size} of {workingCols.length} days marked · {Math.max(0, workingCols.length - markedDays.size)} remaining
              </span>
            </div>

            {/* ── 3. Register Table ── */}
            <div className="reg-wrap">
              <table className="reg-table">
                <colgroup>
                  <col style={{ width: W_ROLL }} />
                  <col style={{ width: W_NAME }} />
                  {dayCols.map(c => (
                    <col key={c.iso} style={{ width: c.kind === "working" ? W_DAY : W_OFF }} />
                  ))}
                  {[0, 1, 2, 3].map(i => (
                    <col key={i} style={{ width: W_TOT }} />
                  ))}
                </colgroup>

                <thead>
                  {/* Row 1: Header Banners */}
                  <tr>
                    <th
                      rowSpan={2}
                      className="th-base th-roll-name col-roll"
                      style={{
                        width: W_ROLL,
                        background: "#f8fafc",
                        color: "#475569",
                        borderRight: "1px solid #e2e8f0",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Roll
                    </th>
                    <th
                      rowSpan={2}
                      className="th-base th-roll-name col-name"
                      style={{
                        width: W_NAME,
                        background: "#f8fafc",
                        color: "#0f172a",
                        borderRight: "2px solid #cbd5e1",
                        borderBottom: "1px solid #e2e8f0",
                        textAlign: "left",
                        paddingLeft: 14,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      Student Name
                    </th>
                    <th
                      colSpan={dayCols.length}
                      className="th-base th-month-banner"
                    >
                      {selectedMonth?.label.toUpperCase()}
                    </th>
                    <th
                      colSpan={4}
                      className="th-base th-total-banner"
                    >
                      Month Summary
                    </th>
                  </tr>

                  {/* Row 2: Day numbers and headers */}
                  <tr>
                    {dayCols.map(col => {
                      const isToday   = col.iso === TODAY;
                      const isWorking = col.kind === "working";

                      if (!isWorking) {
                        const isHol = col.kind === "holiday";
                        return (
                          <th
                            key={col.iso}
                            className={`th-base ${isHol ? "th-day-holiday" : "th-day-off"}`}
                            style={{
                              width: W_OFF,
                              top: 29,
                              borderRight: "1px solid #e2e8f0",
                            }}
                            title={col.label}
                          >
                            <div style={{ fontWeight: 800, fontSize: 10, lineHeight: 1 }}>
                              {getDisplayDay(col.iso)}
                            </div>
                            <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2, opacity: 0.8 }}>
                              {DAY_MINI[localDow(col.iso)]}
                            </div>
                          </th>
                        );
                      }

                      return (
                        <th
                          key={col.iso}
                          className={`th-base th-day-working ${isToday ? "is-today" : ""}`}
                          style={{
                            width: W_DAY,
                            top: 29,
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ fontWeight: 900, fontSize: 11.5, lineHeight: 1 }}>
                            {getDisplayDay(col.iso)}
                          </div>
                          <div style={{ fontSize: 8.5, fontWeight: 700, marginTop: 2, opacity: isToday ? 1 : 0.7 }}>
                            {DAY_MINI[localDow(col.iso)]}
                          </div>
                        </th>
                      );
                    })}

                    {/* Month Total Header Badges */}
                    {[
                      { lbl: "P",   cls: "tot-p",  bg: "#f0fdf4" },
                      { lbl: "A",   cls: "tot-a",  bg: "#fef2f2" },
                      { lbl: "Lv",  cls: "tot-lv", bg: "#eff6ff" },
                      { lbl: "Att%", cls: "tot-n", bg: "#f8fafc" },
                    ].map((h, i) => (
                      <th
                        key={h.lbl}
                        className={`th-base td-tot ${h.cls}`}
                        style={{
                          width: W_TOT,
                          top: 29,
                          background: h.bg,
                          borderLeft: i === 0 ? "2px solid #cbd5e1" : "1px solid #e2e8f0",
                          borderBottom: "2px solid #e2e8f0",
                        }}
                      >
                        {h.lbl}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {students.map((st, idx) => {
                    const rowBg = idx % 2 === 0 ? "#ffffff" : "#fbfcfe";
                    const pct   = st.month_total > 0
                      ? Math.round((st.month_present / st.month_total) * 100)
                      : null;
                    const pctColor = pct !== null
                      ? (pct >= 75 ? "#16a34a" : pct >= 50 ? "#ea580c" : "#dc2626")
                      : "#94a3b8";

                    return (
                      <tr key={st.id} style={{ background: rowBg }}>
                        {/* Roll */}
                        <td
                          className="td-base col-roll"
                          style={{
                            width: W_ROLL,
                            fontWeight: 800,
                            fontSize: 12,
                            color: "#64748b",
                            background: rowBg,
                            borderRight: "1px solid #e2e8f0",
                          }}
                        >
                          {st.roll_number ?? idx + 1}
                        </td>

                        {/* Student Name */}
                        <td
                          className="col-name"
                          style={{
                            padding: "8px 12px 8px 14px",
                            borderBottom: "1px solid #f1f5f9",
                            borderRight: "2px solid #cbd5e1",
                            verticalAlign: "middle",
                            background: rowBg,
                          }}
                        >
                          <span style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: "#0f172a",
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: W_NAME - 24,
                          }}>
                            {st.full_name}
                          </span>
                        </td>

                        {/* Calendar Day Cells */}
                        {dayCols.map(col => {
                          if (col.kind !== "working") {
                            const isHol = col.kind === "holiday";
                            return (
                              <td
                                key={col.iso}
                                className={isHol ? "td-off-holiday" : "td-off-weekend"}
                                style={{ width: W_OFF }}
                                title={col.label}
                              >
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: isHol ? "#db2777" : "#cbd5e1",
                                }}>
                                  {isHol ? "H" : "—"}
                                </span>
                              </td>
                            );
                          }

                          const isToday = col.iso === TODAY;
                          const status  = getCellStatus(st, col.iso);
                          return (
                            <td
                              key={col.iso}
                              className={`td-base ${isToday ? "is-today" : ""}`}
                              style={{ width: W_DAY, borderRight: "1px solid #f8fafc" }}
                            >
                              <AttendanceBadge status={status} />
                            </td>
                          );
                        })}

                        {/* Month Total Columns */}
                        <td className="td-tot tot-p"  style={{ borderLeft: "2px solid #cbd5e1", background: rowBg }}>
                          {st.month_present}
                        </td>
                        <td className="td-tot tot-a"  style={{ background: rowBg }}>
                          {st.month_absent}
                        </td>
                        <td className="td-tot tot-lv" style={{ background: rowBg }}>
                          {st.month_leave}
                        </td>
                        <td className="td-tot tot-n"  style={{ background: rowBg }}>
                          {pct !== null ? (
                            <span style={{ color: pctColor, fontWeight: 900 }}>
                              {pct}%
                            </span>
                          ) : (
                            <span style={{ color: "#cbd5e1" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── 4. Daily Attendance Totals Footer Row ── */}
                  <tr className="tr-foot">
                    <td
                      colSpan={2}
                      className="foot-pinned-label"
                    >
                      <i className="fa-solid fa-chart-simple" style={{ color: "#ff9148", marginRight: 6 }} />
                      Daily Total (Present / Absent)
                    </td>
                    {dayCols.map(col => {
                      if (col.kind !== "working") {
                        return (
                          <td
                            key={col.iso}
                            style={{
                              width: W_OFF,
                              background: col.kind === "holiday" ? "#fdf2f8" : "#f1f5f9",
                            }}
                          />
                        );
                      }
                      const t = dayTotals[col.iso];
                      const hasData = t && (t.P > 0 || t.A > 0 || t.Lv > 0);
                      return (
                        <td key={col.iso} style={{ width: W_DAY }}>
                          {hasData ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <span className="foot-stat-p">{t.P}</span>
                              <span className="foot-stat-a">{t.A}</span>
                            </div>
                          ) : (
                            <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td colSpan={4} style={{ borderLeft: "2px solid #cbd5e1", color: "#64748b", fontSize: 11 }}>
                      Summary
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
