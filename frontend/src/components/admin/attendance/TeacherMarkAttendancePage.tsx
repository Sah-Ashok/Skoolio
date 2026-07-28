"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import ToastNotification from "@/components/shared/ToastNotification";
import styles from "./attendance.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";

const s  = (name: string) => styles[name] || name;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

type AttendanceStatus = "present" | "absent" | "leave";

const PAL: { key: AttendanceStatus; label: string; activeClass: string }[] = [
  { key: "present",   label: "P",  activeClass: "palActiveP" },
  { key: "absent",    label: "A",  activeClass: "palActiveA" },
  { key: "leave",     label: "Lv", activeClass: "palActiveL" },
];

const todayStr = () => new Date().toISOString().split("T")[0];

const statusColor: Record<AttendanceStatus, string> = {
  present:   "#12805c",
  absent:    "#b42318",
  leave:     "#c46a14",
};
const statusBg: Record<AttendanceStatus, string> = {
  present:   "#e2f6ee",
  absent:    "#fde7e7",
  leave:     "#fff1df",
};
const statusLabel: Record<AttendanceStatus, string> = {
  present:   "Present",
  absent:    "Absent",
  leave:     "Leave",
};

// Quick-mark statuses available in the bulk textbox bar
const QUICK_STATUSES: { key: AttendanceStatus; label: string; color: string; bg: string }[] = [
  { key: "present",   label: "Present",   color: "#12805c", bg: "#e2f6ee" },
  { key: "absent",    label: "Absent",    color: "#b42318", bg: "#fde7e7" },
  { key: "leave",     label: "Leave",     color: "#c46a14", bg: "#fff1df" },
];

