"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { isoToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";
import { Loader } from "@/components/shared/Loader";

// -- Types ------------------------------------------------------------------
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
  iso:     string;       // "YYYY-MM-DD"
  kind:    "working" | "weekend" | "holiday";
  label:   string;
  dayNum:  number;
  dowName: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

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

type CellStatus = "present" | "absent" | "leave" | "remain";

const BADGE: Record<CellStatus, { cls: string; label: string }> = {
  present: { cls: "badge-p",  label: "P"  },
  absent:  { cls: "badge-a",  label: "A"  },
  leave:   { cls: "badge-lv", label: "Lv" },
  remain:  { cls: "badge-r",  label: "-"  },
};

function AttendanceBadge({ status }: { status: CellStatus }) {
  const b = BADGE[status];
  return <span className={`att-badge ${b.cls}`}>{b.label}</span>;
}

function ClassAttendanceRegisterContent() {
  const searchParams = useSearchParams();
  const urlClassId   = searchParams.get("class_id");
  const urlSectionId = searchParams.get("section_id");

  const { activeYear, academicYearId } = useAcademicYear();
  const { isBS }                       = useDateFormat();

  const { data: classes } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const [classId, setClassId]       = useState<string>(urlClassId || "");
  const [sectionId, setSectionId]   = useState<string>(urlSectionId || "");
  const [sections, setSections]     = useState<any[]>([]);
  const [monthKey, setMonthKey]     = useState<string>("");
  const [rows, setRows]             = useState<RegisterRow[]>([]);
  const [loading, setLoading]       = useState<boolean>(false);
  const [error, setError]           = useState<string | null>(null);
  const [holidayMap, setHolidayMap] = useState<Map<string, string>>(new Map());
  const [weekendDows, setWeekendDows] = useState<Set<number>>(new Set([0, 6]));

  const today = useMemo(() => new Date(), []);

  // Auto-select first class if none selected
  useEffect(() => {
    if (classes?.length && !classId) {
      setClassId(String(classes[0].id));
    }
  }, [classes, classId]);

  // Load sections when classId changes
  useEffect(() => {
    if (!classId) return;
    apiRequest<{ data?: any[] } | any[]>(`/classes/${classId}/sections`)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setSections(list);
        if (list.length > 0) {
          const found = list.find((s: any) => String(s.id) === urlSectionId);
          if (found) {
            setSectionId(String(found.id));
          } else if (!list.some((s: any) => String(s.id) === sectionId)) {
            setSectionId(String(list[0].id));
          }
        } else {
          setSectionId("");
        }
      })
      .catch(() => setSections([]));
  }, [classId, urlSectionId]);

  // Month Options Generation
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
  const selectedSection = sections.find((s: any) => String(s.id) === sectionId);
  const selectedClass   = classes?.find((c: any) => String(c.id) === classId);

  // Fetch register rows & calendar events
  const loadRegister = useCallback(async () => {
    if (!sectionId || !academicYearId || !selectedMonth) return;
    setLoading(true);
    setError(null);
    setRows([]);
    setHolidayMap(new Map());

    try {
      const [regRes, calRes] = await Promise.all([
        apiRequest<any>(
          `/attendance/section/${sectionId}/register?academic_year_id=${academicYearId}&start_date=${selectedMonth.startDate}&end_date=${selectedMonth.endDate}`
        ),
        apiRequest<{ data: { id: number; weekend_type?: string } }>(
          `/calendar?academic_year_id=${academicYearId}`
        ).catch(() => null),
      ]);

      const data: RegisterRow[] = Array.isArray(regRes) ? regRes : (regRes?.data ?? []);
      setRows(data);

      if (calRes?.data?.id) {
        const calId = calRes.data.id;
        try {
          const [evRes, offRes] = await Promise.all([
            apiRequest<{ data: any[] }>(`/calendar/${calId}/events`),
            apiRequest<{ data: any[] }>(`/calendar/${calId}/weekly-offs`).catch(() => ({ data: [] })),
          ]);

          const offs: any[] = offRes?.data ?? [];
          if (offs.length > 0) {
            setWeekendDows(new Set(offs.map((o: any) => Number(o.day_of_week))));
          } else {
            const wt = calRes.data.weekend_type ?? "sunday_only";
            if (wt === "sunday_only")        setWeekendDows(new Set([0]));
            else if (wt === "saturday_only") setWeekendDows(new Set([6]));
            else                             setWeekendDows(new Set([0, 6]));
          }

          const events: any[] = evRes?.data ?? [];
          const hMap = new Map<string, string>();
          for (const ev of events) {
            if (ev.affects_attendance || ev.event_type === "holiday") {
              const startStr = String(ev.event_date).slice(0, 10);
              const endStr   = ev.end_date ? String(ev.end_date).slice(0, 10) : startStr;
              const sObj = localDate(startStr);
              const eObj = localDate(endStr);
              for (let cur = new Date(sObj); cur <= eObj; cur.setDate(cur.getDate() + 1)) {
                const curISO = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
                hMap.set(curISO, ev.title);
              }
            }
          }
          setHolidayMap(hMap);
        } catch {}
      }
    } catch (err: any) {
      setError(err.message || "Failed to load register.");
    } finally {
      setLoading(false);
    }
  }, [sectionId, academicYearId, selectedMonth]);

  useEffect(() => {
    loadRegister();
  }, [loadRegister]);

  // Build Day Columns
  const dayCols = useMemo((): DayCol[] => {
    if (!selectedMonth) return [];
    const dates = buildDateRange(selectedMonth.startDate, selectedMonth.endDate);

    return dates.map(iso => {
      const dow = localDate(iso).getDay();
      const dowName = DAY_SHORT[dow];
      const isOff = weekendDows.has(dow);
      const isHol = holidayMap.has(iso);

      let dayNum = localDate(iso).getDate();
      if (isBS) {
        try {
          const bs = isoToBS(iso);
          dayNum = bs.day;
        } catch {}
      }

      if (isHol) {
        return { iso, kind: "holiday", label: holidayMap.get(iso)!, dayNum, dowName };
      }
      if (isOff) {
        return { iso, kind: "weekend", label: "Weekly Off", dayNum, dowName };
      }
      return { iso, kind: "working", label: "", dayNum, dowName };
    });
  }, [selectedMonth, weekendDows, holidayMap, isBS]);

  const students = useMemo(() => parseRows(rows), [rows]);

  // Aggregate Stats
  const workingDayCols = dayCols.filter(c => c.kind === "working");
  const totalWorkingDays = workingDayCols.length;
  const totalEnrolled = students.length;
  const totalPresents = students.reduce((acc, s) => acc + s.month_present, 0);
  const maxPossible = totalEnrolled * totalWorkingDays;
  const avgAttendanceRate = maxPossible > 0 ? Math.round((totalPresents / maxPossible) * 100) : 0;

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!students.length) return;
    const dateHeaders = dayCols.map(c => `"${c.dayNum} ${c.dowName}"`);
    const headers = ["Roll No", "Student Name", ...dateHeaders, "Month Present", "Month Absent", "Month Leave", "Attendance %"];

    const csvRows = students.map(st => {
      const dayValues = dayCols.map(col => {
        const s = st.byDate[col.iso];
        if (s === "present") return `"P"`;
        if (s === "absent")  return `"A"`;
        if (s === "leave")   return `"Lv"`;
        if (col.kind === "holiday") return `"HOL"`;
        if (col.kind === "weekend") return `"OFF"`;
        return `"-"`;
      });
      const pct = totalWorkingDays > 0 ? Math.round((st.month_present / totalWorkingDays) * 100) : 0;
      return [
        `"${st.roll_number || ""}"`,
        `"${st.full_name.replace(/"/g, '""')}"`,
        ...dayValues,
        st.month_present,
        st.month_absent,
        st.month_leave,
        `"${pct}%"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Attendance_Register_${selectedClass?.name || "Class"}_${selectedSection?.name || "Section"}_${selectedMonth?.label || "Month"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8faff", display: "flex", flexDirection: "column" }}>
      <style>{`
        .att-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 800;
        }
        .badge-p  { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .badge-a  { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .badge-lv { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 9px; }
        .badge-r  { background: #f8fafc; color: #cbd5e1; border: 1px dashed #e2e8f0; }

        .reg-table th, .reg-table td {
          border: 1px solid #e2e8f0;
          padding: 8px 6px;
          text-align: center;
        }
        .reg-table th {
          background: #f8fafc;
          font-size: 11px;
          font-weight: 800;
          color: #475569;
        }
        .off-col {
          background: #f1f5f9 !important;
          color: #94a3b8;
        }
        .hol-col {
          background: #fff7ed !important;
          color: #ea580c;
        }
      `}</style>

      {/* -- Page Header -- */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/attendance"
            style={{
              width: 36, height: 36, borderRadius: 8, border: "1.5px solid #e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#64748b", textDecoration: "none", background: "#fff",
            }}
            title="Back to Attendance Overview"
          >
            <i className="fa-solid fa-arrow-left" />
          </Link>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: 0 }}>
              Monthly Attendance Register
            </h1>
            <p style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, margin: "2px 0 0" }}>
              Read-only monthly attendance sheets and student matrices for administrators.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleExportCSV}
            disabled={!students.length}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
              background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12.5,
              cursor: students.length ? "pointer" : "not-allowed", opacity: students.length ? 1 : 0.6,
            }}
          >
            <i className="fa-solid fa-file-csv" style={{ color: "#059669" }} /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!students.length}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
              background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12.5,
              cursor: students.length ? "pointer" : "not-allowed",
            }}
          >
            <i className="fa-solid fa-print" style={{ color: "#3b82f6" }} /> Print
          </button>
        </div>
      </div>

      {/* -- Toolbar: Class, Section, Month Pickers & Legend -- */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Class selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Class</span>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              style={{
                height: 36, padding: "0 10px", borderRadius: 7, border: "1.5px solid #e2e8f0",
                fontSize: 12.5, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer",
              }}
            >
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id.toString()}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Section selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Section</span>
            <select
              value={sectionId}
              onChange={e => setSectionId(e.target.value)}
              disabled={!sections.length}
              style={{
                height: 36, padding: "0 10px", borderRadius: 7, border: "1.5px solid #e2e8f0",
                fontSize: 12.5, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer",
              }}
            >
              {sections.map((s: any) => (
                <option key={s.id} value={s.id.toString()}>Section {s.name}</option>
              ))}
            </select>
          </div>

          {/* Month selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Month</span>
            <select
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              style={{
                height: 36, padding: "0 10px", borderRadius: 7, border: "1.5px solid #e2e8f0",
                fontSize: 12.5, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer", minWidth: 160,
              }}
            >
              {monthOptions.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="att-badge badge-p" style={{ width: 18, height: 18, fontSize: 10 }}>P</span> Present
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="att-badge badge-a" style={{ width: 18, height: 18, fontSize: 10 }}>A</span> Absent
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span className="att-badge badge-lv" style={{ width: 18, height: 18, fontSize: 9 }}>Lv</span> Leave
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 18, height: 18, background: "#f1f5f9", borderRadius: 4, border: "1px solid #cbd5e1" }} /> Off/Hol
          </span>
        </div>
      </div>

      {/* -- Content Body -- */}
      <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Section Info Banner */}
        <div style={{
          background: "#fff", borderRadius: 12, border: "1.5px solid #e2e8f0",
          padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8, background: "#eff6ff",
              color: "#1e40af", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16,
            }}>
              {selectedSection?.name || "-"}
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                {selectedClass?.name || "Class"} - Section {selectedSection?.name || "Section"}
              </h2>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                <i className="fa-solid fa-user-tie" style={{ color: "#ff9b51", marginRight: 4 }} />
                Coordinator: {selectedSection?.coordinator_name || "Assigned Teacher"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Enrolled</span>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{totalEnrolled}</div>
            </div>
            <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Working Days</span>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{totalWorkingDays}</div>
            </div>
            <div style={{ width: 1, height: 28, background: "#e2e8f0" }} />
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Avg Attendance</span>
              <div style={{ fontSize: 16, fontWeight: 900, color: avgAttendanceRate >= 75 ? "#16a34a" : "#ea580c" }}>
                {avgAttendanceRate}%
              </div>
            </div>
          </div>
        </div>

        {/* Register Table Matrix */}
        <div style={{
          background: "#fff", borderRadius: 12, border: "1.5px solid #e2e8f0",
          overflow: "hidden", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
        }}>
          {loading ? (
            <div style={{ padding: "4rem 1rem", textAlign: "center" }}>
              <Loader fullScreen={false} size="md" text="Loading attendance register…" />
            </div>
          ) : error ? (
            <div style={{ padding: "3rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{error}</div>
          ) : students.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#64748b" }}>
              <i className="fa-solid fa-users-slash" style={{ fontSize: 36, opacity: 0.35, marginBottom: 10, display: "block" }} />
              <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>No students enrolled in this section</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Enroll students in this class section to view attendance.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="reg-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 45, position: "sticky", left: 0, zIndex: 2, background: "#f8fafc" }}>#</th>
                    <th style={{ minWidth: 160, textAlign: "left", paddingLeft: 12, position: "sticky", left: 45, zIndex: 2, background: "#f8fafc" }}>Student</th>
                    {dayCols.map(col => (
                      <th
                        key={col.iso}
                        className={col.kind === "weekend" ? "off-col" : col.kind === "holiday" ? "hol-col" : ""}
                        style={{ minWidth: 32, padding: "4px 2px" }}
                        title={col.label || col.iso}
                      >
                        <div style={{ fontSize: 11, fontWeight: 900 }}>{col.dayNum}</div>
                        <div style={{ fontSize: 9, opacity: 0.75 }}>{col.dowName}</div>
                      </th>
                    ))}
                    <th style={{ minWidth: 38, background: "#f0fdf4", color: "#16a34a" }}>P</th>
                    <th style={{ minWidth: 38, background: "#fef2f2", color: "#dc2626" }}>A</th>
                    <th style={{ minWidth: 38, background: "#eff6ff", color: "#2563eb" }}>Lv</th>
                    <th style={{ minWidth: 50 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((st, idx) => {
                    const pct = totalWorkingDays > 0 ? Math.round((st.month_present / totalWorkingDays) * 100) : 0;
                    return (
                      <tr key={st.id} style={{ background: idx % 2 === 1 ? "#fafbfc" : "#fff" }}>
                        <td style={{ fontWeight: 800, color: "#64748b", position: "sticky", left: 0, background: idx % 2 === 1 ? "#fafbfc" : "#fff" }}>
                          {st.roll_number || idx + 1}
                        </td>
                        <td style={{ textAlign: "left", paddingLeft: 12, fontWeight: 800, color: "#0f172a", position: "sticky", left: 45, background: idx % 2 === 1 ? "#fafbfc" : "#fff", whiteSpace: "nowrap" }}>
                          {st.full_name}
                        </td>
                        {dayCols.map(col => {
                          const s = st.byDate[col.iso];
                          if (s) {
                            const isOnHoliday = col.kind === "holiday";
                            const isOnWeekend = col.kind === "weekend";
                            return (
                              <td
                                key={col.iso}
                                style={{
                                  padding: "4px 2px",
                                  background: isOnHoliday ? "#fff7ed" : isOnWeekend ? "#f8fafc" : undefined,
                                }}
                                title={isOnHoliday ? `${col.label} (Attended: ${s})` : isOnWeekend ? `Weekend (Attended: ${s})` : s}
                              >
                                <AttendanceBadge status={s} />
                              </td>
                            );
                          }

                          if (col.kind === "holiday") {
                            return (
                              <td key={col.iso} className="hol-col" style={{ padding: "4px 2px" }} title={col.label}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 24, height: 24, borderRadius: 5, fontSize: 10, fontWeight: 900,
                                  background: "#fff4e6", color: "#ea580c", border: "1px solid #fdd5b0",
                                }}>
                                  H
                                </span>
                              </td>
                            );
                          }
                          if (col.kind === "weekend") {
                            return <td key={col.iso} className="off-col" style={{ fontSize: 10 }} title="Weekly Off">-</td>;
                          }

                          return (
                            <td key={col.iso} style={{ padding: "4px 2px" }}>
                              <AttendanceBadge status="remain" />
                            </td>
                          );
                        })}
                        <td style={{ fontWeight: 900, color: "#16a34a" }}>{st.month_present}</td>
                        <td style={{ fontWeight: 900, color: "#dc2626" }}>{st.month_absent}</td>
                        <td style={{ fontWeight: 900, color: "#2563eb" }}>{st.month_leave}</td>
                        <td style={{ fontWeight: 900, color: pct >= 75 ? "#16a34a" : "#ea580c" }}>
                          {totalWorkingDays > 0 ? `${pct}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function ClassAttendanceRegisterPage() {
  return (
    <Suspense fallback={<div style={{ padding: "4rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading attendance register…" /></div>}>
      <ClassAttendanceRegisterContent />
    </Suspense>
  );
}
