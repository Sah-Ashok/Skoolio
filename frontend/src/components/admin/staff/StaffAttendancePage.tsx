"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { isoToBS, bsToISO, daysInBSMonth, BS_MONTH_NAMES } from "@/lib/bs-ad";
import DateInput from "@/components/shared/DateInput";

// ── Types ──────────────────────────────────────────────────────────────────────
type AttStatus = "present" | "absent" | "leave" | "half_day";

type Person = {
  id: number;
  full_name: string;
  role_name?: string;
  phone?: string;
  email?: string;
  status: string;
  _type: "staff" | "teacher";
};

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
  key:           string;
  person_id:     number;
  person_type:   "staff" | "teacher";
  full_name:     string;
  phone?:        string;
  email?:        string;
  role_name:     string;
  byDate:        Record<string, AttStatus>;
  month_present: number;
  month_absent:  number;
  month_leave:   number;
  month_half_day:number;
  month_total:   number;
}

interface DayCol {
  iso:     string;
  kind:    "working" | "weekend" | "holiday";
  label:   string;
  dayNum:  number;
  dowName: string;
}

const personKey = (p: Person | { _type?: string; person_type?: string; id?: number; person_id?: number }) => {
  const type = (p as any)._type || (p as any).person_type;
  const id   = (p as any).id || (p as any).person_id;
  return `${type}-${id}`;
};

