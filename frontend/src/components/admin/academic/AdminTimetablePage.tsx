"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { SkeletonTable } from "@/components/shared/Skeleton";
import { apiRequest } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = [
  { key: "sunday",    label: "Sunday",    abbr: "SUN" },
  { key: "monday",    label: "Monday",    abbr: "MON" },
  { key: "tuesday",   label: "Tuesday",   abbr: "TUE" },
  { key: "wednesday", label: "Wednesday", abbr: "WED" },
  { key: "thursday",  label: "Thursday",  abbr: "THU" },
  { key: "friday",    label: "Friday",    abbr: "FRI" },
  { key: "saturday",  label: "Saturday",  abbr: "SAT" },
];

// Distinct hues for subjects (index cycles)
const PALETTE = [
  { bg: "#fff7ed", fg: "#9A3412", accent: "#FF9B51" },
  { bg: "#ECFDF5", fg: "#065F46", accent: "#10B981" },
  { bg: "#FFF7ED", fg: "#9A3412", accent: "#F97316" },
  { bg: "#FDF4FF", fg: "#6B21A8", accent: "#A855F7" },
  { bg: "#F0F9FF", fg: "#0C4A6E", accent: "#0EA5E9" },
  { bg: "#FFF1F2", fg: "#9F1239", accent: "#F43F5E" },
  { bg: "#FEFCE8", fg: "#713F12", accent: "#EAB308" },
  { bg: "#F0FDF4", fg: "#14532D", accent: "#22C55E" },
];

