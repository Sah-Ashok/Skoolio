"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/shared/Topbar";
import styles from "./exams.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import DateInput from "@/components/shared/DateInput";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const EXAM_TYPES = [
  { value: "unit_test", label: "Unit Test",  icon: "fa-pen-clip",      desc: "Short assessment for a specific unit" },
  { value: "mid_term",  label: "Mid Term",   icon: "fa-book-open",     desc: "Midpoint examination of the term" },
  { value: "final",     label: "Final Exam", icon: "fa-graduation-cap", desc: "End-of-term comprehensive exam" },
  { value: "practice",  label: "Practice",   icon: "fa-dumbbell",      desc: "Mock or practice test" },
];

export default function AddExamPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();
  const { activeYear, academicYearId } = useAcademicYear();
  const { execute: createExam, loading: saving } = useMutation("/exams", "POST");

  const [name,      setName]      = useState("");
  const [examType,  setExamType]  = useState("unit_test");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [notes,     setNotes]     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId)
      return dispatch(showToast({ type: "error", title: "No Active Year", message: "Please set an active academic year first." }));
    if (!name.trim())
      return dispatch(showToast({ type: "error", title: "Missing Name", message: "Please enter an exam name." }));
    if (!startDate || !endDate)
      return dispatch(showToast({ type: "error", title: "Missing Dates", message: "Start and end dates are required." }));
    if (new Date(startDate) > new Date(endDate))
      return dispatch(showToast({ type: "error", title: "Invalid Dates", message: "Start date must be before end date." }));

    try {
      await createExam({
        academic_year_id: academicYearId,
        name: name.trim(),
        exam_type: examType,
        start_date: startDate,
        end_date:   endDate,
        notes:      notes.trim() || undefined,
        status:     "upcoming",
      });
      dispatch(showToast({ type: "success", title: "Exam Created!", message: `"${name}" is ready. Add a schedule next.` }));
      router.push("/exams");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not create exam." }));
    }
  };

  const selectedType = EXAM_TYPES.find((t) => t.value === examType);

  return (
    <div className={s("page")}>
      <Topbar title="Create Exam" subtitle="Define a new examination for the current academic year" />

      <main className={s("content")}>
        {/* ── Header ── */}
        <div className={s("head")}>
          <div>
            <h1>Create New Exam</h1>
            <p>Academic Year: <strong>{activeYear?.year_name ?? "Loading…"}</strong></p>
          </div>
          <Link className={cx(s("btn"), s("btnOutline"))} href="/exams">
            <i className="fa-solid fa-arrow-left" /> Back to Exams
          </Link>
        </div>

        <div className={s("formLayout")}>
          <form className={s("formStack")} onSubmit={handleSubmit}>

            {/* ── Basic details ── */}
            <div className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2><i className="fa-solid fa-scroll" style={{ marginRight: 8, color: "#FF9B51" }} />Exam Details</h2>
                  <p>Basic information about the examination</p>
                </div>
              </div>
              <div className={s("formGrid")}>
                <label className={cx(s("field"), s("full"))}>
                  <span>Exam Name <b>*</b></span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mid Term Examination 2025–26"
                    required
                    maxLength={120}
                  />
                </label>

                <label className={s("field")}>
                  <span>Start Date <b>*</b></span>
                  <DateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </label>

                <label className={s("field")}>
                  <span>End Date <b>*</b></span>
                  <DateInput value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </label>

                <label className={cx(s("field"), s("full"))}>
                  <span>Notes (optional)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes or instructions for this exam…"
                  />
                </label>
              </div>
            </div>

            {/* ── Exam type selector ── */}
            <div className={s("card")}>
              <div className={s("cardHead")}>
                <div>
                  <h2><i className="fa-solid fa-layer-group" style={{ marginRight: 8, color: "#FF9B51" }} />Exam Type</h2>
                  <p>Select the category that best describes this examination</p>
                </div>
              </div>
              <div style={{ padding: "20px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {EXAM_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setExamType(t.value)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "14px 16px", borderRadius: 10,
                      border: `2px solid ${examType === t.value ? "#FF9B51" : "#e2e8f0"}`,
                      background: examType === t.value ? "#fff7ed" : "#fff",
                      cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                      transition: "all 0.18s",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: examType === t.value ? "#FF9B51" : "#f1f5f9",
                      color: examType === t.value ? "#fff" : "#64748b",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, transition: "all 0.18s",
                    }}>
                      <i className={`fa-solid ${t.icon}`} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5, color: examType === t.value ? "#c2410c" : "#1e293b" }}>
                        {t.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Form actions ── */}
            <div className={s("formActions")}>
              <button type="button" className={cx(s("btn"), s("btnOutline"))} onClick={() => router.push("/exams")}>
                <i className="fa-solid fa-xmark" /> Cancel
              </button>
              <button type="submit" className={cx(s("btn"), s("btnPrimary"))} disabled={saving}>
                {saving ? <><Spinner size={15} /> Creating…</> : <><i className="fa-solid fa-floppy-disk" /> Create Exam</>}
              </button>
            </div>
          </form>

          {/* ── Sidebar summary ── */}
          <aside className={s("summaryCard")}>
            <div className={s("card")}>
              <div className={s("cardHead")}>
                <div><h2>Preview</h2><p>What you're creating</p></div>
              </div>
              <div className={s("summaryBody")}>
                {/* Icon */}
                <div style={{ display: "flex", justifyContent: "center", paddingBottom: 8 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 16,
                    background: "#fff7ed", color: "#FF9B51",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26,
                  }}>
                    <i className={`fa-solid ${selectedType?.icon ?? "fa-scroll"}`} />
                  </div>
                </div>

                <div className={s("summaryRow")}>
                  <span>Name</span>
                  <strong style={{ maxWidth: 160, textAlign: "right", wordBreak: "break-word" }}>
                    {name || "—"}
                  </strong>
                </div>
                <div className={s("summaryRow")}>
                  <span>Type</span>
                  <strong>{selectedType?.label ?? "—"}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <span>Start</span>
                  <strong>{startDate ? new Date(startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <span>End</span>
                  <strong>{endDate ? new Date(endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</strong>
                </div>
                <div className={s("summaryRow")}>
                  <span>Academic Year</span>
                  <strong>{activeYear?.year_name ?? "—"}</strong>
                </div>
              </div>
            </div>

            <div className={s("card")} style={{ marginTop: 16 }}>
              <div className={s("cardHead")}><h2>Next Steps</h2></div>
              <div className={s("summaryBody")}>
                <ul className={s("tipsList")}>
                  <li><i className="fa-solid fa-circle-check" />Create this exam first</li>
                  <li><i className="fa-solid fa-calendar-days" />Add a <strong>Schedule</strong> (class, subject, date, time)</li>
                  <li><i className="fa-solid fa-chart-bar" />Enter <strong>Results</strong> and publish to students</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