const STATUS_CONFIG: Record<AttStatus, {
  label: string; short: string; bg: string; color: string; border: string; rowBg: string;
}> = {
  present:  { label: "Present",  short: "P",  bg: "#e2f6ee", color: "#16a34a", border: "#16a34a", rowBg: "#fff" },
  absent:   { label: "Absent",   short: "A",  bg: "#fde7e7", color: "#dc2626", border: "#dc2626", rowBg: "#fff8f8" },
  leave:    { label: "Leave",    short: "Lv", bg: "#f3eeff", color: "#7c3aed", border: "#7c3aed", rowBg: "#fbf9ff" },
  half_day: { label: "Half Day", short: "½",  bg: "#fff4e6", color: "#ea580c", border: "#ea580c", rowBg: "#fffdf9" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as AttStatus[];

const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

// ── Status Toggle ──────────────────────────────────────────────────────────────
function StatusToggle({ value, onChange, disabled }: {
  value: AttStatus;
  onChange: (v: AttStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "inline-flex", gap: 4, background: "#f8fafc", padding: 3, borderRadius: 8, border: "1.5px solid #e2e8f0" }}>
      {ALL_STATUSES.map(st => {
        const c      = STATUS_CONFIG[st];
        const active = value === st;
        return (
          <button
            key={st}
            type="button"
            disabled={disabled}
            onClick={() => onChange(st)}
            title={c.label}
            style={{
              minWidth: 32,
              height: 28,
              padding: "0 6px",
              borderRadius: 6,
              cursor: disabled ? "not-allowed" : "pointer",
              border: active ? `1.5px solid ${c.border}` : "1px solid transparent",
              background: active ? c.bg : "transparent",
              color: active ? c.color : "#64748b",
              fontWeight: 900,
              fontSize: 11.5,
              transition: "all 0.12s",
              opacity: disabled ? 0.55 : 1,
              flexShrink: 0,
            }}
          >
            {c.short}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Page Component ─────────────────────────────────────────────────────────
export function StaffAttendancePage() {
  const dispatch = useAppDispatch();
  const { formatDate, isBS } = useDateFormat();
  const { activeYear, academicYearId } = useAcademicYear();

  // Mode: Daily Marking vs Monthly Register Matrix
  const [activeTab, setActiveTab] = useState<"daily" | "register">("daily");

  // ── DAILY MARKING STATE ──
  const [date,   setDate]   = useState(todayStr);
  const [filter, setFilter] = useState<"all" | "staff" | "teacher">("all");
  const [search, setSearch] = useState("");
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: staffList,   loading: loadingStaff }    = useApi<any[]>("/staff");
  const { data: teacherList, loading: loadingTeachers } = useApi<any[]>("/teachers");
  const { data: existingStaff,    refetch: refetchStaff }    = useApi<any[]>(`/staff/attendance?date=${date}`);
  const { data: existingTeachers, refetch: refetchTeachers } = useApi<any[]>(`/teachers/attendance?date=${date}`);

  const { execute: saveStaff }   = useMutation("/staff/attendance/bulk",    "POST");
  const { execute: saveTeacher } = useMutation("/teachers/attendance/bulk", "POST");

  const allPeople = useMemo<Person[]>(() => [
    ...(teacherList ?? []).filter((m: any) => m.status !== "inactive").map((m: any) => ({ ...m, _type: "teacher" as const })),
    ...(staffList   ?? []).filter((m: any) => m.status !== "terminated").map((m: any) => ({ ...m, _type: "staff" as const })),
  ], [staffList, teacherList]);

  const [draft, setDraft] = useState<Record<string, AttStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextDraft: Record<string, AttStatus> = {};
    const nextNotes: Record<string, string>    = {};

    allPeople.forEach(p => {
      nextDraft[personKey(p)] = "present";
      nextNotes[personKey(p)] = "";
    });

    (existingStaff ?? []).forEach((r: any) => {
      nextDraft[`staff-${r.staff_id}`] = r.status;
      if (r.note) nextNotes[`staff-${r.staff_id}`] = r.note;
    });

    (existingTeachers ?? []).forEach((r: any) => {
      nextDraft[`teacher-${r.teacher_id}`] = r.status;
      if (r.note) nextNotes[`teacher-${r.teacher_id}`] = r.note;
    });

    setDraft(nextDraft);
    setNotes(nextNotes);
    setSaved(false);
  }, [existingStaff, existingTeachers, allPeople.length]); // eslint-disable-line

  const setStatus = (key: string, st: AttStatus) => {
    setSaved(false);
    setDraft(d => ({ ...d, [key]: st }));
  };

  const setNote = (key: string, noteVal: string) => {
    setSaved(false);
    setNotes(n => ({ ...n, [key]: noteVal }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const teachers = allPeople.filter(p => p._type === "teacher");
      const staff    = allPeople.filter(p => p._type === "staff");
      await Promise.all([
        teachers.length && saveTeacher({
          date,
          records: teachers.map(p => ({
            teacher_id: p.id,
            status: draft[personKey(p)] ?? "present",
            note: notes[personKey(p)] || undefined,
          })),
        }),
        staff.length && saveStaff({
          date,
          records: staff.map(p => ({
            staff_id: p.id,
            status: draft[personKey(p)] ?? "present",
            note: notes[personKey(p)] || undefined,
          })),
        }),
      ]);
      refetchStaff();
      refetchTeachers();
      setSaved(true);
      dispatch(showToast({ type: "success", title: "Attendance Saved", message: `Attendance saved for ${formatDate(date)}.` }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to save attendance." }));
    } finally {
      setSaving(false);
    }
  };

  const setAllTo = (st: AttStatus) => {
    setSaved(false);
    setDraft(d => {
      const next = { ...d };
      displayed.forEach(p => { next[personKey(p)] = st; });
      return next;
    });
  };

  const isLoading = loadingStaff || loadingTeachers;
  const isFuture  = date > todayStr();

  const displayed = useMemo(() => allPeople.filter(p => {
    const matchType   = filter === "all" || p._type === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.full_name?.toLowerCase().includes(q) ||
      p.role_name?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q);
    return matchType && matchSearch;
  }), [allPeople, filter, search]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0, half_day: 0 };
    allPeople.forEach(p => {
      const st = (draft[personKey(p)] ?? "present") as AttStatus;
      if (st in c) c[st as keyof typeof c]++;
    });
    return c;
  }, [draft, allPeople]);

  const total        = allPeople.length;
  const teacherCount = (teacherList ?? []).filter((m: any) => m.status !== "inactive").length;
  const staffCount   = (staffList   ?? []).filter((m: any) => m.status !== "terminated").length;

  const dateLabel = useMemo(() => {
    if (!date) return "";
    const weekday = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" });
    return isBS
      ? `${weekday}, ${formatDate(date)}`
      : new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }, [date, isBS, formatDate]);

  // ── MONTHLY REGISTER STATE ──
  const today = useMemo(() => new Date(), []);
  const [monthKey, setMonthKey] = useState<string>("");
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [regLoading, setRegLoading]     = useState<boolean>(false);
  const [regError, setRegError]         = useState<string | null>(null);
  const [holidayMap, setHolidayMap]     = useState<Map<string, string>>(new Map());
  const [weekendDows, setWeekendDows]   = useState<Set<number>>(new Set([0, 6]));

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
    if (!selectedMonth || activeTab !== "register") return;
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
            if (ev.affects_attendance) {
              hMap.set(ev.event_date.slice(0, 10), ev.title);
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
  }, [selectedMonth, activeTab, academicYearId]);

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
      const k = personKey(p);
      map.set(k, {
        key:           k,
        person_id:     p.id,
        person_type:   p._type,
        full_name:     p.full_name,
        phone:         p.phone,
        email:         p.email,
        role_name:     p._type === "teacher" ? "Teacher" : (p.role_name ?? "Staff"),
        byDate:        {},
        month_present: 0,
        month_absent:  0,
        month_leave:   0,
        month_half_day:0,
        month_total:   0,
      });
    });

    // Populate from register rows
    registerRows.forEach(r => {
      const k = `${r.person_type}-${r.person_id}`;
      if (!map.has(k)) {
        map.set(k, {
          key:           k,
          person_id:     r.person_id,
          person_type:   r.person_type,
          full_name:     r.full_name,
          phone:         r.phone,
          email:         r.email,
          role_name:     r.role_name,
          byDate:        {},
          month_present: 0,
          month_absent:  0,
          month_leave:   0,
          month_half_day:0,
          month_total:   0,
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

  const workingDaysCount = dayCols.filter(c => c.kind === "working").length;

  // Export Monthly Register CSV
  const handleExportCSV = () => {
    if (!matrixPeople.length) return;
    const dateHeaders = dayCols.map(c => `"${c.dayNum} ${c.dowName}"`);
    const headers = ["Employee", "Role & Category", "Phone", ...dateHeaders, "Present", "Absent", "Leave", "Half Day", "Attendance %"];

    const csvRows = matrixPeople.map(p => {
      const dayValues = dayCols.map(col => {
        if (col.kind === "weekend") return `"OFF"`;
        if (col.kind === "holiday") return `"HOL"`;
        const s = p.byDate[col.iso];
        if (s === "present")  return `"P"`;
        if (s === "absent")   return `"A"`;
        if (s === "leave")    return `"Lv"`;
        if (s === "half_day") return `"½"`;
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
        .sa-tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sa-tbl-wrap table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sa-tbl-wrap th { background: #f8fafc; padding: 11px 16px; font-weight: 800; font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #e2e8f0; }
        .sa-tbl-wrap td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        
        .sa-stat-card {
          flex: 1;
          min-width: 130px;
          height: 76px;
          border-radius: 12px;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(15,23,42,0.03);
          transition: transform 0.15s, box-shadow 0.15s;
        }

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
                <i className="fa-solid fa-users-gear" />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                  Staff &amp; Teacher Attendance
                </h1>
                <p style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, margin: "2px 0 0" }}>
                  {activeTab === "daily" ? dateLabel : `Monthly Staff Attendance Register (${selectedMonth?.label})`}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Switcher & Action Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* View Mode Toggle */}
            <div style={{ display: "inline-flex", background: "#f1f5f9", padding: 3, borderRadius: 9, border: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => setActiveTab("daily")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 7, border: "none",
                  cursor: "pointer", fontSize: 12.5, fontWeight: 800,
                  background: activeTab === "daily" ? "#fff" : "transparent",
                  color: activeTab === "daily" ? "#0f172a" : "#64748b",
                  boxShadow: activeTab === "daily" ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                <i className="fa-solid fa-calendar-day" /> Daily Marking
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("register")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 7, border: "none",
                  cursor: "pointer", fontSize: 12.5, fontWeight: 800,
                  background: activeTab === "register" ? "#fff" : "transparent",
                  color: activeTab === "register" ? "#0f172a" : "#64748b",
                  boxShadow: activeTab === "register" ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                <i className="fa-solid fa-table-cells" /> Monthly Register
              </button>
            </div>

            {/* Daily Actions */}
            {activeTab === "daily" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <DateInput
                  value={date}
                  maxDate={todayStr()}
                  onChange={e => { setDate(e.target.value); setSaved(false); }}
                  style={{
                    height: 38, padding: "0 12px", borderRadius: 8,
                    border: "1.5px solid #e2e8f0", fontSize: 13, fontWeight: 800,
                    color: "#0f172a", background: "#fff", outline: "none",
                  }}
                />

                <button
                  onClick={handleSave}
                  disabled={saving || isLoading || total === 0 || isFuture}
                  style={{
                    height: 38, padding: "0 18px", borderRadius: 8, border: "none",
                    background: saved ? "#16a34a" : "#ff9b51",
                    color: "#fff", fontWeight: 900, fontSize: 13,
                    cursor: saving || isLoading || total === 0 || isFuture ? "not-allowed" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 7,
                    boxShadow: saved ? "0 2px 8px rgba(22,163,74,0.25)" : "0 2px 8px rgba(255,155,81,0.25)",
                    opacity: isFuture ? 0.5 : 1,
                    transition: "all 0.18s",
                  }}
                >
                  {saving ? <Spinner size={14} color="#fff" /> :
                   saved  ? <i className="fa-solid fa-circle-check" /> :
                            <i className="fa-solid fa-floppy-disk" />}
                  {saving ? "Saving…" : saved ? "Saved" : "Save Attendance"}
                </button>
              </div>
            )}

            {/* Monthly Register Actions */}
            {activeTab === "register" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                  disabled={!matrixPeople.length}
                  style={{
                    height: 38, padding: "0 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                    background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12.5,
                    cursor: matrixPeople.length ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <i className="fa-solid fa-file-csv" style={{ color: "#16a34a" }} /> Export CSV
                </button>

                <button
                  onClick={() => window.print()}
                  disabled={!matrixPeople.length}
                  style={{
                    height: 38, padding: "0 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                    background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12.5,
                    cursor: matrixPeople.length ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", gap: 6,
                  }}
                >
                  <i className="fa-solid fa-print" style={{ color: "#3b82f6" }} /> Print
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── TAB 1: DAILY ATTENDANCE MARKING ── */}
        {activeTab === "daily" && (
          <>
            {/* Future Date Warning */}
            {isFuture && (
              <div style={{
                padding: "10px 16px", borderRadius: 10, background: "#fef2f2",
                border: "1px solid #fecaca", color: "#dc2626", fontWeight: 700,
                fontSize: 12.5, display: "flex", gap: 8, alignItems: "center",
              }}>
                <i className="fa-solid fa-triangle-exclamation" />
                Cannot mark attendance for future dates.
              </div>
            )}

            {/* 5 Compact Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <div className="sa-stat-card">
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Total Staff</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{total}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f1f5f9", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  <i className="fa-solid fa-users" />
                </div>
              </div>

              <div className="sa-stat-card" style={{ borderLeft: "4px solid #16a34a" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", textTransform: "uppercase" }}>Present</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#16a34a" }}>{counts.present}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  <i className="fa-solid fa-user-check" />
                </div>
              </div>

              <div className="sa-stat-card" style={{ borderLeft: "4px solid #dc2626" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", textTransform: "uppercase" }}>Absent</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#dc2626" }}>{counts.absent}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  <i className="fa-solid fa-user-xmark" />
                </div>
              </div>

              <div className="sa-stat-card" style={{ borderLeft: "4px solid #7c3aed" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase" }}>On Leave</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#7c3aed" }}>{counts.leave}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#f3eeff", color: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  <i className="fa-solid fa-calendar-minus" />
                </div>
              </div>

              <div className="sa-stat-card" style={{ borderLeft: "4px solid #ea580c" }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#ea580c", textTransform: "uppercase" }}>Half Day</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#ea580c" }}>{counts.half_day}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#fff4e6", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                  <i className="fa-solid fa-hourglass-half" />
                </div>
              </div>
            </div>

            {/* Toolbar: Search, Filter Tabs & Set All */}
            <div style={{
              background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12,
              padding: "10px 16px", display: "flex", gap: 12, alignItems: "center",
              justifyContent: "space-between", flexWrap: "wrap", boxShadow: "0 1px 3px rgba(15,23,42,0.02)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260, flexWrap: "wrap" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e2e8f0",
                  borderRadius: 8, padding: "0 10px", background: "#f8fafc", height: 36, minWidth: 200, flex: 1,
                }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 12 }} />
                  <input
                    type="search"
                    placeholder="Search by name, role, phone…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ border: "none", background: "transparent", width: "100%", fontSize: 12.5, outline: "none", color: "#0f172a", fontWeight: 600 }}
                  />
                </div>

                <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
                  {(["all", "teacher", "staff"] as const).map(f => {
                    const active = filter === f;
                    const count  = f === "all" ? total : f === "teacher" ? teacherCount : staffCount;
                    return (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 11px", borderRadius: 6, border: "none",
                          cursor: "pointer", fontSize: 12, fontWeight: 700,
                          background: active ? "#fff" : "transparent",
                          color: active ? "#0f172a" : "#64748b",
                          boxShadow: active ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                          transition: "all 0.15s",
                        }}
                      >
                        <i className={`fa-solid ${f === "teacher" ? "fa-chalkboard-user" : f === "staff" ? "fa-users-gear" : "fa-users"}`} style={{ fontSize: 11 }} />
                        {f === "all" ? "All" : f === "teacher" ? "Teachers" : "Staff"}
                        <span style={{
                          background: active ? "#ff9b51" : "#e2e8f0",
                          color: active ? "#fff" : "#475569",
                          fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 99,
                        }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {displayed.length > 0 && !isFuture && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Set All:</span>
                  {ALL_STATUSES.map(st => {
                    const c = STATUS_CONFIG[st];
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAllTo(st)}
                        style={{
                          padding: "4px 8px", borderRadius: 6, border: `1px solid ${c.border}44`,
                          background: c.bg, color: c.color, fontSize: 11, fontWeight: 800, cursor: "pointer",
                        }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Daily Table */}
            <div style={{
              background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 14,
              overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
            }}>
              {isLoading ? (
                <div style={{ padding: "4rem", textAlign: "center" }}>
                  <Spinner size={32} color="#ff9b51" />
                  <p style={{ marginTop: 10, color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>Loading staff members…</p>
                </div>
              ) : displayed.length === 0 ? (
                <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748b" }}>
                  <i className="fa-solid fa-users-slash" style={{ fontSize: 36, opacity: 0.35, marginBottom: 12, display: "block" }} />
                  <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>
                    {search ? "No staff match your search" : "No staff found in this category"}
                  </p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>Try changing your filter or clearing the search query.</p>
                </div>
              ) : (
                <div className="sa-tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 45, textAlign: "center" }}>#</th>
                        <th style={{ minWidth: 200, textAlign: "left" }}>Staff Member</th>
                        <th style={{ minWidth: 140, textAlign: "left" }}>Role &amp; Category</th>
                        <th style={{ minWidth: 170, textAlign: "center" }}>Attendance Status</th>
                        <th style={{ minWidth: 220, textAlign: "left" }}>Remarks / Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map((person, idx) => {
                        const key       = personKey(person);
                        const st        = (draft[key] ?? "present") as AttStatus;
                        const cfg       = STATUS_CONFIG[st];
                        const isTeacher = person._type === "teacher";
                        const roleLabel = isTeacher ? "Teacher" : (person.role_name ?? "Staff");
                        const noteVal   = notes[key] ?? "";

                        return (
                          <tr key={key} style={{ background: cfg.rowBg, transition: "background 0.12s" }}>
                            <td style={{ textAlign: "center", fontWeight: 800, color: "#64748b", fontSize: 12 }}>
                              {idx + 1}
                            </td>
                            <td>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 13.5, color: "#0f172a" }}>
                                  {person.full_name}
                                </div>
                                {person.phone ? (
                                  <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                    <i className="fa-solid fa-phone" style={{ fontSize: 10, color: "#94a3b8" }} />
                                    {person.phone}
                                  </div>
                                ) : person.email ? (
                                  <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600, marginTop: 2 }}>
                                    {person.email}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                padding: "3px 8px", borderRadius: 6,
                                fontSize: 11, fontWeight: 800,
                                background: isTeacher ? "#eff6ff" : "#f1f5f9",
                                color:      isTeacher ? "#1e40af" : "#334155",
                                border: `1px solid ${isTeacher ? "#bfdbfe" : "#cbd5e1"}`,
                              }}>
                                <i className={`fa-solid ${isTeacher ? "fa-chalkboard-user" : "fa-user-gear"}`} style={{ fontSize: 10 }} />
                                {roleLabel}
                              </span>
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {isFuture ? (
                                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>—</span>
                              ) : (
                                <StatusToggle
                                  value={st}
                                  onChange={v => setStatus(key, v)}
                                />
                              )}
                            </td>
                            <td>
                              <input
                                type="text"
                                placeholder="Optional note / reason…"
                                value={noteVal}
                                disabled={isFuture}
                                onChange={e => setNote(key, e.target.value)}
                                style={{
                                  width: "100%", height: 32, padding: "0 10px",
                                  borderRadius: 6, border: "1.5px solid #e2e8f0",
                                  fontSize: 12, fontWeight: 600, color: "#0f172a",
                                  background: "#fff", outline: "none",
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Footer */}
              {!isLoading && displayed.length > 0 && (
                <div style={{
                  padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#64748b" }}>
                    Showing <strong>{displayed.length}</strong> of <strong>{total}</strong> staff members
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {saved && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <i className="fa-solid fa-circle-check" /> All changes saved
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── TAB 2: MONTHLY REGISTER MATRIX ── */}
        {activeTab === "register" && (
          <div style={{
            background: "#fff", borderRadius: 14, border: "1.5px solid #e2e8f0",
            overflow: "hidden", boxShadow: "0 1px 3px rgba(15,23,42,0.03)",
          }}>
            {/* Header info in register tab */}
            <div style={{
              padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
            }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                  Staff Attendance Sheet — {selectedMonth?.label}
                </span>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginLeft: 10 }}>
                  {matrixPeople.length} employees · {workingDaysCount} working days
                </span>
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

            {regLoading ? (
              <div style={{ padding: "5rem", textAlign: "center" }}>
                <Spinner size={32} color="#ff9b51" />
                <p style={{ marginTop: 10, color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>Loading staff attendance register…</p>
              </div>
            ) : regError ? (
              <div style={{ padding: "3rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{regError}</div>
            ) : matrixPeople.length === 0 ? (
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
                      <th style={{ minWidth: 160, textAlign: "left", paddingLeft: 12, position: "sticky", left: 40, zIndex: 2, background: "#f8fafc" }}>Employee</th>
                      <th style={{ minWidth: 110, textAlign: "left", position: "sticky", left: 200, zIndex: 2, background: "#f8fafc" }}>Role</th>
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
                    {matrixPeople.map((p, idx) => {
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
                          <td style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", position: "sticky", left: 200, background: idx % 2 === 1 ? "#fafbfc" : "#fff", whiteSpace: "nowrap" }}>
                            {p.role_name}
                          </td>
                          {dayCols.map(col => {
                            if (col.kind === "weekend") {
                              return <td key={col.iso} className="off-col" style={{ fontSize: 10 }}>·</td>;
                            }
                            if (col.kind === "holiday") {
                              return <td key={col.iso} className="hol-col" style={{ fontSize: 10 }} title={col.label}>H</td>;
                            }
                            const s = p.byDate[col.iso];
                            if (!s) return <td key={col.iso} style={{ color: "#cbd5e1", fontSize: 11 }}>—</td>;

                            const cfg = STATUS_CONFIG[s];
                            return (
                              <td key={col.iso} style={{ padding: "4px 2px" }}>
                                <span style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  width: 22, height: 22, borderRadius: 4, fontSize: 10, fontWeight: 900,
                                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                                }}>
                                  {cfg.short}
                                </span>
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
        )}

      </main>
    </div>
  );
}