const palette = (id?: number | null) => id ? PALETTE[id % PALETTE.length] : { bg: "#F8FAFC", fg: "#475569", accent: "#94A3B8" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMins(time: string, mins: number): string {
  const [h, m] = (time || "10:00").split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function fmtTime(t?: string) {
  return t ? t.slice(0, 5) : "—";
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BreakConfig {
  id: string;
  afterPeriod: number;
  duration: number;
  title: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: "rgba(15,23,42,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      {children}
    </div>
  );
}

function ModalCard({ children, maxW = 540 }: { children: React.ReactNode; maxW?: number }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: "16px",
      width: "100%",
      maxWidth: maxW,
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: "0 24px 64px rgba(15,23,42,0.18)",
    }}>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminTimetablePage() {
  const dispatch = useAppDispatch();

  // ── Filters ──
  const [classId, setClassId]     = useState("");
  const [sectionId, setSectionId] = useState("");
  const [withSat, setWithSat]     = useState(false);

  // ── Data fetching ──
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: classes }    = useApi<any[]>(activeYear?.id ? `/classes?academic_year_id=${activeYear.id}` : "/classes");
  const { data: sections }   = useApi<any[]>(classId ? `/classes/${classId}/sections` : "");
  const { data: subjects }   = useApi<any[]>(classId ? `/classes/${classId}/subjects` : "");
  const { data: teachers }   = useApi<any[]>("/teachers");

  const { data: ttData, loading: ttLoading, refetch: refetchTT } = useApi<any>(
    sectionId && activeYear?.id
      ? `/timetable/section/${sectionId}?academic_year_id=${activeYear.id}`
      : ""
  );

  // ── Default selections ──
  useEffect(() => { if (!classId && classes?.length)   setClassId(String(classes[0].id)); },   [classes]);
  useEffect(() => {
    if (sections?.length) {
      const ok = sections.some((s: any) => String(s.id) === sectionId);
      if (!ok) setSectionId(String(sections[0].id));
    } else setSectionId("");
  }, [sections]);

  // ── Mutations ──
  const { execute: saveSlot, loading: savingSlot } = useMutation("/timetable/slot", "POST");
  const { execute: saveBulk, loading: savingBulk } = useMutation(
    sectionId ? `/timetable/section/${sectionId}/bulk` : "", "POST"
  );

  // ── Derived data ──
  const currSection = useMemo(() => sections?.find((s: any) => String(s.id) === sectionId), [sections, sectionId]);
  const displayDays = useMemo(() => DAYS.filter(d => withSat || d.key !== "saturday"), [withSat]);

  const slots: any[] = useMemo(() => ttData?.slots ?? [], [ttData]);

  // period timing from first day that has that period saved
  const periodTimings = useMemo(() => {
    const map: Record<number, { start: string; end: string; isBreak?: boolean; title?: string }> = {};
    for (const s of slots) {
      if (s.period_number && s.start_time && !map[s.period_number]) {
        map[s.period_number] = {
          start: s.start_time.slice(0, 5),
          end:   s.end_time.slice(0, 5),
          isBreak: s.is_break,
          title: s.title,
        };
      }
    }
    return map;
  }, [slots]);

  const maxPeriods = useMemo(() => {
    if (!slots.length) return 0;
    return Math.max(...slots.map((s: any) => Number(s.period_number) || 1));
  }, [slots]);

  const periodNums = useMemo(() => Array.from({ length: maxPeriods }, (_, i) => i + 1), [maxPeriods]);

  const slotMap = useMemo(() => {
    const m: Record<string, Record<number, any>> = {};
    for (const d of DAYS) m[d.key] = {};
    for (const s of slots) {
      const day = s.day_of_week?.toLowerCase();
      if (m[day]) m[day][s.period_number] = s;
    }
    return m;
  }, [slots]);

  // ── Slot modal ──
  const [modal, setModal] = useState<any | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);

  // Conflict check
  useEffect(() => {
    if (!modal || modal.is_break || !modal.teacher_id || !modal.start_time || !modal.end_time || !activeYear?.id) {
      setConflict(null); return;
    }
    const t = setTimeout(() => {
      apiRequest<any>(
        `/timetable/check-conflict?teacher_id=${modal.teacher_id}&day_of_week=${modal.day_of_week}&start_time=${modal.start_time}&end_time=${modal.end_time}&academic_year_id=${activeYear.id}&exclude_section_id=${sectionId}&exclude_slot_id=${modal.id || ""}`
      ).then(r => setConflict(r?.data?.has_conflict ? r.data.message || "Teacher has a conflict!" : null))
        .catch(() => setConflict(null));
    }, 400);
    return () => clearTimeout(t);
  }, [modal, activeYear?.id, sectionId]);

  const openAdd = useCallback((day: string, pNum: number) => {
    const existing = periodTimings[pNum];
    const prev     = periodTimings[pNum - 1];
    const start    = existing ? existing.start : prev ? prev.end : "10:00";
    const end      = existing ? existing.end   : addMins(start, 45);
    setModal({
      section_id: Number(sectionId), class_id: Number(classId),
      academic_year_id: activeYear?.id,
      day_of_week: day, period_number: pNum,
      start_time: start, end_time: end,
      is_break: existing?.isBreak ?? false,
      title: existing?.title ?? "", subject_id: "", teacher_id: "",
      room_no: currSection?.room_no ?? "",
    });
    setConflict(null);
  }, [sectionId, classId, activeYear, periodTimings, currSection]);

  const openEdit = useCallback((slot: any) => {
    setModal({
      id: slot.id,
      section_id: Number(sectionId), class_id: slot.class_id || Number(classId),
      academic_year_id: activeYear?.id,
      day_of_week: slot.day_of_week, period_number: slot.period_number,
      start_time: slot.start_time?.slice(0, 5) ?? "10:00",
      end_time:   slot.end_time?.slice(0, 5)   ?? "10:45",
      is_break: Boolean(slot.is_break),
      title: slot.title ?? "",
      subject_id:  slot.subject_id  ? String(slot.subject_id)  : "",
      teacher_id:  slot.teacher_id  ? String(slot.teacher_id)  : "",
      room_no: slot.room_no ?? currSection?.room_no ?? "",
    });
    setConflict(null);
  }, [sectionId, classId, activeYear, currSection]);

  const handleSubjectChange = (subId: string) => {
    const sub = subjects?.find((s: any) => String(s.id) === subId);
    setModal((p: any) => ({ ...p, subject_id: subId, teacher_id: sub?.teacher_id ? String(sub.teacher_id) : p.teacher_id }));
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal) return;
    if (!modal.is_break && !modal.subject_id) {
      dispatch(showToast({ type: "error", title: "Required", message: "Select a subject or mark as break." })); return;
    }
    if (!modal.start_time || !modal.end_time) {
      dispatch(showToast({ type: "error", title: "Required", message: "Start and end time required." })); return;
    }
    try {
      await saveSlot({ ...modal, class_id: Number(classId), section_id: Number(sectionId), academic_year_id: activeYear?.id, period_number: Number(modal.period_number), subject_id: modal.is_break ? null : (Number(modal.subject_id) || null), teacher_id: modal.is_break ? null : (Number(modal.teacher_id) || null) });
      dispatch(showToast({ type: "success", title: "Saved", message: "Period slot saved." }));
      setModal(null); refetchTT();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err?.message || "Could not save slot." }));
    }
  };

  const deleteSlot = async (slotId: number) => {
    if (!confirm("Remove this period?")) return;
    try {
      await apiRequest(`/timetable/slot/${slotId}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Removed", message: "Slot removed." }));
      refetchTT();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err?.message || "Could not remove slot." }));
    }
  };

  // ── Delete Day & All Schedule ──
  const [confirmDeleteDay, setConfirmDeleteDay] = useState<any | null>(null);
  const [deletingDay, setDeletingDay]           = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll]           = useState(false);

  const handleDeleteDay = async () => {
    if (!confirmDeleteDay || !sectionId) return;
    setDeletingDay(true);
    try {
      await apiRequest(
        `/timetable/section/${sectionId}/day/${confirmDeleteDay.key}?academic_year_id=${activeYear?.id || ""}`,
        { method: "DELETE" }
      );
      dispatch(showToast({
        type: "success",
        title: "Schedule Cleared",
        message: `All periods for ${confirmDeleteDay.label} have been removed.`
      }));
      setConfirmDeleteDay(null);
      refetchTT();
    } catch (err: any) {
      dispatch(showToast({
        type: "error",
        title: "Error",
        message: err?.message || `Failed to clear ${confirmDeleteDay.label} schedule.`
      }));
    } finally {
      setDeletingDay(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!sectionId) return;
    setDeletingAll(true);
    try {
      await apiRequest(
        `/timetable/section/${sectionId}/all?academic_year_id=${activeYear?.id || ""}`,
        { method: "DELETE" }
      );
      dispatch(showToast({
        type: "success",
        title: "Timetable Cleared",
        message: "Entire timetable schedule has been cleared for this section."
      }));
      setConfirmDeleteAll(false);
      refetchTT();
    } catch (err: any) {
      dispatch(showToast({
        type: "error",
        title: "Error",
        message: err?.message || "Failed to clear timetable."
      }));
    } finally {
      setDeletingAll(false);
    }
  };

  // ── Copy modal ──
  const [copyOpen, setCopyOpen]   = useState(false);
  const [copySrc, setCopySrc]     = useState("sunday");
  const [copyDst, setCopyDst]     = useState<string[]>(["monday","tuesday","wednesday","thursday","friday"]);

  const handleCopy = async () => {
    const src = slots.filter((s: any) => s.day_of_week?.toLowerCase() === copySrc);
    if (!src.length) { dispatch(showToast({ type: "error", title: "Empty", message: `No periods on ${copySrc}.` })); return; }
    if (!copyDst.length) { dispatch(showToast({ type: "error", title: "Select", message: "Choose target days." })); return; }
    const dstSet = new Set(copyDst.map(d => d.toLowerCase()));
    const other  = slots.filter((s: any) => !dstSet.has(s.day_of_week?.toLowerCase()));
    const added: any[] = copyDst.flatMap(day => src.map(s => ({
      day_of_week: day, period_number: s.period_number,
      start_time: s.start_time?.slice(0,5), end_time: s.end_time?.slice(0,5),
      subject_id: s.subject_id, teacher_id: s.teacher_id,
      is_break: s.is_break, title: s.title, room_no: s.room_no,
    })));
    try {
      await saveBulk({ class_id: Number(classId), section_id: Number(sectionId), academic_year_id: activeYear?.id, slots: [...other, ...added] });
      dispatch(showToast({ type: "success", title: "Copied", message: `Routine duplicated to ${copyDst.length} day(s).` }));
      setCopyOpen(false); refetchTT();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err?.message || "Copy failed." }));
    }
  };

  // ── Quick Shift Setup modal ──
  const [shiftOpen,  setShiftOpen]  = useState(false);
  const [shiftStart, setShiftStart] = useState("10:00");
  const [shiftDur,   setShiftDur]   = useState(45);
  const [shiftCount, setShiftCount] = useState(7);
  const [breaks, setBreaks]         = useState<BreakConfig[]>([
    { id: "b1", afterPeriod: 4, duration: 30, title: "Lunch Break" },
  ]);
  const [shiftDays,  setShiftDays]  = useState<string[]>(["sunday","monday","tuesday","wednesday","thursday","friday"]);

  const addBreak = () => setBreaks(prev => [...prev, { id: `b${Date.now()}`, afterPeriod: 3, duration: 10, title: "Tiffin Break" }]);
  const removeBreak = (id: string) => setBreaks(prev => prev.filter(b => b.id !== id));
  const updateBreak = (id: string, field: keyof Omit<BreakConfig,"id">, val: any) =>
    setBreaks(prev => prev.map(b => b.id === id ? { ...b, [field]: val } : b));

  const handleGenerateShift = async () => {
    if (!sectionId || !classId) { dispatch(showToast({ type: "error", title: "Select Section", message: "Choose class and section first." })); return; }
    if (!shiftDays.length) { dispatch(showToast({ type: "error", title: "Select Days", message: "Choose at least one day." })); return; }

    const dstSet = new Set(shiftDays.map(d => d.toLowerCase()));
    const other  = slots.filter((s: any) => !dstSet.has(s.day_of_week?.toLowerCase()));

    // Sort breaks by afterPeriod so they insert in order
    const sortedBreaks = [...breaks].sort((a, b) => a.afterPeriod - b.afterPeriod);

    const newSlots: any[] = [];
    for (const day of shiftDays) {
      let currentTime = shiftStart;
      let slotIdx = 1; // slot index (includes breaks)
      let periodIdx = 1; // teaching period index

      while (periodIdx <= shiftCount) {
        // Insert any break that comes after this periodIdx - 1 (i.e., before periodIdx teaching period)
        for (const brk of sortedBreaks) {
          if (brk.afterPeriod === periodIdx - 1 && brk.afterPeriod > 0) {
            const breakEnd = addMins(currentTime, brk.duration);
            newSlots.push({
              day_of_week: day, period_number: slotIdx,
              start_time: currentTime, end_time: breakEnd,
              subject_id: null, teacher_id: null,
              is_break: true, title: brk.title, room_no: null,
            });
            currentTime = breakEnd;
            slotIdx++;
          }
        }

        const end = addMins(currentTime, shiftDur);
        const prev = slotMap[day]?.[slotIdx];
        newSlots.push({
          day_of_week: day, period_number: slotIdx,
          start_time: currentTime, end_time: end,
          subject_id: prev?.subject_id || null,
          teacher_id: prev?.teacher_id || null,
          is_break: false, title: null,
          room_no: prev?.room_no || currSection?.room_no || null,
        });

        currentTime = end;
        slotIdx++;
        periodIdx++;
      }
    }

    try {
      await saveBulk({ class_id: Number(classId), section_id: Number(sectionId), academic_year_id: activeYear?.id, slots: [...other, ...newSlots] });
      dispatch(showToast({ type: "success", title: "Generated", message: `Routine created for ${shiftDays.length} day(s).` }));
      setShiftOpen(false); refetchTT();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err?.message || "Generation failed." }));
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <i className="fa-solid fa-calendar-days" style={{ color: "#fff", fontSize: 16 }} />
              </div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>
                Academic Timetable
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B", fontWeight: 500 }}>
              Build and manage class section routines with flexible shift timings
            </p>
          </div>

          {sectionId && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn icon="fa-bolt" label="Quick Shift Setup" primary onClick={() => setShiftOpen(true)} />
              <Btn icon="fa-copy" label="Copy Day" onClick={() => setCopyOpen(true)} />
              <Btn
                icon="fa-trash-can"
                label="Clear All"
                danger
                disabled={slots.length === 0}
                onClick={() => setConfirmDeleteAll(true)}
              />
            </div>
          )}
        </div>

        {/* ── Filters Card ── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <FilterSelect label="Class" value={classId} onChange={setClassId}>
              {(classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </FilterSelect>

            <FilterSelect label="Section" value={sectionId} onChange={setSectionId}>
              {!(sections?.length) && <option value="">No sections</option>}
              {(sections ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.room_no ? ` · Room ${s.room_no}` : ""}
                </option>
              ))}
            </FilterSelect>

            {currSection && (
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#64748B", fontWeight: 600, padding: "5px 10px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <i className="fa-solid fa-users" style={{ color: "#FF9B51", fontSize: 11 }} />
                {currSection.capacity ? `Capacity: ${currSection.capacity}` : "Section"}
                {currSection.room_no && ` · Room ${currSection.room_no}`}
              </span>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#475569" }}>
            <input type="checkbox" checked={withSat} onChange={e => setWithSat(e.target.checked)} style={{ accentColor: "#FF9B51" }} />
            Saturday
          </label>
        </div>

        {/* ── Timetable Grid ── */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {ttLoading && !ttData ? (
            <SkeletonTable rows={6} columns={7} />
          ) : !sectionId ? (
            <EmptyState icon="fa-calendar-plus" title="No section selected" subtitle="Choose a class and section above to build the timetable." />
          ) : maxPeriods === 0 ? (
            <EmptyState
              icon="fa-bolt"
              title="No periods yet"
              subtitle="Click ⚡ Quick Shift Setup to generate the routine grid, or manually add periods."
            >
              <button
                onClick={() => setShiftOpen(true)}
                style={{ marginTop: 16, padding: "9px 20px", borderRadius: 8, border: "none", background: "#FF9B51", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                <i className="fa-solid fa-bolt" style={{ marginRight: 6 }} /> Quick Shift Setup
              </button>
            </EmptyState>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                {/* Header */}
                <thead>
                  <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", width: 96, background: "#FAFAFA" }}>
                      Day
                    </th>
                    {(() => {
                      // Count only non-break slots for the "P X" label
                      let teachIdx = 0;
                      const teachLabel: Record<number, number> = {};
                      for (const p of periodNums) {
                        if (!periodTimings[p]?.isBreak) { teachIdx++; teachLabel[p] = teachIdx; }
                      }
                      return periodNums.map(p => {
                        const t = periodTimings[p];
                        const isBreakCol = t?.isBreak;
                        return (
                          <th key={p} style={{ padding: "10px 8px", textAlign: "center", background: "#FAFAFA", borderLeft: "1px solid #F1F5F9", minWidth: 110 }}>
                            <div style={{ fontSize: 10, fontWeight: 800, color: isBreakCol ? "#F59E0B" : "#FF9B51", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {isBreakCol ? (t?.title || "Break") : `P ${teachLabel[p]}`}
                            </div>
                            {t && (
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginTop: 2 }}>
                                {t.start}–{t.end}
                              </div>
                            )}
                          </th>
                        );
                      });
                    })()}
                    <th style={{ width: 52, background: "#FAFAFA" }} />
                  </tr>
                </thead>

                {/* Body */}
                <tbody>
                  {displayDays.map((day, di) => (
                    <tr key={day.key} style={{ borderBottom: di < displayDays.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                      {/* Day label & Clear Day action */}
                      <td style={{ padding: "10px 14px", background: "#FAFAFA", borderRight: "2px solid #F1F5F9", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#334155", textTransform: "uppercase", letterSpacing: "0.08em" }}>{day.abbr}</span>
                            <div style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 500, marginTop: 1 }}>{day.label}</div>
                          </div>
                          {(() => {
                            const daySlots = Object.values(slotMap[day.key] || {});
                            if (daySlots.length === 0) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteDay(day)}
                                title={`Clear all periods for ${day.label}`}
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: 7,
                                  border: "1px solid #FECACA",
                                  background: "#FEF2F2",
                                  color: "#DC2626",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  transition: "all 0.15s ease",
                                  flexShrink: 0,
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = "#DC2626";
                                  e.currentTarget.style.color = "#fff";
                                  e.currentTarget.style.borderColor = "#DC2626";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = "#FEF2F2";
                                  e.currentTarget.style.color = "#DC2626";
                                  e.currentTarget.style.borderColor = "#FECACA";
                                }}
                              >
                                <i className="fa-solid fa-trash-can" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Period cells */}
                      {periodNums.map(p => {
                        const s = slotMap[day.key]?.[p];
                        if (s) {
                          return (
                            <td key={p} style={{ padding: "6px", verticalAlign: "top", borderLeft: "1px solid #F1F5F9" }}>
                              {s.is_break
                                ? <BreakCell slot={s} onEdit={() => openEdit(s)} onDelete={() => deleteSlot(s.id)} />
                                : <SubjectCell slot={s} onEdit={() => openEdit(s)} onDelete={() => deleteSlot(s.id)} />
                              }
                            </td>
                          );
                        }
                        return (
                          <td key={p} style={{ padding: "6px", borderLeft: "1px solid #F1F5F9" }}>
                            <AddCell onClick={() => openAdd(day.key, p)} />
                          </td>
                        );
                      })}

                      {/* Add extra period */}
                      <td style={{ padding: "6px 4px", textAlign: "center", verticalAlign: "middle" }}>
                        <button
                          onClick={() => openAdd(day.key, maxPeriods + 1)}
                          title="Add extra period"
                          style={{ width: 28, height: 28, borderRadius: 6, border: "1.5px dashed #CBD5E1", background: "transparent", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "#FF9B51"; e.currentTarget.style.color = "#FF9B51"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.color = "#CBD5E1"; }}
                        >
                          <i className="fa-solid fa-plus" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: QUICK SHIFT SETUP
      ══════════════════════════════════════════════════════════════════ */}
      {shiftOpen && (
        <ModalOverlay onClose={() => setShiftOpen(false)}>
          <ModalCard maxW={560}>
            {/* Header */}
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "#FF9B51", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className="fa-solid fa-bolt" style={{ color: "#fff", fontSize: 15 }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Quick Shift Setup</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>Configure school shift & auto-generate routine</p>
                </div>
              </div>
              <CloseBtn onClick={() => setShiftOpen(false)} />
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Preset buttons */}
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Quick Presets</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  { label: "🌅 Morning", sub: "7:00 AM start", start: "07:00" },
                  { label: "🏢 Early",   sub: "8:00 AM start", start: "08:00" },
                  { label: "☀️ Day",     sub: "10:00 AM start", start: "10:00" },
                ].map(p => (
                  <button
                    key={p.start}
                    type="button"
                    onClick={() => { setShiftStart(p.start); setShiftDur(45); setShiftCount(7); }}
                    style={{
                      padding: "10px 8px", borderRadius: 9, textAlign: "center", cursor: "pointer",
                      border: shiftStart === p.start ? "2px solid #6366F1" : "1.5px solid #E2E8F0",
                      background: shiftStart === p.start ? "#fff7ed" : "#FAFAFA",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: shiftStart === p.start ? "#c2680a" : "#334155" }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{p.sub}</div>
                  </button>
                ))}
              </div>

              {/* Timing settings */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <FormField label="Start Time">
                  <input type="time" value={shiftStart} onChange={e => setShiftStart(e.target.value)} style={inputStyle} />
                </FormField>
                <FormField label="Period Duration (min)">
                  <input type="number" min={20} max={90} value={shiftDur} onChange={e => setShiftDur(Number(e.target.value))} style={inputStyle} />
                </FormField>
                <FormField label="Teaching Periods">
                  <input type="number" min={1} max={12} value={shiftCount} onChange={e => setShiftCount(Number(e.target.value))} style={inputStyle} />
                </FormField>
              </div>

              {/* Breaks section */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Breaks / Recesses
                  </p>
                  <button type="button" onClick={addBreak} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 12, fontWeight: 700, color: "#FF9B51", cursor: "pointer" }}>
                    <i className="fa-solid fa-plus" /> Add Break
                  </button>
                </div>

                {breaks.length === 0 && (
                  <div style={{ padding: "12px 16px", borderRadius: 9, border: "1.5px dashed #E2E8F0", textAlign: "center", fontSize: 12.5, color: "#94A3B8", fontWeight: 600 }}>
                    No breaks added. Click "Add Break" to insert a lunch or tiffin break.
                  </div>
                )}

                {breaks.map((brk, i) => (
                  <div key={brk.id} style={{ background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#9A3412" }}>
                        <i className="fa-solid fa-mug-hot" style={{ marginRight: 6 }} />
                        Break {i + 1}
                      </span>
                      <button type="button" onClick={() => removeBreak(brk.id)} style={{ background: "#FEE2E2", border: "none", borderRadius: 5, width: 22, height: 22, color: "#DC2626", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <FormField label="After Period">
                        <select
                          value={brk.afterPeriod}
                          onChange={e => updateBreak(brk.id, "afterPeriod", Number(e.target.value))}
                          style={{ ...inputStyle, fontSize: 12 }}
                        >
                          {Array.from({ length: shiftCount }, (_, i) => i + 1).map(p => (
                            <option key={p} value={p}>After Period {p}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Duration (min)">
                        <input type="number" min={5} max={120} value={brk.duration} onChange={e => updateBreak(brk.id, "duration", Number(e.target.value))} style={inputStyle} />
                      </FormField>
                      <FormField label="Label">
                        <input type="text" value={brk.title} onChange={e => updateBreak(brk.id, "title", e.target.value)} placeholder="e.g. Lunch Break" style={inputStyle} />
                      </FormField>
                    </div>

                    <p style={{ margin: "8px 0 0", fontSize: 11, color: "#C2410C", fontWeight: 600 }}>
                      <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }} />
                      This break will appear as a separate period slot in the grid with its own time.
                    </p>
                  </div>
                ))}
              </div>

              {/* Days selection */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Apply To Days</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {DAYS.map(d => {
                    const on = shiftDays.includes(d.key);
                    return (
                      <label key={d.key} style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                        border: `1.5px solid ${on ? "#FF9B51" : "#E2E8F0"}`,
                        background: on ? "#fff7ed" : "#FAFAFA",
                        fontSize: 12, fontWeight: 700,
                        color: on ? "#c2680a" : "#64748B",
                        transition: "all 0.15s",
                      }}>
                        <input type="checkbox" checked={on} onChange={e => setShiftDays(prev => e.target.checked ? [...prev, d.key] : prev.filter(k => k !== d.key))} style={{ accentColor: "#FF9B51" }} />
                        {d.abbr}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Preview (simplified) */}
              {shiftStart && shiftDur && shiftCount > 0 && (
                <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 800, color: "#475569" }}>📅 Preview Timeline</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(() => {
                      const preview: { label: string; time: string; isBreak: boolean }[] = [];
                      const sortedB = [...breaks].sort((a, b) => a.afterPeriod - b.afterPeriod);
                      let cur = shiftStart;
                      let pIdx = 1;
                      let sIdx = 1;
                      while (pIdx <= shiftCount) {
                        for (const b of sortedB) {
                          if (b.afterPeriod === pIdx - 1 && pIdx > 1) {
                            const e = addMins(cur, b.duration);
                            preview.push({ label: b.title || "Break", time: `${cur}–${e}`, isBreak: true });
                            cur = e; sIdx++;
                          }
                        }
                        const e = addMins(cur, shiftDur);
                        preview.push({ label: `P${sIdx}`, time: `${cur}–${e}`, isBreak: false });
                        cur = e; sIdx++; pIdx++;
                      }
                      return preview;
                    })().map((item, i) => (
                      <span key={i} style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                        background: item.isBreak ? "#FFF7ED" : "#fff7ed",
                        color: item.isBreak ? "#9A3412" : "#c2680a",
                        border: `1px solid ${item.isBreak ? "#FED7AA" : "#fed7aa"}`,
                      }}>
                        {item.label} <span style={{ opacity: 0.7 }}>{item.time}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <GhostBtn label="Cancel" onClick={() => setShiftOpen(false)} />
                <PrimaryBtn label="Generate Routine" loading={savingBulk} onClick={handleGenerateShift} icon="fa-wand-magic-sparkles" />
              </div>
            </div>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT SLOT
      ══════════════════════════════════════════════════════════════════ */}
      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          <ModalCard maxW={500}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                {modal.id ? "Edit Period" : "Add Period"}
              </h3>
              <CloseBtn onClick={() => setModal(null)} />
            </div>

            <form onSubmit={handleSaveSlot} style={{ padding: "20px 24px" }}>
              {/* Conflict warning */}
              {conflict && (
                <div style={{ padding: "10px 14px", borderRadius: 9, background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", fontSize: 12.5, fontWeight: 700, marginBottom: 14, display: "flex", gap: 8 }}>
                  <i className="fa-solid fa-triangle-exclamation" style={{ flexShrink: 0, marginTop: 1 }} /> {conflict}
                </div>
              )}

              {/* Day & Period */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <FormField label="Day of Week *">
                  <select value={modal.day_of_week} onChange={e => setModal({ ...modal, day_of_week: e.target.value })} style={inputStyle}>
                    {DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Period Number *">
                  <input type="number" min={1} max={20} value={modal.period_number}
                    onChange={e => setModal({ ...modal, period_number: Number(e.target.value) })} style={inputStyle} />
                </FormField>
              </div>

              {/* Times */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <FormField label="Start Time *">
                  <input type="time" value={modal.start_time} onChange={e => setModal({ ...modal, start_time: e.target.value })} style={inputStyle} />
                </FormField>
                <FormField label="End Time *">
                  <input type="time" value={modal.end_time} onChange={e => setModal({ ...modal, end_time: e.target.value })} style={inputStyle} />
                </FormField>
              </div>

              {/* Break toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 14, padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${modal.is_break ? "#FED7AA" : "#E2E8F0"}`, background: modal.is_break ? "#FFF7ED" : "#FAFAFA" }}>
                <input type="checkbox" checked={modal.is_break} onChange={e => setModal({ ...modal, is_break: e.target.checked })} style={{ accentColor: "#F97316", width: 15, height: 15 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: modal.is_break ? "#9A3412" : "#475569" }}>
                  <i className="fa-solid fa-mug-hot" style={{ marginRight: 6, color: "#F97316" }} />
                  Mark as Break / Recess / Tiffin
                </span>
              </label>

              {/* Break title */}
              {modal.is_break ? (
                <FormField label="Break Label">
                  <input type="text" placeholder="e.g. Lunch Break, Morning Tiffin…" value={modal.title} onChange={e => setModal({ ...modal, title: e.target.value })} style={inputStyle} />
                </FormField>
              ) : (
                <>
                  <FormField label="Subject *">
                    <select value={modal.subject_id} onChange={e => handleSubjectChange(e.target.value)} style={inputStyle}>
                      <option value="">Select subject…</option>
                      {(subjects ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
                    </select>
                  </FormField>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                    <FormField label="Teacher">
                      <select value={modal.teacher_id} onChange={e => setModal({ ...modal, teacher_id: e.target.value })} style={inputStyle}>
                        <option value="">Select teacher…</option>
                        {(teachers ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Room No">
                      <input type="text" placeholder="e.g. 101, Lab-2" value={modal.room_no} onChange={e => setModal({ ...modal, room_no: e.target.value })} style={inputStyle} />
                    </FormField>
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid #F1F5F9" }}>
                <GhostBtn label="Cancel" onClick={() => setModal(null)} />
                <PrimaryBtn label={modal.id ? "Update" : "Add Slot"} loading={savingSlot} type="submit" icon="fa-floppy-disk" />
              </div>
            </form>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: COPY DAY SCHEDULE
      ══════════════════════════════════════════════════════════════════ */}
      {copyOpen && (
        <ModalOverlay onClose={() => setCopyOpen(false)}>
          <ModalCard maxW={420}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Copy Day Schedule</h3>
              <CloseBtn onClick={() => setCopyOpen(false)} />
            </div>
            <div style={{ padding: "20px 24px" }}>
              <FormField label="Copy From">
                <select value={copySrc} onChange={e => setCopySrc(e.target.value)} style={inputStyle}>
                  {DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </FormField>

              <p style={{ margin: "16px 0 8px", fontSize: 12, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>Apply To</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {DAYS.filter(d => d.key !== copySrc).map(d => {
                  const on = copyDst.includes(d.key);
                  return (
                    <label key={d.key} style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                      border: `1.5px solid ${on ? "#FF9B51" : "#E2E8F0"}`,
                      background: on ? "#fff7ed" : "#FAFAFA",
                      fontSize: 12.5, fontWeight: 700, color: on ? "#c2680a" : "#64748B",
                    }}>
                      <input type="checkbox" checked={on} onChange={e => setCopyDst(p => e.target.checked ? [...p, d.key] : p.filter(k => k !== d.key))} style={{ accentColor: "#FF9B51" }} />
                      {d.label}
                    </label>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                <GhostBtn label="Cancel" onClick={() => setCopyOpen(false)} />
                <PrimaryBtn label="Copy & Save" loading={savingBulk} onClick={handleCopy} icon="fa-copy" />
              </div>
            </div>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: CONFIRM CLEAR DAY SCHEDULE
      ══════════════════════════════════════════════════════════════════ */}
      {confirmDeleteDay && (
        <ModalOverlay onClose={() => !deletingDay && setConfirmDeleteDay(null)}>
          <ModalCard maxW={430}>
            <div style={{ padding: "24px 24px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", fontSize: 18, flexShrink: 0 }}>
                  <i className="fa-solid fa-trash-can" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0F172A" }}>
                    Clear {confirmDeleteDay.label} Schedule?
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                    {currSection ? `Class ${classes?.find((c: any) => String(c.id) === classId)?.name || ""} · Section ${currSection.name}` : "Selected Section"}
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 20px" }}>
                Are you sure you want to delete all scheduled periods and breaks for <strong>{confirmDeleteDay.label}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <GhostBtn label="Cancel" onClick={() => setConfirmDeleteDay(null)} />
                <button
                  type="button"
                  onClick={handleDeleteDay}
                  disabled={deletingDay}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 9,
                    border: "none",
                    background: "#DC2626",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: deletingDay ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
                  }}
                >
                  {deletingDay ? <Spinner size={14} color="#fff" /> : <i className="fa-solid fa-trash-can" />}
                  Yes, Clear Day
                </button>
              </div>
            </div>
          </ModalCard>
        </ModalOverlay>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: CONFIRM CLEAR ALL SCHEDULE
      ══════════════════════════════════════════════════════════════════ */}
      {confirmDeleteAll && (
        <ModalOverlay onClose={() => !deletingAll && setConfirmDeleteAll(false)}>
          <ModalCard maxW={450}>
            <div style={{ padding: "24px 24px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#FEF2F2", border: "1.5px solid #FECACA", display: "flex", alignItems: "center", justifyContent: "center", color: "#DC2626", fontSize: 20, flexShrink: 0 }}>
                  <i className="fa-solid fa-triangle-exclamation" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
                    Delete Entire Routine?
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                    {currSection ? `Class ${classes?.find((c: any) => String(c.id) === classId)?.name || ""} · Section ${currSection.name}` : "Selected Section"}
                  </p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.5, margin: "0 0 20px" }}>
                Are you sure you want to delete the <strong>entire weekly timetable</strong> ({slots.length} period{slots.length !== 1 ? "s" : ""}) for this section? All days and periods will be cleared.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <GhostBtn label="Cancel" onClick={() => setConfirmDeleteAll(false)} />
                <button
                  type="button"
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 9,
                    border: "none",
                    background: "#DC2626",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: deletingAll ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
                  }}
                >
                  {deletingAll ? <Spinner size={14} color="#fff" /> : <i className="fa-solid fa-trash-can" />}
                  Yes, Delete All
                </button>
              </div>
            </div>
          </ModalCard>
        </ModalOverlay>
      )}
    </div>
  );
}

// ─── Reusable micro-components ────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: "1.5px solid #E2E8F0", fontSize: 13, fontWeight: 600,
  color: "#1E293B", background: "#fff", outline: "none",
  boxSizing: "border-box",
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "#64748B", whiteSpace: "nowrap" }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, minWidth: 140, padding: "7px 10px" }}>
        {children}
      </select>
    </div>
  );
}

