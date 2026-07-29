"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import DateInput from "@/components/shared/DateInput";
import {
  CalendarDayStatusBanner,
  useCalendarDayStatus,
} from "@/components/shared/CalendarDayStatus";

const TODAY = new Date().toISOString().split("T")[0];

const getEditLockDate = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString().split("T")[0];
};

type AttendanceStatus = "present" | "absent" | "leave";

const STATUS_CONFIG: Record<AttendanceStatus, {
  label: string; short: string; bg: string; color: string; border: string; rowBg: string;
}> = {
  present: { label: "Present", short: "P",  bg: "#e2f6ee", color: "#12805c", border: "#12805c", rowBg: "#fff"    },
  absent:  { label: "Absent",  short: "A",  bg: "#fde7e7", color: "#b42318", border: "#b42318", rowBg: "#fff5f5" },
  leave:   { label: "Leave",   short: "Lv", bg: "#f3eeff", color: "#7c3aed", border: "#7c3aed", rowBg: "#faf7ff" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as AttendanceStatus[];

function PALToggle({
  value, onChange, disabled,
}: { value: AttendanceStatus | undefined; onChange: (v: AttendanceStatus) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {ALL_STATUSES.map((st) => {
        const c      = STATUS_CONFIG[st];
        const active = value === st;  // false when value is undefined — no button lit
        return (
          <button
            key={st}
            type="button"
            disabled={disabled}
            onClick={() => onChange(st)}
            style={{
              width: 34, height: 34, borderRadius: 7,
              cursor: disabled ? "not-allowed" : "pointer",
              border: `1.5px solid ${active ? c.border : "#d4dde2"}`,
              background: active ? c.bg : "#fff",
              color: active ? c.color : "#6a7882",
              fontWeight: 900, fontSize: 11,
              transition: "all 0.12s",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {c.short}
          </button>
        );
      })}
    </div>
  );
}

export default function TeacherMarkAttendancePage() {
  const dispatch = useAppDispatch();
  const editLock = getEditLockDate();
  const { formatDate } = useDateFormat();

  const { data: mySections, loading: sectionsLoading } = useApi<any[]>("/teachers/me/sections");
  const { data: activeYear } = useApi<any>("/academic-years/active");

  const [sectionId,   setSectionId]   = useState("");
  const [date,        setDate]        = useState(TODAY);
  const [students,    setStudents]    = useState<any[]>([]);
  const [statuses,    setStatuses]    = useState<Record<number, AttendanceStatus>>({});
  const [remarks,     setRemarks]     = useState<Record<number, string>>({});
  const [loading,     setLoading]     = useState(false);
  const [existingRec, setExistingRec] = useState<any | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false);
  // Edit mode: for submitted records, user must click Edit to enable changes
  const [editMode,    setEditMode]    = useState(false);

  // Quick-mark by roll number (real-time)
  const [quickRolls,  setQuickRolls]  = useState("");
  const [quickStatus, setQuickStatus] = useState<"present" | "absent">("absent");
  const quickRef = useRef<HTMLInputElement>(null);

  // Store pre-quick-mark statuses so clearing input restores them
  const baseStatusesRef = useRef<Record<number, AttendanceStatus>>({});

  useEffect(() => {
    if (mySections && mySections.length > 0 && !sectionId) {
      setSectionId(String(mySections[0].id));
    }
  }, [mySections]);

  // ── Calendar day status (holiday / weekly-off check via shared hook) ────
  const { isNonWorkingDay, holidayEvent, isWeeklyOff } =
    useCalendarDayStatus(date, activeYear?.id);

  const selectedSection = mySections?.find((s: any) => String(s.id) === sectionId);
  const isFutureDate    = date > TODAY;
  const isLockedDate    = date < editLock;
  const dateIsEditable  = !isFutureDate && !isLockedDate;
  const isSubmitted     = existingRec?.status === "submitted";
  // Readonly if date not editable, OR if submitted and user hasn't clicked Edit
  const readonly        = !dateIsEditable || (isSubmitted && !editMode);

  const loadData = useCallback(async () => {
    if (!sectionId || !activeYear?.id || !date) return;
    setLoading(true);
    setExistingRec(null);
    setStudents([]);
    setStatuses({});
    setRemarks({});
    setEditMode(false);
    setQuickRolls("");

    try {
      const sectionRecords = await apiRequest<{ data: any[] }>(
        `/attendance/section/${sectionId}?academic_year_id=${activeYear.id}`
      );
      const records  = sectionRecords.data ?? sectionRecords;
      const existing = Array.isArray(records)
        ? records.find((r: any) => r.date === date)
        : null;

      if (existing) {
        const detailRes = await apiRequest<{ data: any }>(`/attendance/${existing.id}`);
        const rec = detailRes.data ?? detailRes;
        setExistingRec(rec);

        const initStatuses: Record<number, AttendanceStatus> = {};
        const initRemarks:  Record<number, string>           = {};
        const studs = (rec.details ?? []).map((d: any) => ({
          id:            d.student_id,
          full_name:     d.full_name,
          roll_no:       d.roll_number ?? null,
          guardian_name: d.guardian_name ?? null,
          enrollment_id: d.enrollment_id,
          detail_id:     d.id,
        }));
        (rec.details ?? []).forEach((d: any) => {
          initStatuses[d.student_id] = (ALL_STATUSES.includes(d.status) ? d.status : "present") as AttendanceStatus;
          initRemarks[d.student_id]  = d.remarks ?? "";
        });
        studs.sort((a: any, b: any) => Number(a.roll_no ?? 9999) - Number(b.roll_no ?? 9999));
        setStudents(studs);
        setStatuses(initStatuses);
        baseStatusesRef.current = { ...initStatuses };
        setRemarks(initRemarks);
      } else {
        const enrollRes = await apiRequest<{ data: any[] }>(
          `/students/enrollments?section_id=${sectionId}&academic_year_id=${activeYear.id}`
        );
        const enrolled = enrollRes.data ?? enrollRes;
        const studs = (Array.isArray(enrolled) ? enrolled : []).map((en: any) => ({
          id:            en.student_id,
          full_name:     en.full_name,
          guardian_name: en.guardian_name ?? null,
          roll_no:       en.roll_number ?? null,
          enrollment_id: en.id,
        }));
        studs.sort((a: any, b: any) => Number(a.roll_no ?? 9999) - Number(b.roll_no ?? 9999));
        setStudents(studs);
        // New record: start with NO status pre-selected; teacher marks explicitly
        setStatuses({});
        baseStatusesRef.current = {};
      }
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to load attendance data." }));
    } finally {
      setLoading(false);
    }
  }, [sectionId, date, activeYear?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const setStudentStatus = (id: number, st: AttendanceStatus) => {
    if (readonly) return;
    setStatuses(p => {
      const next = { ...p, [id]: st };
      baseStatusesRef.current = { ...next };
      return next;
    });
  };

  // ── Real-time Quick Mark ────────────────────────────────────────────────────
  // Re-applies the current rolls+status whenever either changes
  const applyQuickToUI = useCallback((rolls: string[], status: AttendanceStatus) => {
    if (students.length === 0) return;
    setStatuses(() => {
      const base = { ...baseStatusesRef.current };
      if (rolls.length === 0) return base;   // empty input → restore base
      rolls.forEach(r => {
        const matched = students.find(
          s => s.roll_no != null && String(s.roll_no).trim() === r
        );
        if (matched) base[matched.id] = status;
      });
      return base;
    });
  }, [students]);

  const handleQuickRollsChange = (value: string) => {
    setQuickRolls(value);
    if (readonly) return;
    const rolls = value.split(",").map(r => r.trim()).filter(Boolean);
    applyQuickToUI(rolls, quickStatus);
  };

  const handleQuickStatusChange = (newStatus: "present" | "absent") => {
    setQuickStatus(newStatus);
    if (readonly) return;
    const rolls = quickRolls.split(",").map(r => r.trim()).filter(Boolean);
    applyQuickToUI(rolls, newStatus);
  };

  // ── Save (Apply / Update button) ────────────────────────────────────────────
  const applyQuickMark = async () => {
    if (readonly || submitting) return;
    if (!sectionId || !activeYear?.id) return;

    const rolls = quickRolls.split(",").map(r => r.trim()).filter(Boolean);

    // Build the full status map from current statuses state
    // (already updated in real-time by applyQuickToUI)
    const updatedStatuses: Record<string, AttendanceStatus> = {};
    students.forEach(s => {
      updatedStatuses[String(s.id)] = statuses[s.id] ?? "present";
    });

    const matched = rolls.filter(r =>
      students.some(s => s.roll_no != null && String(s.roll_no).trim() === r)
    ).length;

    if (matched === 0 && rolls.length > 0) {
      dispatch(showToast({ type: "warning", title: "No match", message: `No students with roll numbers: ${rolls.join(", ")}.` }));
      return;
    }

    setSubmitting(true);
    try {
      if (existingRec) {
        // PATCH each student's detail
        for (const student of students) {
          const newStatus = updatedStatuses[String(student.id)] ?? "present";
          const detail = (existingRec.details ?? []).find(
            (d: any) => String(d.student_id) === String(student.id)
          );
          if (!detail) continue;
          await apiRequest(`/attendance/details/${detail.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              attendance_id: existingRec.id,
              status: newStatus,
              remarks: remarks[student.id] || null,
            }),
          });
        }
        await apiRequest(`/attendance/${existingRec.id}/submit`, { method: "PATCH" });

        // Update existingRec in place — NO full reload, no loading spinner
        setExistingRec((prev: any) => ({
          ...prev,
          status: "submitted",
          details: (prev.details ?? []).map((d: any) => ({
            ...d,
            status: updatedStatuses[String(d.student_id)] ?? d.status,
          })),
        }));
        // Commit current statuses as the new base
        baseStatusesRef.current = { ...statuses };
        setQuickRolls("");
        setEditMode(false);
        dispatch(showToast({
          type: "success",
          title: "Updated",
          message: `Attendance updated — ${matched > 0 ? `${matched} roll(s) changed` : "all statuses saved"}.`,
        }));
      } else {
        // New record
        await apiRequest("/attendance", {
          method: "POST",
          body: JSON.stringify({
            academic_year_id: activeYear.id,
            class_id:         selectedSection?.class_id,
            section_id:       Number(sectionId),
            date,
            marked_by:        null,
            students: students.map(s => ({
              student_id:    s.id,
              enrollment_id: s.enrollment_id,
              status:        updatedStatuses[String(s.id)] ?? "present",
            })),
          }),
        });
        dispatch(showToast({ type: "success", title: "Saved", message: "Attendance saved successfully." }));
        // Only reload for new records (need to fetch the new record ID)
        await loadData();
      }
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save attendance." }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Save Attendance button (bottom, new records only) ──────────────────────
  const handleSave = async () => {
    if (!sectionId || !activeYear?.id || students.length === 0) return;
    if (isFutureDate) { dispatch(showToast({ type: "error", title: "Invalid Date",  message: "Cannot mark attendance for a future date." })); return; }
    if (isLockedDate) { dispatch(showToast({ type: "error", title: "Date Locked",   message: "This date is too old to edit." })); return; }

    setSubmitting(true);
    try {
      await apiRequest("/attendance", {
        method: "POST",
        body: JSON.stringify({
          academic_year_id: activeYear.id,
          class_id:         selectedSection?.class_id,
          section_id:       Number(sectionId),
          date,
          marked_by:        null,
          students: students.map(s => ({
            student_id:    s.id,
            enrollment_id: s.enrollment_id,
            status:        statuses[s.id] ?? "present",
          })),
        }),
      });
      dispatch(showToast({ type: "success", title: "Saved", message: "Attendance saved as draft." }));
      await loadData();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to save attendance." }));
    } finally {
      setSubmitting(false);
    }
  };

  const suspendClassForDay = async () => {
    if (!sectionId || !activeYear?.id || !selectedSection) return;
    setSubmitting(true);
    try {
      await apiRequest("/attendance", {
        method: "POST",
        body: JSON.stringify({
          academic_year_id: activeYear.id, class_id: selectedSection.class_id,
          section_id: Number(sectionId), date, marked_by: null,
          is_holiday: true, remarks: "Class suspended", students: [],
        }),
      });
      setShowSuspendConfirm(false);
      dispatch(showToast({ type: "success", title: "Class suspended", message: `${selectedSection.class_name} — Section ${selectedSection.name} is suspended for ${formatDate(date)}.` }));
      await loadData();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Could not suspend class", message: err.message || "Please try again." }));
    } finally { setSubmitting(false); }
  };

  const counts = {
    present: students.filter(s => statuses[s.id] === "present").length,
    absent:  students.filter(s => statuses[s.id] === "absent").length,
    leave:   students.filter(s => statuses[s.id] === "leave").length,
  };

  const isClassSuspended = Boolean(existingRec?.is_holiday);

  return (
    <div style={{ minHeight: "100vh", background: "#eef2f3" }}>
      <style>{`
        @media(max-width:640px){
          .mka-head { flex-direction:column !important; }
          .mka-controls { flex-direction:column !important; }
          .mka-controls label { flex:unset !important; width:100% !important; }
          .mka-qm-row { flex-direction:column !important; }
          .mka-qm-row input { width:100% !important; }
          .mka-bottom { flex-direction:column !important; }
          .mka-bottom > button { width:100% !important; justify-content:center !important; }
          .mka-table-wrap { overflow-x:auto; -webkit-overflow-scrolling:touch; }
          .mka-table-wrap table { min-width:500px; }
        }
      `}</style>

      <Topbar title="Mark Attendance" subtitle="Record daily attendance for your section" />

      <main style={{ padding: "24px 28px 48px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Page head ── */}
        <div className="mka-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Mark Attendance</h1>
            <p style={{ color: "#6a7882", fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              {selectedSection
                ? `Your section — ${selectedSection.class_name} · Section ${selectedSection.name} · ${formatDate(date)}`
                : "Only your assigned coordinator sections are shown."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => window.history.back()}
              style={{ minHeight: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
            >
              <i className="fa-solid fa-arrow-left" /> Back
            </button>
            {!readonly && !existingRec && (
              <button
                onClick={() => setShowSuspendConfirm(true)}
                style={{ minHeight: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #c4b5fd", background: "#f5f3ff", color: "#6d28d9", fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
              >
                <i className="fa-solid fa-ban" /> Suspend class
              </button>
            )}
          </div>
        </div>

        {/* ── Controls row ── */}
        <div
          className="mka-controls"
          style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", padding: "18px 20px", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}
        >
          {/* Section */}
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900, color: "#1f2d36", flex: "1 1 200px" }}>
            Section
            {sectionsLoading ? (
              <div style={{ height: 44, display: "flex", alignItems: "center" }}><Spinner size={18} color="#ff9b51" /></div>
            ) : (
              <select
                value={sectionId}
                onChange={e => setSectionId(e.target.value)}
                style={{ minHeight: 44, padding: "0 12px", border: "1px solid #c6d0d7", borderRadius: 8, fontSize: 14, fontWeight: 800, color: "#1f2d36", background: "#fff", outline: "none" }}
              >
                {(mySections ?? []).map((sec: any) => (
                  <option key={sec.id} value={sec.id}>{sec.class_name} — Section {sec.name}</option>
                ))}
              </select>
            )}
          </label>

          {/* Date + Edit button (replaces All Present / All Absent) */}
          <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 900, color: "#1f2d36", flex: "1 1 180px" }}>
            Date
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <DateInput
                value={date}
                onChange={e => setDate(e.target.value)}
                maxDate={TODAY}
                minDate={editLock}
                disabled={false}
                style={{ minHeight: 44, flex: 1 }}
              />
              {/* Edit button — shown when there's an existing submitted record */}
              {existingRec && dateIsEditable && (
                <button
                  type="button"
                  onClick={() => setEditMode(m => !m)}
                  title={editMode ? "Lock editing" : "Edit attendance"}
                  style={{
                    minHeight: 44, padding: "0 14px", borderRadius: 8, cursor: "pointer",
                    border: `1.5px solid ${editMode ? "#ff9b51" : "#d4dde2"}`,
                    background: editMode ? "#fff8f0" : "#fff",
                    color: editMode ? "#ff9b51" : "#6a7882",
                    fontWeight: 900, fontSize: 13,
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all .15s",
                  }}
                >
                  <i className={`fa-solid ${editMode ? "fa-lock-open" : "fa-pen"}`} />
                  {editMode ? "Editing" : "Edit"}
                </button>
              )}
            </div>
          </label>

          {/* Record status badge */}
          {existingRec && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", height: 44, borderRadius: 8, background: isSubmitted ? "#eff6ff" : "#fff1df", border: `1px solid ${isSubmitted ? "#bfdbfe" : "#ffd7a8"}` }}>
              <i className="fa-solid fa-pen-to-square" style={{ color: isSubmitted ? "#3b82f6" : "#c46a14", fontSize: 13 }} />
              <span style={{ fontSize: 13, fontWeight: 900, color: isSubmitted ? "#3b82f6" : "#c46a14" }}>
                {isSubmitted ? "Submitted · Editable" : "Draft"}
              </span>
            </div>
          )}

          {/* Suspend class for a day — shown when no existing record */}
          {!existingRec && !isClassSuspended && (
            <button
              type="button"
              onClick={() => setShowSuspendConfirm(true)}
              style={{ minHeight: 44, padding: "0 14px", border: "1.5px solid #c4b5fd", borderRadius: 8, background: "#f5f3ff", color: "#6d28d9", fontWeight: 900, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <i className="fa-solid fa-ban" /> Suspend class for a day
            </button>
          )}
        </div>

        {/* ── Banners ── */}
        {/* ── Holiday / Weekly-off banner (shared component, BS/AD aware dates) ── */}
        <CalendarDayStatusBanner adDate={date} academicYearId={activeYear?.id} />

        {isFutureDate && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fde7e7", border: "1px solid #fca5a5", color: "#b42318", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-triangle-exclamation" /> Cannot mark attendance for a future date.
          </div>
        )}
        {isLockedDate && !isFutureDate && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fde7e7", border: "1px solid #fca5a5", color: "#b42318", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-lock" /> This date is locked for editing.
          </div>
        )}
        {isSubmitted && !editMode && (
          <div style={{ padding: "12px 16px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-circle-info" /> This record was previously submitted. Click <strong style={{ margin: "0 4px" }}>Edit</strong> next to the date to make changes.
          </div>
        )}
        {isClassSuspended && (
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f5f3ff", border: "1px solid #c4b5fd", color: "#5b21b6", fontWeight: 700, fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
            <i className="fa-solid fa-ban" /> This class is suspended for the selected day.
          </div>
        )}

        {/* ── Student table (hidden on holidays / weekly-off) ── */}
        {!isNonWorkingDay && <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", overflow: "hidden", boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #e8eef0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>
              {selectedSection ? `${selectedSection.class_name} — Section ${selectedSection.name}` : "Students"}
            </h2>
            <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, marginTop: 3 }}>{formatDate(date)}</p>
          </div>

          {isClassSuspended ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#5b21b6" }}>
              <i className="fa-solid fa-ban" style={{ fontSize: 32, display: "block", marginBottom: 12 }} />
              <p style={{ fontWeight: 800, fontSize: 14 }}>Class suspended — no student attendance is recorded today.</p>
            </div>
          ) : loading ? (
            <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#ff9b51" /></div>
          ) : students.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
              <i className="fa-solid fa-users" style={{ fontSize: 32, display: "block", marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontWeight: 700, fontSize: 14 }}>No students found for this section.</p>
            </div>
          ) : (
            <div className="mka-table-wrap" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f7fafb" }}>
                    {["Roll no.", "Student", "Father / guardian", "Status", "Remarks"].map(h => (
                      <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontWeight: 900, fontSize: 11, color: "#6a7882", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const st  = statuses[student.id] as AttendanceStatus | undefined;
                    // Neutral row bg when no status chosen yet
                    const cfg = st ? STATUS_CONFIG[st] : null;
                    return (
                      <tr key={student.id} style={{ background: cfg ? cfg.rowBg : "#fff", borderBottom: "1px solid #f0f4f5", transition: "background .12s" }}>
                        <td style={{ padding: "14px 20px", fontWeight: 900, fontSize: 13, color: "#1f2d36" }}>{student.roll_no ?? "—"}</td>
                        <td style={{ padding: "14px 20px" }}>
                          <strong style={{ display: "block", fontWeight: 900 }}>{student.full_name}</strong>
                        </td>
                        <td style={{ padding: "14px 20px", color: "#51606a", fontWeight: 700 }}>{student.guardian_name ?? "—"}</td>
                        <td style={{ padding: "14px 20px" }}>
                          {readonly ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 900, background: cfg?.bg ?? "#f1f5f9", color: cfg?.color ?? "#6a7882" }}>
                              {cfg?.label ?? "—"}
                            </span>
                          ) : (
                            <PALToggle value={st} onChange={v => setStudentStatus(student.id, v)} />
                          )}
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          {readonly ? (
                            <span style={{ fontSize: 12, color: "#6a7882", fontWeight: 700 }}>{remarks[student.id] || "—"}</span>
                          ) : (
                            <input
                              type="text"
                              value={remarks[student.id] ?? ""}
                              onChange={e => setRemarks(p => ({ ...p, [student.id]: e.target.value }))}
                              placeholder="Optional remark…"
                              style={{ width: "100%", minHeight: 34, padding: "0 10px", border: "1px solid #d4dde2", borderRadius: 7, fontSize: 13, fontWeight: 700, color: "#1f2d36", outline: "none" }}
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
        </div>}

        {/* ── Quick mark by roll number ── */}
        {!isNonWorkingDay && !readonly && !isClassSuspended && students.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #d4dde2", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 2px 8px rgba(31,45,54,.05)" }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>
                <i className="fa-solid fa-bolt" style={{ color: "#ff9b51", marginRight: 7 }} />
                Quick Mark by Roll Number
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6a7882", fontWeight: 600 }}>
                Type roll numbers separated by commas — the table updates instantly. Click {existingRec ? "Update" : "Apply"} to save.
              </p>
            </div>
            <div className="mka-qm-row" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                ref={quickRef}
                value={quickRolls}
                onChange={e => handleQuickRollsChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && applyQuickMark()}
                placeholder="e.g. 3, 7, 12, 15"
                style={{ flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 9, border: "1px solid #d4dde2", fontSize: 13, fontWeight: 700, outline: "none" }}
              />
              {/* Status dropdown — Leave excluded */}
              <select
                value={quickStatus}
                onChange={e => handleQuickStatusChange(e.target.value as "present" | "absent")}
                style={{
                  padding: "8px 12px", borderRadius: 9,
                  border: `1.5px solid ${STATUS_CONFIG[quickStatus].border}`,
                  background: STATUS_CONFIG[quickStatus].bg,
                  color: STATUS_CONFIG[quickStatus].color,
                  fontWeight: 900, fontSize: 13, cursor: "pointer", outline: "none", minWidth: 130,
                }}
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
              </select>
              <button
                type="button"
                onClick={applyQuickMark}
                disabled={submitting}
                style={{
                  padding: "8px 20px", borderRadius: 9, border: "none", cursor: submitting ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 900,
                  background: "#ff9b51", color: "#fff",
                  display: "flex", alignItems: "center", gap: 6,
                  opacity: submitting ? 0.7 : 1,
                  transition: "all .15s",
                }}
              >
                {submitting ? <Spinner size={13} /> : <i className="fa-solid fa-bolt" />}
                {existingRec ? "Update" : "Apply"}
              </button>
            </div>
          </div>
        )}

        {/* ── Bottom: stat pills + Save button (new records only) ── */}
        {!isNonWorkingDay && !isClassSuspended && students.length > 0 && (
          <div className="mka-bottom" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Total",   val: students.length, color: "#1f2d36",                  bg: "#f8fafc", border: "#dce5e9" },
                { label: "Present", val: counts.present,  color: STATUS_CONFIG.present.color, bg: STATUS_CONFIG.present.bg, border: "#a7f3d0" },
                { label: "Absent",  val: counts.absent,   color: STATUS_CONFIG.absent.color,  bg: STATUS_CONFIG.absent.bg,  border: "#fca5a5" },
                { label: "Leave",   val: counts.leave,    color: STATUS_CONFIG.leave.color,   bg: STATUS_CONFIG.leave.bg,   border: "#ddd6fe" },
              ].map(c => (
                <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, background: c.bg, border: `1px solid ${c.border}` }}>
                  <strong style={{ fontSize: 15, fontWeight: 900, color: c.color }}>{c.val}</strong>
                  <span style={{ fontSize: 11, fontWeight: 700, color: c.color, opacity: 0.85 }}>{c.label}</span>
                </div>
              ))}
            </div>
            {/* Save Attendance — only for new (no existing) records */}
            {!existingRec && !readonly && (
              <button
                onClick={handleSave}
                disabled={submitting}
                style={{ minHeight: 42, padding: "0 22px", borderRadius: 9, border: "none", background: "#ff9b51", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                {submitting ? <Spinner size={14} /> : <i className="fa-solid fa-floppy-disk" />}
                Save Attendance
              </button>
            )}
          </div>
        )}

      </main>

      {/* ── Suspend confirm modal ── */}
      {showSuspendConfirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="suspend-title" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "min(460px,100%)", background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 24px 70px rgba(15,23,42,.3)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ede9fe", color: "#6d28d9", display: "grid", placeItems: "center", fontSize: 18, marginBottom: 14 }}>
              <i className="fa-solid fa-ban" />
            </div>
            <h2 id="suspend-title" style={{ margin: 0, color: "#1f2d36", fontSize: 18, fontWeight: 900 }}>Suspend this class for the day?</h2>
            <p style={{ margin: "9px 0 0", color: "#5f6f7b", fontSize: 13, fontWeight: 600, lineHeight: 1.55 }}>
              This marks {selectedSection?.class_name} — Section {selectedSection?.name} as suspended on {formatDate(date)}. No student attendance will be recorded.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button type="button" onClick={() => setShowSuspendConfirm(false)} disabled={submitting} style={{ minHeight: 38, padding: "0 16px", borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", fontWeight: 900, cursor: "pointer" }}>Cancel</button>
              <button type="button" onClick={suspendClassForDay} disabled={submitting} style={{ minHeight: 38, padding: "0 16px", borderRadius: 8, border: "none", background: "#6d28d9", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
                {submitting ? <Spinner size={14} /> : <><i className="fa-solid fa-ban" /> Yes, suspend class</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
