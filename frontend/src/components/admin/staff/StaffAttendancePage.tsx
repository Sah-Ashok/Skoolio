"use client";

import { useState, useEffect, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { Spinner } from "@/components/shared/Loader";
import { useApi, useMutation } from "@/lib/useApi";
import styles from "./staff.module.css";
import { useDateFormat } from "@/lib/useDateFormat";
import DateInput from "@/components/shared/DateInput";

const s  = (n: string) => styles[n] || n;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

// ── Types ─────────────────────────────────────────────────────────────────────
type StaffMember   = { id: number; full_name: string; role_name?: string; status: string; _type: "staff"; };
type TeacherMember = { id: number; full_name: string; status: string; _type: "teacher"; };
type Person = StaffMember | TeacherMember;

const personKey = (p: Person) => `${p._type}-${p.id}`;

const ATT_STATUSES = [
  { key: "present",  label: "Present",  icon: "fa-check",              color: "#12805c" },
  { key: "absent",   label: "Absent",   icon: "fa-xmark",              color: "#b42318" },
  { key: "leave",    label: "Leave",    icon: "fa-moon",               color: "#3b5bdb" },
  { key: "half_day", label: "Half Day", icon: "fa-circle-half-stroke", color: "#c46a14" },
];

const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// ── Person Row ────────────────────────────────────────────────────────────────
function PersonRow({ person, current, onChange }: { person: Person; current: string; onChange: (s: string) => void }) {
  const isTeacher = person._type === "teacher";
  const roleLabel = isTeacher ? "Teacher" : (person as StaffMember).role_name ?? "Staff";
  return (
    <div className={s("attRow")}>
      <div className={s("attNameCell")}>
        <div
          className={s("attAvatar")}
          style={{ background: isTeacher ? "#e8edff" : "#fff1df", color: isTeacher ? "#3b5bdb" : "#c46a14" }}
        >
          {person.full_name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <strong className={s("attName")}>{person.full_name}</strong>
          <span className={s("attRole")}>
            <i className={`fa-solid ${isTeacher ? "fa-chalkboard-user" : "fa-users-gear"}`} style={{ marginRight: 4, fontSize: 10 }} />
            {roleLabel}
          </span>
        </div>
      </div>
      <div className={s("attBtns")}>
        {ATT_STATUSES.map(a => (
          <button
            key={a.key}
            className={cx(s("attBtn"), current === a.key && s("attBtnActive"))}
            style={current === a.key ? { background: a.color + "18", color: a.color, borderColor: a.color + "55" } : undefined}
            onClick={() => onChange(a.key)}
            title={a.label}
          >
            <i className={`fa-solid ${a.icon}`} />
            <span className={s("attBtnLabel")}>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function StaffAttendancePage() {
  const { data: staffList,   loading: loadingStaff }    = useApi<any[]>("/staff");
  const { data: teacherList, loading: loadingTeachers } = useApi<any[]>("/teachers");

  // date is always stored/sent as AD ISO string
  const [date,   setDate]   = useState(todayStr);
  const [filter, setFilter] = useState<"all" | "staff" | "teacher">("all");
  const [search, setSearch] = useState("");
  const [saved,  setSaved]  = useState(false);

  const { formatDate, isBS } = useDateFormat();

  // Display the date header in BS or AD
  const dateLabel = useMemo(() => {
    if (!date) return "";
    if (isBS) {
      // formatDate converts AD ISO → BS display string
      // Add weekday separately in English (weekday name is the same)
      const weekday = new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long" });
      return `${weekday}, ${formatDate(date)}`;
    }
    return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  }, [date, isBS, formatDate]);

  const { data: existingStaff,    refetch: refetchStaff }    = useApi<any[]>(`/staff/attendance?date=${date}`);
  const { data: existingTeachers, refetch: refetchTeachers } = useApi<any[]>(`/teachers/attendance?date=${date}`);

  const allPeople = useMemo<Person[]>(() => [
    ...(teacherList ?? []).filter((m: any) => m.status !== "inactive").map((m: any) => ({ ...m, _type: "teacher" as const })),
    ...(staffList   ?? []).filter((m: any) => m.status !== "terminated").map((m: any) => ({ ...m, _type: "staff" as const })),
  ], [staffList, teacherList]);

  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    allPeople.forEach(p => { next[personKey(p)] = "present"; });
    (existingStaff    ?? []).forEach((r: any) => { next[`staff-${r.staff_id}`]     = r.status; });
    (existingTeachers ?? []).forEach((r: any) => { next[`teacher-${r.teacher_id}`] = r.status; });
    setDraft(next);
    setSaved(false);
  }, [existingStaff, existingTeachers, allPeople.length]); // eslint-disable-line

  const { execute: saveStaff,   loading: savingStaff }    = useMutation("/staff/attendance/bulk",    "POST");
  const { execute: saveTeacher, loading: savingTeachers } = useMutation("/teachers/attendance/bulk", "POST");
  const saving = savingStaff || savingTeachers;

  const setStatus = (key: string, status: string) => { setSaved(false); setDraft(d => ({ ...d, [key]: status })); };

  const handleSave = async () => {
    const teachers = allPeople.filter(p => p._type === "teacher");
    const staff    = allPeople.filter(p => p._type === "staff");
    await Promise.all([
      teachers.length && saveTeacher({ date, records: teachers.map(p => ({ teacher_id: p.id, status: draft[personKey(p)] ?? "present" })) }),
      staff.length    && saveStaff  ({ date, records: staff.map(p =>    ({ staff_id:   p.id, status: draft[personKey(p)] ?? "present" })) }),
    ]);
    refetchStaff(); refetchTeachers();
    setSaved(true);
  };

  const displayed = useMemo(() => allPeople.filter(p => {
    const matchType   = filter === "all" || p._type === filter;
    const matchSearch = !search || p.full_name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  }), [allPeople, filter, search]);

  const summary = useMemo(() => {
    const c = { present: 0, absent: 0, leave: 0, half_day: 0 };
    allPeople.forEach(p => {
      const st = (draft[personKey(p)] ?? "present") as keyof typeof c;
      if (st in c) c[st]++;
    });
    return c;
  }, [draft, allPeople]);

  const total        = allPeople.length;
  const isLoading    = loadingStaff || loadingTeachers;
  const teacherCount = (teacherList ?? []).filter((m: any) => m.status !== "inactive").length;
  const staffCount   = (staffList   ?? []).filter((m: any) => m.status !== "terminated").length;

  // DateInput sends back AD ISO — clamp to today
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    // never allow future dates
    if (val > todayStr()) return;
    setDate(val);
    setSaved(false);
  };

  return (
    <div className={s("page")}>
      <Topbar title="Staff &amp; Teacher Attendance" subtitle="Mark daily attendance for all staff and teaching faculty" />
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div>
            <h1>Daily Attendance</h1>
            {/* Always shows in the school's calendar (BS or AD) */}
            <p>{dateLabel}</p>
          </div>
          <div className={s("actions")}>
            {/* DateInput is BS-aware — shows BS picker for BS schools, native for AD */}
            <DateInput
              value={date}
              max={todayStr()}
              onChange={handleDateChange}
              className={s("dateInput")}
            />
            <button
              className={cx(s("btn"), s("btnPrimary"))}
              onClick={handleSave}
              disabled={saving || isLoading || total === 0}
            >
              {saving ? <><Spinner size={14} color="#fff" /> Saving…</>
                : saved  ? <><i className="fa-solid fa-circle-check" /> Saved!</>
                : <><i className="fa-solid fa-floppy-disk" /> Save All</>}
            </button>
          </div>
        </section>

        {/* Summary bar */}
        <div className={s("attSummary")}>
          {[
            { label: "Present",  count: summary.present,  color: "#12805c" },
            { label: "Absent",   count: summary.absent,   color: "#b42318" },
            { label: "Leave",    count: summary.leave,    color: "#3b5bdb" },
            { label: "Half Day", count: summary.half_day, color: "#c46a14" },
          ].map(({ label, count, color }) => (
            <div key={label} className={s("attSumPill")} style={{ borderColor: color + "33", background: color + "11" }}>
              <span style={{ color, fontWeight: 900, fontSize: 22, lineHeight: 1 }}>{count}</span>
              <span style={{ color, fontWeight: 800, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</span>
            </div>
          ))}
          <div className={s("attSumTotal")}>
            <span style={{ fontWeight: 900, fontSize: 20, color: "#1f2d36" }}>{total}</span>
            <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 800, textTransform: "uppercase" }}>Total</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className={s("attToolbar")}>
          <div className={s("search")} style={{ flex: 1, minWidth: 180 }}>
            <i className="fa-solid fa-magnifying-glass" />
            <input placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className={s("attFilterGroup")}>
            {(["all", "teacher", "staff"] as const).map(f => (
              <button
                key={f}
                className={cx(s("attFilterBtn"), filter === f && s("attFilterActive"))}
                onClick={() => setFilter(f)}
              >
                <i className={`fa-solid ${f === "teacher" ? "fa-chalkboard-user" : f === "staff" ? "fa-users-gear" : "fa-users"}`} />
                {f === "all" ? "All" : f === "teacher" ? "Teachers" : "Staff"}
                <span className={s("attFilterCount")}>{f === "all" ? total : f === "teacher" ? teacherCount : staffCount}</span>
              </button>
            ))}
          </div>
        </div>

        {/* List card */}
        <div className={s("card")}>
          {isLoading ? (
            <div className={s("empty")}><Spinner size={32} color="#FF9B51" /></div>
          ) : displayed.length === 0 ? (
            <div className={s("empty")}>
              <i className="fa-solid fa-users-slash" />
              <p>{search ? "No matches found" : "No people in this category"}</p>
              <small>{search ? "Try a different name." : "Add staff or teachers first."}</small>
            </div>
          ) : (
            <>
              <div className={s("attHeader")}>
                <div className={s("attNameCell")} style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>Person</div>
                <div className={s("attBtns")} style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {ATT_STATUSES.map(a => <div key={a.key} style={{ flex: 1, textAlign: "center" }}>{a.label}</div>)}
                </div>
              </div>
              {displayed.map(p => (
                <PersonRow
                  key={personKey(p)}
                  person={p}
                  current={draft[personKey(p)] ?? "present"}
                  onChange={st => setStatus(personKey(p), st)}
                />
              ))}
            </>
          )}
        </div>

        {/* Quick-set all */}
        {displayed.length > 1 && (
          <div className={s("attQuickSet")}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#6a7882" }}>Set all shown:</span>
            {ATT_STATUSES.map(a => (
              <button
                key={a.key}
                className={cx(s("btn"), s("btnSm"))}
                style={{ background: a.color + "15", color: a.color, border: `1px solid ${a.color}44` }}
                onClick={() => {
                  const n = { ...draft };
                  displayed.forEach(p => { n[personKey(p)] = a.key; });
                  setDraft(n);
                  setSaved(false);
                }}
              >
                <i className={`fa-solid ${a.icon}`} /> All {a.label}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
