"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./exams.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const d = new Date();
  d.setHours(+h, +m, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ExamSchedulePage() {
  const { id: examId } = useParams() as { id: string };
  const dispatch = useAppDispatch();

  const { data: exam,      loading: examLoading } = useApi<any>(`/exams/${examId}`);
  const { data: schedules, refetch }               = useApi<any[]>(`/exams/${examId}/schedules`);
  const { data: activeYear }                        = useApi<any>("/academic-years/active");
  const { data: classes }                           = useApi<any[]>(
    activeYear?.id ? `/classes?academic_year_id=${activeYear.id}` : "", [activeYear?.id]
  );

  const { execute: saveSchedule, loading: saving } = useMutation("/exams/schedules", "POST");
  const { execute: deleteSchedule }                 = useMutation("/exams/schedules", "DELETE");

  const [classId,   setClassId]   = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examDate,  setExamDate]  = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime,   setEndTime]   = useState("");
  const [maxMarks,  setMaxMarks]  = useState("100");
  const [passMarks, setPassMarks] = useState("40");
  const [venue,     setVenue]     = useState("");

  const { data: subjects } = useApi<any[]>(classId ? `/classes/${classId}/subjects` : "");

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setExamDate(""); setStartTime(""); setEndTime(""); setVenue("");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not add schedule." }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this schedule entry?")) return;
    try {
      await deleteSchedule(undefined, `/exams/schedules/${id}`);
      dispatch(showToast({ type: "success", title: "Removed", message: "Schedule entry deleted." }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not delete schedule." }));
    }
  };

  if (examLoading) return <div className={s("loadingWrap")}><Spinner size={36} color="#FF9B51" /></div>;

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
                {exam?.start_date ? new Date(exam.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                {" — "}
                {exam?.end_date   ? new Date(exam.end_date).toLocaleDateString("en-IN",   { day: "2-digit", month: "short", year: "numeric" }) : ""}
              </span>
              <span className={s("chip")} style={{ textTransform: "capitalize" }}>
                <i className="fa-solid fa-tag" />
                {exam?.exam_type?.replace("_", " ")}
              </span>
              <span className={s("chip")}>
                <i className="fa-solid fa-list-check" />
                {schedules?.length ?? 0} schedule{schedules?.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/exams">
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            <Link className={cx(s("btn"), s("btnPrimary"))} href={`/exams/${examId}/results`}>
              <i className="fa-solid fa-chart-bar" /> Enter Results
            </Link>
          </div>
        </div>

        <div className={s("formLayout")}>
          <div className={s("formStack")}>

            {/* ── Add schedule form ── */}
            <div className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2><i className="fa-solid fa-calendar-plus" style={{ marginRight: 8, color: "#FF9B51" }} />Add Schedule Entry</h2>
                  <p>Assign a class, subject and date to this exam</p>
                </div>
              </div>
              <form className={s("formGrid")} onSubmit={handleAdd}>
                <label className={s("field")}>
                  <span>Class <b>*</b></span>
                  <select value={classId} onChange={(e) => setClassId(e.target.value)} required>
                    <option value="">— Select class —</option>
                    {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>

                <label className={s("field")}>
                  <span>Subject <b>*</b></span>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required disabled={!subjects?.length}>
                    {subjects?.length
                      ? subjects.map((sub: any) => <option key={sub.id} value={sub.id}>{sub.name}</option>)
                      : <option value="">— Select class first —</option>
                    }
                  </select>
                </label>

                <label className={s("field")}>
                  <span>Exam Date <b>*</b></span>
                  <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} required />
                </label>

                <label className={s("field")}>
                  <span>Venue</span>
                  <input placeholder="e.g. Hall A, Room 201" value={venue} onChange={(e) => setVenue(e.target.value)} />
                </label>

                <label className={s("field")}>
                  <span>Start Time <b>*</b></span>
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </label>

                <label className={s("field")}>
                  <span>End Time <b>*</b></span>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </label>

                <label className={s("field")}>
                  <span>Max Marks <b>*</b></span>
                  <input type="number" min="1" max="1000" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} required />
                </label>

                <label className={s("field")}>
                  <span>Pass Marks <b>*</b></span>
                  <input type="number" min="0" max={maxMarks} value={passMarks} onChange={(e) => setPassMarks(e.target.value)} required />
                </label>

                <div className={cx(s("field"), s("full"))} style={{ paddingTop: 4 }}>
                  <button className={cx(s("btn"), s("btnPrimary"))} type="submit" disabled={saving || !subjectId}>
                    {saving ? <><Spinner size={15} /> Adding…</> : <><i className="fa-solid fa-plus" /> Add to Schedule</>}
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
                            {new Date(sch.exam_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
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
                              onClick={() => handleDelete(sch.id)}
                            >
                              <i className="fa-solid fa-trash" />
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
                  <strong>{exam?.start_date ? new Date(exam.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <span>Ends</span>
                  <strong>{exam?.end_date ? new Date(exam.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</strong>
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
    </div>
  );
}
