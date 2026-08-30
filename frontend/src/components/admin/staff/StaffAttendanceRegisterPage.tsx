"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Spinner } from "@/components/shared/Loader";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { isoToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";

// ── Types ──────────────────────────────────────────────────────────────────────
type AttStatus = "present" | "absent" | "leave" | "half_day";

interface MonthOption {
  key:       string;
  label:     string;
  startDate: string;
  endDate:   string;
}

interface RegisterRow {
  person_type: "staff" | "teacher";
  person_id:   number;
  full_name:   string;
  phone?:      string;
  email?:      string;
  role_name:   string;
  date:        string | null;
  status:      "present" | "absent" | "leave" | "half_day" | null;
  note?:       string | null;
}

interface StaffMatrixPerson {
  key:            string;
  person_id:      number;
  person_type:    "staff" | "teacher";
  full_name:      string;
  phone?:         string;
  email?:         string;
  role_name:      string;
  byDate:         Record<string, AttStatus>;
  month_present:  number;
  month_absent:   number;
  month_leave:    number;
  month_half_day: number;
  month_total:    number;
}

interface DayCol {
  iso:     string;
  kind:    "working" | "weekend" | "holiday";
  label:   string;
  dayNum:  number;
  dowName: string;
}

const STATUS_CONFIG: Record<AttStatus, {
  label: string; short: string; bg: string; color: string; border: string;
}> = {
  present:  { label: "Present",  short: "P",  bg: "#e2f6ee", color: "#16a34a", border: "#16a34a" },
  absent:   { label: "Absent",   short: "A",  bg: "#fde7e7", color: "#dc2626", border: "#dc2626" },
  leave:    { label: "Leave",    short: "Lv", bg: "#f3eeff", color: "#7c3aed", border: "#7c3aed" },
  half_day: { label: "Half Day", short: "½",  bg: "#fff4e6", color: "#ea580c", border: "#ea580c" },
};

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