function Btn({ icon, label, primary, danger, disabled, onClick }: {
  icon: string; label: string; primary?: boolean; danger?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "8px 14px", borderRadius: 9,
        border: primary ? "none" : danger ? "1.5px solid #FECACA" : "1.5px solid #E2E8F0",
        background: primary ? "#FF9B51" : danger ? "#FEF2F2" : "#fff",
        color: primary ? "#fff" : danger ? "#DC2626" : "#334155",
        fontWeight: 700, fontSize: 12.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow: primary ? "0 2px 8px rgba(255,155,81,0.25)" : "none",
        transition: "opacity 0.15s, background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.88"; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = "1"; }}
    >
      <i className={`fa-solid ${icon}`} style={{ fontSize: 12 }} /> {label}
    </button>
  );
}

function PrimaryBtn({ label, loading, onClick, type = "button", icon }: { label: string; loading?: boolean; onClick?: () => void; type?: "button" | "submit"; icon?: string }) {
  return (
    <button type={type} onClick={onClick} disabled={loading} style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "9px 18px", borderRadius: 9, border: "none",
      background: "#FF9B51",
      color: "#fff", fontWeight: 700, fontSize: 13,
      cursor: loading ? "wait" : "pointer",
      boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
    }}>
      {loading ? <Spinner size={14} color="#fff" /> : icon ? <i className={`fa-solid ${icon}`} style={{ fontSize: 12 }} /> : null}
      {label}
    </button>
  );
}

