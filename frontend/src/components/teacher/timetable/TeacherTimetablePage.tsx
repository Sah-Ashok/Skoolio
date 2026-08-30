"use client";

import { useState, useMemo, useEffect } from "react";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { apiRequest } from "@/lib/api";

const DAYS_OF_WEEK = [
  { key: "sunday",    label: "Sunday",    short: "Sun" },
  { key: "monday",    label: "Monday",    short: "Mon" },
  { key: "tuesday",   label: "Tuesday",   short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday",  label: "Thursday",  short: "Thu" },
  { key: "friday",    label: "Friday",    short: "Fri" },
  { key: "saturday",  label: "Saturday",  short: "Sat" },
];

const SUBJECT_COLORS = [
  { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
  { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" },
  { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" },
  { bg: "#fefce8", text: "#a16207", border: "#fef08a" },
  { bg: "#f8fafc", text: "#334155", border: "#cbd5e1" },
];

function getSubjectColor(id?: number | null) {
  if (!id) return SUBJECT_COLORS[7];
  return SUBJECT_COLORS[id % SUBJECT_COLORS.length];
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hStr, mStr] = (timeStr || "10:00").split(":");
  let h = parseInt(hStr, 10) || 0;
  let m = parseInt(mStr, 10) || 0;
  m += minutes;
  h += Math.floor(m / 60);
  m = m % 60;
  h = h % 24;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function TeacherTimetablePage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(s => s.auth);

  const [activeTab, setActiveTab] = useState<"section" | "my_schedule">("section");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [includeSaturday, setIncludeSaturday] = useState(false);

  // Active Year & Current User / Sections
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: me } = useApi<any>("/auth/me");
  const { data: teachers } = useApi<any[]>("/teachers");

  // Sections accessible to this teacher (or all sections if admin)
  const teacherSections = useMemo(() => {
    return me?.sections ?? [];
  }, [me]);

  // Set default selected section
  useEffect(() => {
    if (!selectedSectionId && teacherSections.length > 0) {
      setSelectedSectionId(String(teacherSections[0].id));
    }
  }, [teacherSections, selectedSectionId]);

  // Fetch Section Timetable
  const {
    data: timetableData,
    loading: loadingTimetable,
    refetch: refetchTimetable,
  } = useApi<any>(
    selectedSectionId && activeYear?.id
      ? `/timetable/section/${selectedSectionId}?academic_year_id=${activeYear.id}`
      : ""
  );

  // Fetch Teacher's Personal Weekly Schedule
  const {
    data: myScheduleData,
    loading: loadingMySchedule,
    refetch: refetchMySchedule,
  } = useApi<any>(
    activeYear?.id ? `/timetable/teacher/my-schedule?academic_year_id=${activeYear.id}` : ""
  );

  // Fetch Class Subjects for current section
  const currentSection = timetableData?.section || teacherSections.find((s: any) => String(s.id) === selectedSectionId);
  const classId = currentSection?.class_id;

  const { data: classSubjects } = useApi<any[]>(
    classId ? `/classes/${classId}/subjects` : ""
  );

  // Mutations
  const { execute: saveSlot, loading: savingSlot } = useMutation("/timetable/slot", "POST");
  const { execute: saveBulk, loading: savingBulk } = useMutation(
    selectedSectionId ? `/timetable/section/${selectedSectionId}/bulk` : "",
    "POST"
  );

  // Modals state
  const [modalSlot, setModalSlot] = useState<any | null>(null);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState("sunday");
  const [copyTargetDays, setCopyTargetDays] = useState<string[]>(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  // Shift Quick Setup Modal state
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState("10:00");
  const [shiftPeriodDuration, setShiftPeriodDuration] = useState(45);
  const [shiftTotalPeriods, setShiftTotalPeriods] = useState(7);
  const [shiftHasBreak, setShiftHasBreak] = useState(true);
  const [shiftBreakAfterPeriod, setShiftBreakAfterPeriod] = useState(4);
  const [shiftBreakDuration, setShiftBreakDuration] = useState(30);
  const [shiftBreakTitle, setShiftBreakTitle] = useState("Lunch Break");
  const [shiftTargetDays, setShiftTargetDays] = useState<string[]>(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday"]);

  const displayDays = useMemo(() => {
    return DAYS_OF_WEEK.filter(d => includeSaturday || d.key !== "saturday");
  }, [includeSaturday]);

  // Derive column timings from saved slots
  const periodTimings = useMemo(() => {
    const timings: Record<number, { start: string; end: string; isBreak?: boolean; title?: string }> = {};
    const slots = timetableData?.slots ?? [];
    for (const s of slots) {
      if (s.period_number && s.start_time && s.end_time && !timings[s.period_number]) {
        timings[s.period_number] = {
          start: s.start_time.slice(0, 5),
          end: s.end_time.slice(0, 5),
          isBreak: s.is_break,
          title: s.title,
        };
      }
    }
    return timings;
  }, [timetableData]);

  const maxPeriods = useMemo(() => {
    const slots = timetableData?.slots ?? [];
    if (slots.length === 0) return 7;
    const max = Math.max(...slots.map((s: any) => Number(s.period_number) || 1));
    return Math.max(max, 7);
  }, [timetableData]);

  const periodNumbers = useMemo(() => {
    return Array.from({ length: maxPeriods }, (_, i) => i + 1);
  }, [maxPeriods]);

  // Map slots for easy lookup: [day][period_number] -> slot
  const slotMatrix = useMemo(() => {
    const map: Record<string, Record<number, any>> = {};
    for (const d of DAYS_OF_WEEK) {
      map[d.key] = {};
    }
    const slots = timetableData?.slots ?? [];
    for (const s of slots) {
      const day = s.day_of_week?.toLowerCase();
      if (map[day]) {
        map[day][s.period_number] = s;
      }
    }
    return map;
  }, [timetableData]);

  // Map teacher's personal routine
  const myScheduleByDay = useMemo(() => {
    return myScheduleData?.schedule_by_day ?? {};
  }, [myScheduleData]);

  // Live conflict checker in Slot modal
  useEffect(() => {
    if (!modalSlot || modalSlot.is_break || !modalSlot.teacher_id || !modalSlot.start_time || !modalSlot.end_time || !activeYear?.id) {
      setConflictMessage(null);
      return;
    }

    const timer = setTimeout(() => {
      apiRequest<any>(
        `/timetable/check-conflict?teacher_id=${modalSlot.teacher_id}&day_of_week=${modalSlot.day_of_week}&start_time=${modalSlot.start_time}&end_time=${modalSlot.end_time}&academic_year_id=${activeYear.id}&exclude_section_id=${selectedSectionId}&exclude_slot_id=${modalSlot.id || ""}`
      )
        .then(res => {
          if (res?.data?.has_conflict) {
            setConflictMessage(res.data.message || "Teacher has a schedule conflict!");
          } else {
            setConflictMessage(null);
          }
        })
        .catch(() => setConflictMessage(null));
    }, 300);

    return () => clearTimeout(timer);
  }, [modalSlot, activeYear?.id, selectedSectionId]);

  const handleOpenAddSlot = (day: string, periodNumber: number) => {
    const existingTiming = periodTimings[periodNumber];
    const prevTiming = periodTimings[periodNumber - 1];

    let start = "10:00";
    let end = "10:45";

    if (existingTiming) {
      start = existingTiming.start;
      end = existingTiming.end;
    } else if (prevTiming) {
      start = prevTiming.end;
      end = addMinutesToTime(start, 45);
    }

    setModalSlot({
      section_id: Number(selectedSectionId),
      class_id: classId,
      academic_year_id: activeYear?.id,
      day_of_week: day,
      period_number: periodNumber,
      start_time: start,
      end_time: end,
      is_break: existingTiming ? Boolean(existingTiming.isBreak) : false,
      title: existingTiming?.title ?? "",
      subject_id: "",
      teacher_id: "",
      room_no: currentSection?.room_no ?? "",
    });
    setConflictMessage(null);
  };

  const handleOpenEditSlot = (slot: any) => {
    setModalSlot({
      id: slot.id,
      section_id: Number(selectedSectionId),
      class_id: slot.class_id || classId,
      academic_year_id: activeYear?.id,
      day_of_week: slot.day_of_week,
      period_number: slot.period_number,
      start_time: slot.start_time?.slice(0, 5) ?? "10:00",
      end_time: slot.end_time?.slice(0, 5) ?? "10:45",
      is_break: Boolean(slot.is_break),
      title: slot.title ?? "",
      subject_id: slot.subject_id ? String(slot.subject_id) : "",
      teacher_id: slot.teacher_id ? String(slot.teacher_id) : "",
      room_no: slot.room_no ?? currentSection?.room_no ?? "",
    });
    setConflictMessage(null);
  };

  const handleSubjectChange = (subjectIdStr: string) => {
    const subId = Number(subjectIdStr);
    const subObj = (classSubjects ?? []).find((s: any) => s.id === subId);
    setModalSlot((prev: any) => ({
      ...prev,
      subject_id: subjectIdStr,
      teacher_id: subObj?.teacher_id ? String(subObj.teacher_id) : prev.teacher_id,
    }));
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSlot) return;

    if (!modalSlot.is_break && !modalSlot.subject_id) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Please select a subject or mark as Break." }));
      return;
    }
    if (!modalSlot.start_time || !modalSlot.end_time) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Start time and End time are required." }));
      return;
    }

    try {
      const payload = {
        ...modalSlot,
        class_id: classId,
        section_id: Number(selectedSectionId),
        academic_year_id: activeYear?.id,
        period_number: Number(modalSlot.period_number),
        subject_id: modalSlot.is_break ? null : (Number(modalSlot.subject_id) || null),
        teacher_id: modalSlot.is_break ? null : (Number(modalSlot.teacher_id) || null),
      };

      await saveSlot(payload);
      dispatch(showToast({ type: "success", title: "Saved", message: "Period slot saved successfully." }));
      setModalSlot(null);
      refetchTimetable();
      refetchMySchedule();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err?.message || "Could not save slot." }));
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm("Are you sure you want to remove this period slot?")) return;
    try {
      await apiRequest(`/timetable/slot/${slotId}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Removed", message: "Period slot deleted." }));
      refetchTimetable();
      refetchMySchedule();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err?.message || "Could not delete slot." }));
    }
  };

  const handleCopySchedule = async () => {
    const sourceSlots = (timetableData?.slots ?? []).filter(
      (s: any) => s.day_of_week?.toLowerCase() === copySourceDay.toLowerCase()
    );

    if (sourceSlots.length === 0) {
      dispatch(showToast({ type: "error", title: "Empty Day", message: `No periods found on ${copySourceDay.toUpperCase()} to copy.` }));
      return;
    }

    if (copyTargetDays.length === 0) {
      dispatch(showToast({ type: "error", title: "Selection", message: "Please select at least one target day." }));
      return;
    }

    const targetDaysSet = new Set(copyTargetDays.map(d => d.toLowerCase()));
    const otherDaysSlots = (timetableData?.slots ?? []).filter(
      (s: any) => !targetDaysSet.has(s.day_of_week?.toLowerCase())
    );

    const newDuplicatedSlots: any[] = [];
    for (const targetDay of copyTargetDays) {
      for (const slot of sourceSlots) {
        newDuplicatedSlots.push({
          day_of_week: targetDay.toLowerCase(),
          period_number: slot.period_number,
          start_time: slot.start_time?.slice(0, 5),
          end_time: slot.end_time?.slice(0, 5),
          subject_id: slot.subject_id,
          teacher_id: slot.teacher_id,
          is_break: slot.is_break,
          title: slot.title,
          room_no: slot.room_no,
        });
      }
    }

    const allSlots = [...otherDaysSlots, ...newDuplicatedSlots];

    try {
      await saveBulk({
        class_id: classId,
        section_id: Number(selectedSectionId),
        academic_year_id: activeYear?.id,
        slots: allSlots,
      });
      dispatch(showToast({ type: "success", title: "Duplicated", message: `Schedule copied from ${copySourceDay} to ${copyTargetDays.length} days.` }));
      setCopyModalOpen(false);
      refetchTimetable();
      refetchMySchedule();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err?.message || "Could not copy schedule." }));
    }
  };

  const handleGenerateShift = async () => {
    if (!selectedSectionId || !classId) {
      dispatch(showToast({ type: "error", title: "Missing Section", message: "Please select a section first." }));
      return;
    }

    if (shiftTargetDays.length === 0) {
      dispatch(showToast({ type: "error", title: "Selection", message: "Please select at least one day." }));
      return;
    }

    const targetDaysSet = new Set(shiftTargetDays.map(d => d.toLowerCase()));
    const existingOtherDaysSlots = (timetableData?.slots ?? []).filter(
      (s: any) => !targetDaysSet.has(s.day_of_week?.toLowerCase())
    );

    const existingSlotMap = slotMatrix;

    const newSlots: any[] = [];
    for (const day of shiftTargetDays) {
      let currentTime = shiftStartTime;
      let periodCounter = 1;

      for (let i = 1; i <= shiftTotalPeriods; i++) {
        if (shiftHasBreak && i === shiftBreakAfterPeriod + 1) {
          const breakEndTime = addMinutesToTime(currentTime, shiftBreakDuration);
          newSlots.push({
            day_of_week: day.toLowerCase(),
            period_number: periodCounter,
            start_time: currentTime,
            end_time: breakEndTime,
            subject_id: null,
            teacher_id: null,
            is_break: true,
            title: shiftBreakTitle || "Lunch Break",
            room_no: null,
          });
          currentTime = breakEndTime;
          periodCounter++;
        }

        const endTime = addMinutesToTime(currentTime, shiftPeriodDuration);
        const prevSlot = existingSlotMap[day.toLowerCase()]?.[periodCounter];

        newSlots.push({
          day_of_week: day.toLowerCase(),
          period_number: periodCounter,
          start_time: currentTime,
          end_time: endTime,
          subject_id: prevSlot?.subject_id || null,
          teacher_id: prevSlot?.teacher_id || null,
          is_break: false,
          title: null,
          room_no: prevSlot?.room_no || currentSection?.room_no || null,
        });

        currentTime = endTime;
        periodCounter++;
      }
    }

    try {
      await saveBulk({
        class_id: classId,
        section_id: Number(selectedSectionId),
        academic_year_id: activeYear?.id,
        slots: [...existingOtherDaysSlots, ...newSlots],
      });
      dispatch(showToast({ type: "success", title: "Generated", message: `Routine timings generated for ${shiftTargetDays.length} days.` }));
      setShiftModalOpen(false);
      refetchTimetable();
      refetchMySchedule();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err?.message || "Could not generate routine timings." }));
    }
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1400, margin: "0 auto" }}>
      {/* ── Page Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#1f2d36", display: "flex", alignItems: "center", gap: 10 }}>
            <i className="fa-solid fa-calendar-days" style={{ color: "#3b5bdb" }} />
            Section Timetable
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6a7882", fontWeight: 700 }}>
            Create and organize weekly routine for class sections with period time slots and subject teachers.
          </p>
        </div>

        {/* Top Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {activeTab === "section" && selectedSectionId && (
            <>
              <button
                type="button"
                onClick={() => setShiftModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#3b5bdb",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(59,91,219,0.25)",
                }}
              >
                <i className="fa-solid fa-bolt" /> ⚡ Quick Shift Setup
              </button>

              <button
                type="button"
                onClick={() => setCopyModalOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #c6d0d7",
                  background: "#fff",
                  color: "#1f2d36",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <i className="fa-solid fa-copy" style={{ color: "#3b5bdb" }} /> Copy Day Schedule
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid #c6d0d7",
                  background: "#fff",
                  color: "#1f2d36",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <i className="fa-solid fa-print" style={{ color: "#12805c" }} /> Print Routine
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setActiveTab("section")}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "section" ? "#3b5bdb" : "#fff",
            color: activeTab === "section" ? "#fff" : "#4a5a65",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: activeTab === "section" ? "0 2px 8px rgba(59,91,219,0.25)" : "none",
            borderWidth: activeTab === "section" ? 0 : 1,
            borderStyle: "solid",
            borderColor: "#d4dde2",
          }}
        >
          <i className="fa-solid fa-table" /> Section Routine Maker
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("my_schedule")}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "my_schedule" ? "#3b5bdb" : "#fff",
            color: activeTab === "my_schedule" ? "#fff" : "#4a5a65",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: activeTab === "my_schedule" ? "0 2px 8px rgba(59,91,219,0.25)" : "none",
            borderWidth: activeTab === "my_schedule" ? 0 : 1,
            borderStyle: "solid",
            borderColor: "#d4dde2",
          }}
        >
          <i className="fa-solid fa-chalkboard-user" /> My Teaching Schedule
        </button>
      </div>

      {/* ── SECTION ROUTINE BUILDER TAB ── */}
      {activeTab === "section" && (
        <>
          {/* Controls bar */}
          <div style={{
            background: "#fff",
            padding: "14px 18px",
            borderRadius: 10,
            border: "1px solid #d4dde2",
            boxShadow: "0 2px 12px rgba(31,45,54,0.06)",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: "#1f2d36", display: "flex", alignItems: "center", gap: 6 }}>
                <i className="fa-solid fa-school" style={{ color: "#3b5bdb" }} /> Select Section:
              </label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                style={{
                  minHeight: 38,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "1.5px solid #c6d0d7",
                  background: "#fff",
                  color: "#1f2d36",
                  fontSize: 13,
                  fontWeight: 800,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {teacherSections.length === 0 && <option value="">No coordinated sections</option>}
                {teacherSections.map((sec: any) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.class_name ? `${sec.class_name} - ` : ""}Section {sec.name} {sec.room_no ? `(Room ${sec.room_no})` : ""}
                  </option>
                ))}
              </select>

              {currentSection && (
                <span style={{ fontSize: 12, color: "#6a7882", fontWeight: 700 }}>
                  <i className="fa-solid fa-circle-info" style={{ color: "#ff9b51", marginRight: 4 }} />
                  {currentSection.class_name ? `${currentSection.class_name} - Section ${currentSection.name}` : `Section ${currentSection.name}`}
                  {currentSection.room_no ? ` · Room ${currentSection.room_no}` : ""}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#6a7882", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={includeSaturday}
                  onChange={e => setIncludeSaturday(e.target.checked)}
                  style={{ accentColor: "#3b5bdb", cursor: "pointer" }}
                />
                Include Saturday
              </label>
            </div>
          </div>

          {/* ── Timetable Grid Table ── */}
          <div style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid #d4dde2",
            boxShadow: "0 2px 12px rgba(31,45,54,0.06)",
            overflowX: "auto",
          }}>
            {loadingTimetable ? (
              <div style={{ padding: "4rem", textAlign: "center" }}>
                <Spinner size={36} color="#FF9B51" />
              </div>
            ) : !selectedSectionId ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
                <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 28, color: "#f97316", marginBottom: 10 }} />
                <p style={{ fontWeight: 800, margin: 0 }}>No section selected. Please select a section above to view/edit timetable.</p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 13, fontWeight: 900, color: "#1e293b", width: 120 }}>
                      Day / Period
                    </th>
                    {periodNumbers.map(pNum => {
                      const timing = periodTimings[pNum];
                      return (
                        <th key={pNum} style={{ padding: "12px 10px", textAlign: "center", fontSize: 12, fontWeight: 800, color: "#475569", borderLeft: "1px solid #e2e8f0" }}>
                          <div style={{ fontWeight: 900, color: "#1e293b" }}>Period {pNum}</div>
                          {timing ? (
                            <div style={{ fontSize: 11, color: timing.isBreak ? "#c2410c" : "#64748b", fontWeight: 800, marginTop: 2 }}>
                              {timing.start} - {timing.end}
                              {timing.isBreak && <span style={{ marginLeft: 4 }}>🍜</span>}
                            </div>
                          ) : (
                            <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>
                              Custom Time
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {displayDays.map(day => (
                    <tr key={day.key} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      {/* Day Label Header */}
                      <td style={{
                        padding: "14px 16px",
                        fontWeight: 900,
                        fontSize: 13,
                        color: "#1e3a5f",
                        background: "#f8fafc",
                        borderRight: "2px solid #e2e8f0",
                        textTransform: "capitalize",
                      }}>
                        {day.label}
                      </td>

                      {/* Period Cells */}
                      {periodNumbers.map(pNum => {
                        const slot = slotMatrix[day.key]?.[pNum];
                        if (slot) {
                          const colors = getSubjectColor(slot.subject_id);
                          return (
                            <td key={pNum} style={{ padding: 6, verticalAlign: "top", borderLeft: "1px solid #e2e8f0" }}>
                              {slot.is_break ? (
                                <div style={{
                                  padding: "10px 8px",
                                  borderRadius: 8,
                                  background: "#fff7ed",
                                  border: "1.5px dashed #fdba74",
                                  textAlign: "center",
                                  position: "relative",
                                  minHeight: 82,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}>
                                  <span style={{ fontSize: 16 }}>🍜</span>
                                  <strong style={{ fontSize: 12, fontWeight: 900, color: "#c2410c", marginTop: 2 }}>
                                    {slot.title || "Break"}
                                  </strong>
                                  <span style={{ fontSize: 10.5, color: "#9a3412", fontWeight: 700, marginTop: 2 }}>
                                    {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                                  </span>

                                  {/* Hover Actions */}
                                  <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditSlot(slot)}
                                      title="Edit slot"
                                      style={{ background: "#ffedd5", border: "none", borderRadius: 4, width: 22, height: 22, cursor: "pointer", color: "#c2410c", fontSize: 10 }}
                                    >
                                      <i className="fa-solid fa-pen" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSlot(slot.id)}
                                      title="Remove slot"
                                      style={{ background: "#fee2e2", border: "none", borderRadius: 4, width: 22, height: 22, cursor: "pointer", color: "#dc2626", fontSize: 10 }}
                                    >
                                      <i className="fa-solid fa-trash" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  background: colors.bg,
                                  border: `1px solid ${colors.border}`,
                                  minHeight: 82,
                                  display: "flex",
                                  flexDirection: "column",
                                  justifyContent: "space-between",
                                }}>
                                  <div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                      <strong style={{ fontSize: 12.5, fontWeight: 900, color: colors.text, display: "block", lineHeight: "1.2" }}>
                                        {slot.subject_name || "Subject"}
                                      </strong>
                                      {slot.room_no && (
                                        <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "#fff", color: "#475569", fontWeight: 800, border: "1px solid #cbd5e1" }}>
                                          {slot.room_no}
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 11, color: "#475569", fontWeight: 700, display: "block", marginTop: 4 }}>
                                      <i className="fa-solid fa-user-tie" style={{ fontSize: 9.5, marginRight: 4, opacity: 0.7 }} />
                                      {slot.teacher_name || "Unassigned"}
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 4, borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}>
                                      {slot.start_time?.slice(0, 5)} - {slot.end_time?.slice(0, 5)}
                                    </span>
                                    <div style={{ display: "flex", gap: 3 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditSlot(slot)}
                                        title="Edit slot"
                                        style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, width: 20, height: 20, cursor: "pointer", color: "#3b5bdb", fontSize: 9.5 }}
                                      >
                                        <i className="fa-solid fa-pen" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSlot(slot.id)}
                                        title="Remove slot"
                                        style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 4, width: 20, height: 20, cursor: "pointer", color: "#dc2626", fontSize: 9.5 }}
                                      >
                                        <i className="fa-solid fa-trash" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        }

                        // Empty Slot
                        return (
                          <td key={pNum} style={{ padding: 6, verticalAlign: "middle", textAlign: "center", borderLeft: "1px solid #e2e8f0" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenAddSlot(day.key, pNum)}
                              style={{
                                width: "100%",
                                minHeight: 82,
                                border: "1.5px dashed #cbd5e1",
                                borderRadius: 8,
                                background: "#fafafa",
                                color: "#94a3b8",
                                cursor: "pointer",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 800,
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = "#3b5bdb";
                                e.currentTarget.style.color = "#3b5bdb";
                                e.currentTarget.style.background = "#eff6ff";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = "#cbd5e1";
                                e.currentTarget.style.color = "#94a3b8";
                                e.currentTarget.style.background = "#fafafa";
                              }}
                            >
                              <i className="fa-solid fa-plus" />
                              <span>Add Period</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── MY TEACHING SCHEDULE TAB ── */}
      {activeTab === "my_schedule" && (
        <div style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #d4dde2",
          boxShadow: "0 2px 12px rgba(31,45,54,0.06)",
          padding: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#1f2d36" }}>
                <i className="fa-solid fa-user-clock" style={{ color: "#3b5bdb", marginRight: 8 }} />
                My Weekly Teaching Routine
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6a7882", fontWeight: 700 }}>
                All assigned periods across different classes and sections.
              </p>
            </div>
            <span style={{ padding: "4px 12px", borderRadius: 99, background: "#e0e7ff", color: "#3730a3", fontSize: 12, fontWeight: 900 }}>
              {myScheduleData?.slots?.length ?? 0} periods / week
            </span>
          </div>

          {loadingMySchedule ? (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <Spinner size={32} color="#FF9B51" />
            </div>
          ) : (myScheduleData?.slots?.length ?? 0) === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882" }}>
              <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 32, color: "#cbd5e1", marginBottom: 8 }} />
              <p style={{ fontWeight: 800, margin: 0 }}>No classes assigned to you in the timetable yet.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {DAYS_OF_WEEK.map(d => {
                const daySlots = myScheduleByDay[d.key] ?? [];
                if (daySlots.length === 0) return null;
                return (
                  <div key={d.key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", background: "#f8fafc" }}>
                    <div style={{ padding: "10px 14px", background: "#1e3a5f", color: "#fff", fontWeight: 900, fontSize: 13, textTransform: "capitalize" }}>
                      <i className="fa-regular fa-calendar" style={{ marginRight: 6 }} />
                      {d.label} ({daySlots.length} class{daySlots.length !== 1 ? "es" : ""})
                    </div>
                    <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {daySlots.map((s: any) => (
                        <div key={s.id} style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: "#fff",
                          border: "1px solid #cbd5e1",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <strong style={{ fontSize: 13, fontWeight: 900, color: "#1e293b" }}>
                              {s.subject_name}
                            </strong>
                            <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#e0f2fe", color: "#0369a1", fontWeight: 800 }}>
                              Period {s.period_number}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                            <span>
                              <i className="fa-solid fa-school" style={{ marginRight: 4, color: "#3b5bdb" }} />
                              {s.class_name} - Sec {s.section_name}
                            </span>
                            {s.room_no && <span>Room {s.room_no}</span>}
                          </div>

                          <div style={{ marginTop: 6, paddingTop: 4, borderTop: "1px solid #f1f5f9", fontSize: 11, fontWeight: 800, color: "#64748b" }}>
                            <i className="fa-regular fa-clock" style={{ marginRight: 4 }} />
                            {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: QUICK SHIFT SETUP ── */}
      {shiftModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            width: "100%",
            maxWidth: 520,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#1f2d36" }}>
                <i className="fa-solid fa-bolt" style={{ color: "#3b5bdb", marginRight: 8 }} />
                ⚡ Setup Section Shift Timings
              </h3>
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "#64748b", margin: "0 0 16px", fontWeight: 700 }}>
              Quickly generate periods and timings tailored to your school&apos;s shift (Morning 7:00 AM, Day 10:00 AM, etc.).
            </p>

            {/* Shift Presets Buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => {
                  setShiftStartTime("07:00");
                  setShiftPeriodDuration(45);
                  setShiftTotalPeriods(6);
                  setShiftBreakAfterPeriod(3);
                }}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: shiftStartTime === "07:00" ? "2px solid #3b5bdb" : "1px solid #cbd5e1",
                  background: shiftStartTime === "07:00" ? "#eff6ff" : "#fff",
                  color: shiftStartTime === "07:00" ? "#1e40af" : "#475569",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                🌅 Morning Shift (7 AM)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShiftStartTime("10:00");
                  setShiftPeriodDuration(45);
                  setShiftTotalPeriods(7);
                  setShiftBreakAfterPeriod(4);
                }}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: shiftStartTime === "10:00" ? "2px solid #3b5bdb" : "1px solid #cbd5e1",
                  background: shiftStartTime === "10:00" ? "#eff6ff" : "#fff",
                  color: shiftStartTime === "10:00" ? "#1e40af" : "#475569",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ☀️ Day Shift (10 AM)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShiftStartTime("08:00");
                  setShiftPeriodDuration(45);
                  setShiftTotalPeriods(7);
                  setShiftBreakAfterPeriod(4);
                }}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: shiftStartTime === "08:00" ? "2px solid #3b5bdb" : "1px solid #cbd5e1",
                  background: shiftStartTime === "08:00" ? "#eff6ff" : "#fff",
                  color: shiftStartTime === "08:00" ? "#1e40af" : "#475569",
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                🏢 Early Shift (8 AM)
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                  First Period Starts At *
                </label>
                <input
                  type="time"
                  value={shiftStartTime}
                  onChange={e => setShiftStartTime(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                  Period Duration (mins) *
                </label>
                <input
                  type="number"
                  min={20}
                  max={90}
                  value={shiftPeriodDuration}
                  onChange={e => setShiftPeriodDuration(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                  Number of Teaching Periods *
                </label>
                <input
                  type="number"
                  min={3}
                  max={12}
                  value={shiftTotalPeriods}
                  onChange={e => setShiftTotalPeriods(Number(e.target.value))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={shiftHasBreak}
                    onChange={e => setShiftHasBreak(e.target.checked)}
                    style={{ accentColor: "#f97316" }}
                  />
                  <span>Include Lunch/Tiffin Break</span>
                </label>
                {shiftHasBreak && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      value={shiftBreakAfterPeriod}
                      onChange={e => setShiftBreakAfterPeriod(Number(e.target.value))}
                      style={{ flex: 1, padding: "8px 8px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 12, fontWeight: 800 }}
                    >
                      {Array.from({ length: shiftTotalPeriods - 1 }, (_, i) => i + 1).map(p => (
                        <option key={p} value={p}>After Period {p}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={10}
                      max={60}
                      value={shiftBreakDuration}
                      onChange={e => setShiftBreakDuration(Number(e.target.value))}
                      title="Break duration in minutes"
                      style={{ width: 65, padding: "8px 6px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 12, fontWeight: 800 }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Target Days */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
                Apply To Days:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {DAYS_OF_WEEK.map(d => {
                  const isChecked = shiftTargetDays.includes(d.key);
                  return (
                    <label
                      key={d.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: `1px solid ${isChecked ? "#3b5bdb" : "#e2e8f0"}`,
                        background: isChecked ? "#eff6ff" : "#fff",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 800,
                        color: isChecked ? "#1e40af" : "#475569",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setShiftTargetDays(prev => [...prev, d.key]);
                          } else {
                            setShiftTargetDays(prev => prev.filter(k => k !== d.key));
                          }
                        }}
                        style={{ accentColor: "#3b5bdb" }}
                      />
                      <span>{d.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setShiftModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateShift}
                disabled={savingBulk}
                style={{
                  padding: "8px 18px",
                  borderRadius: 7,
                  border: "none",
                  background: "#3b5bdb",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {savingBulk && <Spinner size={14} color="#fff" />}
                Generate Routine Grid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / EDIT PERIOD SLOT ── */}
      {modalSlot && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            width: "100%",
            maxWidth: 500,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#1f2d36" }}>
                {modalSlot.id ? "Edit Period Slot" : "Add Period Slot"}
              </h3>
              <button
                type="button"
                onClick={() => setModalSlot(null)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleSaveSlot}>
              {conflictMessage && (
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: 12.5,
                  fontWeight: 800,
                  marginBottom: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ flexShrink: 0 }} />
                  <span>{conflictMessage}</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                    Day of Week *
                  </label>
                  <select
                    value={modalSlot.day_of_week}
                    onChange={e => setModalSlot({ ...modalSlot, day_of_week: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d.key} value={d.key}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                    Period Number *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={modalSlot.period_number}
                    onChange={e => setModalSlot({ ...modalSlot, period_number: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={modalSlot.start_time}
                    onChange={e => setModalSlot({ ...modalSlot, start_time: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={modalSlot.end_time}
                    onChange={e => setModalSlot({ ...modalSlot, end_time: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#1e293b", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={modalSlot.is_break}
                    onChange={e => setModalSlot({ ...modalSlot, is_break: e.target.checked })}
                    style={{ accentColor: "#f97316", width: 16, height: 16, cursor: "pointer" }}
                  />
                  <span>Mark as Break / Tiffin / Recess</span>
                </label>
              </div>

              {modalSlot.is_break ? (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                    Break Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lunch Break, Morning Assembly"
                    value={modalSlot.title}
                    onChange={e => setModalSlot({ ...modalSlot, title: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                      Subject *
                    </label>
                    <select
                      value={modalSlot.subject_id}
                      onChange={e => handleSubjectChange(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                    >
                      <option value="">Select subject…</option>
                      {(classSubjects ?? []).map((sub: any) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} {sub.code ? `(${sub.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                        Teacher
                      </label>
                      <select
                        value={modalSlot.teacher_id}
                        onChange={e => setModalSlot({ ...modalSlot, teacher_id: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                      >
                        <option value="">Select teacher…</option>
                        {(teachers ?? []).map((t: any) => (
                          <option key={t.id} value={t.id}>{t.full_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                        Room No
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 101, Lab-1"
                        value={modalSlot.room_no}
                        onChange={e => setModalSlot({ ...modalSlot, room_no: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setModalSlot(null)}
                  style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSlot}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 7,
                    border: "none",
                    background: "#3b5bdb",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {savingSlot && <Spinner size={14} color="#fff" />}
                  {modalSlot.id ? "Update Slot" : "Add Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: COPY SCHEDULE ── */}
      {copyModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 16,
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            width: "100%",
            maxWidth: 460,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#1f2d36" }}>
                <i className="fa-solid fa-copy" style={{ color: "#3b5bdb", marginRight: 8 }} />
                Copy Day Schedule
              </h3>
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                style={{ background: "transparent", border: "none", fontSize: 18, cursor: "pointer", color: "#64748b" }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 4 }}>
                Copy Schedule From:
              </label>
              <select
                value={copySourceDay}
                onChange={e => setCopySourceDay(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontWeight: 800, fontSize: 13 }}
              >
                {DAYS_OF_WEEK.map(d => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
                Apply To Target Days:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {DAYS_OF_WEEK.filter(d => d.key !== copySourceDay).map(d => {
                  const isChecked = copyTargetDays.includes(d.key);
                  return (
                    <label
                      key={d.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: `1px solid ${isChecked ? "#3b5bdb" : "#e2e8f0"}`,
                        background: isChecked ? "#eff6ff" : "#fff",
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: isChecked ? "#1e40af" : "#475569",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => {
                          if (e.target.checked) {
                            setCopyTargetDays(prev => [...prev, d.key]);
                          } else {
                            setCopyTargetDays(prev => prev.filter(k => k !== d.key));
                          }
                        }}
                        style={{ accentColor: "#3b5bdb" }}
                      />
                      <span>{d.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
              <button
                type="button"
                onClick={() => setCopyModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCopySchedule}
                disabled={savingBulk}
                style={{
                  padding: "8px 18px",
                  borderRadius: 7,
                  border: "none",
                  background: "#3b5bdb",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {savingBulk && <Spinner size={14} color="#fff" />}
                Apply &amp; Save Routine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
