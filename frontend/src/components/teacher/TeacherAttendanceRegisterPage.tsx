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

// Column descriptor — every calendar day is a column
interface DayCol {
  iso:     string;       // "YYYY-MM-DD"
  kind:    "working" | "weekend" | "holiday";
  label:   string;       // display text for header (e.g. "Weekly Off", "Dashain")
}

// ── Helpers ────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function localDow(iso: string) { return localDate(iso).getDay(); }
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

// ── Cell badge ─────────────────────────────────────────────────────────────
type CellStatus = "present" | "absent" | "leave" | "remain";

const BADGE: Record<CellStatus, { cls: string; label: string }> = {
  present: { cls: "badge-p",  label: "P"  },
  absent:  { cls: "badge-a",  label: "A"  },
  leave:   { cls: "badge-lv", label: "Lv" },
  remain:  { cls: "badge-r",  label: "R"  },
};

function AttendanceBadge({ status }: { status: CellStatus }) {
  const b = BADGE[status];
  return <span className={`att-badge ${b.cls}`}>{b.label}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────
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
  // Map: iso → event title (for holidays that affect attendance)
  const [holidayMap,  setHolidayMap]  = useState<Map<string, string>>(new Map());
  // Set of day-of-week numbers (0=Sun … 6=Sat) that are weekly offs for this school
  const [weekendDows, setWeekendDows] = useState<Set<number>>(new Set([0, 6])); // fallback

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
            // calendar_weekly_offs rows have day_of_week (0–6)
            setWeekendDows(new Set(offs.map((o: any) => Number(o.day_of_week))));
          } else {
            // Fallback to calendar.weekend_type
            const wt = calRes.data.weekend_type ?? "sunday_only";
            if (wt === "sunday_only")        setWeekendDows(new Set([0]));
            else if (wt === "saturday_only") setWeekendDows(new Set([6]));
            else                             setWeekendDows(new Set([0, 6]));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, academicYearId, selectedMonth?.key]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ──
  const students = useMemo(() => parseRows(rows), [rows]);

  const TODAY = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // ALL calendar dates in the month — each becomes a column
  const allDates = useMemo(() =>
    selectedMonth ? buildDateRange(selectedMonth.startDate, selectedMonth.endDate) : [],
    [selectedMonth]
  );

  // Build column descriptors (working | weekend | holiday)
  // holidays take priority over weekly offs (a holiday on a weekend is still a holiday)
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

  const workingCols  = useMemo(() => dayCols.filter(c => c.kind === "working"),  [dayCols]);
  const markedDays   = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) if (r.date) s.add(r.date.slice(0, 10));
    return s;
  }, [rows]);

  const getCellStatus = (st: Student, iso: string): CellStatus => {
    const s = st.byDate[iso];
    if (s) return s;
    return "remain";
  };

  // Day totals for working days only
  const dayTotals = useMemo(() => {
    const out: Record<string, { P: number; A: number }> = {};
    for (const col of workingCols) {
      out[col.iso] = { P: 0, A: 0 };
      for (const st of students) {
        const s = st.byDate[col.iso];
        if (s === "present") out[col.iso].P++;
        else if (s === "absent") out[col.iso].A++;
      }
    }
    return out;
  }, [workingCols, students]);

  const getDisplayDay = useCallback((iso: string) => {
    if (!isBS) return String(Number(iso.slice(8, 10)));
    return String(isoToBS(iso).day);
  }, [isBS]);

  const showEmpty = !loading && !error && students.length === 0;

  // Fixed col widths
  const W_ROLL = 48;
  const W_NAME = 190;
  const W_DAY  = 36;   // working
  const W_OFF  = 28;   // weekend / holiday (narrower)
  const W_TOT  = 46;

  return (
    <>
      {/* ── Scoped styles ── */}
      <style>{`
        /* Badge styles */
        .att-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: -0.3px;
        }
        .badge-p  { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .badge-a  { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .badge-lv { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 9px; }
        .badge-r  { background: #f8fafc; color: #cbd5e1; border: 1px dashed #e2e8f0; }

        /* Controls bar */
        .reg-controls {
          background: #fff;
          border-bottom: 1px solid #e8edf2;
          padding: 12px 20px;
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .reg-label-wrap { display: flex; flex-direction: column; gap: 3px; }
        .reg-label-txt  { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; }
        .reg-select {
          height: 38px;
          padding: 0 10px;
          border: 1.5px solid #e2e8f2;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #1e293b;
          background: #fff;
          outline: none;
          min-width: 175px;
          cursor: pointer;
          font-family: inherit;
          transition: border-color .15s;
        }
        .reg-select:focus { border-color: #FF9B51; }

        /* Legend */
        .reg-legend {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .leg-item {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
        }
        .leg-dot {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 800;
        }

        /* Mark-attendance button */
        .mark-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 14px;
          border-radius: 8px;
          background: #FF9B51;
          color: #fff;
          font-weight: 800;
          font-size: 12px;
          text-decoration: none;
          white-space: nowrap;
          transition: background .15s;
        }
        .mark-btn:hover { background: #f08840; }

        /* Sub-header */
        .reg-subhdr {
          padding: 10px 20px;
          background: #fff;
          border-bottom: 1px solid #e8edf2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 6px;
        }

        /* Table wrapper */
        .reg-wrap {
          flex: 1;
          overflow: auto;
          margin: 16px 20px 20px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.04);
        }
        .reg-table {
          border-collapse: separate;
          border-spacing: 0;
          width: max-content;
          min-width: 100%;
        }

        /* Sticky columns */
        .col-roll {
          position: sticky; left: 0; z-index: 4;
          background: inherit;
        }
        .col-name {
          position: sticky; left: ${W_ROLL}px; z-index: 4;
          background: inherit;
        }

        /* Head row styles */
        .th-base {
          position: sticky;
          top: 0;
          padding: 7px 4px;
          text-align: center;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .05em;
          white-space: nowrap;
          border-bottom: 1px solid #e2e8f0;
          z-index: 3;
        }
        .th-roll-name {
          z-index: 6 !important;
        }
        .th-month-group {
          background: #1e293b;
          color: #FF9B51;
          font-size: 11px;
          letter-spacing: .08em;
        }
        .th-total-group {
          background: #1e293b;
          color: #94a3b8;
          font-size: 10px;
        }
        /* Working day header */
        .th-working {
          background: #f8fafc;
          color: #475569;
        }
        .th-working.is-today {
          background: #fff7ed;
          color: #FF9B51;
        }
        .th-working.is-unmarked {
          background: #fef9f9;
          color: #94a3b8;
        }
        /* Weekend / holiday header — vertical text */
        .th-off {
          background: #f1f5f9;
          color: #94a3b8;
          font-size: 9px;
          padding: 4px 2px;
          vertical-align: bottom;
        }
        .th-off-inner {
          writing-mode: vertical-lr;
          transform: rotate(180deg);
          white-space: nowrap;
          max-height: 72px;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 700;
          font-size: 9px;
          letter-spacing: .03em;
          color: #94a3b8;
          display: block;
          line-height: 1.2;
        }
        .th-off.is-weekend .th-off-inner { color: #94a3b8; }
        .th-off.is-holiday .th-off-inner { color: #f472b6; }

        /* Sub-header row (day numbers) */
        .th-day-num {
          padding: 5px 2px;
          border-bottom: 2px solid #e2e8f0;
        }
        .th-day-num.is-today { border-bottom-color: #FF9B51; }

        /* Body cells */
        .td-base {
          padding: 6px 4px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          text-align: center;
        }
        .td-base.is-today { background: #fffbf5 !important; }
        .td-off {
          background: #f8fafc;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          position: relative;
        }
        .td-off::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: #cbd5e1;
          border-radius: 0;
        }
        .td-off.is-holiday {
          background: #fff5f5;
        }
        .td-off.is-holiday::before {
          background: #ef4444;
        }

        /* Total cells */
        .td-tot {
          text-align: center;
          padding: 6px 5px;
          font-size: 13px;
          font-weight: 800;
          border-bottom: 1px solid #f1f5f9;
          border-left: 1px solid #e8edf2;
          vertical-align: middle;
          white-space: nowrap;
        }
        .td-tot.tot-p  { color: #16a34a; }
        .td-tot.tot-a  { color: #dc2626; }
        .td-tot.tot-lv { color: #2563eb; }
        .td-tot.tot-n  { color: #334155; }

        /* Footer day-total row */
        .tr-foot td {
          background: #f8fafc;
          border-top: 2px solid #e2e8f0;
          border-bottom: none;
          padding: 6px 4px;
          text-align: center;
          font-size: 11px;
          font-weight: 800;
        }
        .foot-label {
          position: sticky;
          left: 0;
          z-index: 2;
          background: #f8fafc;
          text-align: right;
          padding-right: 12px;
          color: #b45309;
          font-size: 10px;
          letter-spacing: .05em;
          border-right: 2px solid #e2e8f0;
        }
        .foot-p { color: #16a34a; line-height: 1.3; }
        .foot-a { color: #dc2626; line-height: 1.3; }

        /* Responsive */
        @media (max-width: 640px) {
          .reg-controls { padding: 10px 12px; gap: 10px; }
          .reg-wrap     { margin: 12px 10px 16px; }
          .reg-select   { min-width: 140px; font-size: 12px; }
          .reg-legend   { display: none; }
          .mark-btn     { padding: 8px 10px; font-size: 11px; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 52px)", background: "#f6f8fa" }}>

        {/* ── Controls ── */}
        <div className="reg-controls">
          <div className="reg-label-wrap">
            <span className="reg-label-txt">Section</span>
            {sectionsLoading
              ? <div style={{ height: 38, display: "flex", alignItems: "center" }}><Spinner size={16} color="#ff9b51" /></div>
              : <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="reg-select">
                  {(mySections ?? []).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.class_name} — Section {s.name}</option>
                  ))}
                </select>
            }
          </div>

          <div className="reg-label-wrap">
            <span className="reg-label-txt">Month</span>
            <select value={monthKey} onChange={e => setMonthKey(e.target.value)} className="reg-select">
              {monthOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          {/* Legend */}
          <div className="reg-legend">
            {([
              { label: "P",  cls: "badge-p",  name: "Present" },
              { label: "A",  cls: "badge-a",  name: "Absent"  },
              { label: "Lv", cls: "badge-lv", name: "Leave"   },
              { label: "R",  cls: "badge-r",  name: "Remain"  },
            ] as const).map(i => (
              <span key={i.name} className="leg-item">
                <span className={`leg-dot ${i.cls}`}>{i.label}</span>
                {i.name}
              </span>
            ))}
            {!loading && students.length > 0 && (
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginLeft: 4 }}>
                {students.length} students · {workingCols.length} working days
              </span>
            )}
          </div>

          <Link href="/teacher/attendance/class" className="mark-btn">
            <i className="fa-solid fa-clipboard-check" /> Mark Attendance
          </Link>
        </div>

        {/* ── States ── */}
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner size={36} color="#ff9b51" />
          </div>
        ) : error ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#dc2626", gap: 10 }}>
            <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 32 }} />
            <p style={{ fontWeight: 700, margin: 0 }}>{error}</p>
          </div>
        ) : showEmpty ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", gap: 10 }}>
            <i className="fa-solid fa-table-list" style={{ fontSize: 40, opacity: 0.2 }} />
            <p style={{ fontWeight: 800, fontSize: 14, margin: 0 }}>No attendance marked for {selectedMonth?.label}</p>
            <p style={{ fontSize: 12, margin: 0 }}>Try a different month or mark attendance first.</p>
          </div>
        ) : (
          <>
            {/* Sub-header */}
            <div className="reg-subhdr">
              <div>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>
                  Attendance Register — {selectedMonth?.label}
                </span>
                {selectedSection && (
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginLeft: 10 }}>
                    {selectedSection.class_name} · Section {selectedSection.name}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
                {markedDays.size} day{markedDays.size !== 1 ? "s" : ""} marked · {workingCols.length - markedDays.size} remaining
              </span>
            </div>

            {/* ── REGISTER TABLE ── */}
            <div className="reg-wrap">
              <table className="reg-table">
                <colgroup>
                  <col style={{ width: W_ROLL }} />
                  <col style={{ width: W_NAME }} />
                  {dayCols.map(c => (
                    <col key={c.iso} style={{ width: c.kind === "working" ? W_DAY : W_OFF }} />
                  ))}
                  {[0,1,2,3].map(i => <col key={i} style={{ width: W_TOT }} />)}
                </colgroup>

                <thead>
                  {/* Row 1: Group labels */}
                  <tr>
                    {/* Roll – sticky */}
                    <th
                      rowSpan={2}
                      className="th-base th-roll-name col-roll"
                      style={{
                        width: W_ROLL, left: 0,
                        background: "#1e293b", color: "#64748b",
                        borderRight: "1px solid #334155",
                        fontSize: 9,
                      }}
                    >
                      Roll
                    </th>
                    {/* Name – sticky */}
                    <th
                      rowSpan={2}
                      className="th-base th-roll-name col-name"
                      style={{
                        width: W_NAME, left: W_ROLL,
                        background: "#1e293b", color: "#64748b",
                        borderRight: "2px solid #2d3f55",
                        textAlign: "left", paddingLeft: 14,
                        fontSize: 10,
                      }}
                    >
                      Student Name
                    </th>
                    {/* Month group */}
                    <th
                      colSpan={dayCols.length}
                      className="th-base th-month-group"
                      style={{ zIndex: 3, borderRight: "2px solid #2d3f55", borderBottom: "1px solid #2d3f55" }}
                    >
                      {selectedMonth?.label.toUpperCase()}
                    </th>
                    {/* Month total group */}
                    <th
                      colSpan={4}
                      className="th-base th-total-group"
                      style={{ zIndex: 3, borderLeft: "2px solid #2d3f55", borderBottom: "1px solid #2d3f55" }}
                    >
                      Month Total
                    </th>
                  </tr>

                  {/* Row 2: Day headers */}
                  <tr>
                    {dayCols.map(col => {
                      const isToday   = col.iso === TODAY;
                      const isWorking = col.kind === "working";

                      if (!isWorking) {
                        // Weekend / holiday — vertical label
                        return (
                          <th
                            key={col.iso}
                            className={`th-base th-off th-day-num ${col.kind === "holiday" ? "is-holiday" : "is-weekend"}`}
                            style={{
                              width: W_OFF, top: 25, zIndex: 3,
                              borderRight: "1px solid #e8edf2",
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 10, color: col.kind === "holiday" ? "#c084fc" : "#cbd5e1", lineHeight: 1, marginBottom: 2 }}>
                              {getDisplayDay(col.iso)}
                            </div>
                            <div style={{ fontSize: 8, color: col.kind === "holiday" ? "#c084fc" : "#cbd5e1", marginBottom: 3 }}>
                              {DAY_SHORT[localDow(col.iso)]}
                            </div>
                            <span className="th-off-inner">{col.label}</span>
                          </th>
                        );
                      }

                      // Working day
                      const isUnmarked = col.iso < TODAY && !markedDays.has(col.iso);
                      return (
                        <th
                          key={col.iso}
                          className={`th-base th-working th-day-num ${isToday ? "is-today" : ""} ${isUnmarked ? "is-unmarked" : ""}`}
                          style={{
                            width: W_DAY, top: 25, zIndex: 3,
                            borderRight: "1px solid #e8edf2",
                          }}
                        >
                          <div style={{ fontWeight: 900, fontSize: 12, lineHeight: 1 }}>{getDisplayDay(col.iso)}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, marginTop: 2, opacity: 0.7 }}>{DAY_SHORT[localDow(col.iso)]}</div>
                          {isToday && (
                            <div style={{ width: 12, height: 2, background: "#FF9B51", borderRadius: 99, margin: "3px auto 0" }} />
                          )}
                        </th>
                      );
                    })}

                    {/* Month total sub-headers */}
                    {[
                      { lbl: "P",   cls: "tot-p",  bg: "#f0fdf4" },
                      { lbl: "A",   cls: "tot-a",  bg: "#fef2f2" },
                      { lbl: "Lv",  cls: "tot-lv", bg: "#eff6ff" },
                      { lbl: "Tot", cls: "tot-n",  bg: "#f8fafc" },
                    ].map((h, i) => (
                      <th
                        key={h.lbl}
                        className={`th-base td-tot ${h.cls}`}
                        style={{
                          width: W_TOT, top: 25, zIndex: 3,
                          background: h.bg,
                          borderLeft: i === 0 ? "2px solid #e2e8f0" : "1px solid #e8edf2",
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
                    const rowBg = idx % 2 === 0 ? "#ffffff" : "#fafbfc";
                    const pct   = st.month_total > 0
                      ? Math.round((st.month_present / st.month_total) * 100)
                      : null;
                    const pctColor = pct !== null
                      ? (pct >= 75 ? "#16a34a" : "#dc2626")
                      : "#94a3b8";

                    return (
                      <tr key={st.id} style={{ background: rowBg }}>
                        {/* Roll */}
                        <td
                          className="td-base col-roll"
                          style={{
                            width: W_ROLL,
                            fontWeight: 800, fontSize: 12, color: "#64748b",
                            borderRight: "1px solid #e8edf2",
                          }}
                        >
                          {st.roll_number ?? idx + 1}
                        </td>

                        {/* Name */}
                        <td
                          className="col-name"
                          style={{
                            position: "sticky", left: W_ROLL, zIndex: 2,
                            padding: "8px 8px 8px 14px",
                            borderBottom: "1px solid #f1f5f9",
                            borderRight: "2px solid #e8edf2",
                            verticalAlign: "middle",
                            background: rowBg,
                          }}
                        >
                          <span style={{
                            fontWeight: 700, fontSize: 13, color: "#1e293b",
                            display: "block", whiteSpace: "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis",
                            maxWidth: W_NAME - 24,
                          }}>
                            {st.full_name}
                          </span>
                        </td>

                        {/* Day cells — ALL calendar days */}
                        {dayCols.map(col => {
                          if (col.kind !== "working") {
                            // Weekend / holiday — shaded with small label
                            const isHol = col.kind === "holiday";
                            return (
                              <td
                                key={col.iso}
                                className={`td-off ${isHol ? "is-holiday" : ""}`}
                                style={{ width: W_OFF, textAlign: "center", verticalAlign: "middle" }}
                              >
                                <span style={{
                                  display: "inline-block",
                                  fontSize: 9,
                                  fontWeight: 800,
                                  color: isHol ? "#c084fc" : "#cbd5e1",
                                  letterSpacing: "-0.2px",
                                  lineHeight: 1,
                                }}>
                                  {isHol ? "H" : "Off"}
                                </span>
                              </td>
                            );
                          }
                          // Working day
                          const isToday  = col.iso === TODAY;
                          const status   = getCellStatus(st, col.iso);
                          return (
                            <td
                              key={col.iso}
                              className={`td-base ${isToday ? "is-today" : ""}`}
                              style={{ width: W_DAY, borderRight: "1px solid #f1f5f9" }}
                            >
                              <AttendanceBadge status={status} />
                            </td>
                          );
                        })}

                        {/* Month totals */}
                        <td className="td-tot tot-p"  style={{ borderLeft: "2px solid #e2e8f0", background: rowBg }}>{st.month_present}</td>
                        <td className="td-tot tot-a"  style={{ background: rowBg }}>{st.month_absent}</td>
                        <td className="td-tot tot-lv" style={{ background: rowBg }}>{st.month_leave}</td>
                        <td className="td-tot tot-n"  style={{ background: rowBg }}>
                          {st.month_total}
                          {pct !== null && (
                            <div style={{ fontSize: 9, fontWeight: 700, color: pctColor, marginTop: 1 }}>
                              {pct}%
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Day total footer */}
                  <tr className="tr-foot">
                    <td
                      colSpan={2}
                      className="foot-label"
                      style={{ width: W_ROLL + W_NAME }}
                    >
                      Day Total
                    </td>
                    {dayCols.map(col => {
                      if (col.kind !== "working") {
                        return (
                          <td
                            key={col.iso}
                            style={{ width: W_OFF, background: col.kind === "holiday" ? "#fdf4ff" : "#f1f5f9" }}
                          />
                        );
                      }
                      const t = dayTotals[col.iso];
                      const hasData = t && (t.P > 0 || t.A > 0);
                      return (
                        <td key={col.iso} style={{ width: W_DAY }}>
                          {hasData ? (
                            <>
                              <div className="foot-p">{t.P}</div>
                              <div className="foot-a">{t.A}</div>
                            </>
                          ) : (
                            <span style={{ color: "#e2e8f0", fontSize: 10 }}>
                              {col.iso < TODAY ? "—" : ""}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td colSpan={4} style={{ borderLeft: "2px solid #e2e8f0" }} />
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
