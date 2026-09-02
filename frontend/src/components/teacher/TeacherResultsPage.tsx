"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

export default function TeacherResultsPage() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: exams }      = useApi<any[]>(
    activeYear?.id ? `/exams?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );
  const { data: mySubjectClasses, loading: mySubjectsLoading } = useApi<any[]>(
    activeYear?.id ? "/classes/me/subject-classes" : "",
    [activeYear?.id]
  );
  const { data: coordinatedSections, loading: coordinatedLoading } = useApi<any[]>(
    "/classes/me/coordinated-sections"
  );

  const myAssignments = useMemo(() => {
    if (!mySubjectClasses || !activeYear?.id) return [];
    return mySubjectClasses.filter((a: any) => a.academic_year_id === activeYear.id);
  }, [mySubjectClasses, activeYear?.id]);

  const mySubjectIds = useMemo(
    () => new Set(myAssignments.map((a: any) => a.subject_id)),
    [myAssignments]
  );

  const hasCoordinatedSections = Boolean(coordinatedSections && coordinatedSections.length > 0);

  // Tab View Mode
  const [viewMode, setViewMode] = useState<"entry" | "register">("entry");

  // Sync tab with URL search params
  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "register") {
      setViewMode("register");
    } else if (tab === "entry" || !tab) {
      setViewMode("entry");
    }
  }, [searchParams]);

  const [examId,             setExamId            ] = useState("");
  const [scheduleId,         setScheduleId        ] = useState("");
  const [schedules,          setSchedules         ] = useState<any[]>([]);
  const [schedulesLoading,   setSchedulesLoading  ] = useState(false);
  const [enrollments,        setEnrollments       ] = useState<any[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [results,            setResults           ] = useState<any[]>([]);
  const [marksMap,           setMarksMap          ] = useState<Record<string, { marks_obtained: string; is_absent: boolean; remarks: string }>>({});

  // ── Tab 2: Class Register State ──
  const [registerExamId,    setRegisterExamId   ] = useState("");
  const [registerSectionId, setRegisterSectionId] = useState("");

  const { execute: saveResult,   loading: saving } = useMutation("/exams/results", "POST");
  const { execute: updateResult                  } = useMutation("/exams/results", "PATCH");

  // Auto-select exam
  useEffect(() => {
    if (exams?.length) {
      if (!examId) setExamId(exams[0].id.toString());
      if (!registerExamId) setRegisterExamId(exams[0].id.toString());
    }
  }, [exams, examId, registerExamId]);

  // Auto-select first coordinated section
  useEffect(() => {
    if (coordinatedSections && coordinatedSections.length > 0 && !registerSectionId) {
      setRegisterSectionId(coordinatedSections[0].id.toString());
    }
  }, [coordinatedSections, registerSectionId]);

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

  // ── Tab 2: Class Register Query ──
  const selectedCoordinated = coordinatedSections?.find(s => s.id.toString() === registerSectionId);
  const { data: registerData, loading: registerLoading } = useApi<any>(
    registerExamId && selectedCoordinated
      ? `/exams/${registerExamId}/class/${selectedCoordinated.class_id}/register?section_id=${selectedCoordinated.id}`
      : ""
  );

  const enteredCount = Object.values(marksMap).filter(m => m.is_absent || m.marks_obtained !== "").length;
  const absentCount  = Object.values(marksMap).filter(m => m.is_absent).length;
  const passCount    = selectedSchedule
    ? Object.values(marksMap).filter(m => !m.is_absent && m.marks_obtained !== "" && parseFloat(m.marks_obtained) >= selectedSchedule.pass_marks).length
    : 0;

  if (!mySubjectsLoading && !coordinatedLoading && activeYear && exams && exams.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <main style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26, color: "#94a3b8" }}>
              <i className="fa-solid fa-pen-to-square" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px", color: "#0f172a" }}>No exams yet this year</h2>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, lineHeight: 1.6 }}>
              No exams have been scheduled for <strong>{activeYear?.year_name}</strong> yet.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!mySubjectsLoading && !coordinatedLoading && activeYear && myAssignments.length === 0 && !hasCoordinatedSections) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <main style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26, color: "#c46a14" }}>
              <i className="fa-solid fa-book-open" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>No assignments found</h2>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 600, lineHeight: 1.6 }}>
              You are not assigned to teach any subjects or coordinate any classes this academic year.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-register, .printable-register * { visibility: visible; }
          .printable-register { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <main style={{ padding: "20px 24px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── Page Header & Tabs ── */}
          <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Exam Results & Tabulation</h1>
              <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                {viewMode === "entry"
                  ? "Record and update student marks for your assigned subjects."
                  : "View complete class results, student progress, and rankings for your section."}
              </p>
            </div>

            {/* Segmented Switcher */}
            {hasCoordinatedSections && (
              <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("entry");
                    router.replace("/teacher/results", { scroll: false });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 18px",
                    borderRadius: 9,
                    border: viewMode === "entry" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
                    background: viewMode === "entry" ? "#fff7ed" : "#ffffff",
                    color: viewMode === "entry" ? "#ea580c" : "#64748b",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: viewMode === "entry" ? "0 1px 4px rgba(255,145,72,0.15)" : "none",
                    transition: "all 0.18s ease",
                  }}
                >
                  <i
                    className="fa-solid fa-pen-to-square"
                    style={{ color: viewMode === "entry" ? "#ff9148" : "#94a3b8" }}
                  />
                  <span>Enter Subject Marks</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("register");
                    router.replace("/teacher/results?tab=register", { scroll: false });
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 18px",
                    borderRadius: 9,
                    border: viewMode === "register" ? "1.5px solid #ff9148" : "1.5px solid #e2e8f0",
                    background: viewMode === "register" ? "#fff7ed" : "#ffffff",
                    color: viewMode === "register" ? "#ea580c" : "#64748b",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: viewMode === "register" ? "0 1px 4px rgba(255,145,72,0.15)" : "none",
                    transition: "all 0.18s ease",
                  }}
                >
                  <i
                    className="fa-solid fa-table-list"
                    style={{ color: viewMode === "register" ? "#ff9148" : "#94a3b8" }}
                  />
                  <span>Class Result Register</span>
                  <span style={{
                    padding: "2px 7px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 900,
                    background: viewMode === "register" ? "#fed7aa" : "#f1f5f9",
                    color: viewMode === "register" ? "#9a3412" : "#475569",
                  }}>
                    {coordinatedSections?.length ?? 0}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════════════
              VIEW MODE 1: SUBJECT MARKS ENTRY
             ══════════════════════════════════════════════════════════════════════════════ */}
          {viewMode === "entry" && (
            <>
              {/* Teaching assignment banner */}
              {myAssignments.length > 0 && (
                <div style={{ padding: "12px 18px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13, fontWeight: 700, color: "#15803d", display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="fa-solid fa-circle-check" style={{ fontSize: 16 }} />
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

              {/* Selector Card */}
              <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20, boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Exam selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                      Exam
                    </label>
                    <select
                      value={examId}
                      onChange={e => setExamId(e.target.value)}
                      style={{ height: 42, padding: "0 12px", borderRadius: 9, border: "1px solid #cbd5e1", fontSize: 13.5, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer" }}
                    >
                      {(exams ?? []).map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subject / Class selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 900, color: "#64748b", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                      Your Assigned Subject / Class
                    </label>
                    <select
                      value={scheduleId}
                      onChange={e => setScheduleId(e.target.value)}
                      disabled={schedules.length === 0}
                      style={{ height: 42, padding: "0 12px", borderRadius: 9, border: "1px solid #cbd5e1", fontSize: 13.5, fontWeight: 700, background: "#fff", outline: "none", cursor: schedules.length === 0 ? "not-allowed" : "pointer" }}
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

                {/* Meta Strip */}
                {selectedSchedule && (
                  <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: "1px solid #f1f5f9", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      {[
                        { label: "Subject",    value: selectedSchedule.subject_name },
                        { label: "Class",      value: selectedSchedule.class_name },
                        { label: "Max Marks",  value: selectedSchedule.max_marks },
                        { label: "Pass Marks", value: selectedSchedule.pass_marks },
                        { label: "Exam Date",  value: selectedSchedule.exam_date ?? "—" },
                      ].map((item, i) => (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{item.label}</span>
                          <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{item.value}</strong>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={saving || !selectedSchedule || isPublished}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "9px 20px", borderRadius: 9, border: "none",
                        background: !selectedSchedule || isPublished ? "#e2e8f0" : "#ff9148",
                        color:      !selectedSchedule || isPublished ? "#94a3b8" : "#ffffff",
                        fontWeight: 800, fontSize: 13.5, cursor: saving || !selectedSchedule || isPublished ? "not-allowed" : "pointer",
                        boxShadow: !selectedSchedule || isPublished ? "none" : "0 2px 8px rgba(255,145,72,0.25)",
                      }}
                    >
                      {saving ? <Spinner size={14} color="#fff" /> : <i className="fa-solid fa-floppy-disk" />}
                      {saving ? "Saving…" : "Save Marks"}
                    </button>
                  </div>
                )}
              </div>

              {/* Published Lock Notice */}
              {isPublished && (
                <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fefce8", border: "1.5px solid #fef08a", color: "#854d0e", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
                  <i className="fa-solid fa-lock" style={{ fontSize: 15 }} />
                  <span>Results for this subject have been published by the admin and are locked. Contact your admin to make changes.</span>
                </div>
              )}

              {/* Students marks table */}
              <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
                    Student Marks ({enrollments.length} Enrolled)
                  </h3>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                    <span>Entered: <strong>{enteredCount}</strong>/{enrollments.length}</span>
                    <span>Passed: <strong style={{ color: "#16a34a" }}>{passCount}</strong></span>
                    <span>Absent: <strong style={{ color: "#b45309" }}>{absentCount}</strong></span>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 800, fontSize: 11, textTransform: "uppercase" }}>
                        <th style={{ padding: "11px 16px", textAlign: "left" }}>Roll</th>
                        <th style={{ padding: "11px 16px", textAlign: "left" }}>Student Name</th>
                        <th style={{ padding: "11px 16px", textAlign: "left", width: 140 }}>Marks Obtained</th>
                        <th style={{ padding: "11px 16px", textAlign: "center", width: 90 }}>Absent</th>
                        <th style={{ padding: "11px 16px", textAlign: "left" }}>Remarks</th>
                        <th style={{ padding: "11px 16px", textAlign: "center", width: 100 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrollmentsLoading ? (
                        <tr><td colSpan={6} style={{ textAlign: "center", padding: 40 }}><Spinner size={28} color="#ff9148" /></td></tr>
                      ) : enrollments.length === 0 ? (
                        <tr><td colSpan={6} style={{ textAlign: "center", padding: 36, color: "#94a3b8", fontWeight: 700 }}>No students enrolled in this class.</td></tr>
                      ) : (
                        enrollments.map((en, idx) => {
                          const m = marksMap[en.student_id] || { marks_obtained: "", is_absent: false, remarks: "" };
                          const score = parseFloat(m.marks_obtained);
                          const hasScore = !m.is_absent && m.marks_obtained !== "" && !isNaN(score);
                          const isPass = hasScore && selectedSchedule ? score >= selectedSchedule.pass_marks : false;

                          return (
                            <tr key={en.id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                              <td style={{ padding: "11px 16px", fontWeight: 800, color: "#64748b" }}>{en.roll_number ?? idx + 1}</td>
                              <td style={{ padding: "11px 16px" }}>
                                <div style={{ fontWeight: 800, color: "#0f172a" }}>{en.full_name}</div>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>{en.admission_number}</div>
                              </td>
                              <td style={{ padding: "11px 16px" }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={selectedSchedule?.max_marks ?? 100}
                                  value={m.marks_obtained}
                                  disabled={m.is_absent || isPublished}
                                  onChange={e => updateMark(en.student_id, "marks_obtained", e.target.value)}
                                  placeholder={m.is_absent ? "Absent" : `Max ${selectedSchedule?.max_marks ?? 100}`}
                                  style={{
                                    width: "100%", height: 36, padding: "0 10px", borderRadius: 8,
                                    border: `1.5px solid ${hasScore ? (isPass ? "#86efac" : "#fca5a5") : "#cbd5e1"}`,
                                    background: m.is_absent ? "#f1f5f9" : "#ffffff",
                                    fontWeight: 800, fontSize: 13.5, color: "#0f172a", outline: "none",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "11px 16px", textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={m.is_absent}
                                  disabled={isPublished}
                                  onChange={e => {
                                    updateMark(en.student_id, "is_absent", e.target.checked);
                                    if (e.target.checked) updateMark(en.student_id, "marks_obtained", "");
                                  }}
                                  style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#ff9148" }}
                                />
                              </td>
                              <td style={{ padding: "11px 16px" }}>
                                <input
                                  type="text"
                                  value={m.remarks}
                                  disabled={isPublished}
                                  onChange={e => updateMark(en.student_id, "remarks", e.target.value)}
                                  placeholder="Optional remarks"
                                  style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12.5, outline: "none" }}
                                />
                              </td>
                              <td style={{ padding: "11px 16px", textAlign: "center" }}>
                                {m.is_absent ? (
                                  <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#fef3c7", color: "#b45309" }}>Absent</span>
                                ) : hasScore ? (
                                  isPass ? (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#dcfce7", color: "#15803d" }}>Pass</span>
                                  ) : (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#fee2e2", color: "#b91c1c" }}>Fail</span>
                                  )
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════════════════
              VIEW MODE 2: CLASS RESULT REGISTER / TABULATION SHEET (COORDINATOR ONLY)
             ══════════════════════════════════════════════════════════════════════════════ */}
          {viewMode === "register" && (
            <div className="printable-register" style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Top Selector Bar (No Print) */}
              <div className="no-print" style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                  {/* Exam Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Exam</label>
                    <select
                      value={registerExamId}
                      onChange={e => setRegisterExamId(e.target.value)}
                      style={{ height: 40, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer" }}
                    >
                      {(exams ?? []).map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                    </select>
                  </div>

                  {/* Coordinated Section Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Your Coordinated Section</label>
                    <select
                      value={registerSectionId}
                      onChange={e => setRegisterSectionId(e.target.value)}
                      style={{ height: 40, padding: "0 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5, fontWeight: 700, background: "#fff", outline: "none", cursor: "pointer" }}
                    >
                      {(coordinatedSections ?? []).map(sec => (
                        <option key={sec.id} value={sec.id}>
                          {sec.class_name} — Section {sec.name} (Coordinator)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {registerLoading ? (
                <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#ff9148" /></div>
              ) : !registerData ? (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontWeight: 700 }}>No register data available.</div>
              ) : (
                <>
                  {/* KPI Analytics Strip (No Print) */}
                  <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                    <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Total Students</span>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
                        {registerData.stats.total_students}
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{registerData.stats.appeared_count} appeared</span>
                    </div>

                    <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Pass Rate</span>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#16a34a", marginTop: 4 }}>
                        {registerData.stats.pass_rate_pct}%
                      </div>
                      <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>{registerData.stats.passed_count} of {registerData.stats.appeared_count} passed</span>
                    </div>

                    <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Class Average</span>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#3b82f6", marginTop: 4 }}>
                        {registerData.stats.class_avg_percentage}%
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Overall average score</span>
                    </div>

                    <div style={{ background: "linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)", padding: "16px 18px", borderRadius: 14, border: "1.5px solid #facc15" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#854d0e", textTransform: "uppercase" }}>Section Topper</span>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#854d0e", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {registerData.stats.topper ? registerData.stats.topper.student_name : "—"}
                      </div>
                      <span style={{ fontSize: 12, color: "#a16207", fontWeight: 800 }}>
                        {registerData.stats.topper ? `${registerData.stats.topper.percentage}% (Score ${registerData.stats.topper.total_obtained}/${registerData.stats.topper.total_max})` : "No scores entered"}
                      </span>
                    </div>

                    <div style={{ background: "#ffffff", padding: "16px 18px", borderRadius: 14, border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Needs Attention</span>
                      <div style={{ fontSize: 20, fontWeight: 900, color: registerData.stats.failed_count > 0 ? "#dc2626" : "#16a34a", marginTop: 4 }}>
                        {registerData.stats.failed_count}
                      </div>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>failing in 1+ subjects</span>
                    </div>
                  </div>

                  {/* ── Main Tabulation Sheet / Master Ledger Table ── */}
                  <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.03)" }}>
                    
                    {/* Sheet Header */}
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                          {registerData.class_info?.class_name} {registerData.section_info ? `— Section ${registerData.section_info.section_name}` : ""} : {registerData.exam?.name}
                        </h2>
                        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                          Section In-charge: <strong>{registerData.section_info?.coordinator_name || "You"}</strong> · {registerData.subjects?.length ?? 0} Scheduled Subjects
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        {registerData.exam?.is_schedule_published ? (
                          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>
                            Schedule Published
                          </span>
                        ) : (
                          <span style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                            Draft Schedule
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #cbd5e1", color: "#475569", fontWeight: 900, fontSize: 11, textTransform: "uppercase" }}>
                            <th style={{ padding: "12px 14px", textAlign: "left", width: 50, position: "sticky", left: 0, background: "#f8fafc" }}>Roll</th>
                            <th style={{ padding: "12px 14px", textAlign: "left", minWidth: 160, position: "sticky", left: 50, background: "#f8fafc" }}>Student Name</th>
                            {registerData.subjects.map((sub: any) => (
                              <th key={sub.subject_id} style={{ padding: "12px 12px", textAlign: "center", minWidth: 100 }}>
                                <div>{sub.subject_name}</div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8" }}>Max: {sub.max_marks}</span>
                              </th>
                            ))}
                            <th style={{ padding: "12px 12px", textAlign: "center", minWidth: 90, background: "#f1f5f9" }}>Total</th>
                            <th style={{ padding: "12px 12px", textAlign: "center", minWidth: 80, background: "#f1f5f9" }}>%</th>
                            <th style={{ padding: "12px 12px", textAlign: "center", minWidth: 70, background: "#f1f5f9" }}>GPA</th>
                            <th style={{ padding: "12px 12px", textAlign: "center", minWidth: 80, background: "#f1f5f9" }}>Status</th>
                            <th style={{ padding: "12px 12px", textAlign: "center", minWidth: 100, background: "#f1f5f9" }}>Rank</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registerData.students.length === 0 ? (
                            <tr><td colSpan={registerData.subjects.length + 7} style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontWeight: 700 }}>No enrolled students found in this section.</td></tr>
                          ) : (
                            registerData.students.map((stu: any, idx: number) => (
                              <tr key={stu.student_id} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                                <td style={{ padding: "10px 14px", fontWeight: 800, color: "#64748b", position: "sticky", left: 0, background: idx % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                                  {stu.roll_number ?? idx + 1}
                                </td>
                                <td style={{ padding: "10px 14px", position: "sticky", left: 50, background: idx % 2 === 0 ? "#ffffff" : "#fafbfc" }}>
                                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{stu.full_name}</div>
                                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{stu.admission_number}</span>
                                </td>

                                {/* Marks per subject */}
                                {registerData.subjects.map((sub: any) => {
                                  const markEntry = stu.marks[sub.subject_id];
                                  if (!markEntry) {
                                    return <td key={sub.subject_id} style={{ padding: "10px 12px", textAlign: "center", color: "#cbd5e1" }}>—</td>;
                                  }
                                  if (markEntry.is_absent) {
                                    return (
                                      <td key={sub.subject_id} style={{ padding: "10px 12px", textAlign: "center", background: "#fef3c7", color: "#b45309", fontWeight: 900, fontSize: 11 }}>
                                        ABS
                                      </td>
                                    );
                                  }
                                  const isFail = markEntry.marks_obtained !== null && !markEntry.is_passed;
                                  return (
                                    <td
                                      key={sub.subject_id}
                                      style={{
                                        padding: "10px 12px",
                                        textAlign: "center",
                                        fontWeight: 800,
                                        color: isFail ? "#dc2626" : "#0f172a",
                                        background: isFail ? "#fee2e2" : undefined,
                                      }}
                                    >
                                      {markEntry.marks_obtained ?? "—"}
                                      {markEntry.grade && <span style={{ fontSize: 10, color: isFail ? "#dc2626" : "#64748b", display: "block" }}>{markEntry.grade}</span>}
                                    </td>
                                  );
                                })}

                                {/* Total */}
                                <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 900, color: "#0f172a", background: "#f8fafc" }}>
                                  {stu.has_marks ? stu.total_obtained : "—"}
                                </td>

                                {/* Percentage */}
                                <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 900, color: "#0f172a", background: "#f8fafc" }}>
                                  {stu.overall_percentage !== null ? `${stu.overall_percentage}%` : "—"}
                                </td>

                                {/* GPA */}
                                <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: "#3b82f6", background: "#f8fafc" }}>
                                  {stu.overall_gpa !== null ? stu.overall_gpa : "—"}
                                </td>

                                {/* Status */}
                                <td style={{ padding: "10px 12px", textAlign: "center", background: "#f8fafc" }}>
                                  {stu.status === "passed" ? (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#dcfce7", color: "#15803d" }}>Pass</span>
                                  ) : stu.status === "failed" ? (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 900, background: "#fee2e2", color: "#b91c1c" }}>Fail ({stu.failed_subjects_count})</span>
                                  ) : (
                                    <span style={{ color: "#94a3b8", fontSize: 11 }}>Pending</span>
                                  )}
                                </td>

                                {/* Rank */}
                                <td style={{ padding: "10px 12px", textAlign: "center", background: "#f8fafc" }}>
                                  {stu.is_topper ? (
                                    <span style={{ padding: "3px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 900, background: "#fef08a", color: "#854d0e", border: "1px solid #facc15" }}>
                                      👑 #1 Topper
                                    </span>
                                  ) : stu.rank === 2 ? (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#e2e8f0", color: "#334155" }}>
                                      🥈 #2
                                    </span>
                                  ) : stu.rank === 3 ? (
                                    <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, background: "#ffedd5", color: "#9a3412" }}>
                                      🥉 #3
                                    </span>
                                  ) : stu.rank ? (
                                    <span style={{ fontWeight: 800, color: "#64748b" }}>#{stu.rank}</span>
                                  ) : (
                                    <span style={{ color: "#cbd5e1" }}>—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>

                        {/* Subject performance footer */}
                        {registerData.stats?.subject_stats && (
                          <tfoot>
                            <tr style={{ background: "#f1f5f9", borderTop: "2px solid #cbd5e1", fontWeight: 900, fontSize: 11.5, color: "#334155" }}>
                              <td colSpan={2} style={{ padding: "10px 14px", position: "sticky", left: 0, background: "#f1f5f9" }}>
                                Subject Averages
                              </td>
                              {registerData.stats.subject_stats.map((stat: any) => (
                                <td key={stat.subject_id} style={{ padding: "10px 12px", textAlign: "center" }}>
                                  <div>{stat.avg_marks !== null ? `${stat.avg_marks}` : "—"}</div>
                                  <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>{stat.pass_rate_pct}% pass</span>
                                </td>
                              ))}
                              <td colSpan={5} style={{ background: "#f1f5f9" }}></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
