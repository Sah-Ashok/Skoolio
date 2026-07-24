"use client";

import { useState, useEffect, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

export default function TeacherResultsPage() {
  const dispatch = useAppDispatch();

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: exams }      = useApi<any[]>(
    activeYear?.id ? `/exams?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );
  const { data: mySubjectClasses, loading: mySubjectsLoading } = useApi<any[]>(
    activeYear?.id ? "/classes/me/subject-classes" : "",
    [activeYear?.id]
  );

  const myAssignments = useMemo(() => {
    if (!mySubjectClasses || !activeYear?.id) return [];
    return mySubjectClasses.filter((a: any) => a.academic_year_id === activeYear.id);
  }, [mySubjectClasses, activeYear?.id]);

  const mySubjectIds = useMemo(
    () => new Set(myAssignments.map((a: any) => a.subject_id)),
    [myAssignments]
  );

  const [examId,             setExamId            ] = useState("");
  const [scheduleId,         setScheduleId        ] = useState("");
  const [schedules,          setSchedules         ] = useState<any[]>([]);
  const [schedulesLoading,   setSchedulesLoading  ] = useState(false);
  const [enrollments,        setEnrollments       ] = useState<any[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [results,            setResults           ] = useState<any[]>([]);
  const [marksMap,           setMarksMap          ] = useState<Record<string, { marks_obtained: string; is_absent: boolean; remarks: string }>>({});

  const { execute: saveResult,   loading: saving } = useMutation("/exams/results", "POST");
  const { execute: updateResult                  } = useMutation("/exams/results", "PATCH");

  useEffect(() => {
    if (exams?.length && !examId) setExamId(exams[0].id.toString());
  }, [exams, examId]);

  useEffect(() => {
    if (!examId) { setSchedules([]); return; }
    const load = async () => {
      setSchedulesLoading(true);
      try {
        const res      = await apiRequest<{ data: any[] }>(`/exams/${examId}/schedules`);
        const filtered = (res.data || []).filter(
          (sch: any) => mySubjectIds.size === 0 || mySubjectIds.has(sch.subject_id)
        );
        setSchedules(filtered);
        setScheduleId(filtered.length > 0 ? filtered[0].id.toString() : "");
      } catch { setSchedules([]); }
      finally  { setSchedulesLoading(false); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, mySubjectIds]);

  const selectedSchedule = schedules.find(s => s.id.toString() === scheduleId);

  useEffect(() => {
    if (!selectedSchedule || !activeYear?.id) { setEnrollments([]); setResults([]); return; }
    const load = async () => {
      setEnrollmentsLoading(true);
      try {
        const [enrollRes, resultsRes] = await Promise.all([
          apiRequest<{ data: any[] }>(`/students/enrollments?academic_year_id=${activeYear.id}`),
          apiRequest<{ data: any[] }>(`/exams/${examId}/class/${selectedSchedule.class_id}/results`),
        ]);
        setEnrollments((enrollRes.data || []).filter(
          (en: any) => en.class_id?.toString() === selectedSchedule.class_id.toString()
        ));
        setResults(resultsRes.data || []);
      } catch { setEnrollments([]); setResults([]); }
      finally  { setEnrollmentsLoading(false); }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchedule?.id, activeYear?.id]);

  const existingByStudent = useMemo(() => {
    if (!selectedSchedule) return new Map<number, any>();
    const m = new Map<number, any>();
    results.filter(r => r.subject_id === selectedSchedule.subject_id).forEach(r => m.set(r.student_id, r));
    return m;
  }, [results, selectedSchedule]);

  useEffect(() => {
    if (!selectedSchedule) return;
    const init: Record<string, any> = {};
    enrollments.forEach(en => {
      const ex = existingByStudent.get(en.student_id);
      init[en.student_id] = {
        marks_obtained: ex?.marks_obtained != null ? ex.marks_obtained.toString() : "",
        is_absent:      ex ? ex.is_absent : false,
        remarks:        ex?.remarks || "",
      };
    });
    setMarksMap(init);
  }, [enrollments, existingByStudent, selectedSchedule]);

  const isPublished = results.some(
    r => r.status === "published" && r.subject_id === selectedSchedule?.subject_id
  );

  const updateMark = (studentId: number, field: string, value: string | boolean) =>
    setMarksMap(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));

  const handleSave = async () => {
    if (!selectedSchedule) return;
    try {
      const tasks = enrollments.map(en => {
        const entry = marksMap[en.student_id];
        if (!entry || (!entry.is_absent && entry.marks_obtained === "")) return null;
        const existing = existingByStudent.get(en.student_id);
        const payload  = {
          exam_id:        parseInt(examId),
          schedule_id:    selectedSchedule.id,
          student_id:     en.student_id,
          enrollment_id:  en.id,
          subject_id:     selectedSchedule.subject_id,
          max_marks:      selectedSchedule.max_marks,
          pass_marks:     selectedSchedule.pass_marks,
          marks_obtained: entry.is_absent ? undefined : parseFloat(entry.marks_obtained),
          is_absent:      entry.is_absent,
          remarks:        entry.remarks || undefined,
        };
        return existing
          ? updateResult(payload, `/exams/results/${existing.id}`)
          : saveResult(payload);
      }).filter(Boolean);

      if (!tasks.length) {
        dispatch(showToast({ type: "warning", title: "No Data", message: "No marks entered to save." }));
        return;
      }
      await Promise.all(tasks);
      dispatch(showToast({ type: "success", title: "Saved", message: "Marks saved successfully." }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save marks" }));
    }
  };

  // ── Stats for current schedule ─────────────────────────────────────────────
  const enteredCount = Object.values(marksMap).filter(
    m => m.is_absent || m.marks_obtained !== ""
  ).length;
  const absentCount  = Object.values(marksMap).filter(m => m.is_absent).length;
  const passCount    = selectedSchedule
    ? Object.values(marksMap).filter(
        m => !m.is_absent && m.marks_obtained !== "" &&
             parseFloat(m.marks_obtained) >= selectedSchedule.pass_marks
      ).length
    : 0;
  const totalStudents = enrollments.length;

  // ── No exams this year state ───────────────────────────────────────────────
  if (!mySubjectsLoading && activeYear && exams && exams.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
        <Topbar title="Enter Results" subtitle="Record marks for the subjects you teach" />
        <main style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26, color: "#94a3b8" }}>
              <i className="fa-solid fa-pen-to-square" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: "#1e293b" }}>No exams yet this year</h2>
            <p style={{ fontSize: 13, color: "#6a7882", fontWeight: 700, lineHeight: 1.6 }}>
              No exams have been scheduled for <strong>{activeYear?.year_name}</strong> yet.
              Ask your school admin to create and schedule an exam first.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── No subjects assigned state ─────────────────────────────────────────────
  if (!mySubjectsLoading && activeYear && myAssignments.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
        <Topbar title="Enter Results" subtitle="Record marks for the subjects you teach" />
        <main style={{ padding: 20, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26, color: "#c46a14" }}>
              <i className="fa-solid fa-book-open" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>No subjects assigned</h2>
            <p style={{ fontSize: 13, color: "#6a7882", fontWeight: 700, lineHeight: 1.6 }}>
              You are not assigned as a subject teacher for any class this year.
              Ask your admin to assign you in the class settings.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <Topbar title="Enter Results" subtitle="Record marks for the subjects you teach" />
      <main style={{ padding: 20, maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Page head ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e293b" }}>Exam Results Entry</h1>
            <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
              Only subjects you are assigned to teach in {activeYear?.year_name ?? "this year"} are shown.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !selectedSchedule || isPublished}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 22px", borderRadius: 9, border: "none",
              background: !selectedSchedule || isPublished ? "#e2e8f0" : "#1e293b",
              color:      !selectedSchedule || isPublished ? "#94a3b8" : "#fff",
              fontWeight: 800, fontSize: 14, cursor: saving || !selectedSchedule || isPublished ? "not-allowed" : "pointer",
              transition: "background .15s",
            }}
          >
            {saving ? <Spinner size={15} color="#fff" /> : <i className="fa-solid fa-floppy-disk" />}
            {saving ? "Saving…" : "Save Marks"}
          </button>
        </div>

        {/* ── Assignment banner ── */}
        {myAssignments.length > 0 && (
          <div style={{ padding: "11px 16px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13, fontWeight: 700, color: "#15803d", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <i className="fa-solid fa-circle-check" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              You teach <strong>{myAssignments.length}</strong> subject{myAssignments.length !== 1 ? "s" : ""} in {activeYear?.year_name}:&nbsp;
              {myAssignments.map((a: any, i: number) => (
                <span key={`${a.subject_id}_${a.class_id}`}>
                  {i > 0 && ", "}
                  <strong>{a.subject_name}</strong> ({a.class_name})
                </span>
              ))}
            </span>
          </div>
        )}

        {/* ── Selector card ── */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce5e9", padding: 20, boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Exam */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Exam
              </label>
              <select
                value={examId}
                onChange={e => setExamId(e.target.value)}
                style={{ height: 42, padding: "0 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer" }}
              >
                {(exams ?? []).map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>

            {/* Subject / Class */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={{ fontSize: 11, fontWeight: 900, color: "#6a7882", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Subject / Class
              </label>
              <select
                value={scheduleId}
                onChange={e => setScheduleId(e.target.value)}
                disabled={schedules.length === 0}
                style={{ height: 42, padding: "0 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 14, fontWeight: 700, background: "#fff", outline: "none", cursor: schedules.length === 0 ? "not-allowed" : "pointer", color: schedules.length === 0 ? "#94a3b8" : "#1e293b" }}
              >
                {schedules.length === 0
                  ? <option>No subjects scheduled for you in this exam</option>
                  : schedules.map(sch => (
                      <option key={sch.id} value={sch.id}>
                        {sch.subject_name ?? `Subject ${sch.subject_id}`} — {sch.class_name ?? `Class ${sch.class_id}`}
                      </option>
                    ))
                }
              </select>
            </div>
          </div>

          {/* Schedule meta info strip */}
          {selectedSchedule && (
            <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: "1px solid #f0f4f5", flexWrap: "wrap" }}>
              {[
                { label: "Subject",    value: selectedSchedule.subject_name },
                { label: "Class",      value: selectedSchedule.class_name   },
                { label: "Max Marks",  value: selectedSchedule.max_marks    },
                { label: "Pass Marks", value: selectedSchedule.pass_marks   },
                { label: "Date",       value: selectedSchedule.exam_date
                    ? new Date(selectedSchedule.exam_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                    : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
                  <strong style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>{value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Published lock notice ── */}
        {isPublished && (
          <div style={{ padding: "11px 16px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13, fontWeight: 700, color: "#15803d", display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-lock" />
            Results for this subject are published and locked from editing.
          </div>
        )}

        {/* ── Stats strip (only when schedule selected and students loaded) ── */}
        {selectedSchedule && totalStudents > 0 && !enrollmentsLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
            {[
              { label: "Total Students", value: totalStudents,  color: "#1e293b", bg: "#f7fafb", border: "#e2e8f0"  },
              { label: "Entered",        value: enteredCount,   color: "#1e293b", bg: "#f7fafb", border: "#e2e8f0"  },
              { label: "Pending",        value: totalStudents - enteredCount, color: "#c46a14", bg: "#fff1df", border: "#fde68a" },
              { label: "Absent",         value: absentCount,    color: "#b42318", bg: "#fde7e7", border: "#fca5a5"  },
              { label: "Passing",        value: passCount,      color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0"  },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 11, padding: "13px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</span>
                <strong style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</strong>
              </div>
            ))}
          </div>
        )}

        {/* ── Marks entry table ── */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce5e9", overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>
          {/* Card head */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f4f5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1e293b" }}>
                {selectedSchedule
                  ? `${selectedSchedule.subject_name} — ${selectedSchedule.class_name}`
                  : "Select an exam and subject above"}
              </h3>
              {selectedSchedule && (
                <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
                  Enter marks for each student. Check "Absent" if the student did not appear.
                </p>
              )}
            </div>
            {selectedSchedule && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ padding: "4px 12px", borderRadius: 999, background: "#f0fdf4", color: "#15803d", fontSize: 11, fontWeight: 900, border: "1px solid #bbf7d0" }}>
                  Max: {selectedSchedule.max_marks}
                </span>
                <span style={{ padding: "4px 12px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontSize: 11, fontWeight: 900, border: "1px solid #fed7aa" }}>
                  Pass: {selectedSchedule.pass_marks}
                </span>
              </div>
            )}
          </div>

          {/* Table body */}
          {schedulesLoading || enrollmentsLoading || mySubjectsLoading ? (
            <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
          ) : !selectedSchedule ? (
            <div style={{ padding: "4rem", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 22, color: "#94a3b8" }}>
                <i className="fa-solid fa-pen-to-square" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", margin: 0 }}>Select an exam schedule to begin entering marks.</p>
              <p style={{ fontSize: 12, color: "#c6d0d7", fontWeight: 700, marginTop: 6 }}>No subjects are currently scheduled for you in this exam.</p>
            </div>
          ) : enrollments.length === 0 ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>
              <i className="fa-solid fa-users-slash" style={{ fontSize: 26, display: "block", marginBottom: 12, opacity: 0.25 }} />
              No students enrolled in this class.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f7fafb" }}>
                    {["#", "Adm. No", "Student Name", "Absent", "Marks Obtained", "Remarks"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid #eef2f3", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((en, idx) => {
                    const entry       = marksMap[en.student_id] ?? { marks_obtained: "", is_absent: false, remarks: "" };
                    const existing    = existingByStudent.get(en.student_id);
                    const marksNum    = parseFloat(entry.marks_obtained);
                    const isPassing   = !isNaN(marksNum) && marksNum >= selectedSchedule.pass_marks;
                    const isFailing   = !isNaN(marksNum) && marksNum < selectedSchedule.pass_marks;
                    const rowBg       = entry.is_absent ? "#fff5f5" : existing ? "#f9fffe" : "#fff";

                    return (
                      <tr key={en.student_id} style={{ background: rowBg, borderBottom: "1px solid #f0f4f5" }}>
                        {/* # */}
                        <td style={{ padding: "14px 16px", width: 40 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8" }}>{idx + 1}</span>
                        </td>
                        {/* Adm no */}
                        <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: "#6a7882", fontFamily: "monospace" }}>{en.admission_number}</span>
                        </td>
                        {/* Name */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff1df", color: "#c46a14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                              {en.full_name?.charAt(0)}
                            </div>
                            <div>
                              <strong style={{ display: "block", fontSize: 13, fontWeight: 900, color: "#1e293b" }}>{en.full_name}</strong>
                              {existing && (
                                <span style={{ fontSize: 10, fontWeight: 800, color: "#12805c" }}>
                                  <i className="fa-solid fa-circle-check" style={{ marginRight: 3 }} />saved
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Absent toggle */}
                        <td style={{ padding: "14px 16px" }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: isPublished ? "not-allowed" : "pointer", userSelect: "none" }}>
                            <div
                              onClick={() => !isPublished && updateMark(en.student_id, "is_absent", !entry.is_absent)}
                              style={{
                                width: 38, height: 22, borderRadius: 11,
                                background: entry.is_absent ? "#b42318" : "#e2e8f0",
                                position: "relative", transition: "background .2s",
                                cursor: isPublished ? "not-allowed" : "pointer",
                                flexShrink: 0,
                              }}
                            >
                              <div style={{
                                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                                position: "absolute", top: 3,
                                left: entry.is_absent ? 19 : 3,
                                transition: "left .2s",
                                boxShadow: "0 1px 3px rgba(0,0,0,.2)",
                              }} />
                            </div>
                            {entry.is_absent && (
                              <span style={{ fontSize: 11, fontWeight: 900, color: "#b42318" }}>Absent</span>
                            )}
                          </label>
                        </td>
                        {/* Marks */}
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="number"
                              min={0}
                              max={selectedSchedule.max_marks}
                              value={entry.marks_obtained}
                              onChange={e => updateMark(en.student_id, "marks_obtained", e.target.value)}
                              disabled={isPublished || entry.is_absent}
                              placeholder={`/ ${selectedSchedule.max_marks}`}
                              style={{
                                width: 90, height: 38, padding: "0 10px",
                                borderRadius: 8,
                                border: `1.5px solid ${!entry.marks_obtained || entry.is_absent ? "#d1d5db" : isPassing ? "#a7f3d0" : "#fca5a5"}`,
                                background: entry.is_absent ? "#f8fafc" : "#fff",
                                fontSize: 14, fontWeight: 800, outline: "none",
                                color: isFailing ? "#b42318" : isPassing ? "#12805c" : "#1e293b",
                                textAlign: "center",
                              }}
                            />
                            {!entry.is_absent && entry.marks_obtained !== "" && (
                              <span style={{
                                fontSize: 11, fontWeight: 900, padding: "3px 9px", borderRadius: 999,
                                background: isPassing ? "#e2f6ee" : "#fde7e7",
                                color:      isPassing ? "#12805c" : "#b42318",
                              }}>
                                {isPassing ? "Pass" : "Fail"}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* Remarks */}
                        <td style={{ padding: "14px 16px" }}>
                          <input
                            type="text"
                            value={entry.remarks}
                            onChange={e => updateMark(en.student_id, "remarks", e.target.value)}
                            disabled={isPublished}
                            placeholder="Optional"
                            style={{ width: 160, height: 38, padding: "0 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 600, outline: "none", background: "#fff" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer summary row */}
                {enrollments.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#f7fafb", borderTop: "2px solid #eef2f3" }}>
                      <td colSpan={3} style={{ padding: "12px 16px", fontSize: 12, fontWeight: 900, color: "#6a7882" }}>
                        {enteredCount} of {totalStudents} filled &nbsp;·&nbsp; {absentCount} absent &nbsp;·&nbsp; {passCount} passing
                      </td>
                      <td colSpan={3} style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          onClick={handleSave}
                          disabled={saving || isPublished}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 7,
                            padding: "9px 20px", borderRadius: 8, border: "none",
                            background: isPublished ? "#e2e8f0" : "#1e293b",
                            color: isPublished ? "#94a3b8" : "#fff",
                            fontWeight: 800, fontSize: 13, cursor: saving || isPublished ? "not-allowed" : "pointer",
                          }}
                        >
                          {saving ? <Spinner size={14} color="#fff" /> : <i className="fa-solid fa-floppy-disk" />}
                          {saving ? "Saving…" : "Save All Marks"}
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Bottom note */}
        <div style={{ padding: "11px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <i className="fa-solid fa-circle-info" style={{ color: "#c2410c", fontSize: 13, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
            Saved marks are in draft until your school admin reviews and publishes the results. Students will not see marks until published.
          </span>
        </div>
      </main>
    </div>
  );
}
