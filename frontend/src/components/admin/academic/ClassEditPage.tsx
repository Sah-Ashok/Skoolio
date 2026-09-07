"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "@/components/admin/academic/academic.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const STREAMS      = ["Not Applicable", "Commerce", "Science - PCM", "Science - PCB", "Arts", "General", "Vocational"];
const SUBJ_COLORS  = ["#fff3e8","#dbeafe","#ccfbf1","#f3e8ff","#dcfce7","#fef9c3"];
const SUBJ_TCOLORS = ["#b45309","#1d4ed8","#0f766e","#7e22ce","#15803d","#854d0e"];

const thStyle: React.CSSProperties = {
  padding: "9px 12px", textAlign: "left", fontSize: 11,
  fontWeight: 800, color: "#6b7b86", textTransform: "uppercase", letterSpacing: "0.4px",
};
const tdStyle: React.CSSProperties = { padding: "10px 12px", verticalAlign: "middle" };

// ─────────────────────────────────────────────────────────────────────────────
export default function ClassEditPage() {
  const { id }   = useParams<{ id: string }>();
  const dispatch = useAppDispatch();

  const { data: cls,         loading, refetch } = useApi<any>(id ? `/classes/${id}` : "");
  const { data: allSubjects                   } = useApi<any[]>("/classes/subjects");
  const { data: teachers                      } = useApi<any[]>("/teachers");
  const { data: activeYear                    } = useApi<any>("/academic-years/active");

  // ── Panel 1 state ─────────────────────────────────────────────────────────
  const [info,       setInfo]       = useState({ name: "", stream: "Not Applicable", status: "active", description: "" });
  const [savingInfo, setSavingInfo] = useState(false);

  // ── Panel 2 state ─────────────────────────────────────────────────────────
  const [assignedSubjects,  setAssignedSubjects]  = useState<any[]>([]);
  const [subjectToAdd,      setSubjectToAdd]      = useState("");
  const [addingSubject,     setAddingSubject]     = useState(false);
  const [removingSubjectId, setRemovingSubjectId] = useState<number | null>(null);
  const [subjectTeacherMap, setSubjectTeacherMap] = useState<Record<number, number>>({});
  const [savingTeacher,     setSavingTeacher]     = useState<number | null>(null);

  // ── Panel 3 state ─────────────────────────────────────────────────────────
  const [showAddSection,    setShowAddSection]    = useState(false);
  const [newSection,        setNewSection]        = useState({ name: "", capacity: "", room_no: "" });
  const [addingSection,     setAddingSection]     = useState(false);
  const [editSectionId,     setEditSectionId]     = useState<number | null>(null);
  const [editSectionForm,   setEditSectionForm]   = useState({ name: "", capacity: "", room_no: "", status: "active" });
  const [savingSection,     setSavingSection]     = useState(false);
  const [confirmSectionId,  setConfirmSectionId]  = useState<number | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<number | null>(null);

  // ── Hydrate ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cls) return;
    setInfo({
      name:        cls.name        ?? "",
      stream:      cls.stream      ?? "Not Applicable",
      status:      cls.status      ?? "active",
      description: cls.description ?? "",
    });
    setAssignedSubjects(cls.subjects ?? []);
  }, [cls]);

  useEffect(() => {
    if (!cls?.subjects) return;
    const map: Record<number, number> = {};
    cls.subjects.forEach((sub: any) => { if (sub.teacher_id) map[sub.id] = sub.teacher_id; });
    setSubjectTeacherMap(map);
  }, [cls?.subjects]);

  const availableSubjects = (allSubjects ?? []).filter(
    (sub) => !assignedSubjects.some((a) => a.id === sub.id)
  );

  // ── Panel 1: save ─────────────────────────────────────────────────────────
  const handleSaveInfo = async () => {
    if (!info.name.trim()) {
      dispatch(showToast({ type: "error", title: "Required", message: "Class name cannot be empty." }));
      return;
    }
    setSavingInfo(true);
    try {
      await apiRequest(`/classes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name:        info.name.trim(),
          stream:      info.stream !== "Not Applicable" ? info.stream : null,
          status:      info.status,
          description: info.description.trim() || null,
        }),
      });
      dispatch(showToast({ type: "success", title: "Saved", message: "Class updated." }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not save." }));
    } finally {
      setSavingInfo(false);
    }
  };

  // ── Panel 2: teacher assign / remove ──────────────────────────────────────
  const handleAssignTeacher = async (subjectId: number, teacherId: number) => {
    if (!activeYear?.id) return;
    setSavingTeacher(subjectId);
    try {
      await apiRequest("/classes/assign-subject-teacher", {
        method: "POST",
        body: JSON.stringify({ class_id: Number(id), subject_id: subjectId, teacher_id: teacherId, academic_year_id: activeYear.id }),
      });
      setSubjectTeacherMap(prev => ({ ...prev, [subjectId]: teacherId }));
      dispatch(showToast({ type: "success", title: "Teacher Assigned", message: "Teacher saved." }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not assign." }));
    } finally {
      setSavingTeacher(null);
    }
  };

  const handleRemoveTeacher = async (subjectId: number) => {
    if (!activeYear?.id) return;
    setSavingTeacher(subjectId);
    try {
      await apiRequest("/classes/remove-subject-teacher", {
        method: "DELETE",
        body: JSON.stringify({ class_id: Number(id), subject_id: subjectId, academic_year_id: activeYear.id }),
      });
      setSubjectTeacherMap(prev => { const n = { ...prev }; delete n[subjectId]; return n; });
      dispatch(showToast({ type: "success", title: "Removed", message: "Teacher unassigned." }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not remove." }));
    } finally {
      setSavingTeacher(null);
    }
  };

  // ── Panel 2: subject add / remove ─────────────────────────────────────────
  const handleAddSubject = async () => {
    if (!subjectToAdd) return;
    setAddingSubject(true);
    try {
      await apiRequest("/classes/assign-subject", {
        method: "POST",
        body: JSON.stringify({ class_id: Number(id), subject_id: Number(subjectToAdd) }),
      });
      const sub = allSubjects?.find((s) => s.id === Number(subjectToAdd));
      if (sub) setAssignedSubjects(prev => [...prev, sub]);
      setSubjectToAdd("");
      dispatch(showToast({ type: "success", title: "Subject Added", message: `"${sub?.name}" assigned.` }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not assign subject." }));
    } finally {
      setAddingSubject(false);
    }
  };

  const handleRemoveSubject = async (subjectId: number, name: string) => {
    setRemovingSubjectId(subjectId);
    try {
      await apiRequest("/classes/remove-subject", {
        method: "DELETE",
        body: JSON.stringify({ class_id: Number(id), subject_id: subjectId }),
      });
      setAssignedSubjects(prev => prev.filter((s) => s.id !== subjectId));
      dispatch(showToast({ type: "success", title: "Removed", message: `"${name}" removed.` }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not remove." }));
    } finally {
      setRemovingSubjectId(null);
    }
  };

  // ── Panel 3: section add ──────────────────────────────────────────────────
  const handleAddSection = async () => {
    if (!newSection.name.trim()) {
      dispatch(showToast({ type: "error", title: "Required", message: "Section name is required." }));
      return;
    }
    setAddingSection(true);
    try {
      await apiRequest(`/classes/${id}/sections`, {
        method: "POST",
        body: JSON.stringify({
          name:     newSection.name.trim(),
          capacity: newSection.capacity ? Number(newSection.capacity) : undefined,
          room_no:  newSection.room_no.trim() || undefined,
        }),
      });
      dispatch(showToast({ type: "success", title: "Section Added", message: `Section "${newSection.name}" created.` }));
      setNewSection({ name: "", capacity: "", room_no: "" });
      setShowAddSection(false);
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not add section." }));
    } finally {
      setAddingSection(false);
    }
  };

  // ── Panel 3: section edit / save ──────────────────────────────────────────
  const startEditSection = (sec: any) => {
    setEditSectionId(sec.id);
    setEditSectionForm({ name: sec.name, capacity: String(sec.capacity ?? ""), room_no: sec.room_no ?? "", status: sec.status ?? "active" });
    setConfirmSectionId(null);
  };

  const handleSaveSection = async (sectionId: number) => {
    if (!editSectionForm.name.trim()) return;
    setSavingSection(true);
    try {
      await apiRequest(`/classes/sections/${sectionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name:     editSectionForm.name.trim(),
          capacity: editSectionForm.capacity ? Number(editSectionForm.capacity) : undefined,
          room_no:  editSectionForm.room_no.trim() || undefined,
          status:   editSectionForm.status,
        }),
      });
      dispatch(showToast({ type: "success", title: "Saved", message: "Section updated." }));
      setEditSectionId(null);
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not update section." }));
    } finally {
      setSavingSection(false);
    }
  };

  // ── Panel 3: section delete ───────────────────────────────────────────────
  const handleDeleteSection = async (sectionId: number) => {
    setDeletingSectionId(sectionId);
    setConfirmSectionId(null);
    try {
      await apiRequest(`/classes/sections/${sectionId}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Section removed." }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not delete section." }));
    } finally {
      setDeletingSectionId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={s("academic-page")}>
      <main className={s("content")}>

        {/* Hero */}
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>Editing Class</div>
            <h1>{cls?.name ?? "Loading…"}</h1>
            <p>Update class details, manage assigned subjects, and edit or add sections below.</p>
          </div>
          <div className={s("hero-actions")}>
            <Link className={s("btn")} href={`/classes/${id}`}>
              <i className="fa-solid fa-eye" /> View
            </Link>
            <Link className={s("btn")} href="/classes">
              <i className="fa-solid fa-arrow-left" /> All Classes
            </Link>
          </div>
        </section>

        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <Spinner size={32} color="#FF9B51" />
          </div>
        ) : (
          <>
            {/* ══ PANEL 1 — Class Details ══════════════════════════════════ */}
            <div className={s("panel")} style={{ marginBottom: 16 }}>
              <div className={s("panel-head")}>
                <h2>
                  <i className="fa-solid fa-pen-to-square" style={{ color: "#ff9b51", marginRight: 8 }} />
                  Class Details
                </h2>
              </div>

              <div className={s("form-body")}>
                <label className={s("field")}>
                  <span>Class Name <em style={{ color: "#f43f5e", fontStyle: "normal" }}>*</em></span>
                  <input
                    value={info.name}
                    onChange={(e) => setInfo({ ...info, name: e.target.value })}
                    placeholder="e.g. Class 9"
                  />
                </label>

                <label className={s("field")}>
                  <span>Stream</span>
                  <select value={info.stream} onChange={(e) => setInfo({ ...info, stream: e.target.value })}>
                    {STREAMS.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                </label>

                <label className={s("field")}>
                  <span>Status</span>
                  <select value={info.status} onChange={(e) => setInfo({ ...info, status: e.target.value })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className={cx(s("field"), s("wide"))}>
                  <span>Description</span>
                  <textarea
                    rows={2}
                    value={info.description}
                    onChange={(e) => setInfo({ ...info, description: e.target.value })}
                    placeholder="Optional short description…"
                  />
                </label>
              </div>

              <div className={s("form-actions")} style={{ padding: "0 18px 18px" }}>
                <button
                  className={cx(s("btn"), s("btn-primary"))}
                  onClick={handleSaveInfo}
                  disabled={savingInfo}
                >
                  {savingInfo
                    ? <><Spinner size={14} /> Saving…</>
                    : <><i className="fa-solid fa-check" /> Save Details</>}
                </button>
              </div>
            </div>

            {/* ══ PANEL 2 — Subjects ═══════════════════════════════════════ */}
            <div className={s("panel")} style={{ marginBottom: 16 }}>
              <div className={s("panel-head")}>
                <h2>
                  <i className="fa-solid fa-book-open" style={{ color: "#ff9b51", marginRight: 8 }} />
                  Subjects
                </h2>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7b86" }}>
                  {assignedSubjects.length} assigned
                </span>
              </div>

              <div className={s("panel-body")}>
                {assignedSubjects.length === 0 ? (
                  <div style={{ padding: "2rem 0", textAlign: "center", color: "#94a3b8" }}>
                    <i className="fa-solid fa-book" style={{ fontSize: 22, display: "block", marginBottom: 8 }} />
                    No subjects assigned yet.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto", marginBottom: 20 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(191,201,209,0.5)" }}>
                          <th style={thStyle}>Subject</th>
                          <th style={thStyle}>Teaching Faculty</th>
                          <th style={{ ...thStyle, width: 52 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedSubjects.map((sub, i) => {
                          const tc      = SUBJ_TCOLORS[i % SUBJ_TCOLORS.length];
                          const bg      = SUBJ_COLORS[i % SUBJ_COLORS.length];
                          const assigned = subjectTeacherMap[sub.id];
                          return (
                            <tr key={sub.id} style={{ borderBottom: "1px solid rgba(191,201,209,0.28)" }}>
                              <td style={tdStyle}>
                                <span style={{ background: bg, color: tc, padding: "3px 10px", borderRadius: 20, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                  <i className="fa-solid fa-book" style={{ fontSize: 10 }} />
                                  {sub.name}
                                  {sub.code && <em style={{ fontStyle: "normal", opacity: 0.6, fontSize: 10 }}>· {sub.code}</em>}
                                </span>
                              </td>
                              <td style={tdStyle}>
                                <select
                                  value={assigned ?? ""}
                                  onChange={(e) => {
                                    if (e.target.value) handleAssignTeacher(sub.id, Number(e.target.value));
                                    else handleRemoveTeacher(sub.id);
                                  }}
                                  disabled={savingTeacher === sub.id}
                                  style={{ height: 34, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "0 10px", fontSize: 13, fontWeight: 700, outline: "none", width: "100%", color: assigned ? "#25343f" : "#94a3b8", fontFamily: "inherit" }}
                                >
                                  <option value="">— Unassigned —</option>
                                  {(teachers ?? []).filter(t => t.status === "active").map(t => (
                                    <option key={t.id} value={t.id}>{t.full_name}</option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                {savingTeacher === sub.id ? <Spinner size={14} /> : (
                                  <button
                                    className={s("btn")}
                                    style={{ minHeight: 30, padding: "0 10px", fontSize: 12, borderColor: "#fecdd3", color: "#f43f5e", background: "#fff1f2" }}
                                    onClick={() => handleRemoveSubject(sub.id, sub.name)}
                                    disabled={removingSubjectId === sub.id}
                                    title="Remove subject"
                                  >
                                    {removingSubjectId === sub.id ? <Spinner size={12} /> : <i className="fa-solid fa-trash" />}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add subject row */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 10, alignItems: "flex-end" }}>
                  <label className={s("field")} style={{ margin: 0 }}>
                    <span>Add a Subject</span>
                    <select
                      value={subjectToAdd}
                      onChange={(e) => setSubjectToAdd(e.target.value)}
                      disabled={availableSubjects.length === 0}
                    >
                      <option value="">
                        {availableSubjects.length === 0 ? "— All subjects already assigned —" : "— Select a subject —"}
                      </option>
                      {availableSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name}{sub.code ? ` (${sub.code})` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={cx(s("btn"), s("btn-primary"))}
                    onClick={handleAddSubject}
                    disabled={!subjectToAdd || addingSubject}
                    style={{ height: 40, whiteSpace: "nowrap" }}
                  >
                    {addingSubject ? <Spinner size={14} /> : <><i className="fa-solid fa-plus" /> Assign</>}
                  </button>
                  <Link href="/subjects" className={s("btn")} style={{ height: 40, whiteSpace: "nowrap", fontSize: 12 }}>
                    <i className="fa-solid fa-arrow-up-right-from-square" /> New Subject
                  </Link>
                </div>
              </div>
            </div>

            {/* ══ PANEL 3 — Sections ═══════════════════════════════════════ */}
            <div className={s("panel")}>
              <div className={s("panel-head")}>
                <h2>
                  <i className="fa-solid fa-people-line" style={{ color: "#ff9b51", marginRight: 8 }} />
                  Sections
                  <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 700, color: "#6b7b86" }}>
                    {cls?.sections?.length ?? 0} total
                  </span>
                </h2>
                <button
                  className={cx(s("btn"), showAddSection ? "" : s("btn-primary"))}
                  style={{ fontSize: 12 }}
                  onClick={() => { setShowAddSection(v => !v); setConfirmSectionId(null); setEditSectionId(null); }}
                >
                  <i className={`fa-solid fa-${showAddSection ? "xmark" : "plus"}`} />
                  {showAddSection ? " Cancel" : " Add Section"}
                </button>
              </div>

              {/* Add section inline form */}
              {showAddSection && (
                <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(191,201,209,0.42)", background: "#f8fbfb" }}>
                  <div className={s("form-body")} style={{ padding: 0, marginBottom: 14 }}>
                    <label className={s("field")}>
                      <span>Section Name <em style={{ color: "#f43f5e", fontStyle: "normal" }}>*</em></span>
                      <input
                        autoFocus
                        value={newSection.name}
                        onChange={(e) => setNewSection({ ...newSection, name: e.target.value })}
                        placeholder="e.g. A"
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); }}
                      />
                    </label>
                    <label className={s("field")}>
                      <span>Capacity</span>
                      <input
                        type="number" min="1"
                        value={newSection.capacity}
                        onChange={(e) => setNewSection({ ...newSection, capacity: e.target.value })}
                        placeholder="e.g. 40"
                      />
                    </label>
                    <label className={s("field")}>
                      <span>Room No</span>
                      <input
                        value={newSection.room_no}
                        onChange={(e) => setNewSection({ ...newSection, room_no: e.target.value })}
                        placeholder="e.g. 101"
                      />
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button className={s("btn")} onClick={() => setShowAddSection(false)}>Cancel</button>
                    <button
                      className={cx(s("btn"), s("btn-primary"))}
                      onClick={handleAddSection}
                      disabled={addingSection}
                    >
                      {addingSection ? <><Spinner size={14} /> Adding…</> : <><i className="fa-solid fa-check" /> Add Section</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Section list */}
              <div style={{ paddingTop: 4 }}>
                {!cls?.sections?.length ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                    <i className="fa-solid fa-inbox" style={{ fontSize: 24, display: "block", marginBottom: 8 }} />
                    No sections yet — click &ldquo;Add Section&rdquo; to create one.
                  </div>
                ) : cls.sections.map((sec: any) => (
                  <div key={sec.id} className={s("data-row")} style={{ padding: "14px 18px" }}>

                    {editSectionId === sec.id ? (
                      <div>
                        <div className={s("form-body")} style={{ padding: 0, marginBottom: 14 }}>
                          <label className={s("field")}>
                            <span>Name</span>
                            <input
                              autoFocus
                              value={editSectionForm.name}
                              onChange={(e) => setEditSectionForm({ ...editSectionForm, name: e.target.value })}
                            />
                          </label>
                          <label className={s("field")}>
                            <span>Capacity</span>
                            <input
                              type="number" min="1"
                              value={editSectionForm.capacity}
                              onChange={(e) => setEditSectionForm({ ...editSectionForm, capacity: e.target.value })}
                            />
                          </label>
                          <label className={s("field")}>
                            <span>Room No</span>
                            <input
                              value={editSectionForm.room_no}
                              onChange={(e) => setEditSectionForm({ ...editSectionForm, room_no: e.target.value })}
                            />
                          </label>
                          <label className={s("field")}>
                            <span>Status</span>
                            <select
                              value={editSectionForm.status}
                              onChange={(e) => setEditSectionForm({ ...editSectionForm, status: e.target.value })}
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </label>
                        </div>
                        <div className={s("row-actions")}>
                          <button className={s("btn")} onClick={() => setEditSectionId(null)}>Cancel</button>
                          <button
                            className={cx(s("btn"), s("btn-primary"))}
                            onClick={() => handleSaveSection(sec.id)}
                            disabled={savingSection}
                          >
                            {savingSection ? <Spinner size={14} /> : <><i className="fa-solid fa-check" /> Save</>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={s("row-main")}>
                        <div>
                          <div className={s("row-title")}>
                            Section {sec.name}
                            <span
                              className={s("badge")}
                              style={{
                                marginLeft: 8, fontSize: 10, textTransform: "capitalize",
                                background: sec.status === "active" ? "#dcfce7" : "#fef3c7",
                                color:      sec.status === "active" ? "#15803d" : "#b45309",
                              }}
                            >
                              {sec.status}
                            </span>
                          </div>
                          <div className={s("row-sub")}>
                            Capacity: {sec.capacity ?? "—"}
                            {sec.room_no          && <> · Room {sec.room_no}</>}
                            {sec.coordinator_name && (
                              <> ·&nbsp;
                                <i className="fa-solid fa-chalkboard-user" style={{ marginRight: 4, color: "#ff9b51" }} />
                                {sec.coordinator_name}
                              </>
                            )}
                          </div>
                        </div>

                        {confirmSectionId === sec.id ? (
                          <div className={s("row-actions")}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#f43f5e", whiteSpace: "nowrap" }}>
                              Delete section {sec.name}?
                            </span>
                            <button
                              className={s("btn")}
                              style={{ minHeight: 30, padding: "0 10px", fontSize: 12, borderColor: "#fecdd3", color: "#f43f5e", background: "#fff1f2" }}
                              onClick={() => handleDeleteSection(sec.id)}
                              disabled={deletingSectionId === sec.id}
                            >
                              {deletingSectionId === sec.id ? <Spinner size={12} /> : "Yes, Delete"}
                            </button>
                            <button
                              className={s("btn")}
                              style={{ minHeight: 30, padding: "0 10px", fontSize: 12 }}
                              onClick={() => setConfirmSectionId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={s("row-actions")}>
                            <button
                              className={s("btn")}
                              style={{ minHeight: 30, padding: "0 12px", fontSize: 12 }}
                              onClick={() => startEditSection(sec)}
                            >
                              <i className="fa-solid fa-pen" /> Edit
                            </button>
                            <button
                              className={s("btn")}
                              style={{ minHeight: 30, padding: "0 12px", fontSize: 12, borderColor: "#fecdd3", color: "#f43f5e", background: "#fff1f2" }}
                              onClick={() => setConfirmSectionId(sec.id)}
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
