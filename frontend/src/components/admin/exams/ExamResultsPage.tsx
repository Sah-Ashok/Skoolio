"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./exams.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { showToast } from "@/store/toastSlice";
import ConfirmModal from "@/components/shared/ConfirmModal";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function getInitials(name: string) {
  return (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function ScorePill({ obtained, max, pass, absent }: { obtained: string; max: number; pass: number; absent: boolean }) {
  if (absent) return <span className={cx(s("badge"), s("badgeOrange"))}>Absent</span>;
  if (!obtained) return <span style={{ color: "#94a3b8", fontSize: 12 }}>Not entered</span>;
  const pct  = (parseFloat(obtained) / max) * 100;
  const pass_ = parseFloat(obtained) >= pass;
  return (
    <span className={cx(s("badge"), pass_ ? s("badgeGreen") : s("badgeRed"))}>
      {obtained}/{max} ({Math.round(pct)}%)
    </span>
  );
}

export default function ExamResultsPage() {
  const { id: examId } = useParams() as { id: string };
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();

  const { data: exam,      loading: examLoading } = useApi<any>(`/exams/${examId}`);
  const { data: schedules }                        = useApi<any[]>(`/exams/${examId}/schedules`);
  const { academicYearId }                         = useAcademicYear();

  const [scheduleId, setScheduleId] = useState("");
  const selectedSchedule = schedules?.find((s) => s.id.toString() === scheduleId);

  const { data: results, refetch: refetchResults, loading: resultsLoading } = useApi<any[]>(
    selectedSchedule ? `/exams/${examId}/class/${selectedSchedule.class_id}/results` : ""
  );

  const [enrollments,         setEnrollments]         = useState<any[]>([]);
  const [enrollmentsLoading,  setEnrollmentsLoading]  = useState(false);

  const { execute: saveResult,     loading: saving }       = useMutation("/exams/results", "POST");
  const { execute: updateResult }                           = useMutation("/exams/results", "PATCH");
  const { execute: publishResults,   loading: publishing }   = useMutation("/exams/results/publish", "POST");
  const { execute: unpublishResults, loading: unpublishing } = useMutation("/exams/results/unpublish", "POST");

  const [marksMap, setMarksMap] = useState<Record<string, { marks_obtained: string; is_absent: boolean; remarks: string }>>({});

  // Auto-select first schedule
  useEffect(() => {
    if (schedules && schedules.length > 0 && !scheduleId)
      setScheduleId(schedules[0].id.toString());
  }, [schedules, scheduleId]);

  // Load enrollments for selected class
  useEffect(() => {
    const load = async () => {
      if (!selectedSchedule || !academicYearId) { setEnrollments([]); return; }
      setEnrollmentsLoading(true);
      try {
        const res = await apiRequest<{ data: any[] }>(`/students/enrollments?academic_year_id=${academicYearId}`);
        setEnrollments((res.data ?? []).filter((e) => e.class_id?.toString() === selectedSchedule.class_id.toString()));
      } catch { setEnrollments([]); }
      finally { setEnrollmentsLoading(false); }
    };
    load();
  }, [selectedSchedule, academicYearId]);

  // Sync marks map
  useEffect(() => {
    if (!selectedSchedule) return;
    const subjectResults = (results ?? []).filter((r: any) => r.subject_id === selectedSchedule.subject_id);
    const map: Record<string, any> = {};
    enrollments.forEach((en) => {
      const r = subjectResults.find((res: any) => res.student_id === en.student_id);
      map[en.student_id] = {
        marks_obtained: r?.marks_obtained !== null && r?.marks_obtained !== undefined ? r.marks_obtained.toString() : "",
        is_absent:      r?.is_absent ?? false,
        remarks:        r?.remarks   ?? "",
      };
    });
    setMarksMap(map);
  }, [results, selectedSchedule, enrollments]);

  const existingResultsBySubject = useMemo(() => {
    const map = new Map<number, any>();
    if (!selectedSchedule) return map;
    (results ?? [])
      .filter((r: any) => r.subject_id === selectedSchedule.subject_id)
      .forEach((r: any) => map.set(r.student_id, r));
    return map;
  }, [results, selectedSchedule]);

  const isPublished = (results ?? []).some(
    (r: any) => r.status === "published" && r.subject_id === selectedSchedule?.subject_id
  );

  const updateMark = (studentId: number, field: string, value: string | boolean) =>
    setMarksMap((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));

  // ── Stats for sidebar
  const enteredCount = enrollments.filter((en) => {
    const m = marksMap[en.student_id];
    return m && (m.is_absent || m.marks_obtained !== "");
  }).length;
  const passCount = enrollments.filter((en) => {
    const m = marksMap[en.student_id];
    if (!m || m.is_absent || !m.marks_obtained) return false;
    return parseFloat(m.marks_obtained) >= (selectedSchedule?.pass_marks ?? 0);
  }).length;
  const absentCount = enrollments.filter((en) => marksMap[en.student_id]?.is_absent).length;

  const handleSaveMarks = async () => {
    if (!selectedSchedule)
      return dispatch(showToast({ type: "error", title: "No Schedule", message: "Select a class–subject schedule first." }));

    const tasks = enrollments
      .map((en) => {
        const entry = marksMap[en.student_id];
        if (!entry) return null;
        if (!entry.is_absent && entry.marks_obtained === "") return null;

        const existing = existingResultsBySubject.get(en.student_id);
        const payload = {
          exam_id:       parseInt(examId),
          schedule_id:   selectedSchedule.id,
          student_id:    en.student_id,
          enrollment_id: en.id,
          subject_id:    selectedSchedule.subject_id,
          max_marks:     selectedSchedule.max_marks,
          pass_marks:    selectedSchedule.pass_marks,
          marks_obtained: entry.is_absent ? undefined : parseFloat(entry.marks_obtained),
          is_absent:     entry.is_absent,
          remarks:       entry.remarks || undefined,
        };
        return existing ? updateResult(payload, `/exams/results/${existing.id}`) : saveResult(payload);
      })
      .filter(Boolean);

    if (tasks.length === 0)
      return dispatch(showToast({ type: "warning", title: "No Data", message: "No marks to save. Enter marks or mark absent first." }));

    try {
      await Promise.all(tasks);
      dispatch(showToast({ type: "success", title: "Marks Saved", message: `${tasks.length} records saved successfully.` }));
      refetchResults();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not save marks." }));
    }
  };

  const [showPublishModal, setShowPublishModal] = useState(false);

  const handleTogglePublish = () => {
    if (!selectedSchedule) return;
    setShowPublishModal(true);
  };

  const handleConfirmPublishToggle = async () => {
    if (!selectedSchedule) return;
    if (isPublished) {
      try {
        await unpublishResults({ exam_id: parseInt(examId), class_id: selectedSchedule.class_id });
        dispatch(showToast({ type: "success", title: "Unpublished", message: "Results reverted to draft mode." }));
        refetchResults();
        setShowPublishModal(false);
      } catch (err: any) {
        dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not unpublish results." }));
      }
    } else {
      try {
        await publishResults({ exam_id: parseInt(examId), class_id: selectedSchedule.class_id });
        dispatch(showToast({ type: "success", title: "Published!", message: "Results are now visible to students." }));
        refetchResults();
        setShowPublishModal(false);
      } catch (err: any) {
        dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not publish results." }));
      }
    }
  };

  if (examLoading) return <div className={s("loadingWrap")}><Spinner size={36} color="#FF9B51" /></div>;

  return (
    <div className={s("page")}>
      <Topbar title="Exam Results" subtitle={exam?.name ?? "Loading…"} />

      <main className={s("content")}>
        {/* ── Header ── */}
        <div className={s("head")}>
          <div>
            <h1>{exam?.name}</h1>
            <div className={s("infoChips")}>
              <span className={s("chip")}><i className="fa-solid fa-calendar" />
                {exam?.start_date ? formatDate(exam.start_date) : ""}
                {exam?.start_date && exam?.end_date ? " — " : ""}
                {exam?.end_date ? formatDate(exam.end_date) : ""}
              </span>
              <span className={s("chip")} style={{ textTransform: "capitalize" }}>
                <i className="fa-solid fa-tag" /> {exam?.exam_type?.replace("_", " ")}
              </span>
              {isPublished && (
                <span className={s("chip")} style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>
                  <i className="fa-solid fa-circle-check" /> Published to Students
                </span>
              )}
            </div>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href={`/exams/${examId}/schedule`}>
              <i className="fa-solid fa-calendar-days" /> Schedule
            </Link>
            <button
              className={cx(s("btn"), isPublished ? s("btnSoft") : s("btnOutline"))}
              onClick={handleTogglePublish}
              disabled={publishing || unpublishing || !selectedSchedule || (!isPublished && enteredCount === 0)}
              style={isPublished ? { borderColor: "#bbf7d0", color: "#15803d", background: "#f0fdf4" } : {}}
            >
              {publishing || unpublishing ? (
                <><Spinner size={14} color="#FF9B51" /> Updating…</>
              ) : isPublished ? (
                <><i className="fa-solid fa-arrow-rotate-left" /> Unpublish Results</>
              ) : (
                <><i className="fa-solid fa-share-from-square" /> Publish Results</>
              )}
            </button>
            <button
              className={cx(s("btn"), s("btnPrimary"))}
              onClick={handleSaveMarks}
              disabled={saving || !selectedSchedule || isPublished}
            >
              {saving ? <><Spinner size={14} /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save Marks</>}
            </button>
          </div>
        </div>

        {/* ── No schedules ── */}
        {(!schedules || schedules.length === 0) ? (
          <div className={s("card")}>
            <div className={s("emptyState")}>
              <div className={s("emptyIcon")}><i className="fa-solid fa-calendar-xmark" /></div>
              <h3>No schedule found</h3>
              <p>Create a schedule for this exam before entering results.</p>
              <Link className={cx(s("btn"), s("btnPrimary"))} href={`/exams/${examId}/schedule`} style={{ marginTop: 8 }}>
                <i className="fa-solid fa-calendar-plus" /> Add Schedule
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* ── Schedule selector ── */}
            <div className={s("scheduleSelector")}>
              <i className="fa-solid fa-filter" style={{ color: "#94a3b8", flexShrink: 0 }} />
              <label className={s("field")} style={{ flex: 1, gap: 4 }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Select Class / Subject</span>
                <select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)} style={{ padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5 }}>
                  {schedules.map((sch) => (
                    <option key={sch.id} value={sch.id}>
                      {sch.class_name ?? `Class ${sch.class_id}`} — {sch.subject_name ?? `Subject ${sch.subject_id}`}
                      {" "}({formatDate(sch.exam_date)})
                      {" · "}{sch.max_marks} marks
                    </option>
                  ))}
                </select>
              </label>
              {selectedSchedule && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className={cx(s("badge"), s("badgeBlue"))} style={{ gap: 0 }}>Max: {selectedSchedule.max_marks}</span>
                  <span className={cx(s("badge"), s("badgeGreen"))} style={{ gap: 0 }}>Pass: {selectedSchedule.pass_marks}</span>
                </div>
              )}
            </div>

            {/* ── Published banner ── */}
            {isPublished && (
              <div className={s("publishedBanner")}>
                <i className="fa-solid fa-lock" />
                Results for this subject are published and locked. Students can now view their marks.
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>
              {/* ── Marks entry table ── */}
              <div className={s("card")}>
                <div className={s("cardHead")}>
                  <div>
                    <h2>
                      <i className="fa-solid fa-pen-to-square" style={{ marginRight: 8, color: "#FF9B51" }} />
                      Marks Entry
                    </h2>
                    <p>
                      {selectedSchedule?.subject_name} &mdash; Max {selectedSchedule?.max_marks}, Pass {selectedSchedule?.pass_marks}
                    </p>
                  </div>
                  <div className={s("cardActions")}>
                    <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
                      {enteredCount} / {enrollments.length} filled
                    </span>
                  </div>
                </div>

                <div className={s("tableWrap")}>
                  {(resultsLoading || enrollmentsLoading) ? (
                    <div className={s("loadingWrap")}><Spinner size={32} color="#FF9B51" /></div>
                  ) : enrollments.length === 0 ? (
                    <div className={s("emptyState")}>
                      <div className={s("emptyIcon")}><i className="fa-solid fa-user-xmark" /></div>
                      <h3>No students enrolled</h3>
                      <p>No students found in this class for the current academic year.</p>
                    </div>
                  ) : (
                    <table className={s("table")}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student</th>
                          <th style={{ textAlign: "center" }}>Absent</th>
                          <th>Marks Obtained</th>
                          <th>Score</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollments.map((en, idx) => {
                          const m = marksMap[en.student_id] ?? { marks_obtained: "", is_absent: false, remarks: "" };
                          return (
                            <tr key={en.student_id} style={{ background: m.is_absent ? "#fff7f7" : undefined }}>
                              <td style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>{idx + 1}</td>
                              <td>
                                <div className={s("studentCell")}>
                                  <div className={s("studentAvatar")}>{getInitials(en.full_name)}</div>
                                  <div>
                                    <div className={s("studentName")}>{en.full_name}</div>
                                    <div className={s("studentAdm")}>{en.admission_number ?? `ID: ${en.student_id}`}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <input
                                  type="checkbox"
                                  className={s("absentCheck")}
                                  checked={m.is_absent}
                                  onChange={(e) => updateMark(en.student_id, "is_absent", e.target.checked)}
                                  disabled={isPublished}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className={s("marksInput")}
                                  min={0}
                                  max={selectedSchedule?.max_marks}
                                  value={m.marks_obtained}
                                  onChange={(e) => updateMark(en.student_id, "marks_obtained", e.target.value)}
                                  disabled={isPublished || m.is_absent}
                                  placeholder={`/ ${selectedSchedule?.max_marks}`}
                                />
                              </td>
                              <td>
                                <ScorePill
                                  obtained={m.marks_obtained}
                                  max={selectedSchedule?.max_marks ?? 100}
                                  pass={selectedSchedule?.pass_marks ?? 40}
                                  absent={m.is_absent}
                                />
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className={s("remarksInput")}
                                  value={m.remarks}
                                  onChange={(e) => updateMark(en.student_id, "remarks", e.target.value)}
                                  disabled={isPublished}
                                  placeholder="Optional"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* ── Right sidebar stats ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className={s("card")}>
                  <div className={s("cardHead")}><div><h2>Summary</h2><p>Current marks status</p></div></div>
                  <div className={s("summaryBody")}>
                    <div className={s("summaryRow")}><span>Students</span><strong>{enrollments.length}</strong></div>
                    <div className={s("summaryRow")}><span>Marks Entered</span><strong>{enteredCount}</strong></div>
                    <div className={s("summaryRow")}><span>Passing</span><strong style={{ color: "#15803d" }}>{passCount}</strong></div>
                    <div className={s("summaryRow")}><span>Absent</span><strong style={{ color: "#c2410c" }}>{absentCount}</strong></div>
                    <div className={s("summaryRow")}>
                      <span>Pass Rate</span>
                      <strong>
                        {enteredCount > 0
                          ? `${Math.round(((passCount) / (enteredCount - absentCount || 1)) * 100)}%`
                          : "—"}
                      </strong>
                    </div>
                    <div className={s("summaryRow")}>
                      <span>Status</span>
                      <span className={cx(s("badge"), isPublished ? s("badgeGreen") : s("badgeGray"))} style={{ fontSize: 11, padding: "3px 8px" }}>
                        {isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={s("card")}>
                  <div className={s("cardHead")}><h2>Quick Actions</h2></div>
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      className={cx(s("btn"), s("btnPrimary"))}
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={handleSaveMarks}
                      disabled={saving || isPublished}
                    >
                      {saving ? <><Spinner size={14} /> Saving…</> : <><i className="fa-solid fa-floppy-disk" /> Save Marks</>}
                    </button>
                    <button
                      className={cx(s("btn"), isPublished ? s("btnSoft") : s("btnOutline"))}
                      style={{
                        width: "100%",
                        justifyContent: "center",
                        borderColor: isPublished ? "#bbf7d0" : undefined,
                        color: isPublished ? "#15803d" : undefined,
                        background: isPublished ? "#f0fdf4" : undefined,
                      }}
                      onClick={handleTogglePublish}
                      disabled={publishing || unpublishing || (!isPublished && enteredCount === 0)}
                    >
                      {publishing || unpublishing ? (
                        <><Spinner size={14} color="#FF9B51" /> Updating…</>
                      ) : isPublished ? (
                        <><i className="fa-solid fa-arrow-rotate-left" /> Unpublish Results</>
                      ) : (
                        <><i className="fa-solid fa-share-from-square" /> Publish Results</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Publish / Unpublish Confirmation Modal */}
      <ConfirmModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handleConfirmPublishToggle}
        title={isPublished ? "Unpublish Results?" : "Publish Results?"}
        message={
          isPublished
            ? `Unpublish results for ${selectedSchedule?.class_name ?? ""} — ${selectedSchedule?.subject_name ?? ""}? This will allow editing marks and unlocks the schedule.`
            : `Publish results for ${selectedSchedule?.class_name ?? ""} — ${selectedSchedule?.subject_name ?? ""}? Published results will be visible to students and lock the schedule.`
        }
        confirmText={isPublished ? "Unpublish Results" : "Publish Results"}
        cancelText="Cancel"
        confirmVariant={isPublished ? "warning" : "primary"}
        icon={isPublished ? "fa-arrow-rotate-left" : "fa-share-from-square"}
      />
    </div>
  );
}
