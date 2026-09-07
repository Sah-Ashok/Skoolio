"use client";

import { useState, useMemo } from "react";
import styles from "./academic.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { Skeleton, SkeletonStatRow } from "@/components/shared/Skeleton";
import { apiRequest } from "@/lib/api";

const s = (c: string) => styles[c] || c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

// ─── colour palette for class cards ────────────────────────────────────────
const CARD_COLORS = [
  { bg: "#fff8f2", border: "#fdd5b0", accent: "#e98239", light: "#fff3e8" },
  { bg: "#f0f9ff", border: "#bae6fd", accent: "#0284c7", light: "#e0f2fe" },
  { bg: "#f0fdf4", border: "#bbf7d0", accent: "#16a34a", light: "#dcfce7" },
  { bg: "#fdf4ff", border: "#e9d5ff", accent: "#9333ea", light: "#f3e8ff" },
  { bg: "#fff1f2", border: "#fecdd3", accent: "#e11d48", light: "#fee2e8" },
  { bg: "#f0fdfa", border: "#99f6e4", accent: "#0d9488", light: "#ccfbf1" },
];

// ─── Add Section modal ──────────────────────────────────────────────
function AddSectionModal({
  cls,
  onClose,
  onAdded,
}: {
  cls: any;
  onClose: () => void;
  onAdded: () => void;
}) {
  const dispatch = useAppDispatch();
  const [name,          setName]          = useState("");
  const [capacity,      setCapacity]      = useState("40");
  const [room,          setRoom]          = useState("");
  const [coordinatorId, setCoordinatorId] = useState("");

  // Fetch teacher list for coordinator dropdown
  const { data: teachers } = useApi<any[]>("/teachers");

  const { execute, loading } = useMutation(`/classes/${cls.id}/sections`, "POST");

  const handleSubmit = async () => {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Section name is required." }));
      return;
    }
    const res = await execute({
      name:           trimmed,
      capacity:       Number(capacity) || 40,
      room_no:        room.trim() || null,
      coordinator_id: coordinatorId ? Number(coordinatorId) : null,
      status:         "active",
    });
    if (res) {
      dispatch(showToast({ type: "success", title: "Added", message: `Section ${trimmed} added to ${cls.name}.` }));
      onAdded();
    } else {
      dispatch(showToast({ type: "error", title: "Error", message: "Failed to add section." }));
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 24px 64px rgba(15,23,42,0.22)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: "#e98239", textTransform: "uppercase", marginBottom: 4 }}>Add Section</p>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: "#1f2d36" }}>New Section in {cls.name}</h3>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", cursor: "pointer", color: "#6a7882", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Section Name */}
          <div className={s("field")}>
            <span>Section Name <b style={{ color: "#b42318" }}>*</b></span>
            <input
              value={name}
              onChange={e => setName(e.target.value.toUpperCase())}
              placeholder="A, B, C …"
              maxLength={10}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>

          {/* Capacity + Room */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className={s("field")}>
              <span>Capacity</span>
              <input type="number" min={1} max={200} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="40" />
            </div>
            <div className={s("field")}>
              <span>Room / Lab</span>
              <input value={room} onChange={e => setRoom(e.target.value)} placeholder="Room 101" />
            </div>
          </div>

          {/* Coordinator */}
          <div className={s("field")}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fa-solid fa-chalkboard-user" style={{ color: "#6a7882", fontSize: 11 }} />
              Section Coordinator
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginLeft: 2 }}>(optional)</span>
            </span>
            <select value={coordinatorId} onChange={e => setCoordinatorId(e.target.value)}>
              <option value="">— No coordinator</option>
              {(teachers ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || `Teacher #${t.id}`}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* footer */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #eef0f3", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className={cx(s("btn"))} onClick={onClose} disabled={loading} style={{ background: "#f0f4f6", border: "none" }}>Cancel</button>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSubmit} disabled={loading} style={{ border: "none" }}>
            {loading ? <Spinner size={14} /> : <><i className="fa-solid fa-plus" /> Add Section</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Section modal ──────────────────────────────────────────────
function EditSectionModal({
  section,
  onClose,
  onSaved,
}: {
  section: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const [name,          setName]          = useState(section.name);
  const [capacity,      setCapacity]      = useState(String(section.capacity || 40));
  const [room,          setRoom]          = useState(section.room_no || section.room || "");
  const [status,        setStatus]        = useState(section.status || "active");
  const [coordinatorId, setCoordinatorId] = useState(String(section.coordinator_id || ""));

  // Fetch teacher list for coordinator dropdown
  const { data: teachers } = useApi<any[]>("/teachers");

  const { execute, loading } = useMutation(`/classes/sections/${section.id}`, "PATCH");

  const handleSave = async () => {
    if (!name.trim()) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Section name is required." }));
      return;
    }
    const res = await execute({
      name:           name.trim().toUpperCase(),
      capacity:       Number(capacity) || 40,
      room_no:        room.trim() || null,
      coordinator_id: coordinatorId ? Number(coordinatorId) : null,
      status,
    });
    if (res) {
      dispatch(showToast({ type: "success", title: "Updated", message: `Section ${name.toUpperCase()} updated.` }));
      onSaved();
    } else {
      dispatch(showToast({ type: "error", title: "Error", message: "Failed to update section." }));
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, boxShadow: "0 24px 64px rgba(15,23,42,0.22)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #eef0f3", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: "#e98239", textTransform: "uppercase", marginBottom: 4 }}>Edit Section</p>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: "#1f2d36" }}>Section {section.name}</h3>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", cursor: "pointer", color: "#6a7882", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Section Name */}
          <div className={s("field")}>
            <span>Section Name <b style={{ color: "#b42318" }}>*</b></span>
            <input value={name} onChange={e => setName(e.target.value.toUpperCase())} maxLength={10} />
          </div>

          {/* Capacity + Room */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className={s("field")}>
              <span>Capacity</span>
              <input type="number" min={1} value={capacity} onChange={e => setCapacity(e.target.value)} />
            </div>
            <div className={s("field")}>
              <span>Room / Lab</span>
              <input value={room} onChange={e => setRoom(e.target.value)} placeholder="Room 101" />
            </div>
          </div>

          {/* Coordinator */}
          <div className={s("field")}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fa-solid fa-chalkboard-user" style={{ color: "#6a7882", fontSize: 11 }} />
              Section Coordinator
              <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginLeft: 2 }}>(optional)</span>
            </span>
            <select value={coordinatorId} onChange={e => setCoordinatorId(e.target.value)}>
              <option value="">— No coordinator</option>
              {(teachers ?? []).map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.full_name || `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || `Teacher #${t.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className={s("field")}>
            <span>Status</span>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid #eef0f3", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className={cx(s("btn"))} onClick={onClose} disabled={loading} style={{ background: "#f0f4f6", border: "none" }}>Cancel</button>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSave} disabled={loading} style={{ border: "none" }}>
            {loading ? <Spinner size={14} /> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ───────────────────────────────────────────────────
function DeleteSectionModal({ section, onClose, onDeleted }: { section: any; onClose: () => void; onDeleted: () => void }) {
  const dispatch = useAppDispatch();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiRequest(`/classes/sections/${section.id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: `Section ${section.name} removed.` }));
      onDeleted();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to delete section." }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 80, padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: "24px", boxShadow: "0 24px 64px rgba(15,23,42,0.22)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fde7e7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <i className="fa-solid fa-trash" style={{ color: "#b42318", fontSize: 18 }} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: "0 0 6px" }}>Delete Section {section.name}?</h3>
        <p style={{ fontSize: 13, color: "#6a7882", margin: "0 0 20px", lineHeight: 1.6 }}>
          This will permanently remove section <strong style={{ color: "#1f2d36" }}>{section.name}</strong>. Students enrolled in this section may be affected. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={cx(s("btn"))} style={{ flex: 1, background: "#f0f4f6", border: "none" }} onClick={onClose} disabled={deleting}>Cancel</button>
          <button
            className={cx(s("btn"))}
            style={{ flex: 1, background: "#b42318", color: "#fff", border: "none" }}
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? <Spinner size={14} /> : <><i className="fa-solid fa-trash" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section pill inside a class card ──────────────────────────────────
function SectionPill({
  section,
  color,
  onEdit,
  onDelete,
}: {
  section: any;
  color: typeof CARD_COLORS[0];
  onEdit: (s: any) => void;
  onDelete: (s: any) => void;
}) {
  const isInactive = section.status === "inactive";

  // Derive coordinator display name from the joined object if present
  const coordinatorName =
    section.coordinator_name ||
    (section.coordinator
      ? section.coordinator.full_name ||
        `${section.coordinator.first_name ?? ""} ${section.coordinator.last_name ?? ""}`.trim()
      : null);

  return (
    <div style={{
      position: "relative",
      display: "flex", flexDirection: "column", gap: 8,
      minWidth: 130, flex: "0 0 auto",
      padding: "12px 14px",
      border: `1.5px solid ${isInactive ? "#d4dde2" : color.border}`,
      borderRadius: 12,
      background: isInactive ? "#f8fafc" : color.light,
      opacity: isInactive ? 0.65 : 1,
      transition: "box-shadow 0.15s",
    }}
      className="section-pill"
    >
      {/* section letter badge */}
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: isInactive ? "#d4dde2" : color.accent,
        color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, fontWeight: 900,
      }}>
        {section.name}
      </div>

      <div>
        <p style={{ fontSize: 12, fontWeight: 900, color: "#1f2d36", margin: 0 }}>Section {section.name}</p>
        {section.room_no || section.room
          ? <p style={{ fontSize: 10.5, color: "#6a7882", fontWeight: 700, marginTop: 2 }}>
              <i className="fa-solid fa-door-open" style={{ marginRight: 4, fontSize: 9 }} />
              {section.room_no || section.room}
            </p>
          : null
        }
        <p style={{ fontSize: 10.5, color: "#6a7882", fontWeight: 700, marginTop: 1 }}>
          <i className="fa-solid fa-users" style={{ marginRight: 4, fontSize: 9 }} />
          Capacity {section.capacity ?? "—"}
        </p>
        {coordinatorName && (
          <p style={{ fontSize: 10.5, color: "#6a7882", fontWeight: 700, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
            <i className="fa-solid fa-chalkboard-user" style={{ fontSize: 9, flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 100 }}>
              {coordinatorName}
            </span>
          </p>
        )}
      </div>

      {/* status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: isInactive ? "#94a3b8" : "#16a34a", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 800, color: isInactive ? "#94a3b8" : "#16a34a", textTransform: "capitalize" }}>{section.status || "active"}</span>
      </div>

      {/* action buttons — show on hover via CSS */}
      <div className="pill-actions" style={{
        position: "absolute", top: 7, right: 7,
        display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s",
      }}>
        <button
          onClick={() => onEdit(section)}
          title="Edit"
          style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #d4dde2", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#4b5f6b" }}
        >
          <i className="fa-solid fa-pen" />
        </button>
        <button
          onClick={() => onDelete(section)}
          title="Delete"
          style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #fecdd3", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#b42318" }}
        >
          <i className="fa-solid fa-trash" />
        </button>
      </div>
    </div>
  );
}

// ─── Single class card with its sections ───────────────────────────────────
function ClassCard({
  cls,
  colorIdx,
  onSectionChange,
}: {
  cls: any;
  colorIdx: number;
  onSectionChange: () => void;
}) {
  const color = CARD_COLORS[colorIdx % CARD_COLORS.length];
  const { data: sections, loading, refetch } = useApi<any[]>(`/classes/${cls.id}/sections`);
  const [addOpen, setAddOpen] = useState(false);
  const [editSection, setEditSection] = useState<any | null>(null);
  const [deleteSection, setDeleteSection] = useState<any | null>(null);

  const activeCount = sections?.filter(s => s.status !== "inactive").length ?? 0;
  const totalCap = sections?.reduce((sum, s) => sum + (s.capacity || 0), 0) ?? 0;

  return (
    <>
      <article style={{
        border: `1.5px solid ${color.border}`,
        borderRadius: 16,
        background: "#fff",
        boxShadow: "0 2px 16px rgba(37,52,63,0.07)",
        overflow: "hidden",
      }}>
        {/* ── Card header ── */}
        <div style={{
          padding: "16px 20px",
          background: color.bg,
          borderBottom: `1.5px solid ${color.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* class avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: color.accent, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 900, flexShrink: 0,
            }}>
              {cls.name?.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 900, color: "#1f2d36", margin: 0 }}>{cls.name}</p>
              <p style={{ fontSize: 11, color: "#6a7882", fontWeight: 700, marginTop: 2 }}>
                <span style={{ color: color.accent, fontWeight: 900 }}>{activeCount}</span> active section{activeCount !== 1 ? "s" : ""}
                {totalCap > 0 && <span style={{ marginLeft: 8 }}>· {totalCap} total capacity</span>}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* status badge */}
            <span style={{
              padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 900,
              background: cls.status === "active" ? "#dcfce7" : "#f1f5f9",
              color: cls.status === "active" ? "#15803d" : "#6a7882",
              textTransform: "capitalize",
            }}>
              {cls.status || "active"}
            </span>
            {/* add section button */}
            <button
              onClick={() => setAddOpen(true)}
              title="Add section"
              style={{
                minHeight: 32, padding: "0 12px",
                border: `1.5px solid ${color.accent}`,
                borderRadius: 8, background: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, fontWeight: 900, color: color.accent,
              }}
            >
              <i className="fa-solid fa-plus" style={{ fontSize: 10 }} /> Add Section
            </button>
          </div>
        </div>

        {/* ── Sections area ── */}
        <div style={{ padding: "16px 20px 18px" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <Spinner size={26} color={color.accent} />
            </div>
          ) : !sections || sections.length === 0 ? (
            <div style={{
              padding: "24px 16px", border: "1.5px dashed #d4dde2", borderRadius: 10,
              textAlign: "center", background: "#fafcfc",
            }}>
              <i className="fa-solid fa-table-cells" style={{ fontSize: 22, color: "#c4cfd7", marginBottom: 8 }} />
              <p style={{ fontSize: 13, fontWeight: 900, color: "#6a7882", margin: "0 0 4px" }}>No sections yet</p>
              <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, margin: 0 }}>Click "Add Section" to create the first one.</p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {sections.map(sec => (
                <SectionPill
                  key={sec.id}
                  section={sec}
                  color={color}
                  onEdit={setEditSection}
                  onDelete={setDeleteSection}
                />
              ))}
            </div>
          )}
        </div>
      </article>

      {addOpen && (
        <AddSectionModal
          cls={cls}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); refetch(); onSectionChange(); }}
        />
      )}
      {editSection && (
        <EditSectionModal
          section={editSection}
          onClose={() => setEditSection(null)}
          onSaved={() => { setEditSection(null); refetch(); onSectionChange(); }}
        />
      )}
      {deleteSection && (
        <DeleteSectionModal
          section={deleteSection}
          onClose={() => setDeleteSection(null)}
          onDeleted={() => { setDeleteSection(null); refetch(); onSectionChange(); }}
        />
      )}
    </>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function SectionsPage() {
  const { activeYear, academicYearId } = useAcademicYear();
  const { data: classes, loading: classesLoading, refetch: refetchClasses } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!classes) return [];
    const q = search.toLowerCase();
    return q ? classes.filter(c => c.name?.toLowerCase().includes(q)) : classes;
  }, [classes, search]);

  // aggregate stats across all classes (rough totals without re-fetching sections)
  const totalClasses = classes?.length ?? 0;

  return (
    <div className={s("academic-page")}>
      <main className={s("content")}>
        {/* ── Hero ── */}
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>Academic Structure</div>
            <h1>Sections Management</h1>
            <p>View, add, and manage sections within each class. Each section tracks its own capacity, room, and status.</p>
          </div>
          <div className={s("hero-actions")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 9, border: "1px solid #d4dde2", background: "#f8fafc", fontSize: 12.5, fontWeight: 700, color: "#6a7882" }}>
              <i className="fa-solid fa-calendar" style={{ color: "#e98239" }} />
              {activeYear?.year_name ?? "No active year"}
            </div>
          </div>
        </section>

        {/* ── Stats row ── */}
        {classesLoading && !classes ? (
          <div style={{ marginBottom: 18 }}>
            <SkeletonStatRow count={2} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
            {[
              { icon: "fa-school",       label: "Total Classes",   value: totalClasses,     color: "#e98239", bg: "#fff3e8" },
              { icon: "fa-table-cells",  label: "Active Year",     value: activeYear?.year_name ?? "—", color: "#0284c7", bg: "#e0f2fe" },
            ].map(stat => (
              <div key={stat.label} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 18px", borderRadius: 12,
                border: "1px solid rgba(191,201,209,0.7)", background: "#fff",
                boxShadow: "0 2px 10px rgba(37,52,63,0.05)", flex: "1 1 180px",
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: stat.bg, color: stat.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  <i className={`fa-solid ${stat.icon}`} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#6a7882", fontWeight: 800, margin: 0 }}>{stat.label}</p>
                  <strong style={{ fontSize: 20, fontWeight: 900, color: "#1f2d36" }}>{stat.value}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <label style={{
            flex: 1, minWidth: 200, display: "flex", alignItems: "center", gap: 8,
            padding: "9px 14px", borderRadius: 10,
            border: "1px solid #d4dde2", background: "#fff",
            boxShadow: "0 1px 4px rgba(37,52,63,0.05)",
          }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 13 }} />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search class name…"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#1f2d36", width: "100%", fontFamily: "inherit" }}
            />
          </label>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#6a7882", padding: "0 4px" }}>
            {filtered.length} class{filtered.length !== 1 ? "es" : ""}
          </span>
        </div>

        {/* ── Class cards ── */}
        {classesLoading && !classes ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: "18px 24px", borderRadius: 16, border: "1px solid rgba(191,201,209,0.7)", background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <Skeleton width="30%" height={24} />
                  <Skeleton width="15%" height={24} borderRadius={8} />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <Skeleton width={120} height={40} borderRadius={10} />
                  <Skeleton width={120} height={40} borderRadius={10} />
                </div>
              </div>
            ))}
          </div>
        ) : !classes || classes.length === 0 ? (
          <div style={{
            padding: "60px 32px", textAlign: "center",
            border: "1.5px dashed #d4dde2", borderRadius: 16,
            background: "#fafcfc",
          }}>
            <i className="fa-solid fa-school" style={{ fontSize: 36, color: "#c4cfd7", marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 900, color: "#1f2d36", marginBottom: 8 }}>No Classes Found</h3>
            <p style={{ fontSize: 13, color: "#6a7882", fontWeight: 700, maxWidth: 340, margin: "0 auto" }}>
              Please create a class first from the Classes page. Sections can then be added here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "#6a7882", fontSize: 14, fontWeight: 700 }}>
            No classes match your search.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {filtered.map((cls, idx) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                colorIdx={idx}
                onSectionChange={refetchClasses}
              />
            ))}
          </div>
        )}
      </main>

      {/* hover reveal for pill action buttons */}
      <style>{`
        .section-pill:hover { box-shadow: 0 4px 18px rgba(37,52,63,0.12); }
        .section-pill:hover .pill-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
