"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { isoToBS, bsToISO } from "@/lib/bs-ad";
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

const personKey = (p: Person) => `${p._type}-${p.id}`;

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

// ── Status Toggle Component ────────────────────────────────────────────────────
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

  const [date,   setDate]   = useState(todayStr);
  const [filter, setFilter] = useState<"all" | "staff" | "teacher">("all");
  const [search, setSearch] = useState("");
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);

  // Calendar info
  const [holidayMap, setHolidayMap]   = useState<Map<string, string>>(new Map());
  const [weekendDows, setWeekendDows] = useState<Set<number>>(new Set([0, 6]));

  const { data: staffList,   loading: loadingStaff }    = useApi<any[]>("/staff");
  const { data: teacherList, loading: loadingTeachers } = useApi<any[]>("/teachers");
  const { data: existingStaff,    refetch: refetchStaff }    = useApi<any[]>(`/staff/attendance?date=${date}`);
  const { data: existingTeachers, refetch: refetchTeachers } = useApi<any[]>(`/teachers/attendance?date=${date}`);

  const { execute: saveStaff }   = useMutation("/staff/attendance/bulk",    "POST");
  const { execute: saveTeacher } = useMutation("/teachers/attendance/bulk", "POST");

  // Load School Calendar for Holidays & Weekend Offs
  const loadCalendar = useCallback(async () => {
    if (!academicYearId) return;
    try {
      const calRes = await apiRequest<{ data: { id: number; weekend_type?: string } }>(
        `/calendar?academic_year_id=${academicYearId}`
      ).catch(() => null);

      if (calRes?.data?.id) {
        const calId = calRes.data.id;
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
      }
    } catch {}
  }, [academicYearId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

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

  // Calendar Day Info
  const selectedHoliday = holidayMap.get(date);
  const selectedDow     = localDate(date).getDay();
  const isWeekend       = weekendDows.has(selectedDow);
  const selectedDowName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][selectedDow];

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
                  {dateLabel}
                </p>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

            <Link
              href="/staff/attendance/register"
              style={{
                height: 38, padding: "0 14px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 12.5,
                textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <i className="fa-solid fa-table-list" style={{ color: "#3b82f6" }} /> Monthly Register
            </Link>
          </div>
        </div>

        {/* ── Status Notices (Future Date / Holiday / Weekend) ── */}
        {isFuture ? (
          <div style={{
            padding: "10px 16px", borderRadius: 10, background: "#fef2f2",
            border: "1px solid #fecaca", color: "#dc2626", fontWeight: 700,
            fontSize: 12.5, display: "flex", gap: 8, alignItems: "center",
          }}>
            <i className="fa-solid fa-triangle-exclamation" />
            Cannot mark attendance for future dates.
          </div>
        ) : selectedHoliday ? (
          <div style={{
            padding: "10px 16px", borderRadius: 10, background: "#fff7ed",
            border: "1.5px solid #fed7aa", color: "#c2410c", fontWeight: 700,
            fontSize: 12.5, display: "flex", gap: 10, alignItems: "center",
          }}>
            <i className="fa-solid fa-umbrella-beach" style={{ fontSize: 15 }} />
            <div>
              <strong>Holiday ({selectedHoliday}):</strong> School calendar marks this date as a holiday. You can still mark and save attendance if duty or special classes were held.
            </div>
          </div>
        ) : isWeekend ? (
          <div style={{
            padding: "10px 16px", borderRadius: 10, background: "#f8fafc",
            border: "1.5px solid #cbd5e1", color: "#475569", fontWeight: 700,
            fontSize: 12.5, display: "flex", gap: 10, alignItems: "center",
          }}>
            <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 14 }} />
            <div>
              <strong>Weekly Off ({selectedDowName}):</strong> Weekend day according to school calendar. You can still mark and save attendance if staff were on duty.
            </div>
          </div>
        ) : null}

        {/* ── 5 Compact Stat Cards (~75px) ── */}
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

        {/* ── Toolbar: Search, Filter Tabs & Set All ── */}
        <div style={{
          background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 12,
          padding: "10px 16px", display: "flex", gap: 12, alignItems: "center",
          justifyContent: "space-between", flexWrap: "wrap", boxShadow: "0 1px 3px rgba(15,23,42,0.02)",
        }}>
          {/* Left: Search & Filter Tabs */}
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

          {/* Right: Quick Set All Buttons */}
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

        {/* ── Table Container ── */}
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

          {/* Footer Bar */}
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

      </main>
    </div>
  );
}
