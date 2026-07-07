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

  // ── Fetch this teacher's subject-class assignments from class_subject_teachers
  // GET /classes/me/subject-classes → [{class_id, class_name, subject_id, subject_name, academic_year_id}]
  const { data: mySubjectClasses, loading: mySubjectsLoading } = useApi<any[]>(
    activeYear?.id ? "/classes/me/subject-classes" : "",
    [activeYear?.id]
  );

  // Filter to the active academic year
  const myAssignments = useMemo(() => {
    if (!mySubjectClasses || !activeYear?.id) return [];
    return mySubjectClasses.filter((a: any) => a.academic_year_id === activeYear.id);
  }, [mySubjectClasses, activeYear?.id]);

  // Build a Set of subject_ids this teacher is assigned to in this year
  const mySubjectIds = useMemo(
    () => new Set(myAssignments.map((a: any) => a.subject_id)),
    [myAssignments]
  );

  const [examId,      setExamId]      = useState("");
  const [scheduleId,  setScheduleId]  = useState("");
  const [schedules,   setSchedules]   = useState<any[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [results,     setResults]     = useState<any[]>([]);
  const [marksMap,    setMarksMap]    = useState<Record<string, { marks_obtained: string; is_absent: boolean; remarks: string }>>({});

  const { execute: saveResult,   loading: saving   } = useMutation("/exams/results", "POST");
  const { execute: updateResult                     } = useMutation("/exams/results", "PATCH");

  // Auto-select first exam
  useEffect(() => {
    if (exams?.length && !examId) setExamId(exams[0].id.toString());
  }, [exams, examId]);

  // Load schedules — filtered to only subjects this teacher is assigned to
  useEffect(() => {
    if (!examId) { setSchedules([]); return; }
    const load = async () => {
      setSchedulesLoading(true);
      try {
        const res = await apiRequest<{ data: any[] }>(`/exams/${examId}/schedules`);
        // Filter schedules to subjects where this teacher is the assigned teacher
        const filtered = (res.data || []).filter(
          (sch: any) => mySubjectIds.size === 0 || mySubjectIds.has(sch.subject_id)
        );
        setSchedules(filtered);
        setScheduleId(filtered.length > 0 ? filtered[0].id.toString() : "");
      } catch {
        setSchedules([]);
      } finally {
        setSchedulesLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, mySubjectIds]);

  const selectedSchedule = schedules.find((sch) => sch.id.toString() === scheduleId);

  // Load enrollments + existing results for the selected schedule
  useEffect(() => {
    if (!selectedSchedule || !activeYear?.id) {
      setEnrollments([]);
      setResults([]);
      return;
    }
    const load = async () => {
      setEnrollmentsLoading(true);
      try {
        const [enrollRes, resultsRes] = await Promise.all([
          apiRequest<{ data: any[] }>(`/students/enrollments?academic_year_id=${activeYear.id}`),
          apiRequest<{ data: any[] }>(`/exams/${examId}/class/${selectedSchedule.class_id}/results`),
        ]);
        // Only students enrolled in the class for this exam schedule
        const filtered = (enrollRes.data || []).filter(
          (en: any) => en.class_id?.toString() === selectedSchedule.class_id.toString()
        );
        setEnrollments(filtered);
        setResults(resultsRes.data || []);
      } catch {
        setEnrollments([]);
        setResults([]);
      } finally {
        setEnrollmentsLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchedule?.id, activeYear?.id]);

  // Map existing results by student for current subject
  const existingByStudent = useMemo(() => {
    if (!selectedSchedule) return new Map<number, any>();
    const m = new Map<number, any>();
    results
      .filter((r) => r.subject_id === selectedSchedule.subject_id)
      .forEach((r) => m.set(r.student_id, r));
    return m;
  }, [results, selectedSchedule]);

  // Populate marks input from existing results
  useEffect(() => {
    if (!selectedSchedule) return;
    const init: Record<string, any> = {};
    enrollments.forEach((en) => {
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
    (r) => r.status === "published" && r.subject_id === selectedSchedule?.subject_id
  );

  const updateMark = (studentId: number, field: string, value: string | boolean) => {
    setMarksMap((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const handleSave = async () => {
    if (!selectedSchedule) return;
    try {
      const tasks = enrollments
        .map((en) => {
          const entry = marksMap[en.student_id];
          if (!entry) return null;
          if (!entry.is_absent && entry.marks_obtained === "") return null;

          const existing = existingByStudent.get(en.student_id);
          const payload = {
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

          if (existing) return updateResult(payload, `/exams/results/${existing.id}`);
          return saveResult(payload);
        })
        .filter(Boolean);

      if (!tasks.length) {
        dispatch(showToast({ type: "warning", title: "No Data", message: "No marks entered to save." }));
        return;
      }
      await Promise.all(tasks);
      dispatch(showToast({
        type: "success",
        title: "Saved",
        message: "Marks saved. Your school admin will publish them once reviewed.",
      }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save marks" }));
    }
  };

  // ── Empty state: teacher has no subject-class assignments ──
  if (!mySubjectsLoading && activeYear && myAssignments.length === 0) {
    return (
      <div className="main-wrapper">
        <Topbar title="Enter Results" subtitle="You have no subject assignments for this academic year" />
        <main className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, color: "#c46a14" }}>
              <i className="fa-solid fa-book-open" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>No subjects assigned</h2>
            <p style={{ fontSize: 13, color: "#6a7882", fontWeight: 700, lineHeight: 1.6 }}>
              You are not assigned as a subject teacher for any class in this academic year.
              Ask your admin to assign you to a subject in the class settings.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="main-wrapper">
      <Topbar title="Enter Results" subtitle="Record marks for the subjects you teach" />

      <main className="page-content">
        <section className="page-header">
          <div>
            <h2>Exam Results Entry</h2>
            <p>Only subjects you are assigned to teach in this academic year are shown.</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !selectedSchedule || isPublished}
          >
            {saving
              ? <Spinner size={16} />
              : <><i className="fa-solid fa-floppy-disk" /> Save Marks</>
            }
          </button>
        </section>

        {/* My subject assignment summary */}
        {myAssignments.length > 0 && (
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: "#f0fdf4", border: "1px solid #bbf7d0",
            marginBottom: 16, fontSize: 13, fontWeight: 700, color: "#15803d",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <i className="fa-solid fa-circle-check" style={{ flexShrink: 0 }} />
            <span>
              You are assigned to teach{" "}
              <strong>{myAssignments.length}</strong>{" "}
              subject{myAssignments.length !== 1 ? "s" : ""} in {activeYear?.year_name}:&nbsp;
              {myAssignments.map((a: any, i: number) => (
                <span key={a.subject_id + "_" + a.class_id}>
                  {i > 0 && ", "}
                  <em style={{ fontStyle: "normal", fontWeight: 900 }}>{a.subject_name}</em>
                  {" "}({a.class_name})
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Exam + schedule selectors */}
        <section className="form-grid" style={{ marginBottom: "20px" }}>
          <div className="form-group">
            <label className="form-label">Exam</label>
            <select className="form-control" value={examId} onChange={(e) => setExamId(e.target.value)}>
              {exams?.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Subject / Class</label>
            <select
              className="form-control"
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              disabled={schedules.length === 0}
            >
              {schedules.length === 0
                ? <option>No subjects scheduled for you in this exam</option>
                : schedules.map((sch) => (
                    <option key={sch.id} value={sch.id}>
                      {sch.class_name || `Class ${sch.class_id}`} — {sch.subject_name || `Subject ${sch.subject_id}`}
                    </option>
                  ))
              }
            </select>
          </div>
        </section>

        {isPublished && (
          <div className="card" style={{ padding: "0.75rem 1rem", marginBottom: "1rem", background: "#ecfdf5", color: "#047857", fontWeight: 700 }}>
            <i className="fa-solid fa-lock" style={{ marginRight: 8 }} />
            Results for this subject are published and locked from editing.
          </div>
        )}

        {/* Marks entry table */}
        <section className="card">
          <div className="card-header">
            <h3>
              {selectedSchedule
                ? `${selectedSchedule.subject_name} · ${selectedSchedule.class_name} · Max: ${selectedSchedule.max_marks} · Pass: ${selectedSchedule.pass_marks}`
                : "Select an exam schedule"}
            </h3>
          </div>
          <div className="table-wrapper">
            {schedulesLoading || enrollmentsLoading || mySubjectsLoading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} /></div>
            ) : !selectedSchedule ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
                No subjects are currently scheduled for you in this exam.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Admission No</th>
                    <th>Student</th>
                    <th>Absent</th>
                    <th>Marks Obtained</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((en) => (
                    <tr key={en.student_id}>
                      <td><strong>{en.admission_number}</strong></td>
                      <td>{en.full_name}</td>
                      <td>
                        <input
                          type="checkbox"
                          checked={marksMap[en.student_id]?.is_absent || false}
                          onChange={(e) => updateMark(en.student_id, "is_absent", e.target.checked)}
                          disabled={isPublished}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={selectedSchedule.max_marks}
                          className="form-control"
                          style={{ width: "100px" }}
                          value={marksMap[en.student_id]?.marks_obtained || ""}
                          onChange={(e) => updateMark(en.student_id, "marks_obtained", e.target.value)}
                          disabled={isPublished || marksMap[en.student_id]?.is_absent}
                          placeholder={`/ ${selectedSchedule.max_marks}`}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="form-control"
                          value={marksMap[en.student_id]?.remarks || ""}
                          onChange={(e) => updateMark(en.student_id, "remarks", e.target.value)}
                          disabled={isPublished}
                          placeholder="Optional"
                        />
                      </td>
                    </tr>
                  ))}
                  {enrollments.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                        No students enrolled in this class.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