export function StaffAttendanceRegisterPage() {
  const { isBS } = useDateFormat();
  const { activeYear, academicYearId } = useAcademicYear();

  const { data: staffList }   = useApi<any[]>("/staff");
  const { data: teacherList } = useApi<any[]>("/teachers");

  const allPeople = useMemo(() => [
    ...(teacherList ?? []).filter((m: any) => m.status !== "inactive").map((m: any) => ({ ...m, _type: "teacher" as const })),
    ...(staffList   ?? []).filter((m: any) => m.status !== "terminated").map((m: any) => ({ ...m, _type: "staff" as const })),
  ], [staffList, teacherList]);

  const today = useMemo(() => new Date(), []);
  const [monthKey, setMonthKey]       = useState<string>("");
  const [search, setSearch]           = useState<string>("");
  const [roleFilter, setRoleFilter]   = useState<"all" | "teacher" | "staff">("all");
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [regLoading, setRegLoading]   = useState<boolean>(true);
  const [regError, setRegError]       = useState<string | null>(null);
  const [holidayMap, setHolidayMap]   = useState<Map<string, string>>(new Map());
  const [weekendDows, setWeekendDows] = useState<Set<number>>(new Set([0, 6]));

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

  const selectedMonth = monthOptions.find(o => o.key === monthKey) ?? monthOptions[0];

  const loadMonthlyRegister = useCallback(async () => {
    if (!selectedMonth) return;
    setRegLoading(true);
    setRegError(null);
    setRegisterRows([]);
    setHolidayMap(new Map());

    try {
      const [regRes, calRes] = await Promise.all([
        apiRequest<any>(`/staff/attendance/register?start_date=${selectedMonth.startDate}&end_date=${selectedMonth.endDate}`),
        academicYearId ? apiRequest<{ data: { id: number; weekend_type?: string } }>(`/calendar?academic_year_id=${academicYearId}`).catch(() => null) : null,
      ]);

      const data: RegisterRow[] = Array.isArray(regRes) ? regRes : (regRes?.data ?? []);
      setRegisterRows(data);

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
      setRegError(err.message || "Failed to load staff register.");
    } finally {
      setRegLoading(false);
    }
  }, [selectedMonth, academicYearId]);

  useEffect(() => {
    loadMonthlyRegister();
  }, [loadMonthlyRegister]);

  // Day columns for Monthly Register Matrix
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

  // Parse Flat rows into staff matrix
  const matrixPeople = useMemo((): StaffMatrixPerson[] => {
    const map = new Map<string, StaffMatrixPerson>();

    // Seed from all active people list
    allPeople.forEach(p => {
      const k = `${p._type}-${p.id}`;
      map.set(k, {
        key:            k,
        person_id:      p.id,
        person_type:    p._type,
        full_name:      p.full_name,
        phone:          p.phone,
        email:          p.email,
        role_name:      p._type === "teacher" ? "Teacher" : (p.role_name ?? "Staff"),
        byDate:         {},
        month_present:  0,
        month_absent:   0,
        month_leave:    0,
        month_half_day: 0,
        month_total:    0,
      });
    });

    // Populate from register rows
    registerRows.forEach(r => {
      const k = `${r.person_type}-${r.person_id}`;
      if (!map.has(k)) {
        map.set(k, {
          key:            k,
          person_id:      r.person_id,
          person_type:    r.person_type,
          full_name:      r.full_name,
          phone:          r.phone,
          email:          r.email,
          role_name:      r.role_name,
          byDate:         {},
          month_present:  0,
          month_absent:   0,
          month_leave:    0,
          month_half_day: 0,
          month_total:    0,
        });
      }
      if (r.date && r.status) {
        const item = map.get(k)!;
        item.byDate[r.date.slice(0, 10)] = r.status as AttStatus;
      }
    });

    const list = [...map.values()];
    list.forEach(p => {
      Object.values(p.byDate).forEach(st => {
        if (st === "present")       p.month_present++;
        else if (st === "absent")   p.month_absent++;
        else if (st === "leave")    p.month_leave++;
        else if (st === "half_day") p.month_half_day++;
        p.month_total++;
      });
    });

    return list.sort((a, b) => a.role_name.localeCompare(b.role_name) || a.full_name.localeCompare(b.full_name));
  }, [allPeople, registerRows]);

  const displayedPeople = useMemo(() => {
    return matrixPeople.filter(p => {
      const matchRole = roleFilter === "all" || p.person_type === roleFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        p.full_name?.toLowerCase().includes(q) ||
        p.role_name?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [matrixPeople, roleFilter, search]);

  const workingDaysCount = dayCols.filter(c => c.kind === "working").length;

  // Export Monthly Register CSV
  const handleExportCSV = () => {
    if (!displayedPeople.length) return;
    const dateHeaders = dayCols.map(c => `"${c.dayNum} ${c.dowName}"`);
    const headers = ["Employee", "Role & Category", "Phone", ...dateHeaders, "Present", "Absent", "Leave", "Half Day", "Attendance %"];

    const csvRows = displayedPeople.map(p => {
      const dayValues = dayCols.map(col => {
        const s = p.byDate[col.iso];
        if (s === "present")  return `"P"`;
        if (s === "absent")   return `"A"`;
        if (s === "leave")    return `"Lv"`;
        if (s === "half_day") return `"½"`;
        if (col.kind === "holiday") return `"HOL"`;
        if (col.kind === "weekend") return `"OFF"`;
        return `"—"`;
      });
      const pct = workingDaysCount > 0 ? Math.round(((p.month_present + (p.month_half_day * 0.5)) / workingDaysCount) * 100) : 0;
      return [
        `"${p.full_name.replace(/"/g, '""')}"`,
        `"${p.role_name}"`,
        `"${p.phone || ""}"`,
        ...dayValues,
        p.month_present,
        p.month_absent,
        p.month_leave,
        p.month_half_day,
        `"${pct}%"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Staff_Attendance_Register_${selectedMonth?.label || "Month"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8faff", display: "flex", flexDirection: "column" }}>
      <style>{`
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

      <main style={{ padding: "24px 28px 48px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Page Header Toolbar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: 16,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9, background: "#ff9b51",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900,
              }}>
                <i className="fa-solid fa-table-list" />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Staff Attendance Register
                </h1>
                <p style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, margin: "2px 0 0" }}>
                  Monthly Attendance Matrix for Teachers &amp; Staff · {selectedMonth?.label || "Select Month"}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={monthKey}
              onChange={e => setMonthKey(e.target.value)}
              style={{
                height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                fontSize: 13, fontWeight: 800, background: "#fff", color: "#0f172a", outline: "none", cursor: "pointer",
              }}
            >
              {monthOptions.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>

            <button
              onClick={handleExportCSV}
              disabled={!displayedPeople.length}
              style={{
                height: 38, padding: "0 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12.5,
                cursor: displayedPeople.length ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <i className="fa-solid fa-file-csv" style={{ color: "#16a34a" }} /> Export CSV
            </button>

            <button
              onClick={() => window.print()}
              disabled={!displayedPeople.length}
              style={{
                height: 38, padding: "0 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12.5,
                cursor: displayedPeople.length ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <i className="fa-solid fa-print" style={{ color: "#3b82f6" }} /> Print
            </button>

            <Link
              href="/staff/attendance"
              style={{
                height: 38, padding: "0 16px", borderRadius: 8, background: "#ff9b51",
                color: "#fff", fontWeight: 900, fontSize: 13, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6,
                boxShadow: "0 2px 8px rgba(255,155,81,0.25)",
              }}
            >
              <i className="fa-solid fa-calendar-check" /> Mark Attendance
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12,
          padding: "10px 16px", display: "flex", gap: 12, alignItems: "center",
          justifyContent: "space-between", flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260, flexWrap: "wrap" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e2e8f0",
              borderRadius: 8, padding: "0 10px", background: "#f8fafc", height: 36, minWidth: 200, flex: 1,
            }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 12 }} />
              <input
                type="search"
                placeholder="Search staff by name, role, phone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: "none", background: "transparent", width: "100%", fontSize: 12.5, outline: "none", color: "#0f172a", fontWeight: 600 }}
              />
            </div>

            <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
              {(["all", "teacher", "staff"] as const).map(f => {
                const active = roleFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setRoleFilter(f)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "5px 12px", borderRadius: 6, border: "none",
                      cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: active ? "#fff" : "transparent",
                      color: active ? "#0f172a" : "#64748b",
                      boxShadow: active ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                    }}
                  >
                    {f === "all" ? "All Roles" : f === "teacher" ? "Teachers" : "Staff"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, fontWeight: 700, color: "#64748b" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>P</span> Present
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>A</span> Absent
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "#f3eeff", color: "#7c3aed", border: "1px solid #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900 }}>Lv</span> Leave
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, background: "#fff4e6", color: "#ea580c", border: "1px solid #fdd5b0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>½</span> Half Day
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 18, height: 18, background: "#f1f5f9", borderRadius: 4, border: "1px solid #cbd5e1" }} /> Off/Hol
            </span>
          </div>
        </div>

        {/* ── Table Card ── */}
        <div style={{
          background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0",
          overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
        }}>
          {regLoading ? (
            <div style={{ padding: "5rem", textAlign: "center" }}>
              <Spinner size={32} color="#ff9b51" />
              <p style={{ marginTop: 10, color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>Loading staff attendance register…</p>
            </div>
          ) : regError ? (
            <div style={{ padding: "3rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{regError}</div>
          ) : displayedPeople.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#64748b" }}>
              <i className="fa-solid fa-users-slash" style={{ fontSize: 36, opacity: 0.35, marginBottom: 10, display: "block" }} />
              <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>No employees found</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="reg-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 40, position: "sticky", left: 0, zIndex: 2, background: "#f8fafc" }}>#</th>
                    <th style={{ minWidth: 170, textAlign: "left", paddingLeft: 12, position: "sticky", left: 40, zIndex: 2, background: "#f8fafc" }}>Employee</th>
                    <th style={{ minWidth: 110, textAlign: "left", position: "sticky", left: 210, zIndex: 2, background: "#f8fafc" }}>Role</th>
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
                    <th style={{ minWidth: 36, background: "#f0fdf4", color: "#16a34a" }}>P</th>
                    <th style={{ minWidth: 36, background: "#fef2f2", color: "#dc2626" }}>A</th>
                    <th style={{ minWidth: 36, background: "#f3eeff", color: "#7c3aed" }}>Lv</th>
                    <th style={{ minWidth: 36, background: "#fff4e6", color: "#ea580c" }}>½</th>
                    <th style={{ minWidth: 50 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPeople.map((p, idx) => {
                    const pct = workingDaysCount > 0
                      ? Math.round(((p.month_present + (p.month_half_day * 0.5)) / workingDaysCount) * 100)
                      : 0;

                    return (
                      <tr key={p.key} style={{ background: idx % 2 === 1 ? "#fafbfc" : "#fff" }}>
                        <td style={{ fontWeight: 800, color: "#64748b", position: "sticky", left: 0, background: idx % 2 === 1 ? "#fafbfc" : "#fff" }}>
                          {idx + 1}
                        </td>
                        <td style={{ textAlign: "left", paddingLeft: 12, fontWeight: 800, color: "#0f172a", position: "sticky", left: 40, background: idx % 2 === 1 ? "#fafbfc" : "#fff", whiteSpace: "nowrap" }}>
                          {p.full_name}
                        </td>
                        <td style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", position: "sticky", left: 210, background: idx % 2 === 1 ? "#fafbfc" : "#fff", whiteSpace: "nowrap" }}>
                          {p.role_name}
                        </td>
                        {dayCols.map(col => {
                          const s = p.byDate[col.iso];
                          if (s) {
                            const cfg = STATUS_CONFIG[s];
                            const isOnHoliday = col.kind === "holiday";
                            const isOnWeekend = col.kind === "weekend";
                            return (
                              <td
                                key={col.iso}
                                style={{
                                  padding: "4px 2px",
                                  background: isOnHoliday ? "#fff7ed" : isOnWeekend ? "#f8fafc" : undefined,
                                }}
                                title={isOnHoliday ? `${col.label} (Duty/Attendance: ${cfg.label})` : isOnWeekend ? `Weekend (Attendance: ${cfg.label})` : cfg.label}
                              >
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 22, height: 22, borderRadius: 4, fontSize: 10, fontWeight: 900,
                                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                                  position: "relative",
                                }}>
                                  {cfg.short}
                                  {(isOnHoliday || isOnWeekend) && (
                                    <span style={{
                                      position: "absolute", top: -2, right: -2, width: 5, height: 5,
                                      borderRadius: "50%", background: isOnHoliday ? "#ea580c" : "#64748b",
                                    }} />
                                  )}
                                </span>
                              </td>
                            );
                          }

                          if (col.kind === "holiday") {
                            return (
                              <td key={col.iso} className="hol-col" style={{ padding: "4px 2px" }} title={col.label}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 22, height: 22, borderRadius: 4, fontSize: 9, fontWeight: 900,
                                  background: "#fff4e6", color: "#ea580c", border: "1px solid #fdd5b0",
                                }}>
                                  H
                                </span>
                              </td>
                            );
                          }
                          if (col.kind === "weekend") {
                            return (
                              <td key={col.iso} className="off-col" style={{ padding: "4px 2px" }} title="Weekly Off">
                                <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>·</span>
                              </td>
                            );
                          }

                          return (
                            <td key={col.iso} style={{ color: "#cbd5e1", fontSize: 11 }}>
                              —
                            </td>
                          );
                        })}
                        <td style={{ fontWeight: 900, color: "#16a34a" }}>{p.month_present}</td>
                        <td style={{ fontWeight: 900, color: "#dc2626" }}>{p.month_absent}</td>
                        <td style={{ fontWeight: 900, color: "#7c3aed" }}>{p.month_leave}</td>
                        <td style={{ fontWeight: 900, color: "#ea580c" }}>{p.month_half_day}</td>
                        <td style={{ fontWeight: 900, color: pct >= 75 ? "#16a34a" : "#ea580c" }}>
                          {workingDaysCount > 0 ? `${pct}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
