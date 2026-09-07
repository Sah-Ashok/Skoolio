"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./exams.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useDateFormat } from "@/lib/useDateFormat";
import { showToast } from "@/store/toastSlice";
import DateInput from "@/components/shared/DateInput";
import ConfirmModal from "@/components/shared/ConfirmModal";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  if (h === undefined || m === undefined) return t;
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export default function ExamSchedulePage() {
  const { id: examId } = useParams() as { id: string };
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();

  const { data: exam,      loading: examLoading, refetch: refetchExam } = useApi<any>(`/exams/${examId}`);
  const { data: schedules, loading: schedulesLoading, refetch }               = useApi<any[]>(`/exams/${examId}/schedules`);
  const { academicYearId }                          = useAcademicYear();
  const { data: classes }                           = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "", [academicYearId]
  );

  const { execute: saveSchedule, loading: saving } = useMutation("/exams/schedules", "POST");
  const { execute: deleteSchedule }                 = useMutation("/exams/schedules", "DELETE");
  const { execute: publishSchedule, loading: publishing } = useMutation(`/exams/${examId}/publish-schedule`, "POST");

  const isSchedulePublished = Boolean(exam?.is_schedule_published);

  const [classId,   setClassId]   = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examDate,  setExamDate]  = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime,   setEndTime]   = useState("");
  const [maxMarks,  setMaxMarks]  = useState("100");
  const [passMarks, setPassMarks] = useState("40");
  const [venue,     setVenue]     = useState("");

  const { data: subjects, loading: subjectsLoading } = useApi<any[]>(classId ? `/classes/${classId}/subjects` : "");

  // Auto-select first class
  useEffect(() => {
    if (classes && classes.length > 0 && !classId) setClassId(classes[0].id.toString());
  }, [classes, classId]);

  // Auto-select first subject when class changes
  useEffect(() => {
    if (subjects && subjects.length > 0) setSubjectId(subjects[0].id.toString());
    else setSubjectId("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects]);

  const hasPublishedResults = Boolean(exam?.has_published_results);

  const handleTogglePublish = async () => {
    if (!schedules || schedules.length === 0) {
      return dispatch(showToast({
        type: "error",
        title: "No Schedule",
        message: "Please add at least one schedule entry before publishing.",
      }));
    }

    const nextState = !isSchedulePublished;
    try {
      await publishSchedule({ is_published: nextState });
      dispatch(showToast({
        type: "success",
        title: nextState ? "Schedule Published" : "Schedule Unpublished",
        message: nextState
          ? "Exam schedule is now visible to students in the student portal."
          : "Exam schedule has been unpublished.",
      }));
      refetchExam();
    } catch (err: any) {
      dispatch(showToast({
        type: "error",
        title: "Failed",
        message: err.message ?? "Could not update publish status.",
      }));
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPublishedResults) {
      return dispatch(showToast({
        type: "error",
        title: "Schedule Locked",
        message: "Cannot add schedule entries because exam results are already published.",
      }));
    }
    if (!classId || !subjectId || !examDate || !startTime || !endTime)
      return dispatch(showToast({ type: "error", title: "Missing Fields", message: "Please fill all required fields." }));
    if (+passMarks > +maxMarks)
      return dispatch(showToast({ type: "error", title: "Invalid Marks", message: "Pass marks cannot exceed max marks." }));
    if (startTime >= endTime)
      return dispatch(showToast({ type: "error", title: "Invalid Time", message: "Start time must be before end time." }));

    try {
      await saveSchedule({
        exam_id:    +examId,
        class_id:   +classId,
        subject_id: +subjectId,
        exam_date:  examDate,
        start_time: startTime,
        end_time:   endTime,
        max_marks:  +maxMarks,
        pass_marks: +passMarks,
        venue:      venue.trim() || undefined,
      });
      dispatch(showToast({ type: "success", title: "Schedule Added", message: "New schedule entry saved successfully." }));
      refetch();
      refetchExam();
      setExamDate(""); setStartTime(""); setEndTime(""); setVenue("");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not add schedule." }));
    }
  };

  const [scheduleToDelete, setScheduleToDelete] = useState<any | null>(null);

  const handleDelete = (sch: any) => {
    if (hasPublishedResults) {
      return dispatch(showToast({
        type: "error",
        title: "Schedule Locked",
        message: "Cannot delete schedule entries because exam results are already published.",
      }));
    }
    setScheduleToDelete(sch);
  };

  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) return;
    try {
      await deleteSchedule(undefined, `/exams/schedules/${scheduleToDelete.id}`);
      dispatch(showToast({ type: "success", title: "Removed", message: "Schedule entry deleted." }));
      refetch();
      refetchExam();
      setScheduleToDelete(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not delete schedule." }));
    }
  };

  if (examLoading) return <div className={s("loadingWrap")}><Loader fullScreen={false} size="md" text="Loading exam schedule…" /></div>;

  return (
    <div className={s("page")}>
      <Topbar title="Exam Schedule" subtitle={exam?.name ?? "Loading…"} />

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
                <i className="fa-solid fa-tag" />
                {exam?.exam_type?.replace("_", " ")}
              </span>
              <span className={s("chip")}>
                <i className="fa-solid fa-list-check" />
                {schedules?.length ?? 0} schedule{schedules?.length !== 1 ? "s" : ""}
              </span>
              {isSchedulePublished ? (
                <span className={s("chip")} style={{ background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}>
                  <i className="fa-solid fa-eye" /> Published to Students
                </span>
              ) : (
                <span className={s("chip")} style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" }}>
                  <i className="fa-solid fa-eye-slash" /> Draft (Not Published)
                </span>
              )}
              {hasPublishedResults && (
                <span className={s("chip")} style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                  <i className="fa-solid fa-lock" /> Results Published (Locked)
                </span>
              )}
            </div>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/exams">
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            <button
              type="button"
              className={cx(s("btn"), isSchedulePublished ? s("btnSoft") : s("btnOutline"))}
              onClick={handleTogglePublish}
              disabled={publishing || (schedules?.length ?? 0) === 0}
              style={{
                borderColor: isSchedulePublished ? "#86efac" : "#FF9B51",
                color: isSchedulePublished ? "#15803d" : "#ea580c",
                background: isSchedulePublished ? "#f0fdf4" : "#fff7ed",
              }}
            >
              {publishing ? (
                <><Spinner size={13} color="#FF9B51" /> Updating…</>
              ) : isSchedulePublished ? (
                <><i className="fa-solid fa-circle-check" style={{ color: "#16a34a" }} /> Published ✓</>
              ) : (
                <><i className="fa-solid fa-share-from-square" style={{ color: "#ea580c" }} /> Publish Schedule</>
              )}
            </button>
            <Link className={cx(s("btn"), s("btnPrimary"))} href={`/exams/${examId}/results`}>
              <i className="fa-solid fa-chart-bar" /> Enter Results
            </Link>
          </div>
        </div>

        <div className={s("formLayout")}>
          <div className={s("formStack")}>

            {/* ── Lock notice banner if results are published ── */}
            {hasPublishedResults && (
              <div style={{
                background: "#fffbeb",
                border: "1.5px solid #fde68a",
                borderRadius: 14,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: "#fef3c7",
                    color: "#b45309",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    flexShrink: 0,
                  }}>
                    <i className="fa-solid fa-lock" />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#92400e" }}>
                      Exam Schedule is Locked
                    </h4>
                    <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 600, color: "#b45309" }}>
                      Results for this exam have already been published. Schedule modifications and deletions are disabled to protect student marks.
                    </p>
                  </div>
                </div>
                <Link
                  href={`/exams/${examId}/results`}
                  className={cx(s("btn"), s("btnOutline"))}
                  style={{ fontSize: 12.5, padding: "7px 16px", borderColor: "#fde68a", color: "#92400e", background: "#ffffff", fontWeight: 800 }}
                >
                  <i className="fa-solid fa-chart-bar" /> Manage Results
                </Link>
              </div>
            )}

            {/* ── Add schedule form ── */}
            <div className={s("card")} style={hasPublishedResults ? { opacity: 0.7 } : {}}>
              <div className={s("cardHead")}>
                <div>
                  <h2><i className="fa-solid fa-calendar-plus" style={{ marginRight: 8, color: "#FF9B51" }} />Add Schedule Entry</h2>
                  <p>{hasPublishedResults ? "Schedule editing is disabled while results are published" : "Assign a class, subject and date to this exam"}</p>
                </div>
              </div>
              <form className={s("formGrid")} onSubmit={handleAdd}>
                <label className={s("field")}>
                  <span>Class <b>*</b></span>
                  <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={hasPublishedResults} required>
                    <option value="">— Select class —</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                <label className={s("field")}>
                  <span>Subject <b>*</b></span>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    required
                    disabled={hasPublishedResults || !classId || subjectsLoading || !subjects?.length}
                  >
                    {!classId ? (
                      <option value="">— Select class first —</option>
                    ) : subjectsLoading ? (
                      <option value="">Loading subjects…</option>
                    ) : subjects?.length ? (
                      subjects.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)
                    ) : (
                      <option value="">No subjects assigned to this class</option>
                    )}
                  </select>
                </label>

                <label className={s("field")}>
                  <span>Exam Date <b>*</b></span>
                  <DateInput
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    minDate={exam?.start_date}
                    maxDate={exam?.end_date}
                    disabled={hasPublishedResults}
                    required
                  />
                </label>

                <label className={s("field")}>
                  <span>Venue</span>
                  <input placeholder="e.g. Hall A, Room 201" value={venue} onChange={(e) => setVenue(e.target.value)} disabled={hasPublishedResults} />
                </label>

                <label className={s("field")}>
                  <span>Start Time <b>*</b></span>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={hasPublishedResults} required />
                </label>

                <label className={s("field")}>
                  <span>End Time <b>*</b></span>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={hasPublishedResults} required />
                </label>

                <label className={s("field")}>
                  <span>Max Marks <b>*</b></span>
                  <input type="number" min="1" max="1000" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} disabled={hasPublishedResults} required />
                </label>

                <label className={s("field")}>
                  <span>Pass Marks <b>*</b></span>
                  <input type="number" min="0" max={maxMarks} value={passMarks} onChange={(e) => setPassMarks(e.target.value)} disabled={hasPublishedResults} required />
                </label>

                <div className={cx(s("field"), s("full"))} style={{ paddingTop: 4 }}>
                  <button className={cx(s("btn"), s("btnPrimary"))} type="submit" disabled={saving || !subjectId || hasPublishedResults}>
                    {saving ? (
                      <><Spinner size={15} /> Adding…</>
                    ) : hasPublishedResults ? (
                      <><i className="fa-solid fa-lock" /> Schedule Locked (Results Published)</>
                    ) : (
                      <><i className="fa-solid fa-plus" /> Add to Schedule</>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* ── Schedule table ── */}
            <div className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2><i className="fa-solid fa-table-list" style={{ marginRight: 8, color: "#FF9B51" }} />Current Schedule</h2>
                  <p>{schedules?.length ?? 0} entries for {exam?.name}</p>
                </div>
              </div>
              <div className={s("tableWrap")}>
                {!schedules || schedules.length === 0 ? (
                  <div className={s("emptyState")}>
                    <div className={s("emptyIcon")}><i className="fa-solid fa-calendar-xmark" /></div>
                    <h3>No schedule yet</h3>
                    <p>Add at least one class–subject entry to get started.</p>
                  </div>
                ) : (
                  <table className={s("table")}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Time</th>
                        <th>Marks (Max / Pass)</th>
                        <th>Venue</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((sch) => (
                        <tr key={sch.id}>
                          <td style={{ fontWeight: 700 }}>
                            {formatDate(sch.exam_date)}
                          </td>
                          <td>{sch.class_name ?? `Class ${sch.class_id}`}</td>
                          <td><strong>{sch.subject_name ?? `Sub ${sch.subject_id}`}</strong></td>
                          <td style={{ fontFamily: "monospace", fontSize: 13 }}>
                            {formatTime(sch.start_time)} – {formatTime(sch.end_time)}
                          </td>
                          <td>
                            <span className={cx(s("badge"), s("badgeBlue"))} style={{ gap: 0 }}>
                              {sch.max_marks} / {sch.pass_marks}
                            </span>
                          </td>
                          <td>{sch.venue || <span style={{ color: "#94a3b8" }}>—</span>}</td>
                          <td>
                            <button
                              className={cx(s("btn"), s("btnDanger"), s("btnSm"))}
                              onClick={() => handleDelete(sch)}
                              disabled={hasPublishedResults}
                              title={hasPublishedResults ? "Cannot delete schedule when results are published" : "Remove entry"}
                              style={hasPublishedResults ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                            >
                              <i className={hasPublishedResults ? "fa-solid fa-lock" : "fa-solid fa-trash"} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <aside className={s("summaryCard")}>
            <div className={s("card")}>
              <div className={s("cardHead")}><div><h2>Exam Info</h2></div></div>
              <div className={s("summaryBody")}>
                <div className={s("summaryRow")}><span>Name</span><strong style={{ textAlign: "right", maxWidth: 160, wordBreak: "break-word" }}>{exam?.name}</strong></div>
                <div className={s("summaryRow")}>
                  <span>Type</span>
                  <strong style={{ textTransform: "capitalize" }}>{exam?.exam_type?.replace("_", " ")}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <span>Starts</span>
                  <strong>{exam?.start_date ? formatDate(exam.start_date) : "—"}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <span>Ends</span>
                  <strong>{exam?.end_date ? formatDate(exam.end_date) : "—"}</strong>
                </div>
                <div className={s("summaryRow")}><span>Entries</span><strong>{schedules?.length ?? 0}</strong></div>
              </div>
            </div>
            <div className={s("card")} style={{ marginTop: 16 }}>
              <div className={s("cardHead")}><h2>Tips</h2></div>
              <div className={s("summaryBody")}>
                <ul className={s("tipsList")}>
                  <li><i className="fa-solid fa-circle-info" />Each class + subject combination gets its own schedule slot</li>
                  <li><i className="fa-solid fa-circle-info" />You can add multiple classes to the same exam</li>
                  <li><i className="fa-solid fa-circle-info" />After scheduling, go to Results to enter student marks</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Remove Schedule Entry Modal */}
      <ConfirmModal
        isOpen={!!scheduleToDelete}
        onClose={() => setScheduleToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Schedule Entry"
        message={`Remove schedule entry for ${scheduleToDelete?.class_name ?? ""} · ${scheduleToDelete?.subject_name ?? ""}? This cannot be undone.`}
        confirmText="Remove Entry"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="fa-trash-can"
      />
    </div>
  );
}
