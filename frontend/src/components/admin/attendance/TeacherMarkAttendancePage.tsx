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
type DayStatus        = "working" | "weekly_off" | "holiday" | "checking";

const PAL: { key: AttendanceStatus; label: string; activeClass: string }[] = [
  { key: "present", label: "P",  activeClass: "palActiveP" },
  { key: "absent",  label: "A",  activeClass: "palActiveA" },
  { key: "leave",   label: "Lv", activeClass: "palActiveL" },
];

const todayStr = () => new Date().toISOString().split("T")[0];

const statusColor: Record<AttendanceStatus, string> = {
  present: "#12805c", absent: "#b42318", leave: "#7c3aed",
};
const statusBg: Record<AttendanceStatus, string> = {
  present: "#e2f6ee", absent: "#fde7e7", leave: "#f3eeff",
};
const statusLabel: Record<AttendanceStatus, string> = {
  present: "Present", absent: "Absent", leave: "Leave",
};

const QUICK_STATUSES: { key: AttendanceStatus; label: string; color: string; bg: string }[] = [
  { key: "present", label: "Present", color: "#12805c", bg: "#e2f6ee" },
  { key: "absent",  label: "Absent",  color: "#b42318", bg: "#fde7e7" },
];

export default function TeacherMarkAttendancePage() {
  const dispatch = useAppDispatch();
  const { activeYear, academicYearId } = useAcademicYear();
  const { formatDate, formatDateShort, toInputValue, fromInputValue, isBS } = useDateFormat();

  const { data: mySections, loading: sectionsLoading } = useApi<any[]>(
    academicYearId ? `/teachers/me/sections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const [selectedDate,      setSelectedDate]      = useState(todayStr());
  const [sectionId,         setSectionId]         = useState("");
  const [enrolledStudents,  setEnrolledStudents]  = useState<any[]>([]);
  const [statusMap,         setStatusMap]         = useState<Record<string, AttendanceStatus>>({});
  const [existingRecord,    setExistingRecord]    = useState<any | null>(null);
  // isSubmitted = record exists and status is "submitted"
  const [isSubmitted,       setIsSubmitted]       = useState(false);
  const [dataLoading,       setDataLoading]       = useState(false);
  const [dayStatus,         setDayStatus]         = useState<DayStatus>("checking");
  const [dayEventName,      setDayEventName]      = useState<string | null>(null);

  const { execute: createAttendance, loading: saving } = useMutation("/attendance", "POST");
  const [submitting,         setSubmitting]         = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  const [showUnsuspendConfirm, setShowUnsuspendConfirm] = useState(false);
  const [loadVersion,        setLoadVersion]        = useState(0);

  // Quick mark
  const [quickRolls,  setQuickRolls]  = useState("");
  const [quickStatus, setQuickStatus] = useState<AttendanceStatus>("absent");
  const quickInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first section
  useEffect(() => {
    if (mySections?.length && !sectionId) setSectionId(String(mySections[0].id));
  }, [mySections, sectionId]);

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sectionId || !selectedDate || !academicYearId) return;

    const load = async () => {
      setDataLoading(true);
      setDayStatus("checking");
      setDayEventName(null);
      setExistingRecord(null);
      setIsSubmitted(false);
      setEnrolledStudents([]);
      setStatusMap({});

      // Step 1: check working day
      try {
        const wdRes = await apiRequest<{ data: { working_days: number; weekend_days: number; holidays: number } }>(
          `/calendar/working-days?academic_year_id=${academicYearId}&start_date=${selectedDate}&end_date=${selectedDate}`
        );
        const wd = wdRes.data;
        if (wd.working_days === 0) {
          const reason: DayStatus = wd.weekend_days > 0 ? "weekly_off" : "holiday";
          setDayStatus(reason);
          if (reason === "holiday") {
            try {
              const calRes = await apiRequest<{ data: { id: number } }>(`/calendar?academic_year_id=${academicYearId}`);
              if (calRes.data?.id) {
                const evRes = await apiRequest<{ data: any[] }>(`/calendar/${calRes.data.id}/events`);
                const events: any[] = evRes.data || [];
                const matching = events.find((ev: any) => {
                  const start = (ev.event_date ?? "").slice(0, 10);
                  const end   = (ev.end_date   ?? start).slice(0, 10);
                  return selectedDate >= start && selectedDate <= end && ev.affects_attendance === true;
                });
                if (matching) setDayEventName(matching.title ?? matching.name ?? null);
              }
            } catch { /* non-critical */ }
          }
          setDataLoading(false);
          return;
        }
        setDayStatus("working");
      } catch {
        setDayStatus("working");
      }

      // Step 2: load record or enrollments
      try {
        const attRes = await apiRequest<{ data: any[] }>(
          `/attendance/section/${sectionId}?academic_year_id=${academicYearId}`
        );
        const records = attRes.data || [];
        const match   = records.find((r: any) => (r.date ?? "").split("T")[0] === selectedDate);

        if (match) {
          setExistingRecord(match);
          setIsSubmitted(match.status === "submitted");

          // Load details (students + their statuses)
          const detRes  = await apiRequest<{ data: any }>(`/attendance/${match.id}`);
          const details: any[] = detRes.data?.details ?? [];

          setEnrolledStudents(details.map((d: any) => ({
            student_id:    d.student_id,
            full_name:     d.full_name ?? d.student_name ?? `Student #${d.student_id}`,
            roll_no:       d.roll_number ?? null,
            guardian_name: d.guardian_name ?? null,
            detail_id:     d.id, // store detail row id for PATCH
          })));

          // ✅ Key fix: use status from DB details, NOT default "present"
          setStatusMap(Object.fromEntries(
            details.map((d: any) => [
              d.student_id,
              (["present", "absent", "leave"].includes(d.status) ? d.status : "present") as AttendanceStatus,
            ])
          ));
        } else {
          // Fresh — load enrolled students, default all to "present"
          const enRes = await apiRequest<{ data: any[] }>(
            `/students/enrollments?academic_year_id=${academicYearId}&section_id=${sectionId}`
          );
          const filtered = (enRes.data || [])
            .filter((en: any) => String(en.section_id) === sectionId)
            .sort((a: any, b: any) => Number(a.roll_number ?? 9999) - Number(b.roll_number ?? 9999));
          setEnrolledStudents(filtered.map((en: any) => ({
            ...en,
            roll_no:   en.roll_number ?? null,
            detail_id: null,
          })));
          setStatusMap(Object.fromEntries(
            filtered.map((en: any) => [en.student_id, "present" as AttendanceStatus])
          ));
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

  // ── Status helpers ───────────────────────────────────────────────────────
  const setStudentStatus = (studentId: number, status: AttendanceStatus) => {
    if (isSubmitted) return;
    setStatusMap(curr => ({ ...curr, [studentId]: status }));
  };

  const markAll = (status: AttendanceStatus) => {
    if (isSubmitted) return;
    const next: Record<string, AttendanceStatus> = {};
    enrolledStudents.forEach(e => { next[e.student_id] = status; });
    setStatusMap(next);
  };

  const applyQuickMark = () => {
    if (isSubmitted || !quickRolls.trim()) return;
    const rollNums = quickRolls.split(",").map(r => r.trim()).filter(Boolean);
    const next = { ...statusMap };
    let matched = 0;
    enrolledStudents.forEach(en => {
      if (rollNums.includes(String(en.roll_no))) { next[en.student_id] = quickStatus; matched++; }
      else { next[en.student_id] = "present"; }
    });
    if (matched === 0) {
      dispatch(showToast({ type: "warning", title: "No match", message: "No students found with those roll numbers." }));
      return;
    }
    setStatusMap(next);
    setQuickRolls("");
    dispatch(showToast({ type: "success", title: "Updated", message: `${matched} marked as ${statusLabel[quickStatus]}, ${enrolledStudents.length - matched} as Present. Click Save to submit.` }));
    quickInputRef.current?.focus();
  };

  const presentCount    = enrolledStudents.filter(e => statusMap[e.student_id] === "present").length;
  const absentCount     = enrolledStudents.filter(e => statusMap[e.student_id] === "absent").length;
  const leaveCount      = enrolledStudents.filter(e => statusMap[e.student_id] === "leave").length;
  const classSuspended  = Boolean(existingRecord?.is_holiday);
  const markedBy        = mySections?.find((sec: any) => String(sec.id) === sectionId)?.coordinator_id ?? null;
  const selectedSection = mySections?.find((sec: any) => String(sec.id) === sectionId);
  const displayDateLabel = formatDate(selectedDate);
  const isNonWorkingDay  = dayStatus === "weekly_off" || dayStatus === "holiday";
  const showStudentTable = dayStatus === "working" || dayStatus === "checking";

  // ── Save / Submit ────────────────────────────────────────────────────────
  // Flow:
  //   Fresh day  → POST /attendance (creates as draft) → immediately PATCH /submit
  //   Draft day  → PATCH each changed detail          → immediately PATCH /submit
  //   Submitted  → blocked (teacher cannot edit; admin can via admin panel)
  const saveAttendance = async () => {
    if (!academicYearId || !sectionId) {
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

    try {
      setSubmitting(true);

      if (existingRecord && existingRecord.status === "draft") {
        // ── Edit draft: PATCH changed details then submit ──
        const detRes  = await apiRequest<{ data: any }>(`/attendance/${existingRecord.id}`);
        const details: any[] = detRes.data?.details ?? [];

        await Promise.all(details.map((d: any) => {
          const newStatus = statusMap[d.student_id] || "present";
          if (d.status === newStatus) return Promise.resolve();
          return apiRequest(`/attendance/details/${d.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus, attendance_id: existingRecord.id }),
          });
        }));
        await apiRequest(`/attendance/${existingRecord.id}/submit`, { method: "PATCH" });

        dispatch(showToast({ type: "success", title: "Attendance Submitted", message: `${presentCount}P · ${absentCount}A · ${leaveCount}Lv — now visible to students.` }));

      } else if (existingRecord && existingRecord.status === "submitted") {
        // Submitted → blocked
        dispatch(showToast({ type: "warning", title: "Already Submitted", message: "This attendance is submitted. Contact admin to make changes." }));
        return;

      } else {
        // ── Fresh: create + immediately submit ──
        const students = enrolledStudents.map(en => ({
          student_id:    en.student_id,
          enrollment_id: en.id ?? en.enrollment_id,
          status:        statusMap[en.student_id] || "present",
        }));

        const created = await createAttendance({
          academic_year_id: academicYearId,
          class_id:         selectedSection?.class_id,
          section_id:       Number(sectionId),
          date:             selectedDate,
          marked_by:        markedBy,
          students,
        }) as any;

        // Immediately submit after creation
        const createdId = created?.id ?? created?.data?.id;
        if (createdId) {
          await apiRequest(`/attendance/${createdId}/submit`, { method: "PATCH" });
        }

        dispatch(showToast({ type: "success", title: "Attendance Submitted", message: `${presentCount}P · ${absentCount}A · ${leaveCount}Lv — saved and visible to students.` }));
      }

      // Reload to reflect submitted state
      setLoadVersion(v => v + 1);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not save attendance." }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Suspend class ────────────────────────────────────────────────────────
  const suspendClassForDay = async () => {
    if (!academicYearId || !sectionId || !markedBy || !selectedSection) return;
    try {
      setSubmitting(true);
      await createAttendance({
        academic_year_id: academicYearId,
        class_id:         selectedSection.class_id,
        section_id:       Number(sectionId),
        date:             selectedDate,
        marked_by:        markedBy,
        is_holiday:       true,
        remarks:          "Class suspended by teacher",
        students:         [],
      });
      setShowSuspendConfirm(false);
      setLoadVersion(v => v + 1);
      dispatch(showToast({ type: "success", title: "Class Suspended", message: `${selectedSection.class_name} — Section ${selectedSection.name} suspended for ${displayDateLabel}.` }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Could not suspend class", message: err.message || "Please try again." }));
    } finally { setSubmitting(false); }
  };

  // ── Unsuspend class ──────────────────────────────────────────────────────
  // Delete the suspension record so teacher can mark normal attendance
  const unsuspendClass = async () => {
    if (!existingRecord?.id || !academicYearId) return;
    try {
      setSubmitting(true);
      await apiRequest(`/attendance/${existingRecord.id}`, { method: "DELETE" });
      setShowUnsuspendConfirm(false);
      setLoadVersion(v => v + 1);
      dispatch(showToast({ type: "success", title: "Suspension Removed", message: `${displayDateLabel} is now a regular attendance day.` }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Could not remove suspension", message: err.message || "Please try again." }));
    } finally { setSubmitting(false); }
  };

  const rowBg = (studentId: number) => {
    const st = statusMap[studentId];
    if (st === "absent") return s("absentTableRow");
    if (st === "leave")  return s("leaveTableRow");
    return undefined;
  };

  // ── Empty sections guard ─────────────────────────────────────────────────
  if (!sectionsLoading && academicYearId && mySections?.length === 0) {
    return (
      <div className={s("page")}>
        <ToastNotification />
        <main className={s("content")} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320 }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, color: "#c46a14" }}>
              <i className="fa-solid fa-person-chalkboard" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: "0 0 8px" }}>No sections assigned</h2>
            <p style={{ fontSize: 13, color: "#6a7882", fontWeight: 700, lineHeight: 1.6 }}>You are not the coordinator of any section. Ask admin to assign you.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={s("page")}>
      <style>{`
        .atnd-hero { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .atnd-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .atnd-table-wrap table { min-width:560px; }
        .atnd-bottom { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .atnd-pills { display:flex; gap:8px; flex-wrap:wrap; }
        .atnd-qm-row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
        @media(max-width:640px){
          .atnd-hero { grid-template-columns:1fr !important; }
          .atnd-qm-row { flex-direction:column; align-items:stretch; }
          .atnd-bottom { flex-direction:column; align-items:stretch; }
          .atnd-bottom button { width:100%; justify-content:center; }
        }
      `}</style>

      <ToastNotification />

      <main className={s("content")}>

        {/* ── Filters bar ── */}
        <section className={cx(s("markHero"), "atnd-hero")}>
          <label>
            <span>Section</span>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={sectionsLoading}>
              {mySections?.map((sec: any) => (
                <option key={sec.id} value={sec.id}>{sec.class_name} — Section {sec.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Date {isBS ? "(BS)" : ""}</span>
            <input
              type="date"
              value={toInputValue(selectedDate)}
              max={toInputValue(todayStr())}
              onChange={e => setSelectedDate(fromInputValue(e.target.value))}
            />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            <span>Quick mark all</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {(["present", "absent"] as AttendanceStatus[]).map(st => (
                <button key={st} type="button" onClick={() => markAll(st)}
                  disabled={isSubmitted || dataLoading || isNonWorkingDay || classSuspended}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800, background: statusBg[st], color: statusColor[st], opacity: (isSubmitted || isNonWorkingDay || classSuspended) ? 0.4 : 1 }}>
                  All {statusLabel[st]}
                </button>
              ))}
              {/* Suspend — only when no record yet */}
              {!existingRecord && !dataLoading && dayStatus === "working" && (
                <button type="button" onClick={() => setShowSuspendConfirm(true)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #c4b5fd", cursor: "pointer", fontSize: 12, fontWeight: 800, background: "#f5f3ff", color: "#6d28d9" }}>
                  <i className="fa-solid fa-ban" style={{ marginRight: 5 }} /> Suspend class for a day
                </button>
              )}
              {/* Unsuspend — when class is suspended */}
              {classSuspended && (
                <button type="button" onClick={() => setShowUnsuspendConfirm(true)}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #fca5a5", cursor: "pointer", fontSize: 12, fontWeight: 800, background: "#fef2f2", color: "#b91c1c" }}>
                  <i className="fa-solid fa-rotate-left" style={{ marginRight: 5 }} /> Remove suspension
                </button>
              )}
            </div>
          </label>
        </section>

        {/* ── Holiday / Weekly-off banner ── */}
        {isNonWorkingDay && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px", borderRadius: 14, background: dayStatus === "weekly_off" ? "#fdf2f8" : "#fff7ed", border: `1px solid ${dayStatus === "weekly_off" ? "#f9a8d4" : "#fed7aa"}` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: dayStatus === "weekly_off" ? "#fce7f3" : "#ffedd5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: dayStatus === "weekly_off" ? "#be185d" : "#c2410c" }}>
              <i className={dayStatus === "weekly_off" ? "fa-solid fa-calendar-xmark" : "fa-solid fa-umbrella-beach"} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 15, color: dayStatus === "weekly_off" ? "#9d174d" : "#92400e" }}>
                {dayStatus === "weekly_off" ? "Weekly Off — No Attendance Required" : `Holiday${dayEventName ? `: ${dayEventName}` : ""}`}
              </p>
              <p style={{ margin: "5px 0 0", fontWeight: 600, fontSize: 13, color: dayStatus === "weekly_off" ? "#be185d" : "#b45309" }}>
                {dayStatus === "weekly_off" ? `${displayDateLabel} is a weekly off day.` : `${displayDateLabel} is a school holiday.`}
              </p>
            </div>
          </div>
        )}

        {/* ── Suspended banner ── */}
        {classSuspended && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderRadius: 12, background: "#f5f3ff", border: "1px solid #c4b5fd", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <i className="fa-solid fa-ban" style={{ color: "#6d28d9", fontSize: 18 }} />
              <div>
                <strong style={{ color: "#5b21b6", fontSize: 14 }}>Class suspended for this day</strong>
                <p style={{ color: "#6d28d9", fontSize: 12, fontWeight: 700, margin: "3px 0 0" }}>No individual student attendance is recorded.</p>
              </div>
            </div>
            <button type="button" onClick={() => setShowUnsuspendConfirm(true)}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fa-solid fa-rotate-left" /> Remove suspension
            </button>
          </div>
        )}

        {/* ── Submitted banner ── */}
        {isSubmitted && !classSuspended && (
          <div style={{ padding: "14px 18px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #86efac", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="fa-solid fa-circle-check" style={{ color: "#15803d", fontSize: 18 }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: "#14532d", margin: 0 }}>Attendance Submitted</p>
              <p style={{ fontSize: 12, color: "#15803d", fontWeight: 700, margin: "3px 0 0" }}>
                Submitted · {presentCount}P · {absentCount}A · {leaveCount}Lv — visible to students. Contact admin to make changes.
              </p>
            </div>
          </div>
        )}

        {/* ── Student table ── */}
        {showStudentTable && (
          <article className={s("card")}>
            <div className={s("cardHead")}>
              <div>
                <h2>{selectedSection?.class_name ?? "Class"} — Section {selectedSection?.name ?? ""}</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 700 }}>{displayDateLabel}</p>
                {isSubmitted && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#15803d", fontWeight: 700 }}>
                    Read-only — attendance submitted. Contact admin to edit.
                  </p>
                )}
              </div>
            </div>

            <div className={cx(s("attendanceTableWrap"), "atnd-table-wrap")}>
              {classSuspended ? (
                <div style={{ padding: "2.5rem", textAlign: "center", color: "#5b21b6" }}>
                  <i className="fa-solid fa-ban" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
                  <strong style={{ fontSize: 14 }}>Class suspended — no attendance required today.</strong>
                </div>
              ) : (sectionsLoading || dataLoading) ? (
                <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={32} /></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: "center" }}>#</th>
                      <th>Roll no.</th>
                      <th>Student</th>
                      <th>Father / Guardian</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolledStudents.map((en, idx) => (
                      <tr className={rowBg(en.student_id)} key={en.student_id}>
                        <td style={{ textAlign: "center", fontWeight: 900, fontSize: 13, color: "#6a7882" }}>{idx + 1}</td>
                        <td style={{ fontWeight: 900, fontSize: 13, color: "#1f2d36" }}>{en.roll_no ?? "—"}</td>
                        <td><div style={{ fontWeight: 800, fontSize: 13, color: "#1f2d36" }}>{en.full_name}</div></td>
                        <td style={{ fontSize: 13, fontWeight: 700, color: "#51606a" }}>{en.guardian_name ?? "—"}</td>
                        <td>
                          {isSubmitted ? (
                            // Show read-only pill
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 900, background: statusBg[(statusMap[en.student_id] ?? "present") as AttendanceStatus], color: statusColor[(statusMap[en.student_id] ?? "present") as AttendanceStatus] }}>
                              {statusLabel[(statusMap[en.student_id] ?? "present") as AttendanceStatus]}
                            </div>
                          ) : (
                            // Editable PAL buttons
                            <div className={s("palToggle")}>
                              {PAL.map(({ key, label, activeClass }) => (
                                <button key={key} type="button"
                                  className={cx(s("palBtn"), statusMap[en.student_id] === key && s(activeClass))}
                                  onClick={() => setStudentStatus(en.student_id, key)}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <input placeholder="Optional remark…" disabled={isSubmitted}
                            style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: "1px solid #dce5e9", fontSize: 12, background: isSubmitted ? "#f8fafc" : "#fff", outline: "none" }}
                          />
                        </td>
                      </tr>
                    ))}
                    {enrolledStudents.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#6a7882" }}>No students found for this section.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </article>
        )}

        {/* ── Quick Mark + Save — only when editable ── */}
        {dayStatus === "working" && !isSubmitted && !classSuspended && enrolledStudents.length > 0 && (
          <>
            {/* Quick mark by roll */}
            <div style={{ background: "#fff", border: "1px solid #dce5e9", borderRadius: 14, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>
                  <i className="fa-solid fa-bolt" style={{ color: "#ff9b51", marginRight: 7 }} />
                  Quick Mark by Roll Number
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 600 }}>
                  Enter roll numbers separated by commas — those students get the chosen status, all others become Present.
                </p>
              </div>
              <div className="atnd-qm-row">
                <input ref={quickInputRef} value={quickRolls}
                  onChange={e => setQuickRolls(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyQuickMark()}
                  placeholder="e.g. 3, 7, 12, 15"
                  style={{ flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 9, border: "1px solid #dce5e9", fontSize: 13, fontWeight: 700, outline: "none" }}
                />
                <div style={{ display: "flex", gap: 5 }}>
                  {QUICK_STATUSES.map(qs => (
                    <button key={qs.key} type="button" onClick={() => setQuickStatus(qs.key)} style={{
                      padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 800,
                      background: quickStatus === qs.key ? qs.color : qs.bg,
                      color:      quickStatus === qs.key ? "#fff"    : qs.color,
                      boxShadow:  quickStatus === qs.key ? `0 0 0 2px ${qs.color}44` : "none",
                    }}>{qs.label}</button>
                  ))}
                </div>
                {/* Apply only updates UI state */}
                <button type="button" onClick={applyQuickMark} disabled={!quickRolls.trim()} style={{
                  padding: "8px 18px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 900,
                  background: quickRolls.trim() ? "#64748b" : "#e2e8f0",
                  color:      quickRolls.trim() ? "#fff"    : "#94a3b8",
                }}>Apply</button>
              </div>
            </div>

            {/* Stats + Save button */}
            <div className="atnd-bottom">
              <div className="atnd-pills">
                {[
                  { label: "Total",   val: enrolledStudents.length, color: "#1f2d36", bg: "#f1f5f9", border: "#dce5e9" },
                  { label: "Present", val: presentCount,            color: "#12805c", bg: "#e2f6ee", border: "#a7f3d0" },
                  { label: "Absent",  val: absentCount,             color: "#b42318", bg: "#fde7e7", border: "#fca5a5" },
                  { label: "Leave",   val: leaveCount,              color: "#7c3aed", bg: "#f3eeff", border: "#ddd6fe" },
                ].map(c => (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}` }}>
                    <strong style={{ fontSize: 15, fontWeight: 900, color: c.color }}>{c.val}</strong>
                    <span style={{ fontSize: 11, fontWeight: 700, color: c.color, opacity: 0.85 }}>{c.label}</span>
                  </div>
                ))}
              </div>
              <button className={cx(s("btn"), s("btnPrimary"))} type="button"
                onClick={saveAttendance} disabled={saving || submitting || dataLoading}>
                {(saving || submitting)
                  ? <Spinner size={16} />
                  : <><i className="fa-solid fa-paper-plane" /> {existingRecord ? "Update & Submit" : "Save & Submit"}</>
                }
              </button>
            </div>
          </>
        )}

      </main>

      {/* ── Suspend confirm modal ── */}
      {showSuspendConfirm && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(460px,100%)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 70px rgba(15,23,42,.3)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ede9fe", color: "#6d28d9", display: "grid", placeItems: "center", fontSize: 18, marginBottom: 14 }}>
              <i className="fa-solid fa-ban" />
            </div>
            <h2 style={{ margin: 0, color: "#1f2d36", fontSize: 18, fontWeight: 900 }}>Suspend this class for the day?</h2>
            <p style={{ margin: "9px 0 0", color: "#5f6f7b", fontSize: 13, fontWeight: 600, lineHeight: 1.55 }}>
              This marks {selectedSection?.class_name} — Section {selectedSection?.name} as suspended on {displayDateLabel}.
              No student attendance will be recorded. <strong>You can undo this later.</strong>
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button type="button" className={cx(s("btn"), s("btnOutline"))} onClick={() => setShowSuspendConfirm(false)} disabled={submitting}>Cancel</button>
              <button type="button" className={cx(s("btn"), s("btnPrimary"))} onClick={suspendClassForDay} disabled={submitting} style={{ background: "#6d28d9" }}>
                {submitting ? <Spinner size={16} /> : <><i className="fa-solid fa-ban" /> Yes, suspend class</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unsuspend confirm modal ── */}
      {showUnsuspendConfirm && (
        <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(460px,100%)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 70px rgba(15,23,42,.3)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef2f2", color: "#b91c1c", display: "grid", placeItems: "center", fontSize: 18, marginBottom: 14 }}>
              <i className="fa-solid fa-rotate-left" />
            </div>
            <h2 style={{ margin: 0, color: "#1f2d36", fontSize: 18, fontWeight: 900 }}>Remove class suspension?</h2>
            <p style={{ margin: "9px 0 0", color: "#5f6f7b", fontSize: 13, fontWeight: 600, lineHeight: 1.55 }}>
              This will remove the suspension for {displayDateLabel}. You will then be able to mark normal student attendance for this day.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button type="button" className={cx(s("btn"), s("btnOutline"))} onClick={() => setShowUnsuspendConfirm(false)} disabled={submitting}>Cancel</button>
              <button type="button" className={cx(s("btn"), s("btnPrimary"))} onClick={unsuspendClass} disabled={submitting} style={{ background: "#b91c1c" }}>
                {submitting ? <Spinner size={16} /> : <><i className="fa-solid fa-rotate-left" /> Yes, remove suspension</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
