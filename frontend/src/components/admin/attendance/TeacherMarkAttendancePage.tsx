"use client";

import { useState, useEffect } from "react";
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

const s  = (name: string) => styles[name] || name;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

type AttendanceStatus = "present" | "absent" | "leave";

const PAL: { key: AttendanceStatus; label: string; activeClass: string }[] = [
  { key: "present", label: "P", activeClass: "palActiveP" },
  { key: "absent",  label: "A", activeClass: "palActiveA" },
  { key: "leave",   label: "L", activeClass: "palActiveL" },
];

const todayStr = () => new Date().toISOString().split("T")[0];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const statusColor: Record<AttendanceStatus, string> = {
  present: "#12805c",
  absent:  "#b42318",
  leave:   "#c46a14",
};
const statusBg: Record<AttendanceStatus, string> = {
  present: "#e2f6ee",
  absent:  "#fde7e7",
  leave:   "#fff1df",
};

export default function TeacherMarkAttendancePage() {
  const dispatch = useAppDispatch();
  const { activeYear, academicYearId } = useAcademicYear();

  // Only teacher's own sections
  const { data: mySections, loading: sectionsLoading } = useApi<any[]>(
    academicYearId ? `/teachers/me/sections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [sectionId, setSectionId]       = useState("");

  // Students and their statuses
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});

  // Existing attendance state
  const [existingRecord, setExistingRecord]   = useState<any | null>(null);
  const [isLocked, setIsLocked]               = useState(false);
  const [dataLoading, setDataLoading]         = useState(false);

  const { execute: createAttendance, loading: saving } = useMutation("/attendance", "POST");
  const [submitting, setSubmitting] = useState(false);

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
        // 1. Check for an existing attendance record for this section + date
        const attRes = await apiRequest<{ data: any[] }>(`/attendance/section/${sectionId}`);
        const records = attRes.data || [];
        const match = records.find(
          (r: any) => (r.date ?? "").split("T")[0] === selectedDate
        );

        if (match) {
          setExistingRecord(match);

          // If submitted → lock. Fetch details for display.
          const detRes = await apiRequest<{ data: any }>(`/attendance/${match.id}`);
          const details: any[] = detRes.data?.details ?? [];

          // Build student list from details (they already have full_name)
          setEnrolledStudents(details.map((d: any) => ({
            student_id:       d.student_id,
            full_name:        d.full_name ?? d.student_name ?? `Student #${d.student_id}`,
            admission_number: d.admission_number ?? null,
          })));
          setStatusMap(
            Object.fromEntries(
              details.map((d: any) => [
                d.student_id,
                (["present", "absent", "leave"].includes(d.status) ? d.status : "present") as AttendanceStatus,
              ])
            )
          );

          setIsLocked(match.status === "submitted");
        } else {
          // 2. No record → load enrollments and default to present
          const enRes = await apiRequest<{ data: any[] }>(
            `/students/enrollments?academic_year_id=${academicYearId}&section_id=${sectionId}`
          );
          const filtered = (enRes.data || []).filter(
            (en: any) => String(en.section_id) === sectionId
          );
          setEnrolledStudents(filtered);
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
  }, [sectionId, selectedDate, academicYearId]);

  const setStudentStatus = (studentId: number, status: AttendanceStatus) => {
    if (isLocked) return;
    setStatusMap((curr) => ({ ...curr, [studentId]: status }));
  };

  const presentCount = enrolledStudents.filter((e) => statusMap[e.student_id] === "present").length;
  const absentCount  = enrolledStudents.filter((e) => statusMap[e.student_id] === "absent").length;
  const leaveCount   = enrolledStudents.filter((e) => statusMap[e.student_id] === "leave").length;

  // marked_by = the coordinator_id of the selected section
  const markedBy = mySections?.find((s) => String(s.id) === sectionId)?.coordinator_id ?? null;
  const selectedSection = mySections?.find((s) => String(s.id) === sectionId);

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

    const students = enrolledStudents.map((en) => ({
      student_id:   en.student_id,
      enrollment_id: en.id ?? en.enrollment_id,
      status:        statusMap[en.student_id] || "present",
    }));

    try {
      if (existingRecord && existingRecord.status === "draft") {
        // Draft exists — patch each detail then submit so students can see it
        setSubmitting(true);
        const detRes = await apiRequest<{ data: any }>(`/attendance/${existingRecord.id}`);
        const details: any[] = detRes.data?.details ?? [];

        // Update each student detail whose status has changed
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

        // Flip draft → submitted so students can see it
        await apiRequest(`/attendance/${existingRecord.id}/submit`, { method: "PATCH" });

        dispatch(showToast({
          type: "success",
          title: "Attendance submitted",
          message: `${presentCount}P \u00b7 ${absentCount}A \u00b7 ${leaveCount}L \u2014 now visible to students.`,
        }));
      } else {
        // No existing record — create fresh (backend always marks as submitted)
        await createAttendance({
          academic_year_id: academicYearId,
          class_id:  selectedSection?.class_id,
          section_id: Number(sectionId),
          date:       selectedDate,
          marked_by:  markedBy,
          students,
        });
        dispatch(showToast({
          type: "success",
          title: "Attendance saved",
          message: `${presentCount}P \u00b7 ${absentCount}A \u00b7 ${leaveCount}L saved.`,
        }));
      }
      // Reload to reflect submitted state
      setSectionId((v) => { setTimeout(() => setSectionId(v), 10); return v; });
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not save attendance." }));
    } finally {
      setSubmitting(false);
    }
  };

  const rowClass = (studentId: number) => {
    const st = statusMap[studentId];
    if (st === "absent") return s("absentTableRow");
    if (st === "leave")  return s("leaveTableRow");
    return undefined;
  };

  // ── Empty state: teacher has no sections ──────────────────────────────────
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
            <h1>Mark Class Attendance</h1>
            <p>{enrolledStudents.length} students · {selectedSection?.class_name ?? ""} — Section {selectedSection?.name ?? ""}</p>
          </div>
          <div className={s("actions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/teacher/attendance">
              <i className="fa-solid fa-arrow-left" /> Overview
            </Link>
            {!isLocked && !existingRecord && (
              <button
                className={cx(s("btn"), s("btnPrimary"))}
                type="button"
                onClick={saveAttendance}
                disabled={saving || dataLoading || isLocked}
              >
                {saving ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" /> Save Attendance</>}
              </button>
            )}
          </div>
        </section>

        {/* ── Filters ── */}
        <section className={s("markHero")}>
          <label>
            <span>My Section</span>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={sectionsLoading}>
              {mySections?.map((sec: any) => (
                <option key={sec.id} value={sec.id}>
                  {sec.class_name} — Section {sec.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            {/* max=today prevents marking future attendance */}
            <input
              type="date"
              value={selectedDate}
              max={todayStr()}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>
          {/* Spacer columns so the grid stays consistent */}
          <div />
          <div />
        </section>

        {/* ── Edit-lock banner ── */}
        {isLocked && (
          <div style={{
            padding: "14px 18px",
            borderRadius: 12,
            background: "#fff8ee",
            border: "1px solid #fdd5b0",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 4,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff1df", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <i className="fa-solid fa-lock" style={{ color: "#c46a14", fontSize: 16 }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 900, color: "#92400e", margin: 0 }}>
                Attendance Submitted &amp; Locked
              </p>
              <p style={{ fontSize: 12, color: "#b45309", fontWeight: 700, margin: "3px 0 0" }}>
                This record was submitted on {fmtDate(existingRecord?.updated_at ?? existingRecord?.created_at ?? selectedDate)}.
                Contact your admin to make changes.
              </p>
            </div>
          </div>
        )}

        {/* ── Existing draft notice ── */}
        {existingRecord && !isLocked && (
          <div style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
            fontSize: 13,
            fontWeight: 700,
            color: "#1e40af",
          }}>
            <i className="fa-solid fa-circle-info" style={{ flexShrink: 0 }} />
            Draft attendance loaded from {fmtDate(existingRecord?.date ?? selectedDate)}. Review and save again to update.
          </div>
        )}

        {/* ── Student table ── */}
        <article className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h2>Student Attendance</h2>
              <p>
                {isLocked
                  ? "Read-only — submitted attendance cannot be edited here."
                  : "Tap P · A · L to set each student's status. Default is Present."}
              </p>
            </div>
          </div>

          <div className={s("attendanceTableWrap")}>
            {(sectionsLoading || dataLoading) ? (
              <div style={{ padding: "2rem", textAlign: "center" }}><Spinner size={32} /></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Admission No / ID</th>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map((en) => (
                    <tr className={rowClass(en.student_id)} key={en.student_id}>
                      <td><strong>{en.admission_number || `ID: ${en.student_id}`}</strong></td>
                      <td>{en.full_name}</td>
                      <td>
                        {isLocked ? (
                          // Read-only status chip
                          <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "5px 12px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 900,
                            background: statusBg[statusMap[en.student_id] ?? "present"],
                            color: statusColor[statusMap[en.student_id] ?? "present"],
                          }}>
                            {(statusMap[en.student_id] ?? "present").charAt(0).toUpperCase()}
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                              {statusMap[en.student_id] ?? "present"}
                            </span>
                          </div>
                        ) : (
                          // Editable P/A/L toggle
                          <div className={s("palToggle")}>
                            {PAL.map(({ key, label, activeClass }) => (
                              <button
                                key={key}
                                type="button"
                                className={cx(
                                  s("palBtn"),
                                  statusMap[en.student_id] === key && s(activeClass)
                                )}
                                onClick={() => setStudentStatus(en.student_id, key)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {enrolledStudents.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "#6a7882" }}>
                        No students found for this section.
                      </td>
                    </tr>
                  )}
                </tbody>
                {enrolledStudents.length > 0 && (
                  <tfoot>
                    <tr>
                      <td>Total: <strong>{enrolledStudents.length}</strong></td>
                      <td>
                        <span className={s("successText")}>P: {presentCount}</span>
                        {" · "}
                        <span className={s("dangerText")}>A: {absentCount}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={s("warningText")}>L: {leaveCount}</span>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>
        </article>

        {/* ── Save footer (only when not locked) ── */}
        {!isLocked && enrolledStudents.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
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
    </div>
  );
}
