"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi, useMutation } from "@/lib/useApi";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import ConfirmModal from "@/components/shared/ConfirmModal";
import styles from "./feedback.module.css";

const s  = (n: string) => styles[n] || n;
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

type FeedbackStatus   = "open" | "in_review" | "resolved" | "closed";
type FeedbackPriority = "low" | "medium" | "high";
type FeedbackCategory = "bug" | "feature_request" | "ui_improvement" | "performance" | "general" | "other";

interface Feedback {
  id:             number;
  school_id:      number;
  submitted_by:   number;
  role:           "admin" | "faculty";
  submitter_name: string;
  category:       FeedbackCategory;
  title:          string;
  description:    string;
  rating?:        number;
  status:         FeedbackStatus;
  priority:       FeedbackPriority;
  admin_response?: string;
  responded_at?:  string;
  created_at:     string;
  updated_at:     string;
}

const CATEGORY_MAP: Record<FeedbackCategory, { label: string; icon: string; color: string; bg: string }> = {
  bug:             { label: "Bug / Error",      icon: "fa-bug",          color: "#b42318", bg: "#fde7e7" },
  feature_request: { label: "Feature Request",  icon: "fa-lightbulb",    color: "#1e3a8a", bg: "#dbeafe" },
  ui_improvement:  { label: "UI Improvement",   icon: "fa-palette",      color: "#7c3aed", bg: "#f3e8ff" },
  performance:     { label: "Performance",      icon: "fa-bolt",         color: "#c46a14", bg: "#fff1df" },
  general:         { label: "General",          icon: "fa-comment-dots", color: "#12805c", bg: "#e2f6ee" },
  other:           { label: "Other",            icon: "fa-ellipsis",     color: "#6a7882", bg: "#f1f5f9" },
};

const STATUS_MAP: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  open:      { label: "Open",      color: "#b42318", bg: "#fde7e7" },
  in_review: { label: "In Review", color: "#c46a14", bg: "#fff1df" },
  resolved:  { label: "Resolved",  color: "#12805c", bg: "#e2f6ee" },
  closed:    { label: "Closed",    color: "#6a7882", bg: "#f1f5f9" },
};

const PRIORITY_MAP: Record<FeedbackPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "#6a7882" },
  medium: { label: "Medium", color: "#c46a14" },
  high:   { label: "High",   color: "#b42318" },
};

function StarDisplay({ rating }: { rating?: number }) {
  if (!rating) return <span style={{ color: "#94a3b8", fontSize: 12 }}>No rating</span>;
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <i key={n} className="fa-solid fa-star" style={{ fontSize: 12, color: rating >= n ? "#f59e0b" : "#e1e8eb" }} />
      ))}
    </span>
  );
}

