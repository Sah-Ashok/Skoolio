"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./attendance.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";

const s  = (n: string) => styles[n] || n;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

// FIX: Removed "late" — only Present, Absent, Leave
type AttendanceStatus = "present" | "absent" | "leave";

const PAL: { key: AttendanceStatus; label: string; short: string; activeClass: string }[] = [
  { key: "present", label: "Present", short: "P",  activeClass: "palActiveP"  },
  { key: "absent",  label: "Absent",  short: "A",  activeClass: "palActiveA"  },
  { key: "leave",   label: "Leave",   short: "Lv", activeClass: "palActiveLv" },
];

export default function MarkClassAttendancePage() {
  const dispatch   = useAppDispatch();
  const router     = useRouter();
  const { formatDate } = useDateFormat();
  const { user }   = useAppSelector(s => s.auth);
  const isFaculty  = user?.role === "faculty";

  const { activeYear, academicYearId } = useAcademicYear();
  // Only fetch teachers list for admin — faculty gets 403 on GET /teachers
  const { data: teachers   } = useApi<any[]>(!isFaculty ? "/teachers" : "");

  // Faculty: only their coordinator sections | Admin: all classes
  const { data: mySections, loading: mySectionsLoading } = useApi<any[]>(
    isFaculty ? "/teachers/me/sections" : ""
  );
  const { data: allClasses, loading: classesLoading } = useApi<any[]>(
    !isFaculty && academicYearId
      ? `/classes?academic_year_id=${academicYearId}`
      : "",
    [academicYearId]
  );

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [classId,      setClassId]      = useState("");
  const [sectionId,    setSectionId]    = useState("");
  const [markedBy,     setMarkedBy]     = useState(isFaculty ? String(user?.id || "") : "");
  const [sections,     setSections]     = useState<any[]>([]);
  const [students,     setStudents]     = useState<any[]>([]);
  const [studentStats, setStudentStats] = useState<Record<number, any>>({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [statusMap,    setStatusMap]    = useState<Record<number, AttendanceStatus>>({});

  // ── Date lock: teachers cannot edit attendance before 1st of previous month ──
  const today = new Date().toISOString().split("T")[0];
  const prevMonth1 = (() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split("T")[0];
  })();
  const isDateLocked = selectedDate < prevMonth1;

  // Bulk mark by roll_number (FIX: was admission_number)
  const [bulkRolls, setBulkRolls]  = useState("");
  const [bulkMark,  setBulkMark]   = useState<AttendanceStatus>("absent");

  // ── Faculty: auto-populate from my-sections ─────────────────────────────
  useEffect(() => {
    if (!isFaculty || !mySections?.length) return;
    // Group by class for the selector
    const first = mySections[0];
    if (first) {
      setClassId(String(first.class_id));
      setSectionId(String(first.id));
      setSections(mySections.filter(s => s.class_id === first.class_id));
    }
  }, [isFaculty, mySections]);

  // ── Admin: load sections when class changes ──────────────────────────────
  const loadSections = useCallback(async (cId: string) => {
    if (isFaculty) return; // faculty uses my-sections
    setSections([]);
    setSectionId("");
    setStudents([]);
    setStatusMap({});
    if (!cId) return;
    try {
      const res = await apiRequest<{ data: any[] }>(`/classes/${cId}/sections`);
      const list = res.data || [];
      setSections(list);
      if (list.length) setSectionId(String(list[0].id));
    } catch { setSections([]); }
  }, [isFaculty]);

  useEffect(() => {
    if (!isFaculty && allClasses?.length && !classId) {
      const first = String(allClasses[0].id);
      setClassId(first);
      loadSections(first);
    }
  }, [allClasses]); // eslint-disable-line

  // ── Load students for selected section ───────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setStudents([]);
      setStatusMap({});
      setStudentStats({});
      if (!academicYearId || !sectionId) return;

      setLoadingStudents(true);
      try {
        // Enrollments for this section
        const res = await apiRequest<{ data: any[] }>(
          `/students/enrollments?academic_year_id=${academicYearId}&section_id=${sectionId}`
        );
        const list = res.data || [];
        setStudents(list);
        const map: Record<number, AttendanceStatus> = {};
        list.forEach((en: any) => { map[en.student_id] = "present"; });
        setStatusMap(map);

        // Batch attendance stats per student for this section
        const today       = new Date().toISOString().split("T")[0];
        const start_date  = activeYear?.start_date || `${new Date().getFullYear()}-01-01`;
        try {
          const statsRes = await apiRequest<{ data: any[] }>(
            `/attendance/section/${sectionId}/summary?academic_year_id=${academicYearId}&start_date=${start_date}&end_date=${today}`
          );
          const statsMap: Record<number, any> = {};
          (statsRes.data || []).forEach((r: any) => { statsMap[r.student_id] = r; });
          setStudentStats(statsMap);
        } catch { /* stats are optional — don't block attendance */ }
      } catch {
        setStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    };
    load();
  }, [academicYearId, sectionId]);

  // ── Derived counts ────────────────────────────────────────────────────────
  const counts = students.reduce(
    (acc, en) => { acc[statusMap[en.student_id] || "present"]++; return acc; },
    { present: 0, absent: 0, leave: 0 } as Record<AttendanceStatus, number>
  );

  const setStatus = (studentId: number, status: AttendanceStatus) =>
    setStatusMap(prev => ({ ...prev, [studentId]: status }));

  const markAll = (status: AttendanceStatus) => {
    const map: Record<number, AttendanceStatus> = {};
    students.forEach(en => { map[en.student_id] = status; });
    setStatusMap(map);
    dispatch(showToast({ type: "success", title: "Done", message: `All students marked ${status}.` }));
  };

  // ── Bulk mark by roll_number (FIX) ────────────────────────────────────────
  const applyBulk = () => {
    const rolls = bulkRolls.split(",").map(r => r.trim()).filter(Boolean);
    if (!rolls.length) {
      dispatch(showToast({ type: "warning", title: "Empty", message: "Enter at least one Roll No." }));
      return;
    }
    // Build roll_number → student_id map
    const rollMap: Record<string, number> = {};
    students.forEach(en => {
      if (en.roll_number) rollMap[String(en.roll_number)] = en.student_id;
    });

    const unknown = rolls.filter(r => !rollMap[r]);
    if (unknown.length) {
      dispatch(showToast({ type: "warning", title: "Not Found", message: `Unknown Roll Nos: ${unknown.join(", ")}` }));
      return;
    }
    setStatusMap(prev => {
      const next = { ...prev };
      rolls.forEach(r => { next[rollMap[r]] = bulkMark; });
      return next;
    });
    setBulkRolls("");
    dispatch(showToast({ type: "success", title: "Applied", message: `${rolls.length} student(s) marked ${bulkMark}.` }));
  };

  // ── Save attendance ───────────────────────────────────────────────────────
  const saveAttendance = async () => {
    if (!academicYearId || !sectionId) {
      dispatch(showToast({ type: "warning", title: "Missing", message: "Select section and date." }));
      return;
    }
    if (!markedBy) {
      dispatch(showToast({ type: "warning", title: "Missing", message: "Select the teacher marking attendance." }));
      return;
    }
    if (!students.length) {
      dispatch(showToast({ type: "warning", title: "No Students", message: "No enrolled students in this section." }));
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/attendance", {
        method: "POST",
        body: JSON.stringify({
          academic_year_id: academicYearId,
          class_id:         classId ? Number(classId) : students[0]?.class_id,
          section_id:       Number(sectionId),
          date:             selectedDate,
          marked_by:        Number(markedBy),
          students: students.map(en => ({
            student_id:    en.student_id,
            enrollment_id: en.id,
            status:        statusMap[en.student_id] || "present",
          })),
        }),
      });
      dispatch(showToast({
        type: "success",
        title: "Attendance Saved",
        message: `P:${counts.present}  A:${counts.absent}  Lv:${counts.leave} — saved for ${selectedDate}.`,
      }));
      router.push(isFaculty ? "/teacher/attendance" : "/attendance");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not save attendance." }));
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const rowBg = (studentId: number) => {
    const st = statusMap[studentId];
    if (st === "absent") return s("absentTableRow");
    if (st === "leave")  return s("leaveTableRow");
    return undefined;
  };

  const getAttPct = (studentId: number) => {
    const stat = studentStats[studentId];
    if (!stat) return null;
    const present = Number(stat.total_present || 0);
    const marked  = Number(stat.total_marked  || 0);
    if (!marked) return 100;
    return Math.round((present / marked) * 100);
  };

  const selectedSection = [...sections, ...(mySections || [])].find(s => String(s.id) === sectionId);
  const selectedClass   = allClasses?.find(c => String(c.id) === classId);
  const isLoading       = classesLoading || mySectionsLoading;

  return (
    <div className={s("page")}>
      <Topbar title="Mark Attendance" subtitle="Record daily class attendance" />

      <main className={s("content")}>
        {/* ── Header ── */}
        <section className={s("head")}>
          <div>
            <h1>Mark Attendance</h1>
            <p>
              {isFaculty
                ? `Your section${selectedSection ? ` — Section ${selectedSection.name} · ${selectedSection.class_name || ""}` : ""}`
                : `${selectedClass?.name || "Select class"}${selectedSection ? ` — Section ${selectedSection.name}` : ""}`
              }
              {" · "}
              {formatDate(selectedDate)}
            </p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href={isFaculty ? "/teacher/attendance" : "/attendance"}>
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            <button className={cx(s("btn"), s("btnPrimary"))} onClick={saveAttendance} disabled={saving || !students.length}>
              {saving
                ? <><Spinner size={15} /> Saving…</>
                : <><i className="fa-solid fa-floppy-disk" /> Save Attendance</>}
            </button>
          </div>
        </section>

        {/* ── Selectors ── */}
        <section className={s("markHero")}>
          {/* Faculty sees section picker from their own sections */}
          {isFaculty ? (
            <label>
              <span>Your Section</span>
              <select
                value={sectionId}
                onChange={e => {
                  setSectionId(e.target.value);
                  const sec = mySections?.find(s => String(s.id) === e.target.value);
                  if (sec) setClassId(String(sec.class_id));
                }}
              >
                <option value="">— Select Your Section —</option>
                {(mySections || []).map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.class_name} — Section {sec.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                <span>Class</span>
                <select value={classId} onChange={e => { setClassId(e.target.value); loadSections(e.target.value); }}>
                  <option value="">— Select Class —</option>
                  {allClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span>Section</span>
                <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId || !sections.length}>
                  <option value="">— Select Section —</option>
                  {sections.map(sec => <option key={sec.id} value={sec.id}>Section {sec.name}</option>)}
                </select>
              </label>
            </>
          )}

          <label>
            <span>Date</span>
            <input
              type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </label>

          <label>
            <span>Marked By</span>
            {isFaculty ? (
              <input value={user?.full_name || "You"} readOnly />
            ) : (
              <select value={markedBy} onChange={e => setMarkedBy(e.target.value)}>
                <option value="">— Select Teacher —</option>
                {teachers?.filter(t => t.status === "active").map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            )}
          </label>
        </section>

        {/* ── Summary strip ── */}
        {students.length > 0 && (
          <section className={s("metricStrip")}>
            {([
              ["Total",    students.length, "Enrolled",  ""],
              ["Present",  counts.present,  "P",         "successText"],
              ["Absent",   counts.absent,   "A",         "dangerText"],
              ["On Leave", counts.leave,    "Lv",        ""],
            ] as const).map(([label, val, abbr, cls]) => (
              <div key={label}>
                <span>{label}</span>
                <strong className={cls ? s(cls) : undefined}>{val}</strong>
                <small>{abbr}</small>
              </div>
            ))}
          </section>
        )}

        {/* ── Date lock warning ── */}
        {isDateLocked && (
          <div style={{
            padding: "12px 16px", borderRadius: 12, marginBottom: 4,
            background: "#fef3c7", border: "1px solid #fde68a",
            display: "flex", alignItems: "center", gap: 12,
            fontSize: 13.5, fontWeight: 700, color: "#92400e",
          }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 16, flexShrink: 0 }} />
            <span>
              This date is before <strong>{formatDate(prevMonth1)}</strong>.
              Attendance records this old are <strong>read-only</strong> and cannot be edited.
            </span>
          </div>
        )}

        {/* ── Student table ── */}
        <article className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h2>Student Attendance</h2>
              <p>Toggle P · A · Lv for each student. Default is <strong>Present</strong>. % shows year-to-date attendance.</p>
            </div>
            {students.length > 0 && (
              <button className={cx(s("btn"), s("btnSoft"))} onClick={() => markAll("present")} type="button">
                <i className="fa-solid fa-check-double" /> All Present
              </button>
            )}
          </div>

          <div className={s("attendanceTableWrap")}>
            {(isLoading || loadingStudents) ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading students…" /></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th style={{ width: 90 }}>Roll No</th>
                    <th>Student Name</th>
                    <th style={{ width: 80, textAlign: "center" }}>YTD %</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "#6a7882" }}>
                        <i className="fa-solid fa-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                        {sectionId ? "No enrolled students in this section." : "Select a section to begin."}
                      </td>
                    </tr>
                  ) : students.map((en, idx) => {
                    const pct = getAttPct(en.student_id);
                    return (
                      <tr key={en.student_id} className={rowBg(en.student_id)}>
                        <td style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <strong style={{ fontSize: 13, fontFamily: "monospace" }}>
                            {en.roll_number ?? "—"}
                          </strong>
                        </td>
                        <td>
                          <div>
                            <strong style={{ fontSize: 13 }}>{en.full_name}</strong>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{en.admission_number}</div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {pct !== null ? (
                            <span style={{
                              fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 20,
                              background: pct >= 75 ? "#dcfce7" : pct >= 60 ? "#fef3c7" : "#fde7e7",
                              color:      pct >= 75 ? "#15803d" : pct >= 60 ? "#b45309" : "#b42318",
                            }}>
                              {pct}%
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>new</span>
                          )}
                        </td>
                        <td>
                          <div className={s("palToggle")}>
                            {PAL.map(({ key, short, activeClass }) => (
                              <button
                                key={key}
                                type="button"
                                className={cx(s("palBtn"), statusMap[en.student_id] === key && s(activeClass))}
                                onClick={() => setStatus(en.student_id, key)}
                                disabled={isDateLocked}
                                title={isDateLocked ? "Record is read-only (too old to edit)" : undefined}
                              >
                                {short}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {students.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={2}><strong>{students.length}</strong> students</td>
                      <td colSpan={2}>
                        <span className={s("successText")}>P: {counts.present}</span>
                        {" · "}
                        <span className={s("dangerText")}>A: {counts.absent}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>Lv: {counts.leave}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </article>

        {/* ── Bulk Mark by Roll No ── */}
        {students.length > 0 && (
          <article className={cx(s("card"), s("bottomBulkCard"))}>
            <div className={s("cardHead")}>
              <div>
                <h2>
                  <i className="fa-solid fa-bolt" style={{ color: "#ff9b51", marginRight: 8 }} />
                  Bulk Mark by Roll No
                </h2>
                <p>Enter Roll Numbers (comma separated) and mark them all at once.</p>
              </div>
            </div>
            <div className={s("bulkAbsent")}>
              <label>
                <span>Roll Numbers</span>
                <input
                  value={bulkRolls}
                  onChange={e => setBulkRolls(e.target.value)}
                  placeholder="e.g. 1, 2, 5, 12"
                />
              </label>
              <label>
                <span>Mark As</span>
                <select value={bulkMark} onChange={e => setBulkMark(e.target.value as AttendanceStatus)}>
                  <option value="present">Present (P)</option>
                  <option value="absent">Absent (A)</option>
                  <option value="leave">Leave (Lv)</option>
                </select>
              </label>
              <button className={cx(s("btn"), s("btnPrimary"))} type="button" onClick={applyBulk}>
                <i className="fa-solid fa-check" /> Apply
              </button>
              <button className={cx(s("btn"), s("btnSoft"))} type="button" onClick={() => markAll("present")}>
                All Present
              </button>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
