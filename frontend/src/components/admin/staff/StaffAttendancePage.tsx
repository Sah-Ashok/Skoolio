"use client";

import { useState, useEffect, useMemo } from "react";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import DateInput from "@/components/shared/DateInput";
import s from "./staff.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────
type AttStatus = "present" | "absent" | "leave" | "half_day";
type Person = {
  id: number;
  full_name: string;
  role_name?: string;
  status: string;
  _type: "staff" | "teacher";
};

const personKey = (p: Person) => `${p._type}-${p.id}`;

const STATUS_CONFIG: Record<AttStatus, {
  label: string; short: string; bg: string; color: string; border: string; rowBg: string;
}> = {
  present:  { label: "Present",  short: "P",  bg: "#e2f6ee", color: "#12805c", border: "#12805c", rowBg: "#fff"      },
  absent:   { label: "Absent",   short: "A",  bg: "#fde7e7", color: "#b42318", border: "#b42318", rowBg: "#fff5f5"   },
  leave:    { label: "Leave",    short: "Lv", bg: "#f3eeff", color: "#7c3aed", border: "#7c3aed", rowBg: "#faf7ff"   },
  half_day: { label: "Half Day", short: "½",  bg: "#fff4e6", color: "#c46a14", border: "#c46a14", rowBg: "#fffbf5"   },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as AttStatus[];

const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// ── Status Toggle ──────────────────────────────────────────────────────────────
function StatusToggle({ value, onChange, disabled }: {
  value: AttStatus;
  onChange: (v: AttStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {ALL_STATUSES.map(st => {
        const c      = STATUS_CONFIG[st];
        const active = value === st;
        return (
          <button key={st} type="button"
            disabled={disabled}
            onClick={() => onChange(st)}
            title={c.label}
            style={{
              width: 34, height: 34, borderRadius: 7,
              cursor: disabled ? "not-allowed" : "pointer",
              border: `1.5px solid ${active ? c.border : "#d4dde2"}`,
              background: active ? c.bg : "#fff",
              color: active ? c.color : "#6a7882",
              fontWeight: 900, fontSize: 11,
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export function StaffAttendancePage() {
  const dispatch   = useAppDispatch();
  const { formatDate, isBS } = useDateFormat();

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

  useEffect(() => {
    const next: Record<string, AttStatus> = {};
    allPeople.forEach(p => { next[personKey(p)] = "present"; });
    (existingStaff    ?? []).forEach((r: any) => { next[`staff-${r.staff_id}`]     = r.status; });
    (existingTeachers ?? []).forEach((r: any) => { next[`teacher-${r.teacher_id}`] = r.status; });
    setDraft(next);
    setSaved(false);
  }, [existingStaff, existingTeachers, allPeople.length]); // eslint-disable-line

  const setStatus = (key: string, st: AttStatus) => {
    setSaved(false);
    setDraft(d => ({ ...d, [key]: st }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const teachers = allPeople.filter(p => p._type === "teacher");
      const staff    = allPeople.filter(p => p._type === "staff");
      await Promise.all([
        teachers.length && saveTeacher({ date, records: teachers.map(p => ({ teacher_id: p.id, status: draft[personKey(p)] ?? "present" })) }),
        staff.length    && saveStaff  ({ date, records: staff.map(p =>    ({ staff_id:   p.id, status: draft[personKey(p)] ?? "present" })) }),
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

  // Quick-set all visible rows
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
    const matchSearch = !search || p.full_name.toLowerCase().includes(search.toLowerCase());
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
    const weekday = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long" });
    return isBS
      ? `${weekday}, ${formatDate(date)}`
      : new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  }, [date, isBS, formatDate]);

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <style>{`
        .sa-tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sa-tbl-wrap table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 13px; }
        @media (max-width: 640px) {
          .sa-head-row { flex-direction: column !important; align-items: flex-start !important; }
          .sa-controls { flex-direction: column !important; }
          .sa-stat-row { flex-wrap: wrap !important; }
          .sa-bot-row  { flex-direction: column !important; }
        }
      `}</style>

      <main style={{ padding: "24px 28px 56px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* ── Page head ── */}
        <div className="sa-head-row"
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: "#FF9B51", margin: 0 }}>
              Daily Attendance
            </p>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: "#25343F", letterSpacing: -0.5, margin: "4px 0 0" }}>
              Staff &amp; Teacher Attendance
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginTop: 3 }}>
              {dateLabel}
            </p>
          </div>
          {/* Date + Save */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <DateInput
              value={date}
              maxDate={todayStr()}
              onChange={e => { setDate(e.target.value); setSaved(false); }}
              style={{ minHeight: 40, padding: "0 12px", borderRadius: 9, border: "1px solid #c6d0d7", fontSize: 13, fontWeight: 800, color: "#1f2d36", background: "#fff", outline: "none" }}
            />
            <button
              onClick={handleSave}
              disabled={saving || isLoading || total === 0 || isFuture}
              style={{
                minHeight: 40, padding: "0 20px", borderRadius: 9, border: "none",
                background: saved ? "#12805c" : "#FF9B51",
                color: "#fff", fontWeight: 900, fontSize: 13.5,
                cursor: saving || isLoading || total === 0 || isFuture ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: saved ? "0 2px 10px rgba(18,128,92,.3)" : "0 2px 10px rgba(255,155,81,.3)",
                opacity: isFuture ? 0.5 : 1,
                transition: "all 0.18s",
              }}
            >
              {saving ? <Spinner size={14} color="#fff" /> :
               saved  ? <i className="fa-solid fa-circle-check" /> :
                        <i className="fa-solid fa-floppy-disk" />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save All"}
            </button>
          </div>
        </div>

        {/* ── Future date warning ── */}
        {isFuture && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fde7e7", border: "1px solid #fca5a5", color: "#b42318", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-triangle-exclamation" />
            Cannot mark attendance for a future date.
          </div>
        )}

        {/* ── Stat cards ── */}
        <div className="sa-stat-row"
          style={{ display: "flex", gap: 12, flexWrap: "nowrap" }}>
          {([
            { label: "Present",  count: counts.present,  color: "#12805c", bg: "#e2f6ee", border: "#a7e1c8" },
            { label: "Absent",   count: counts.absent,   color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
            { label: "Leave",    count: counts.leave,    color: "#7c3aed", bg: "#f3eeff", border: "#c4b5fd" },
            { label: "Half Day", count: counts.half_day, color: "#c46a14", bg: "#fff4e6", border: "#fdd5b0" },
            { label: "Total",    count: total,           color: "#25343F", bg: "#f8fafc", border: "#d4dde2" },
          ] as const).map(c => (
            <div key={c.label}
              style={{
                flex: 1, minWidth: 90,
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${c.border}`,
                background: c.bg,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 4, textAlign: "center",
              }}
            >
              <span style={{ fontSize: 26, fontWeight: 900, color: c.color, lineHeight: 1 }}>{c.count}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: c.color, textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="sa-controls"
          style={{ background: "#fff", border: "1px solid #d4dde2", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          {/* Search */}
          <label style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "0 12px", background: "#f8fafc", transition: "border-color .18s" }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 13 }} />
            <input
              type="search"
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: "none", background: "transparent", padding: "9px 0", width: "100%", fontFamily: "inherit", fontSize: 13.5, outline: "none", color: "#1e293b" }}
            />
          </label>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 9, padding: 3 }}>
            {(["all", "teacher", "staff"] as const).map(f => {
              const active = filter === f;
              const count  = f === "all" ? total : f === "teacher" ? teacherCount : staffCount;
              return (
                <button key={f} onClick={() => setFilter(f)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 13px", borderRadius: 7,
                    border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                    background: active ? "#fff" : "transparent",
                    color: active ? "#25343F" : "#64748b",
                    boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <i className={`fa-solid ${f === "teacher" ? "fa-chalkboard-user" : f === "staff" ? "fa-users-gear" : "fa-users"}`} />
                  {f === "all" ? "All" : f === "teacher" ? "Teachers" : "Staff"}
                  <span style={{
                    background: active ? "#FF9B51" : "#e2e8f0",
                    color: active ? "#fff" : "#475569",
                    fontSize: 10.5, fontWeight: 800,
                    padding: "1px 6px", borderRadius: 999, minWidth: 18, textAlign: "center", lineHeight: 1.5,
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table card ── */}
        <div style={{ background: "#fff", border: "1px solid #d4dde2", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          {/* Card head */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>Attendance List</span>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginLeft: 10 }}>
                {displayed.length} {displayed.length === 1 ? "person" : "people"}
              </span>
            </div>
            {/* Quick-set all */}
            {displayed.length > 0 && !isFuture && (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.4, marginRight: 2 }}>Set all:</span>
                {ALL_STATUSES.map(st => {
                  const c = STATUS_CONFIG[st];
                  return (
                    <button key={st} type="button" onClick={() => setAllTo(st)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${c.border}44`, background: c.bg, color: c.color, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isLoading ? (
            <div style={{ padding: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spinner size={32} color="#FF9B51" />
            </div>
          ) : displayed.length === 0 ? (
            <div style={{ padding: "56px 24px", textAlign: "center", color: "#94a3b8" }}>
              <i className="fa-solid fa-users-slash" style={{ fontSize: 32, display: "block", marginBottom: 12 }} />
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                {search ? "No matches found" : "No people in this category"}
              </p>
              <p style={{ fontSize: 12, marginTop: 4 }}>
                {search ? "Try a different name." : "Add staff or teachers first."}
              </p>
            </div>
          ) : (
            <div className="sa-tbl-wrap">
              <table>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Person", "Role", "Status"].map(h => (
                      <th key={h} style={{ padding: "11px 20px", textAlign: "left", fontWeight: 800, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.7, borderBottom: "1px solid #e8edf2", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(person => {
                    const key    = personKey(person);
                    const st     = (draft[key] ?? "present") as AttStatus;
                    const cfg    = STATUS_CONFIG[st];
                    const isTeacher = person._type === "teacher";
                    const initials  = person.full_name.slice(0, 2).toUpperCase();
                    const roleLabel = isTeacher ? "Teacher" : (person.role_name ?? "Staff");

                    return (
                      <tr key={key}
                        style={{
                          background: cfg.rowBg,
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.12s",
                        }}
                      >
                        {/* Person */}
                        <td style={{ padding: "13px 20px", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                              background: isTeacher ? "#e8edff" : "#fff1df",
                              color:      isTeacher ? "#3b5bdb" : "#c46a14",
                              display: "grid", placeItems: "center",
                              fontSize: 12, fontWeight: 900,
                            }}>
                              {initials}
                            </div>
                            <span style={{ fontWeight: 800, fontSize: 13.5, color: "#1e293b" }}>
                              {person.full_name}
                            </span>
                          </div>
                        </td>
                        {/* Role */}
                        <td style={{ padding: "13px 20px", verticalAlign: "middle" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "3px 9px", borderRadius: 5,
                            fontSize: 11, fontWeight: 800,
                            background: isTeacher ? "#e8edff" : "#f1f5f9",
                            color:      isTeacher ? "#3b5bdb" : "#475569",
                            border: `1px solid ${isTeacher ? "#c7d2fe" : "#e2e8f0"}`,
                          }}>
                            <i className={`fa-solid ${isTeacher ? "fa-chalkboard-user" : "fa-users-gear"}`} style={{ fontSize: 9 }} />
                            {roleLabel}
                          </span>
                        </td>
                        {/* Status toggle */}
                        <td style={{ padding: "13px 20px", verticalAlign: "middle" }}>
                          {isFuture ? (
                            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>—</span>
                          ) : (
                            <StatusToggle
                              value={st}
                              onChange={v => setStatus(key, v)}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Bottom: counts + save ── */}
        {!isLoading && total > 0 && (
          <div className="sa-bot-row"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            {/* Count pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([
                { label: "Total",    val: total,           color: "#25343F", bg: "#f8fafc", border: "#d4dde2" },
                { label: "Present",  val: counts.present,  color: STATUS_CONFIG.present.color,  bg: STATUS_CONFIG.present.bg,  border: "#a7e1c8" },
                { label: "Absent",   val: counts.absent,   color: STATUS_CONFIG.absent.color,   bg: STATUS_CONFIG.absent.bg,   border: "#fca5a5" },
                { label: "Leave",    val: counts.leave,    color: STATUS_CONFIG.leave.color,    bg: STATUS_CONFIG.leave.bg,    border: "#c4b5fd" },
                { label: "Half Day", val: counts.half_day, color: STATUS_CONFIG.half_day.color, bg: STATUS_CONFIG.half_day.bg, border: "#fdd5b0" },
              ] as const).map(c => (
                <div key={c.label}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 13px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}` }}>
                  <strong style={{ fontSize: 14, fontWeight: 900, color: c.color }}>{c.val}</strong>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.color, opacity: 0.85 }}>{c.label}</span>
                </div>
              ))}
            </div>
            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || isFuture || total === 0}
              style={{
                minHeight: 42, padding: "0 24px", borderRadius: 9, border: "none",
                background: saved ? "#12805c" : "#FF9B51",
                color: "#fff", fontWeight: 900, fontSize: 14,
                cursor: saving || isFuture ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 8,
                boxShadow: saved ? "0 3px 12px rgba(18,128,92,.3)" : "0 3px 12px rgba(255,155,81,.35)",
                opacity: isFuture ? 0.5 : 1, transition: "all 0.18s",
              }}
            >
              {saving ? <Spinner size={16} color="#fff" /> :
               saved  ? <i className="fa-solid fa-circle-check" /> :
                        <i className="fa-solid fa-floppy-disk" />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save Attendance"}
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
