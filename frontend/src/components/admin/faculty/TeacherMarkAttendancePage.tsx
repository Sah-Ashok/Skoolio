"use client";

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const TODAY = new Date().toISOString().split("T")[0];

// Oldest editable date = 1st of previous month
const getEditLockDate = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split("T")[0];
};

const statusLabel: Record<string, string> = {
  present: "P",
  absent:  "A",
  late:    "L",
  leave:   "Lv",
};

const statusColor: Record<string, { bg: string; color: string; border: string }> = {
  present: { bg: "#e2f6ee", color: "#12805c", border: "#12805c" },
  absent:  { bg: "#fde7e7", color: "#b42318", border: "#b42318" },
  late:    { bg: "#fff1df", color: "#c46a14", border: "#c46a14" },
  leave:   { bg: "#e8edff", color: "#3b5bdb", border: "#3b5bdb" },
};

function PALToggle({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {(["present", "absent", "late", "leave"] as const).map((st) => {
        const active  = value === st;
        const c       = statusColor[st];
        return (
          <button
            key={st}
            type="button"
            disabled={disabled}
            onClick={() => onChange(st)}
            style={{
              width: 32, height: 32, borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer",
              border: `1.5px solid ${active ? c.border : "#d4dde2"}`,
              background: active ? c.bg : "#fff",
              color: active ? c.color : "#6a7882",
              fontWeight: 900, fontSize: 11, transition: "all 0.12s",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {statusLabel[st]}
          </button>
        );
      })}
    </div>
  );
}

export default function TeacherMarkAttendancePage() {
  const dispatch   = useAppDispatch();
  const editLock   = getEditLockDate();

  // My coordinator sections
  const { data: mySections, loading: sectionsLoading } = useApi<any[]>("/teachers/me/sections");

  const { data: activeYear } = useApi<any>("/academic-years/active");

  const [sectionId,  setSectionId]  = useState("");
  const [date,       setDate]       = useState(TODAY);
  const [students,   setStudents]   = useState<any[]>([]);
  const [statuses,   setStatuses]   = useState<Record<number, string>>({});
  const [remarks,    setRemarks]    = useState<Record<number, string>>({});
  const [loading,    setLoading]    = useState(false);
  const [existingRec, setExistingRec] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-select first section
  useEffect(() => {
    if (mySections && mySections.length > 0 && !sectionId) {
      setSectionId(String(mySections[0].id));
    }
  }, [mySections]);

  const selectedSection = mySections?.find((s) => String(s.id) === sectionId);

  // Date constraints
  const isFutureDate  = date > TODAY;
  const isLockedDate  = date < editLock;
  const dateIsEditable = !isFutureDate && !isLockedDate;

  // Load students + existing attendance when section/date changes
  const loadAttendanceData = useCallback(async () => {
    if (!sectionId || !activeYear?.id || !date) return;
    setLoading(true);
    setExistingRec(null);
    setStudents([]);
    setStatuses({});
    setRemarks({});

    try {
      // Load existing attendance for this section+date
      const sectionRecords = await apiRequest<{ data: any[] }>(
        `/attendance/section/${sectionId}?academic_year_id=${activeYear.id}`
      );
      const records = sectionRecords.data ?? sectionRecords;
      const existing = Array.isArray(records)
        ? records.find((r: any) => r.date === date)
        : null;

      if (existing) {
        // Load the details
        const detailRes = await apiRequest<{ data: any }>(
          `/attendance/${existing.id}`
        );
        const rec = detailRes.data ?? detailRes;
        setExistingRec(rec);

        const initStatuses: Record<number, string> = {};
        const initRemarks:  Record<number, string> = {};
        const studs = (rec.details ?? []).map((d: any) => ({
          id:               d.student_id,
          full_name:        d.full_name,
          admission_number: d.admission_number,
          detail_id:        d.id,
          enrollment_id:    d.enrollment_id,
        }));
        (rec.details ?? []).forEach((d: any) => {
          initStatuses[d.student_id] = d.status;
          initRemarks[d.student_id]  = d.remarks ?? "";
        });
        setStudents(studs);
        setStatuses(initStatuses);
        setRemarks(initRemarks);
      } else {
        // No existing record — load enrolled students for this section
        // Use /students/enrollments (accessible to faculty) not /students (admin-only)
        const enrollRes = await apiRequest<{ data: any[] }>(
          `/students/enrollments?section_id=${sectionId}&academic_year_id=${activeYear.id}`
        );
        const enrolled = enrollRes.data ?? enrollRes;
        const studs = (Array.isArray(enrolled) ? enrolled : []).map((en: any) => ({
          id:               en.student_id,   // enrollment row uses student_id, not id
          full_name:        en.full_name,
          admission_number: en.admission_number,
          enrollment_id:    en.id,           // the enrollment row id — needed for POST /attendance
        }));
        setStudents(studs);
        const initStatuses: Record<number, string> = {};
        studs.forEach((s: any) => { initStatuses[s.id] = "present"; });
        setStatuses(initStatuses);
      }
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to load attendance data." }));
    } finally {
      setLoading(false);
    }
  }, [sectionId, date, activeYear?.id]);

  useEffect(() => {
    loadAttendanceData();
  }, [loadAttendanceData]);

  const setStatus = (studentId: number, status: string) => {
    if (!dateIsEditable || existingRec?.status === "submitted") return;
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const setAllStatus = (status: string) => {
    if (!dateIsEditable || existingRec?.status === "submitted") return;
    const newStatuses: Record<number, string> = {};
    students.forEach((s) => { newStatuses[s.id] = status; });
    setStatuses(newStatuses);
  };

  const handleSave = async () => {
    if (!sectionId || !activeYear?.id || students.length === 0) return;
    if (isFutureDate) {
      dispatch(showToast({ type: "error", title: "Invalid Date", message: "Cannot mark attendance for a future date." }));
      return;
    }
    if (isLockedDate) {
      dispatch(showToast({ type: "error", title: "Date Locked", message: `Cannot edit attendance older than ${new Date(editLock).toLocaleDateString("en-US", { month: "long", year: "numeric" })} 1st.` }));
      return;
    }
    if (existingRec?.status === "submitted") {
      dispatch(showToast({ type: "error", title: "Submitted", message: "This attendance record is already submitted and cannot be edited." }));
      return;
    }

    setSubmitting(true);
    try {
      if (existingRec) {
        // Update existing details one by one
        for (const student of students) {
          const detail = existingRec.details?.find((d: any) => d.student_id === student.id);
          if (!detail) continue;
          await apiRequest(`/attendance/details/${detail.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              attendance_id: existingRec.id,
              status:        statuses[student.id] ?? "present",
              remarks:       remarks[student.id]  || null,
            }),
          });
        }
        dispatch(showToast({ type: "success", title: "Updated", message: "Attendance updated successfully." }));
      } else {
        // Create new attendance record
        const section = mySections?.find((s) => String(s.id) === sectionId);
        await apiRequest("/attendance", {
          method: "POST",
          body: JSON.stringify({
            academic_year_id: activeYear.id,
            class_id:         section?.class_id,
            section_id:       Number(sectionId),
            date,
            marked_by:        null, // backend fills from JWT
            students:         students.map((s) => ({
              student_id:    s.id,
              enrollment_id: s.enrollment_id ?? s.current_enrollment_id,
              status:        statuses[s.id] ?? "present",
            })),
          }),
        });
        dispatch(showToast({ type: "success", title: "Saved", message: "Attendance marked successfully." }));
      }
      loadAttendanceData();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save attendance." }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!existingRec) return;
    setSubmitting(true);
    try {
      await apiRequest(`/attendance/${existingRec.id}/submit`, { method: "PATCH" });
      dispatch(showToast({ type: "success", title: "Submitted", message: "Attendance submitted and locked." }));
      loadAttendanceData();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to submit attendance." }));
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitted = existingRec?.status === "submitted";
  const readonly    = isSubmitted || !dateIsEditable;

  const present = Object.values(statuses).filter((s) => s === "present").length;
  const absent  = Object.values(statuses).filter((s) => s === "absent").length;
  const late    = Object.values(statuses).filter((s) => s === "late").length;
  const leave   = Object.values(statuses).filter((s) => s === "leave").length;

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <Topbar title="Mark Attendance" subtitle="Record daily attendance for your section" />

      <main style={{ padding: "24px 28px 40px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Page head */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Mark Attendance</h1>
            <p style={{ color: "#6a7882", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              {selectedSection
                ? `Your section — ${selectedSection.name} · ${selectedSection.class_name} · ${new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`
                : "Only your assigned coordinator sections are shown."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => window.history.back()}
              style={{ minHeight: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
            >
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            {!readonly && students.length > 0 && (
              <button
                onClick={handleSave}
                disabled={submitting}
                style={{ minHeight: 38, padding: "0 16px", borderRadius: 8, border: "none", background: "#ff9b51", color: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
              >
                {submitting ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />}
                Save Attendance
              </button>
            )}
          </div>
        </div>

        {/* Controls card */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", padding: "18px 20px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", boxShadow: "0 2px 12px rgba(31,45,54,.06)" }}>
          {/* Section select */}
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900, color: "#1f2d36", flex: "1 1 200px" }}>
            Section
            {sectionsLoading ? (
              <div style={{ height: 44, display: "flex", alignItems: "center" }}><Spinner size={18} color="#ff9b51" /></div>
            ) : mySections && mySections.length === 0 ? (
              <div style={{ color: "#b42318", fontSize: 13, fontWeight: 700 }}>
                No sections assigned to you.
              </div>
            ) : (
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                style={{ minHeight: 44, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, color: "#1f2d36", background: "#fff", fontFamily: "inherit", outline: "none" }}
              >
                {(mySections ?? []).map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.class_name} — Section {sec.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Date picker — max = today */}
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900, color: "#1f2d36", flex: "1 1 180px" }}>
            Date
            <input
              type="date"
              value={date}
              max={TODAY}
              min={editLock}
              onChange={(e) => setDate(e.target.value)}
              style={{ minHeight: 44, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, color: "#1f2d36", background: "#fff", fontFamily: "inherit", outline: "none" }}
            />
          </label>

          {/* Status indicator */}
          {existingRec && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: 44, borderRadius: 8, background: isSubmitted ? "#e2f6ee" : "#fff1df", border: `1px solid ${isSubmitted ? "#bee8d6" : "#ffd7a8"}` }}>
              <i className={`fa-solid ${isSubmitted ? "fa-lock" : "fa-pen-to-square"}`} style={{ color: isSubmitted ? "#12805c" : "#c46a14", fontSize: 13 }} />
              <span style={{ fontSize: 13, fontWeight: 900, color: isSubmitted ? "#12805c" : "#c46a14" }}>
                {isSubmitted ? "Submitted" : "Draft"}
              </span>
            </div>
          )}

          {/* Bulk actions */}
          {!readonly && students.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["present", "absent", "late", "leave"] as const).map((st) => {
                const c = statusColor[st];
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAllStatus(st)}
                    style={{
                      minHeight: 44, padding: "0 14px",
                      border: `1.5px solid ${c.border}`, borderRadius: 8,
                      background: c.bg, color: c.color,
                      fontWeight: 900, fontSize: 12, cursor: "pointer",
                    }}
                  >
                    All {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Date warning banners */}
        {isFutureDate && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fde7e7", border: "1px solid #fca5a5", color: "#b42318", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-triangle-exclamation" />
            Cannot mark attendance for a future date.
          </div>
        )}
        {isLockedDate && !isFutureDate && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fde7e7", border: "1px solid #fca5a5", color: "#b42318", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-lock" />
            This date is locked. You can only edit attendance from {new Date(editLock).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} onwards.
          </div>
        )}
        {isSubmitted && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#e2f6ee", border: "1px solid #bee8d6", color: "#12805c", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-circle-check" />
            This attendance record is submitted and locked. No further edits are allowed.
          </div>
        )}

        {/* Summary strip */}
        {students.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {[
              { label: "Total",   value: students.length, color: "#1f2d36", bg: "#f8fafc" },
              { label: "Present", value: present,         color: "#12805c", bg: "#e2f6ee" },
              { label: "Absent",  value: absent,          color: "#b42318", bg: "#fde7e7" },
              { label: "Late",    value: late,            color: "#c46a14", bg: "#fff1df" },
              { label: "Leave",   value: leave,           color: "#3b5bdb", bg: "#e8edff" },
            ].map((c) => (
              <div key={c.label} style={{
                padding: "14px 16px", borderRadius: 10,
                background: c.bg, border: "1px solid rgba(191,201,209,0.5)",
                display: "flex", flexDirection: "column", gap: 4,
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#6a7882" }}>{c.label}</span>
                <strong style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Student list */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden", boxShadow: "0 2px 12px rgba(31,45,54,.06)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8eef0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
                {selectedSection ? `${selectedSection.class_name} — Section ${selectedSection.name}` : "Students"}
              </h2>
              <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, marginTop: 3 }}>
                {new Date(date).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            {!readonly && students.length > 0 && (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={submitting}
                  style={{
                    minHeight: 36, padding: "0 16px", borderRadius: 8, border: "none",
                    background: "#ff9b51", color: "#fff", fontWeight: 900, fontSize: 13,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                  }}
                >
                  {submitting ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />}
                  {existingRec ? "Update" : "Save Draft"}
                </button>
                {existingRec && !isSubmitted && (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      minHeight: 36, padding: "0 16px", borderRadius: 8, border: "none",
                      background: "#12805c", color: "#fff", fontWeight: 900, fontSize: 13,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                    }}
                  >
                    {submitting ? <Spinner size={14} /> : <i className="fa-solid fa-lock" />}
                    Submit & Lock
                  </button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <Spinner size={32} color="#ff9b51" />
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
              <i className="fa-solid fa-users" style={{ fontSize: 32, display: "block", marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontWeight: 700, fontSize: 14 }}>No students found for this section.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f7fafb" }}>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 900, fontSize: 11, color: "#6a7882", textTransform: "uppercase" }}>#</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 900, fontSize: 11, color: "#6a7882", textTransform: "uppercase" }}>Student</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 900, fontSize: 11, color: "#6a7882", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: 900, fontSize: 11, color: "#6a7882", textTransform: "uppercase" }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, idx) => {
                    const st = statuses[student.id] ?? "present";
                    const sc = statusColor[st];
                    return (
                      <tr
                        key={student.id}
                        style={{
                          background: st === "absent" ? "#fff5f5" : st === "late" ? "#fffbf0" : "#fff",
                          borderBottom: "1px solid #f0f4f5",
                        }}
                      >
                        <td style={{ padding: "14px 20px", color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 9, background: sc.bg,
                              color: sc.color, display: "flex", alignItems: "center",
                              justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0,
                            }}>
                              {student.full_name?.charAt(0) ?? "?"}
                            </div>
                            <div>
                              <strong style={{ display: "block", fontWeight: 900 }}>{student.full_name}</strong>
                              <span style={{ fontSize: 11, color: "#6a7882", fontWeight: 700 }}>
                                {student.admission_number ?? `ID #${student.id}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <PALToggle
                            value={st}
                            onChange={(v) => setStatus(student.id, v)}
                            disabled={readonly}
                          />
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          {readonly ? (
                            <span style={{ fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                              {remarks[student.id] || "—"}
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={remarks[student.id] ?? ""}
                              onChange={(e) => setRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))}
                              placeholder="Optional remark…"
                              style={{
                                width: "100%", minHeight: 34, padding: "0 10px",
                                border: "1px solid #d4dde2", borderRadius: 7, fontSize: 13,
                                fontWeight: 700, color: "#1f2d36", background: "#fff",
                                fontFamily: "inherit", outline: "none",
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom save bar */}
          {!readonly && students.length > 0 && (
            <div style={{ padding: "14px 20px", borderTop: "1px solid #e8eef0", display: "flex", gap: 10, justifyContent: "flex-end", background: "#fafcfc" }}>
              <button
                onClick={handleSave}
                disabled={submitting}
                style={{
                  minHeight: 38, padding: "0 20px", borderRadius: 8, border: "none",
                  background: "#ff9b51", color: "#fff", fontWeight: 900, fontSize: 13,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                }}
              >
                {submitting ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />}
                {existingRec ? "Update Attendance" : "Save Draft"}
              </button>
              {existingRec && !isSubmitted && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    minHeight: 38, padding: "0 20px", borderRadius: 8, border: "none",
                    background: "#12805c", color: "#fff", fontWeight: 900, fontSize: 13,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {submitting ? <Spinner size={14} /> : <i className="fa-solid fa-circle-check" />}
                  Submit & Lock
                </button>
              )}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