export default function TeacherMarkAttendancePage() {
  const dispatch = useAppDispatch();
  const { activeYear, academicYearId } = useAcademicYear();
  const { formatDate, formatDateShort, toInputValue, fromInputValue, todayISO, isBS } = useDateFormat();

  // Only teacher's own sections
  const { data: mySections, loading: sectionsLoading } = useApi<any[]>(
    academicYearId ? `/teachers/me/sections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  // selectedDate is always stored as AD ISO (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [sectionId, setSectionId]       = useState("");

  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});

  const [existingRecord, setExistingRecord] = useState<any | null>(null);
  const [isLocked, setIsLocked]             = useState(false);
  const [dataLoading, setDataLoading]       = useState(false);

  const { execute: createAttendance, loading: saving } = useMutation("/attendance", "POST");
  const [submitting, setSubmitting] = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);

  // Quick-mark state
  const [quickRolls, setQuickRolls]         = useState("");
  const [quickStatus, setQuickStatus]       = useState<AttendanceStatus>("absent");
  const quickInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first section
  useEffect(() => {
    if (mySections?.length && !sectionId) {
      setSectionId(String(mySections[0].id));
    }
  }, [mySections, sectionId]);

  // Load data whenever section or date changes
  useEffect(() => {
    if (!sectionId || !selectedDate || !academicYearId) return;

    const load = async () => {
      setDataLoading(true);
      setExistingRecord(null);
      setIsLocked(false);
      setEnrolledStudents([]);

      try {
        const attRes = await apiRequest<{ data: any[] }>(`/attendance/section/${sectionId}`);
        const records = attRes.data || [];
        const match = records.find(
          (r: any) => (r.date ?? "").split("T")[0] === selectedDate
        );

        if (match) {
          setExistingRecord(match);
          const detRes = await apiRequest<{ data: any }>(`/attendance/${match.id}`);
          const details: any[] = detRes.data?.details ?? [];
          setEnrolledStudents(details.map((d: any) => ({
            student_id:       d.student_id,
            full_name:        d.full_name ?? d.student_name ?? `Student #${d.student_id}`,
            admission_number: d.admission_number ?? null,
            roll_no:          d.roll_number ?? null,
            guardian_name:    d.guardian_name ?? null,
          })));
          setStatusMap(
            Object.fromEntries(
              details.map((d: any) => [
                d.student_id,
                (["present","absent","leave"].includes(d.status) ? d.status : "present") as AttendanceStatus,
              ])
            )
          );
          setIsLocked(match.status === "submitted");
        } else {
          const enRes = await apiRequest<{ data: any[] }>(
            `/students/enrollments?academic_year_id=${academicYearId}&section_id=${sectionId}`
          );
          const filtered = (enRes.data || []).filter(
            (en: any) => String(en.section_id) === sectionId
          );
          // Sort by the enrollment roll number if available.
          filtered.sort((a: any, b: any) => {
            const ra = Number(a.roll_number ?? 9999);
            const rb = Number(b.roll_number ?? 9999);
            return ra - rb;
          });
          setEnrolledStudents(filtered.map((en: any) => ({ ...en, roll_no: en.roll_number ?? null })));
          setStatusMap(
            Object.fromEntries(
              filtered.map((en: any) => [en.student_id, "present" as AttendanceStatus])
            )
          );
        }
      } catch {
        dispatch(showToast({ type: "error", title: "Error", message: "Could not load attendance data." }));
      } finally {
        setDataLoading(false);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, selectedDate, academicYearId, loadVersion]);

  const setStudentStatus = (studentId: number, status: AttendanceStatus) => {
    if (isLocked) return;
    setStatusMap(curr => ({ ...curr, [studentId]: status }));
  };

  // Bulk mark all
  const markAll = (status: AttendanceStatus) => {
    if (isLocked) return;
    const next: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(e => { next[e.student_id] = status; });
    setStatusMap(next);
  };

  // Quick-mark by roll numbers.
  // The listed roll numbers get the selected status.
  // ALL OTHER students are automatically set to Present.
  const applyQuickMark = () => {
    if (isLocked || !quickRolls.trim()) return;
    const rollNums = quickRolls.split(",").map(r => r.trim()).filter(Boolean);
    const next = { ...statusMap };
    let matched = 0;
    enrolledStudents.forEach(en => {
      if (rollNums.includes(String(en.roll_no))) {
        next[en.student_id] = quickStatus;
        matched++;
      } else {
        // Unlisted students automatically become Present
        next[en.student_id] = "present";
      }
    });
    if (matched === 0) {
      dispatch(showToast({ type: "warning", title: "No match", message: "No students found with those roll numbers." }));
      return;
    }
    setStatusMap(next);
    setQuickRolls("");
    const unmarked = enrolledStudents.length - matched;
    dispatch(showToast({ type: "success", title: "Applied", message: `${matched} marked as ${statusLabel[quickStatus]}, ${unmarked} marked as Present.` }));
    quickInputRef.current?.focus();
  };

  const presentCount   = enrolledStudents.filter(e => statusMap[e.student_id] === "present").length;
  const absentCount    = enrolledStudents.filter(e => statusMap[e.student_id] === "absent").length;
  const leaveCount     = enrolledStudents.filter(e => statusMap[e.student_id] === "leave").length;
  const classSuspended = Boolean(existingRecord?.is_holiday);

  const markedBy = mySections?.find((sec: any) => String(sec.id) === sectionId)?.coordinator_id ?? null;
  const selectedSection = mySections?.find((sec: any) => String(sec.id) === sectionId);

  const saveAttendance = async () => {
    if (!activeYear?.id || !sectionId) {
      dispatch(showToast({ type: "warning", title: "Validation", message: "Please select a section." }));
      return;
    }
    if (!markedBy) {
      dispatch(showToast({ type: "warning", title: "Validation", message: "Could not resolve your teacher ID. Please reload." }));
      return;
    }
    if (enrolledStudents.length === 0) {
      dispatch(showToast({ type: "warning", title: "No students", message: "No enrolled students found for this section." }));
      return;
    }

    const students = enrolledStudents.map(en => ({
      student_id:    en.student_id,
      enrollment_id: en.id ?? en.enrollment_id,
      status:        statusMap[en.student_id] || "present",
    }));

    try {
      if (existingRecord && existingRecord.status === "draft") {
        setSubmitting(true);
        const detRes = await apiRequest<{ data: any }>(`/attendance/${existingRecord.id}`);
        const details: any[] = detRes.data?.details ?? [];

        await Promise.all(
          details.map((d: any) => {
            const newStatus = statusMap[d.student_id] || "present";
            if (d.status === newStatus) return Promise.resolve();
            return apiRequest(`/attendance/details/${d.id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: newStatus, attendance_id: existingRecord.id }),
            });
          })
        );

        await apiRequest(`/attendance/${existingRecord.id}/submit`, { method: "PATCH" });

        dispatch(showToast({
          type: "success",
          title: "Attendance submitted",
          message: `${presentCount}P · ${absentCount}A · ${leaveCount}Lv — visible to students.`,
        }));
      } else {
        await createAttendance({
          academic_year_id: academicYearId,
          class_id:         selectedSection?.class_id,
          section_id:       Number(sectionId),
          date:             selectedDate,
          marked_by:        markedBy,
          students,
        });
        dispatch(showToast({
          type: "success",
          title: "Attendance saved",
          message: `${presentCount}P · ${absentCount}A · ${leaveCount}Lv saved.`,
        }));
      }
      setLoadVersion(v => v + 1);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not save attendance." }));
    } finally {
      setSubmitting(false);
    }
  };

  const rowClass = (studentId: number) => {
    const st = statusMap[studentId];
    if (st === "absent")    return s("absentTableRow");
    if (st === "leave")     return s("leaveTableRow");
    return undefined;
  };

  const suspendClassForDay = async () => {
    if (!activeYear?.id || !sectionId || !markedBy || !selectedSection) return;
    try {
      setSubmitting(true);
      await createAttendance({ academic_year_id: academicYearId, class_id: selectedSection.class_id, section_id: Number(sectionId), date: selectedDate, marked_by: markedBy, is_holiday: true, remarks: "Class suspended", students: [] });
      setShowSuspendConfirm(false);
      setLoadVersion(v => v + 1);
      dispatch(showToast({ type: "success", title: "Class suspended", message: `${selectedSection.class_name} — Section ${selectedSection.name} is suspended for ${displayDateLabel}.` }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Could not suspend class", message: err.message || "Please try again." }));
    } finally { setSubmitting(false); }
  };

  // Display date in BS if needed
  const displayDateLabel = formatDate(selectedDate);

  if (!sectionsLoading && academicYearId && mySections?.length === 0) {
    return (
      <div className={s("page")}>
        <Topbar title="Mark Attendance" subtitle="You have no sections assigned" />
        <ToastNotification />
        <main className={s("content")} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, color: "#c46a14" }}>
              <i className="fa-solid fa-person-chalkboard" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>No sections assigned</h2>
            <p style={{ fontSize: 13, color: "#6a7882", fontWeight: 700, lineHeight: 1.6 }}>
              You are not set as coordinator of any section. Ask your admin to assign you as a section coordinator.
            </p>
            <Link href="/teacher/dashboard" className={cx(s("btn"), s("btnSoft"))} style={{ marginTop: 20, display: "inline-flex" }}>
              <i className="fa-solid fa-house" /> Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={s("page")}>
      <Topbar title="Mark Attendance" subtitle="Record daily attendance for your section" />
      <ToastNotification />

      <main className={s("content")}>

        {/* ── Page header ── */}
        <section className={s("head")}>
          <div>
            <h1>Mark Attendance</h1>
            <p>
              Your section — {selectedSection?.class_name ?? "…"} · {selectedSection ? `Section ${selectedSection.name}` : ""}
              {" · "}
              <strong>{displayDateLabel}</strong>
            </p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/teacher/attendance">
              <i className="fa-solid fa-arrow-left" /> Back
            </Link>
            {!isLocked && !classSuspended && enrolledStudents.length > 0 && (
              <button
                className={cx(s("btn"), s("btnPrimary"))}
                type="button"
                onClick={saveAttendance}
                disabled={saving || submitting || dataLoading}
              >
                {(saving || submitting) ? <Spinner size={16} /> : (
                  existingRecord?.status === "draft"
                    ? <><i className="fa-solid fa-paper-plane" /> Submit Attendance</>
                    : <><i className="fa-solid fa-floppy-disk" /> Save Attendance</>
                )}
              </button>
            )}
            {!existingRecord && !dataLoading && (
              <button className={cx(s("btn"), s("btnOutline"))} type="button" onClick={() => setShowSuspendConfirm(true)} style={{ color: "#6d28d9", borderColor: "#c4b5fd" }}>
                <i className="fa-solid fa-ban" /> Suspend class
              </button>
            )}
          </div>
        </section>

        {/* ── Filters ── */}
        <section className={s("markHero")}>
          <label>
            <span>Section</span>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={sectionsLoading}>
              {mySections?.map((sec: any) => (
                <option key={sec.id} value={sec.id}>
                  {sec.class_name} — Section {sec.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date {isBS ? "(BS)" : ""}</span>
            {/* Input always operates in the display calendar (BS or AD) */}
            <input
              type="date"
              value={toInputValue(selectedDate)}
              max={toInputValue(todayStr())}
              onChange={e => setSelectedDate(fromInputValue(e.target.value))}
            />
          </label>

          {/* Bulk mark buttons */}
          <label style={{ gridColumn: "span 2" }}>
            <span>Quick mark all</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(["present","absent","leave"] as AttendanceStatus[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => markAll(st)}
                  disabled={isLocked || dataLoading}
                  style={{
                    padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 800,
                    background: statusBg[st], color: statusColor[st],
                    opacity: isLocked ? 0.5 : 1,
                  }}
                >
                  All {statusLabel[st]}
                </button>
              ))}
            </div>
          </label>
        </section>

        {classSuspended && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 12, background: "#f5f3ff", border: "1px solid #c4b5fd", marginBottom: 4 }}>
            <i className="fa-solid fa-ban" style={{ color: "#6d28d9", fontSize: 18 }} />
            <div><strong style={{ color: "#5b21b6", fontSize: 14 }}>Class suspended for this day</strong><p style={{ color: "#6d28d9", fontSize: 12, fontWeight: 700, margin: "3px 0 0" }}>No individual student attendance is recorded for this section.</p></div>
          </div>
        )}

        {/* ── Lock banner ── */}
        {isLocked && (
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "#fff8ee", border: "1px solid #fdd5b0", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="fa-solid fa-lock" style={{ color: "#c46a14", fontSize: 16 }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: "#92400e", margin: 0 }}>Attendance Submitted &amp; Locked</p>
              <p style={{ fontSize: 12, color: "#b45309", fontWeight: 700, margin: "3px 0 0" }}>
                Submitted on {formatDateShort(existingRecord?.updated_at ?? existingRecord?.created_at ?? selectedDate)}.
                Contact your admin to make changes.
              </p>
            </div>
          </div>
        )}

        {/* ── Draft notice ── */}
        {existingRecord && !isLocked && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 700, color: "#1e40af" }}>
            <i className="fa-solid fa-circle-info" style={{ flexShrink: 0 }} />
            Draft attendance loaded from {formatDateShort(existingRecord?.date ?? selectedDate)}. Review and submit to publish.
          </div>
        )}

        {/* ── Student table ── */}
        <article className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h2>{selectedSection?.class_name ?? "Class"} — Section {selectedSection?.name ?? ""}</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                {displayDateLabel}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6a7882" }}>
                {isLocked
                  ? "Read-only — submitted attendance cannot be edited here."
                  : "Tap P · A · Lv to set each student's status."}
              </p>
            </div>
          </div>

          <div className={s("attendanceTableWrap")}>
            {classSuspended ? (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "#5b21b6" }}>
                <i className="fa-solid fa-ban" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
                <strong style={{ fontSize: 14 }}>Class suspended — attendance is not required for this section today.</strong>
              </div>
            ) : (sectionsLoading || dataLoading) ? (
              <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={32} /></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48, textAlign: "center" }}>#</th>
                    <th>Roll no.</th>
                    <th>Student</th>
                    <th>Father / guardian</th>
                    <th>Status</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map((en, idx) => (
                    <tr className={rowClass(en.student_id)} key={en.student_id}>
                      <td style={{ textAlign: "center", fontWeight: 900, fontSize: 13, color: "#6a7882" }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 900, fontSize: 13, color: "#1f2d36" }}>{en.roll_no ?? "—"}</td>
                      <td>
                        <div style={{ fontWeight: 800, fontSize: 13, color: "#1f2d36" }}>{en.full_name}</div>
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 700, color: "#51606a" }}>{en.guardian_name ?? "—"}</td>
                      <td>
                        {isLocked ? (
                          <div style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 900,
                            background: statusBg[(statusMap[en.student_id] ?? "present") as AttendanceStatus],
                            color: statusColor[(statusMap[en.student_id] ?? "present") as AttendanceStatus],
                          }}>
                            {statusLabel[(statusMap[en.student_id] ?? "present") as AttendanceStatus]}
                          </div>
                        ) : (
                          <div className={s("palToggle")}>
                            {PAL.map(({ key, label, activeClass }) => (
                              <button
                                key={key}
                                type="button"
                                className={cx(s("palBtn"), statusMap[en.student_id] === key && s(activeClass))}
                                onClick={() => setStudentStatus(en.student_id, key)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          placeholder="Optional remark…"
                          disabled={isLocked}
                          style={{
                            width: "100%", padding: "6px 10px", borderRadius: 8,
                            border: "1px solid #dce5e9", fontSize: 12, background: isLocked ? "#f8fafc" : "#fff",
                            outline: "none",
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {enrolledStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#6a7882" }}>
                        No students found for this section.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </article>

        {/* ── Quick-mark by roll number ── */}
        {!isLocked && !classSuspended && enrolledStudents.length > 0 && (
          <div style={{
            background: "#fff", border: "1px solid #dce5e9", borderRadius: 14,
            padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>
                <i className="fa-solid fa-bolt" style={{ color: "#ff9b51", marginRight: 7 }} />
                Quick Mark by Roll Number
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 600 }}>
                Enter roll numbers separated by commas, choose a status, then click Apply.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                ref={quickInputRef}
                value={quickRolls}
                onChange={e => setQuickRolls(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applyQuickMark()}
                placeholder="e.g. 3, 7, 12, 15"
                style={{
                  flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 9,
                  border: "1px solid #dce5e9", fontSize: 13, fontWeight: 700,
                  outline: "none",
                }}
              />
              {/* Status selector */}
              <div style={{ display: "flex", gap: 5 }}>
                {QUICK_STATUSES.map(qs => (
                  <button
                    key={qs.key}
                    type="button"
                    onClick={() => setQuickStatus(qs.key)}
                    style={{
                      padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 800,
                      background: quickStatus === qs.key ? qs.color : qs.bg,
                      color:      quickStatus === qs.key ? "#fff"    : qs.color,
                      boxShadow:  quickStatus === qs.key ? `0 0 0 2px ${qs.color}44` : "none",
                      transition: "all .15s",
                    }}
                  >
                    {qs.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={applyQuickMark}
                disabled={!quickRolls.trim()}
                style={{
                  padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 900,
                  background: quickRolls.trim() ? "#ff9b51" : "#e2e8f0",
                  color:      quickRolls.trim() ? "#fff"    : "#94a3b8",
                  transition: "all .15s",
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* ── Bottom: compact stats strip + save button ── */}
        {!isLocked && !classSuspended && enrolledStudents.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            {/* Compact stat pill strip */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Total",   val: enrolledStudents.length, color: "#1f2d36", bg: "#f1f5f9", border: "#dce5e9" },
                { label: "Present", val: presentCount,            color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
                { label: "Absent",  val: absentCount,             color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
                { label: "Leave",   val: leaveCount,              color: "#c46a14", bg: "#fff1df", border: "#fcd34d" },
              ].map(c => (
                <div key={c.label} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 999,
                  background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <strong style={{ fontSize: 14, fontWeight: 900, color: c.color }}>{c.val}</strong>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.color, opacity: 0.85 }}>{c.label}</span>
                </div>
              ))}
            </div>
            {/* Save / Submit button */}
            <button
              className={cx(s("btn"), s("btnPrimary"))}
              type="button"
              onClick={saveAttendance}
              disabled={saving || submitting || dataLoading}
            >
              {(saving || submitting) ? <Spinner size={16} /> : (
                existingRecord?.status === "draft"
                  ? <><i className="fa-solid fa-paper-plane" /> Submit Attendance</>
                  : <><i className="fa-solid fa-floppy-disk" /> Save Attendance</>
              )}
            </button>
          </div>
        )}

      </main>
      {showSuspendConfirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="suspend-class-title" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15, 23, 42, .48)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(460px, 100%)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 70px rgba(15,23,42,.3)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ede9fe", color: "#6d28d9", display: "grid", placeItems: "center", fontSize: 18, marginBottom: 14 }}><i className="fa-solid fa-ban" /></div>
            <h2 id="suspend-class-title" style={{ margin: 0, color: "#1f2d36", fontSize: 18, fontWeight: 900 }}>Suspend this class for the day?</h2>
            <p style={{ margin: "9px 0 0", color: "#5f6f7b", fontSize: 13, fontWeight: 600, lineHeight: 1.55 }}>This marks {selectedSection?.class_name} — Section {selectedSection?.name} as suspended on {displayDateLabel}. No student will be marked present, absent, or on leave for this date.</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button type="button" className={cx(s("btn"), s("btnOutline"))} onClick={() => setShowSuspendConfirm(false)} disabled={submitting}>Cancel</button>
              <button type="button" className={cx(s("btn"), s("btnPrimary"))} onClick={suspendClassForDay} disabled={submitting} style={{ background: "#6d28d9" }}>{submitting ? <Spinner size={16} /> : <><i className="fa-solid fa-ban" /> Yes, suspend class</>}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