export default function FeedbackPage() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector(s => s.auth);
  const { formatDate } = useDateFormat();
  const role = user?.role;

  const endpoint = role === "faculty" ? "/feedback/teacher/mine" : "/feedback/admin";
  const { data: rawFeedback, loading, refetch } = useApi<Feedback[]>(endpoint);
  const feedback = Array.isArray(rawFeedback)
    ? rawFeedback
    : (rawFeedback as any)?.data ?? [];

  const submitEndpoint = role === "faculty" ? "/feedback/teacher" : "/feedback/admin";
  const { execute: submit, loading: submitting } = useMutation(submitEndpoint, "POST");
  const { execute: deleteFb } = useMutation("/feedback", "DELETE");

  const [selected,    setSelected]    = useState<Feedback | null>(null);
  const [search,      setSearch]      = useState("");
  const [filterCat,   setFilterCat]   = useState<"" | FeedbackCategory>("");
  const [filterStatus,setFilterStatus]= useState<"" | FeedbackStatus>("");
  const [showForm,    setShowForm]    = useState(false);

  // Form
  const [form, setForm] = useState({
    category:    "general" as FeedbackCategory,
    title:       "",
    description: "",
    rating:      0,
    priority:    "medium" as FeedbackPriority,
  });

  const filtered = useMemo(() => {
    return feedback.filter((f: Feedback) => {
      if (filterCat    && f.category !== filterCat)    return false;
      if (filterStatus && f.status   !== filterStatus) return false;
      if (search && !f.title.toLowerCase().includes(search.toLowerCase()) &&
          !f.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [feedback, filterCat, filterStatus, search]);

  const totalOpen     = feedback.filter((f: Feedback) => f.status === "open").length;
  const totalResolved = feedback.filter((f: Feedback) => f.status === "resolved").length;
  const avgRating     = (() => {
    const rated = feedback.filter((f: Feedback) => f.rating);
    if (!rated.length) return 0;
    return (rated.reduce((s: number, f: Feedback) => s + (f.rating ?? 0), 0) / rated.length).toFixed(1);
  })();

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Title is required." }));
      return;
    }
    if (!form.description.trim()) {
      dispatch(showToast({ type: "error", title: "Validation", message: "Description is required." }));
      return;
    }
    try {
      await submit({ ...form, rating: form.rating || undefined });
      dispatch(showToast({ type: "success", title: "Submitted!", message: "Thank you for your feedback." }));
      setShowForm(false);
      setForm({ category: "general", title: "", description: "", rating: 0, priority: "medium" });
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message }));
    }
  };

  const [feedbackToDelete, setFeedbackToDelete] = useState<Feedback | null>(null);

  const handleDelete = (fb: Feedback, e: React.MouseEvent) => {
    e.stopPropagation();
    setFeedbackToDelete(fb);
  };

  const handleConfirmDelete = async () => {
    if (!feedbackToDelete) return;
    try {
      await deleteFb(undefined, `/feedback/${feedbackToDelete.id}`);
      dispatch(showToast({ type: "success", title: "Deleted", message: "Feedback deleted." }));
      if (selected?.id === feedbackToDelete.id) setSelected(null);
      refetch();
      setFeedbackToDelete(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message }));
    }
  };

  return (
    <div className={s("page")}>
      <Topbar title="Feedback" subtitle="Share your experience and suggestions to help us improve Skoolio" />
      <main className={s("content")}>

        {/* Head */}
        <section className={s("head")}>
          <div>
            <h1>My Feedback</h1>
            <p>Track all the feedback you've submitted to the Skoolio team.</p>
          </div>
          <button className={cx(s("btn"), s("btnPrimary"))} onClick={() => setShowForm(true)}>
            <i className="fa-solid fa-plus" /> New Feedback
          </button>
        </section>

        {/* Stats */}
        <section className={s("stats")}>
          <article className={cx(s("stat"), s("blue"))}>
            <div><i className="fa-solid fa-inbox" /></div>
            <span>Total</span>
            <strong>{feedback.length}</strong>
            <small>Submitted</small>
          </article>
          <article className={cx(s("stat"), s("red"))}>
            <div><i className="fa-solid fa-circle-dot" /></div>
            <span>Open</span>
            <strong>{totalOpen}</strong>
            <small>Awaiting review</small>
          </article>
          <article className={cx(s("stat"), s("green"))}>
            <div><i className="fa-solid fa-circle-check" /></div>
            <span>Resolved</span>
            <strong>{totalResolved}</strong>
            <small>Completed</small>
          </article>
          <article className={cx(s("stat"), s("orange"))}>
            <div><i className="fa-solid fa-star" /></div>
            <span>Avg Rating</span>
            <strong>{avgRating || "—"}</strong>
            <small>Out of 5</small>
          </article>
        </section>

        {/* Toolbar */}
        <section className={s("toolbar")}>
          <label className={s("search")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="Search feedback..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value as any)} className={s("select")}>
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className={s("select")}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </section>

        {/* Main grid */}
        <section className={s("grid")}>

          {/* List */}
          <div className={s("list")}>
            {loading && <div style={{ padding: "3rem 1rem", textAlign: "center" }}><Loader fullScreen={false} size="md" text="Loading feedback…" /></div>}
            {!loading && filtered.length === 0 && (
              <div className={s("empty")}>
                <i className="fa-solid fa-comment-slash" />
                <p>No feedback yet. Click "New Feedback" to get started.</p>
              </div>
            )}
            {!loading && filtered.map((fb: Feedback) => {
              const cat = CATEGORY_MAP[fb.category];
              const st  = STATUS_MAP[fb.status];
              const pr  = PRIORITY_MAP[fb.priority];
              return (
                <div
                  key={fb.id}
                  className={cx(s("item"), selected?.id === fb.id && s("itemActive"))}
                  onClick={() => setSelected(fb)}
                >
                  <div className={s("itemTop")}>
                    <div className={s("itemIcon")} style={{ background: cat.bg, color: cat.color }}>
                      <i className={`fa-solid ${cat.icon}`} />
                    </div>
                    <div className={s("itemMeta")}>
                      <span className={s("itemTitle")}>{fb.title}</span>
                      <div className={s("itemTags")}>
                        <span className={s("chip")} style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                        <span className={s("chip")} style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pr.color }}>
                          <i className="fa-solid fa-circle" style={{ fontSize: 6, verticalAlign: "middle", marginRight: 3 }} />
                          {pr.label}
                        </span>
                      </div>
                    </div>
                    <div className={s("itemRight")}>
                      <StarDisplay rating={fb.rating} />
                      <span className={s("itemDate")}>{formatDate(fb.created_at)}</span>
                      <button
                        className={s("deleteBtn")}
                        onClick={e => handleDelete(fb, e)}
                        title="Delete"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                  <p className={s("itemDesc")}>{fb.description}</p>
                  {fb.admin_response && (
                    <div className={s("response")}>
                      <i className="fa-solid fa-reply" />
                      <span>{fb.admin_response}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className={s("detail")}>
            {!selected ? (
              <div className={s("noSelection")}>
                <i className="fa-solid fa-comment-dots" />
                <p>Select a feedback item to see details.</p>
              </div>
            ) : (() => {
              const cat = CATEGORY_MAP[selected.category];
              const st  = STATUS_MAP[selected.status];
              return (
                <div className={s("detailInner")}>
                  <div className={s("detailHeader")}>
                    <div className={s("detailIcon")} style={{ background: cat.bg, color: cat.color }}>
                      <i className={`fa-solid ${cat.icon}`} />
                    </div>
                    <div>
                      <h2>{selected.title}</h2>
                      <div className={s("detailTags")}>
                        <span className={s("chip")} style={{ background: cat.bg, color: cat.color }}>{cat.label}</span>
                        <span className={s("chip")} style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                    </div>
                  </div>

                  <div className={s("detailMeta")}>
                    <span><i className="fa-solid fa-calendar" /> {formatDate(selected.created_at)}</span>
                    {selected.rating && (
                      <span><StarDisplay rating={selected.rating} /></span>
                    )}
                    <span style={{ color: PRIORITY_MAP[selected.priority].color }}>
                      <i className="fa-solid fa-flag" /> {PRIORITY_MAP[selected.priority].label} Priority
                    </span>
                  </div>

                  <div className={s("detailSection")}>
                    <h4>Description</h4>
                    <p>{selected.description}</p>
                  </div>

                  {selected.admin_response && (
                    <div className={s("adminReply")}>
                      <div className={s("adminReplyHead")}>
                        <i className="fa-solid fa-headset" />
                        <strong>Skoolio Team Response</strong>
                        {selected.responded_at && (
                          <span>{formatDate(selected.responded_at)}</span>
                        )}
                      </div>
                      <p>{selected.admin_response}</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </section>
      </main>

      {/* New Feedback Modal */}
      {showForm && (
        <div className={s("overlay")} onClick={() => setShowForm(false)}>
          <div className={s("modal")} onClick={e => e.stopPropagation()}>
            <div className={s("modalHead")}>
              <h3><i className="fa-solid fa-comment-dots" style={{ color: "#ff9b51", marginRight: 8 }} />New Feedback</h3>
              <button className={s("closeBtn")} onClick={() => setShowForm(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className={s("modalBody")}>

              {/* Category */}
              <div className={s("field")}>
                <label>Category <b>*</b></label>
                <div className={s("catGrid")}>
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                    <button
                      key={k}
                      className={cx(s("catOpt"), form.category === k && s("catOptActive"))}
                      onClick={() => setForm(f => ({ ...f, category: k as FeedbackCategory }))}
                      style={form.category === k ? { borderColor: v.color, background: v.bg, color: v.color } : {}}
                    >
                      <i className={`fa-solid ${v.icon}`} />
                      <span>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating */}
              <div className={s("field")}>
                <label>Overall Rating</label>
                <div className={s("ratingRow")}>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      className={cx(s("starBtn"), form.rating >= n && s("starBtnActive"))}
                      onClick={() => setForm(f => ({ ...f, rating: n }))}
                    >
                      <i className="fa-solid fa-star" />
                    </button>
                  ))}
                  {form.rating > 0 && (
                    <span className={s("ratingHint")}>
                      {["", "Terrible", "Poor", "Okay", "Good", "Excellent"][form.rating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className={s("field")}>
                <label>Title <b>*</b></label>
                <input
                  placeholder="Brief summary of your feedback"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div className={s("field")}>
                <label>Description <b>*</b></label>
                <textarea
                  placeholder="Tell us more — what happened, what you'd like to see improved, or steps to reproduce a bug."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  maxLength={1000}
                />
              </div>

              {/* Priority */}
              <div className={s("field")}>
                <label>Priority</label>
                <div className={s("priorityRow")}>
                  {(["low","medium","high"] as FeedbackPriority[]).map(p => (
                    <button
                      key={p}
                      className={cx(s("prBtn"), form.priority === p && s("prBtnActive"))}
                      onClick={() => setForm(f => ({ ...f, priority: p }))}
                      style={form.priority === p ? { borderColor: PRIORITY_MAP[p].color, color: PRIORITY_MAP[p].color } : {}}
                    >
                      {PRIORITY_MAP[p].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={s("modalFooter")}>
              <button className={cx(s("btn"), s("btnOutline"))} onClick={() => setShowForm(false)}>Cancel</button>
              <button className={cx(s("btn"), s("btnPrimary"))} onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Spinner size={15} color="#fff" /> : <i className="fa-solid fa-paper-plane" />}
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Feedback Confirmation Modal ── */}
      <ConfirmModal
        isOpen={!!feedbackToDelete}
        onClose={() => setFeedbackToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Feedback"
        message={`Are you sure you want to delete "${feedbackToDelete?.title}"? This cannot be undone.`}
        confirmText="Delete Feedback"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="fa-trash-can"
      />
    </div>
  );
}