function GhostBtn({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "9px 16px", borderRadius: 9, border: "1.5px solid #E2E8F0",
      background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer",
    }}>
      {label}
    </button>
  );
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", color: "#64748B", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <i className="fa-solid fa-xmark" />
    </button>
  );
}

function SubjectCell({ slot, onEdit, onDelete }: { slot: any; onEdit: () => void; onDelete: () => void }) {
  const c = palette(slot.subject_id);
  return (
    <div style={{ borderRadius: 8, background: c.bg, border: `1.5px solid ${c.accent}22`, padding: "8px 10px", minHeight: 86, display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: c.fg, lineHeight: 1.3, flex: 1 }}>
            {slot.subject_name || "Subject"}
          </span>
          {slot.room_no && (
            <span style={{ fontSize: 9.5, padding: "2px 5px", borderRadius: 4, background: "#fff", border: "1px solid #E2E8F0", color: "#64748B", fontWeight: 700, whiteSpace: "nowrap" }}>
              {slot.room_no}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 3, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
          <i className="fa-solid fa-user" style={{ fontSize: 9, opacity: 0.6 }} />
          {slot.teacher_name || "Unassigned"}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 5, borderTop: `1px solid ${c.accent}18` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8" }}>
          {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
        </span>
        <div style={{ display: "flex", gap: 3 }}>
          <IconBtn icon="fa-pen" color={c.fg} bg={c.bg} onClick={onEdit} />
          <IconBtn icon="fa-trash" color="#DC2626" bg="#FEF2F2" onClick={onDelete} />
        </div>
      </div>
    </div>
  );
}

function BreakCell({ slot, onEdit, onDelete }: { slot: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ borderRadius: 8, background: "#FFF7ED", border: "1.5px dashed #FED7AA", padding: "8px 10px", minHeight: 86, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 3 }}>
      <span style={{ fontSize: 18 }}>☕</span>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: "#9A3412" }}>{slot.title || "Break"}</span>
      <span style={{ fontSize: 10.5, color: "#C2410C", fontWeight: 600 }}>{fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}</span>
      <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
        <IconBtn icon="fa-pen" color="#9A3412" bg="#FFEDD5" onClick={onEdit} />
        <IconBtn icon="fa-trash" color="#DC2626" bg="#FEF2F2" onClick={onDelete} />
      </div>
    </div>
  );
}

function AddCell({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: "100%", minHeight: 86, borderRadius: 8, border: "1.5px dashed #E2E8F0", background: "#FAFAFA", color: "#CBD5E1", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 11, fontWeight: 700, transition: "all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#FF9B51"; e.currentTarget.style.color = "#FF9B51"; e.currentTarget.style.background = "#fff7ed"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#CBD5E1"; e.currentTarget.style.background = "#FAFAFA"; }}
    >
      <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
      Add
    </button>
  );
}

function IconBtn({ icon, color, bg, onClick }: { icon: string; color: string; bg: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: bg, color, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <i className={`fa-solid ${icon}`} />
    </button>
  );
}

function EmptyState({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children?: React.ReactNode }) {
  return (
    <div style={{ padding: "5rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 22, color: "#94A3B8" }} />
      </div>
      <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#334155" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, color: "#94A3B8", fontWeight: 500, maxWidth: 320 }}>{subtitle}</p>
      {children}
    </div>
  );
}
