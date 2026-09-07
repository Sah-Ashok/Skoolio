"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import ConfirmModal from "@/components/shared/ConfirmModal";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

export default function SuperAdminFeedbackPage() {
  const dispatch = useAppDispatch();

  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter]       = useState("all");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Build query
  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") queryParams.append("status", statusFilter);
  if (catFilter !== "all") queryParams.append("category", catFilter);

  const { data: feedbackList, loading, refetch } = useApi<any[]>(
    `/feedback/super/all?${queryParams.toString()}`,
    [statusFilter, catFilter]
  );
  const { data: stats, refetch: refetchStats } = useApi<any>("/feedback/super/stats");

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    setActionLoading(id);
    try {
      await apiRequest(`/feedback/super/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      dispatch(showToast({ type: "success", title: "Status Updated", message: `Feedback marked as ${newStatus}.` }));
      refetch();
      refetchStats();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to update status." }));
    } finally {
      setActionLoading(null);
    }
  };

  const [feedbackToDelete, setFeedbackToDelete] = useState<any | null>(null);

  const handleConfirmDelete = async () => {
    if (!feedbackToDelete) return;
    try {
      await apiRequest(`/feedback/super/${feedbackToDelete.id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Feedback removed." }));
      refetch();
      refetchStats();
      setFeedbackToDelete(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to delete feedback." }));
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <i
        key={i}
        className={i < rating ? "fa-solid fa-star" : "fa-regular fa-star"}
        style={{ color: i < rating ? "#f59e0b" : "#cbd5e1", fontSize: 13, marginRight: 2 }}
      />
    ));
  };

  const categoryBadge = (cat: string) => {
    const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
      bug: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", label: "Bug Report" },
      feature: { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0", label: "Feature Request" },
      praise: { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa", label: "Praise" },
      general: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe", label: "General" },
    };
    const c = map[cat] || { bg: "#f8fafc", color: "#475569", border: "#e2e8f0", label: cat };
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontSize: 11, fontWeight: 800 }}>
        {c.label}
      </span>
    );
  };

  const statusBadge = (st: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      new: { bg: "#fee2e2", color: "#b91c1c", label: "New" },
      reviewed: { bg: "#fef3c7", color: "#92400e", label: "Reviewed" },
      resolved: { bg: "#dcfce7", color: "#166534", label: "Resolved" },
      dismissed: { bg: "#f1f5f9", color: "#64748b", label: "Dismissed" },
    };
    const c = map[st] || { bg: "#f1f5f9", color: "#64748b", label: st };
    return (
      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: c.bg, color: c.color, fontSize: 11, fontWeight: 800 }}>
        {c.label}
      </span>
    );
  };

  return (
    <div className={s("sa-page")}>
      <Topbar
        title="User Feedback & Ratings Desk"
        subtitle="Review ratings, bug reports, and suggestions from school administrators and teachers"
      />

      <main className={s("page-content")}>

        {/* ── KPI STATS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 20 }}>
          <div style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Total Feedback</span>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>
              {stats?.total ?? (feedbackList?.length || 0)}
            </div>
          </div>

          <div style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Avg Platform Rating</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: "#f59e0b" }}>
                {stats?.avgRating ? Number(stats.avgRating).toFixed(1) : "—"}
              </span>
              <div style={{ display: "flex" }}>
                {renderStars(Math.round(Number(stats?.avgRating || 0)))}
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Pending Review</span>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#dc2626", marginTop: 4 }}>
              {stats?.byStatus?.new ?? 0}
            </div>
          </div>

          <div style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: "1px solid #e2e8f0" }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase" }}>Resolved Items</span>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#16a34a", marginTop: 4 }}>
              {stats?.byStatus?.resolved ?? 0}
            </div>
          </div>
        </div>

        {/* ── FILTER CONTROLS ── */}
        <div style={{ background: "#fff", padding: "14px 18px", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: "#475569" }}>Category:</span>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12.5, fontWeight: 700, background: "#fff" }}
            >
              <option value="all">All Categories</option>
              <option value="bug">Bug Reports</option>
              <option value="feature">Feature Requests</option>
              <option value="praise">Praise</option>
              <option value="general">General</option>
            </select>

            <span style={{ fontSize: 12.5, fontWeight: 800, color: "#475569", marginLeft: 8 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12.5, fontWeight: 700, background: "#fff" }}
            >
              <option value="all">All Statuses</option>
              <option value="new">New (Unreviewed)</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          <button
            onClick={() => { refetch(); refetchStats(); }}
            style={{ padding: "6px 14px", borderRadius: 8, background: "#fff7ed", border: "1.5px solid #ff9148", color: "#ea580c", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
          >
            <i className="fa-solid fa-rotate-right" /> Refresh
          </button>
        </div>

        {/* ── FEEDBACK CARDS LIST ── */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}><Spinner size={32} color="#ff9148" /></div>
        ) : (!feedbackList || feedbackList.length === 0) ? (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "50px 20px", textAlign: "center", color: "#94a3b8" }}>
            <i className="fa-regular fa-comment-dots" style={{ fontSize: 32, marginBottom: 10, color: "#cbd5e1" }} /><br />
            No feedback found matching the current filters.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {feedbackList.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "#ffffff", borderRadius: 14, border: "1px solid #e2e8f0",
                  padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  display: "flex", flexDirection: "column", gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff7ed", border: "1.5px solid #fed7aa", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>
                      {item.user_name ? item.user_name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 13.5, color: "#0f172a" }}>{item.user_name || item.user_email || "User"}</strong>
                        <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "#f1f5f9", color: "#475569", fontWeight: 800, textTransform: "uppercase" }}>
                          {item.role || "User"}
                        </span>
                        {item.school_name && (
                          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                            · {item.school_name}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {categoryBadge(item.category)}
                    {statusBadge(item.status)}
                  </div>
                </div>

                {/* Stars and Message */}
                <div>
                  {item.rating && (
                    <div style={{ marginBottom: 6 }}>
                      {renderStars(item.rating)}
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: 13.5, color: "#334155", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {item.message}
                  </p>
                </div>

                {/* Action Toolbar */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                  {item.status !== "reviewed" && item.status !== "resolved" && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, "reviewed")}
                      disabled={actionLoading === item.id}
                      style={{ padding: "4px 10px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", color: "#b45309", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      <i className="fa-solid fa-eye" /> Mark Reviewed
                    </button>
                  )}

                  {item.status !== "resolved" && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, "resolved")}
                      disabled={actionLoading === item.id}
                      style={{ padding: "4px 10px", borderRadius: 6, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}
                    >
                      <i className="fa-solid fa-check" /> Resolve
                    </button>
                  )}

                  {item.status !== "dismissed" && (
                    <button
                      onClick={() => handleUpdateStatus(item.id, "dismissed")}
                      disabled={actionLoading === item.id}
                      style={{ padding: "4px 10px", borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0", color: "#64748b", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      Dismiss
                    </button>
                  )}

                  <button
                    onClick={() => setFeedbackToDelete(item)}
                    style={{ padding: "4px 8px", borderRadius: 6, background: "#fff", border: "1px solid #fee2e2", color: "#dc2626", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                    title="Delete"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}

      </main>

      {/* Delete Feedback Modal */}
      <ConfirmModal
        isOpen={!!feedbackToDelete}
        onClose={() => setFeedbackToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Feedback"
        message={`Delete feedback from "${feedbackToDelete?.user_name || feedbackToDelete?.school_name || "User"}"? This cannot be undone.`}
        confirmText="Delete Feedback"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="fa-trash-can"
      />
    </div>
  );
}
