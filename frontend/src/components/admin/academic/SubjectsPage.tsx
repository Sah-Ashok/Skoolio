"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./academic.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

export default function SubjectsPage() {
  const dispatch = useAppDispatch();
  const { formatDate } = useDateFormat();
  const { data: subjects, loading, refetch } = useApi<any[]>("/classes/subjects");

  const [search,     setSearch]     = useState("");
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState({ name: "", code: "" });
  const [creating,   setCreating]   = useState(false);
  const [confirmId,  setConfirmId]  = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editId,     setEditId]     = useState<number | null>(null);
  const [editForm,   setEditForm]   = useState({ name: "", code: "" });
  const [saving,     setSaving]     = useState(false);

  const filtered = (subjects || []).filter((sub) =>
    sub.name.toLowerCase().includes(search.toLowerCase()) ||
    (sub.code && sub.code.toLowerCase().includes(search.toLowerCase()))
  );

  const withCode    = (subjects || []).filter((s) => s.code).length;
  const withoutCode = (subjects || []).length - withCode;

  // ── CREATE ──────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      await apiRequest("/classes/subjects", {
        method: "POST",
        body: JSON.stringify({ name: form.name.trim(), code: form.code.trim() || undefined }),
      });
      dispatch(showToast({ type: "success", title: "Subject Created", message: `"${form.name}" has been added.` }));
      setForm({ name: "", code: "" });
      setShowForm(false);
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not create subject." }));
    } finally {
      setCreating(false);
    }
  };

  // ── DELETE ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setConfirmId(null);
    try {
      await apiRequest(`/classes/subjects/${id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Subject removed successfully." }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not delete subject." }));
    } finally {
      setDeletingId(null);
    }
  };

  // ── EDIT ─────────────────────────────────────────────────────────────────────
  const startEdit = (sub: any) => {
    setEditId(sub.id);
    setEditForm({ name: sub.name, code: sub.code || "" });
    setConfirmId(null);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      await apiRequest(`/classes/subjects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editForm.name.trim(), code: editForm.code.trim() || null }),
      });
      dispatch(showToast({ type: "success", title: "Updated", message: "Subject updated successfully." }));
      setEditId(null);
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not update subject." }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={s("academic-page")}>
      <Topbar title="Subjects" subtitle="Manage the master list of all subjects" />

      <main className={s("content")}>

        {/* ── Hero ── */}
        <section className={s("hero")}>
          <div>
            <div className={s("eyebrow")}>Academic</div>
            <h1>Subject Directory</h1>
            <p>Manage the master list of all subjects taught across the school. Subjects can be assigned to classes from the Classes page.</p>
          </div>
          <div className={s("hero-actions")}>
            <button
              className={cx(s("btn"), s("btn-primary"))}
              onClick={() => { setShowForm((v) => !v); setForm({ name: "", code: "" }); }}
            >
              <i className={`fa-solid fa-${showForm ? "xmark" : "plus"}`} />
              {showForm ? "Cancel" : "Add Subject"}
            </button>
          </div>
        </section>

        {/* ── Stats ── */}
        <div className={s("stats-grid")}>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")}><i className="fa-solid fa-book" /></div>
            <div>
              <p>Total Subjects</p>
              <strong>{subjects?.length ?? "—"}</strong>
            </div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")} style={{ background: "#dcfce7", color: "#15803d" }}>
              <i className="fa-solid fa-tag" />
            </div>
            <div>
              <p>With Code</p>
              <strong>{withCode}</strong>
            </div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")} style={{ background: "#fef3c7", color: "#b45309" }}>
              <i className="fa-solid fa-tag" style={{ opacity: 0.4 }} />
            </div>
            <div>
              <p>Without Code</p>
              <strong>{withoutCode}</strong>
            </div>
          </article>
          <article className={s("stat-card")}>
            <div className={s("stat-icon")} style={{ background: "#ede9fe", color: "#7c3aed" }}>
              <i className="fa-solid fa-layer-group" />
            </div>
            <div>
              <p>Shown</p>
              <strong>{filtered.length}</strong>
            </div>
          </article>
        </div>

        {/* ── Add Subject inline form ── */}
        {showForm && (
          <div className={s("panel")} style={{ marginBottom: 16 }}>
            <div className={s("panel-head")}>
              <h2><i className="fa-solid fa-plus" style={{ color: "#ff9b51", marginRight: 8 }} />New Subject</h2>
            </div>
            <form onSubmit={handleCreate} className={s("form-body")}>
              <label className={s("field")}>
                <span>Subject Name <em style={{ color: "#f43f5e" }}>*</em></span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Mathematics"
                  autoFocus
                />
              </label>
              <label className={s("field")}>
                <span>Subject Code <em style={{ color: "#94a3b8", fontStyle: "normal" }}>(optional)</em></span>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. MATH101"
                />
              </label>
              <div className={cx(s("form-actions"), s("wide"))}>
                <button type="button" className={s("btn")} onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className={cx(s("btn"), s("btn-primary"))} disabled={creating || !form.name.trim()}>
                  {creating ? <><Spinner size={14} /> Saving…</> : <><i className="fa-solid fa-check" /> Save Subject</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Main Panel ── */}
        <div className={s("panel")}>
          <div className={s("panel-head")}>
            <h2>
              <i className="fa-solid fa-book-open" style={{ color: "#ff9b51", marginRight: 8 }} />
              All Subjects
            </h2>
            {/* Search */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 12 }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subjects…"
                  style={{ paddingLeft: 30, paddingRight: 12, height: 36, border: "1px solid rgba(191,201,209,0.9)", borderRadius: 8, fontSize: 13, fontWeight: 700, outline: "none", color: "#25343f", background: "#f8fbfb", width: 220 }}
                />
              </div>
              <button className={s("btn")} onClick={refetch} title="Refresh">
                <i className="fa-solid fa-rotate-right" />
              </button>
            </div>
          </div>

          <div className={s("panel-body")} style={{ padding: 0 }}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <Spinner size={32} color="#FF9B51" />
              </div>
            ) : (
              <div className={s("table-scroll")}>
                <table className={s("subject-table")}>
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>#</th>
                      <th>Subject Name</th>
                      <th>Code</th>
                      <th>Created</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "#6b7b86" }}>
                          <i className="fa-solid fa-inbox" style={{ fontSize: 26, display: "block", marginBottom: 10 }} />
                          {search ? `No subjects match "${search}"` : "No subjects yet. Click Add Subject to get started."}
                        </td>
                      </tr>
                    ) : filtered.map((sub, idx) => (
                      <tr key={sub.id}>
                        <td style={{ color: "#94a3b8", fontWeight: 700 }}>{idx + 1}</td>

                        {/* Inline edit name/code */}
                        {editId === sub.id ? (
                          <>
                            <td>
                              <input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                style={{ height: 34, border: "1.5px solid #ff9b51", borderRadius: 7, padding: "0 10px", fontSize: 13, fontWeight: 700, outline: "none", width: "100%" }}
                                autoFocus
                              />
                            </td>
                            <td>
                              <input
                                value={editForm.code}
                                onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                                placeholder="Code"
                                style={{ height: 34, border: "1.5px solid #e2e8f0", borderRadius: 7, padding: "0 10px", fontSize: 13, fontWeight: 700, outline: "none", width: "100%" }}
                              />
                            </td>
                            <td style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>
                              {formatDate(sub.created_at?.slice(0,10))}
                            </td>
                            <td>
                              <div className={s("row-actions")}>
                                <button
                                  className={cx(s("btn"), s("btn-primary"))}
                                  style={{ minHeight: 32, padding: "0 12px", fontSize: 12 }}
                                  onClick={() => handleSaveEdit(sub.id)}
                                  disabled={saving}
                                >
                                  {saving ? <Spinner size={13} /> : <><i className="fa-solid fa-check" /> Save</>}
                                </button>
                                <button
                                  className={s("btn")}
                                  style={{ minHeight: 32, padding: "0 12px", fontSize: 12 }}
                                  onClick={() => setEditId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <strong>{sub.name}</strong>
                            </td>
                            <td>
                              {sub.code
                                ? <span className={cx(s("badge"), s("badge-secondary"))}>{sub.code}</span>
                                : <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>—</span>
                              }
                            </td>
                            <td style={{ color: "#6b7b86", fontSize: 12, fontWeight: 700 }}>
                              {formatDate(sub.created_at?.slice(0,10))}
                            </td>
                            <td>
                              {confirmId === sub.id ? (
                                /* Inline delete confirm */
                                <div className={s("row-actions")} style={{ justifyContent: "flex-end" }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#f43f5e", whiteSpace: "nowrap" }}>
                                    Delete &ldquo;{sub.name}&rdquo;?
                                  </span>
                                  <button
                                    className={cx(s("btn"))}
                                    style={{ minHeight: 30, padding: "0 10px", fontSize: 12, borderColor: "#f43f5e", color: "#f43f5e" }}
                                    onClick={() => handleDelete(sub.id)}
                                    disabled={deletingId === sub.id}
                                  >
                                    {deletingId === sub.id ? <Spinner size={12} /> : "Yes, Delete"}
                                  </button>
                                  <button
                                    className={s("btn")}
                                    style={{ minHeight: 30, padding: "0 10px", fontSize: 12 }}
                                    onClick={() => setConfirmId(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className={s("row-actions")} style={{ justifyContent: "flex-end" }}>
                                  <button
                                    className={s("btn")}
                                    style={{ minHeight: 30, padding: "0 10px", fontSize: 12 }}
                                    onClick={() => startEdit(sub)}
                                    title="Edit"
                                  >
                                    <i className="fa-solid fa-pen" /> Edit
                                  </button>
                                  <button
                                    className={s("btn")}
                                    style={{ minHeight: 30, padding: "0 10px", fontSize: 12, borderColor: "#fecdd3", color: "#f43f5e", background: "#fff1f2" }}
                                    onClick={() => setConfirmId(sub.id)}
                                    title="Delete"
                                  >
                                    <i className="fa-solid fa-trash" /> Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
