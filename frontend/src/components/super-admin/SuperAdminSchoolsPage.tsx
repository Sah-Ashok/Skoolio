"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useRouter } from "next/navigation";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

const planBadge = (p: string) => {
  const m: Record<string, string> = { Free: "badge-blue", Pro: "badge-violet", Plus: "badge-teal", Ultra: "badge-yellow" };
  return s(m[p] ?? "badge-blue");
};

const subStatusBadge = (st: string) => {
  const m: Record<string, string> = {
    active: "badge-green", grace_period: "badge-yellow",
    expired: "badge-red",  cancelled: "badge-red",
  };
  return s(m[st] ?? "badge-blue");
};

const accountBadge = (acc: string) => (acc === "blocked" ? s("badge-red") : s("badge-green"));

/* ─────────────────────────────────────────── */
export default function SuperAdminSchoolsPage() {
  const { data: schools, loading, refetch } = useApi<any[]>("/subscriptions/schools");
  const { data: plans }                     = useApi<any[]>("/subscriptions/plans/all");

  const dispatch = useAppDispatch();
  const router = useRouter();

  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter]     = useState("all");
  const [activating, setActivating]     = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageSize, setPageSize]         = useState(10);

  const handleVerify = async (sc: any) => {
    setActionLoading(sc.school_id);
    try {
      await apiRequest(`/school/${sc.school_id}/verify`, { method: 'PATCH' });
      dispatch(showToast({
        type: 'success',
        title: 'School Verified',
        message: `${sc.school_name} is now verified and can log in.`,
      }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: err.message || 'Could not verify school.' }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockUnblock = async (sc: any) => {
    const action = sc.is_account === 'blocked' ? 'unblock' : 'block';
    setActionLoading(sc.school_id);
    try {
      await apiRequest(`/school/${sc.school_id}/${action}`, { method: 'PATCH' });
      dispatch(showToast({
        type: action === 'block' ? 'error' : 'success',
        title: action === 'block' ? 'School Blocked' : 'School Unblocked',
        message: `${sc.school_name} has been ${action === 'block' ? 'blocked' : 'unblocked'}.`,
      }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: err.message || `Could not ${action} school.` }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle2FA = async (sc: any) => {
    const enable = !sc.two_fa_enabled;
    setActionLoading(sc.school_id);
    try {
      await apiRequest(`/school/${sc.school_id}/toggle-2fa`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: enable }),
      });
      dispatch(showToast({
        type: 'success',
        title: enable ? '2FA Enabled' : '2FA Disabled',
        message: `Two-factor authentication has been ${enable ? 'enabled' : 'disabled'} for ${sc.school_name}.`,
      }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: err.message || 'Could not update 2FA.' }));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredSchools = useMemo(() => {
    return (schools || []).filter((sc) => {
      const q = search.toLowerCase();
      const matchSearch =
        sc.school_name?.toLowerCase().includes(q) ||
        sc.email?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || sc.status === statusFilter;
      const matchPlan   = planFilter   === "all" || sc.plan_name === planFilter;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [schools, search, statusFilter, planFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSchools.length / pageSize));
  const paginatedSchools = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchools.slice(start, start + pageSize);
  }, [filteredSchools, currentPage, pageSize]);

  const total    = schools?.length || 0;
  const active   = schools?.filter((sc) => sc.status === "active").length        || 0;
  const grace    = schools?.filter((sc) => sc.status === "grace_period").length  || 0;
  const expired  = schools?.filter((sc) => sc.status === "expired" || sc.status === "cancelled").length || 0;
  const freePlan = schools?.filter((sc) => sc.plan_name === "Free").length       || 0;

  const uniquePlans = Array.from(
    new Set((schools || []).map((sc: any) => sc.plan_name).filter(Boolean))
  ) as string[];

  return (
    <div className={s("sa-page")}>
      <Topbar title="Schools" subtitle="Manage all registered schools and their subscriptions" />

      <main className={s("page-content")}>
        {/* KPI stat cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {/* Card 1: Total Schools */}
          <div style={{ background: "#ffffff", borderRadius: 14, padding: "18px 20px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>Total Tenants</span>
                <h3 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{total}</h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fff7ed", border: "1.5px solid #fed7aa", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className="fa-solid fa-building-columns" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#ea580c", background: "#fff7ed", padding: "2px 7px", borderRadius: 6, border: "1px solid #fed7aa" }}>
                {active} Active
              </span>
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>
                {schools?.filter((sc) => sc.plan_name === "Pro").length || 0} Pro · {schools?.filter((sc) => sc.plan_name === "Plus").length || 0} Plus · {schools?.filter((sc) => sc.plan_name === "Ultra").length || 0} Ultra
              </span>
            </div>
          </div>

          {/* Card 2: Active Plans */}
          <div style={{ background: "#ffffff", borderRadius: 14, padding: "18px 20px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>Active Subscriptions</span>
                <h3 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{active}</h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", border: "1.5px solid #bbf7d0", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className="fa-solid fa-circle-check" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#16a34a", background: "#f0fdf4", padding: "2px 7px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                {total > 0 ? Math.round((active / total) * 100) : 0}% Active
              </span>
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Good standing</span>
            </div>
          </div>

          {/* Card 3: Grace Period */}
          <div style={{ background: "#ffffff", borderRadius: 14, padding: "18px 20px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>Grace Period</span>
                <h3 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{grace}</h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fffbeb", border: "1.5px solid #fde68a", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className="fa-solid fa-hourglass-half" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: grace === 0 ? "#16a34a" : "#b45309", background: grace === 0 ? "#f0fdf4" : "#fffbeb", padding: "2px 7px", borderRadius: 6, border: `1px solid ${grace === 0 ? "#bbf7d0" : "#fde68a"}` }}>
                {grace === 0 ? "All Healthy" : "Renewal Needed"}
              </span>
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Expired before lockout</span>
            </div>
          </div>

          {/* Card 4: Action Required (Unverified or Blocked) */}
          <div style={{ background: "#ffffff", borderRadius: 14, padding: "18px 20px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>Review Required</span>
                <h3 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
                  {(schools || []).filter(s => !s.is_verified || s.is_account === 'blocked').length}
                </h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef2f2", border: "1.5px solid #fca5a5", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className="fa-solid fa-shield-halved" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626", background: "#fef2f2", padding: "2px 7px", borderRadius: 6, border: "1px solid #fca5a5" }}>
                {(schools || []).filter(s => !s.is_verified).length} Unverified
              </span>
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{(schools || []).filter(s => s.is_account === 'blocked').length} Blocked</span>
            </div>
          </div>
        </section>

        {/* Table card */}
        <section className={s("card")}>
          {/* Toolbar */}
          <div className={s("toolbar")}>
            <label className={s("search-field")}>
              <i className="fa-solid fa-magnifying-glass" />
              <input
                type="search"
                placeholder="Search by school name or email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </label>

            <select
              className={s("filter-field")}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="grace_period">Grace Period</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className={s("filter-field")}
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Plans</option>
              {uniquePlans.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Sub-header */}
          <div className={s("card-head")} style={{ borderTop: "1px solid rgba(191,201,209,0.42)" }}>
            <div>
              <h3>School Directory</h3>
              <p>
                Showing <strong>{filteredSchools.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredSchools.length)}</strong> of <strong>{filteredSchools.length}</strong> schools {filteredSchools.length !== total && `(filtered from ${total})`}
              </p>
            </div>
          </div>

          <div className={s("table-wrap")}>
            {loading ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                <Loader fullScreen={false} size="md" text="Loading schools…" />
              </div>
            ) : (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center" }}>#</th>
                    <th>School</th>
                    <th>Country</th>
                    <th>Plan</th>
                    <th>Sub Status</th>
                    <th>Expires</th>
                    <th>Verified</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSchools.map((sc, idx) => (
                    <tr key={sc.school_id}>
                      <td style={{ textAlign: "center", color: "#64748b", fontWeight: 700, fontSize: 12.5 }}>
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td>
                        <Link
                          href={`/super-admin/schools/${sc.school_id}`}
                          style={{ textDecoration: "none" }}
                        >
                          <div>
                            <strong style={{ color: "#0f172a", display: "flex", alignItems: "center", gap: 5, fontSize: 13.5 }}>
                              {sc.school_name}
                              <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 10, color: "#94a3b8" }} />
                            </strong>
                            <span style={{ fontSize: 12, color: "#64748b" }}>{sc.email}</span>
                          </div>
                        </Link>
                      </td>
                      <td style={{ color: "#6b7b86" }}>{sc.country || "—"}</td>
                      <td>
                        <span className={cx(s("badge"), planBadge(sc.plan_name))}>
                          {sc.plan_name || "Free"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={cx(s("badge"), subStatusBadge(sc.status))}
                          style={{ textTransform: "capitalize" }}
                        >
                          {sc.status?.replace("_", " ") || "active"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "#6b7b86" }}>
                        {sc.end_date
                          ? new Date(sc.end_date).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })
                          : <span style={{ color: "#94a3b8", fontWeight: 600 }}>Pending</span>}
                      </td>
                      <td>
                        <span
                          className={cx(s("badge"), sc.is_verified ? s("badge-green") : s("badge-yellow"))}
                        >
                          {sc.is_verified ? <><i className="fa-solid fa-circle-check" /> Verified</> : <><i className="fa-solid fa-clock" /> Pending</>}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/super-admin/schools/${sc.school_id}`}
                          style={{
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 14px",
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: 12.5,
                            color: "#ea580c",
                            background: "#fff7ed",
                            border: "1.5px solid #ff9148",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <i className="fa-solid fa-circle-info" /> Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredSchools.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "#6b7b86" }}>
                        <i
                          className="fa-solid fa-building-columns"
                          style={{ fontSize: 28, marginBottom: 8, display: "block", opacity: 0.3 }}
                        />
                        No schools match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Pagination Footer Bar ── */}
          {filteredSchools.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderTop: "1px solid #e2e8f0",
                fontSize: 13,
                color: "#64748b",
                flexWrap: "wrap",
                gap: 12,
                background: "#fafafa",
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
              }}
            >
              {/* Range & Per-page selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span>
                  Showing{" "}
                  <strong style={{ color: "#0f172a" }}>
                    {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredSchools.length)}
                  </strong>{" "}
                  of <strong style={{ color: "#0f172a" }}>{filteredSchools.length}</strong>
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                  <span>Rows:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      fontSize: 12,
                      color: "#334155",
                      fontWeight: 700,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>

              {/* Prev / Page Pills / Next */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: currentPage === 1 ? "#f1f5f9" : "#fff",
                    color: currentPage === 1 ? "#94a3b8" : "#334155",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <i className="fa-solid fa-chevron-left" style={{ fontSize: 10 }} /> Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                  })
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && page - prev > 1;
                    return (
                      <span key={page} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {showEllipsis && <span style={{ color: "#94a3b8", padding: "0 2px" }}>…</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          style={{
                            minWidth: 32,
                            height: 32,
                            borderRadius: 6,
                            border: page === currentPage ? "1.5px solid #ff9148" : "1px solid #cbd5e1",
                            background: page === currentPage ? "#fff7ed" : "#fff",
                            color: page === currentPage ? "#ea580c" : "#334155",
                            fontSize: 12.5,
                            fontWeight: page === currentPage ? 900 : 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {page}
                        </button>
                      </span>
                    );
                  })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || filteredSchools.length === 0}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: currentPage === totalPages || filteredSchools.length === 0 ? "#f1f5f9" : "#fff",
                    color: currentPage === totalPages || filteredSchools.length === 0 ? "#94a3b8" : "#334155",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: currentPage === totalPages || filteredSchools.length === 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Next <i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {activating && (
        <ActivateSubscriptionModal
          school={activating}
          plans={plans || []}
          onClose={() => setActivating(null)}
          onActivated={() => { setActivating(null); refetch(); }}
        />
      )}
    </div>
  );
}

/* ── Activate Subscription Modal ─────────────────── */
function ActivateSubscriptionModal({
  school, plans, onClose, onActivated,
}: {
  school: any; plans: any[];
  onClose: () => void; onActivated: () => void;
}) {
  const dispatch = useAppDispatch();
  const { execute: activate, loading } = useMutation("/subscriptions/activate", "POST");

  const [planId, setPlanId]         = useState(school.plan_id?.toString() || "");
  const [cycle, setCycle]           = useState<"monthly" | "yearly" | "free">("monthly");
  const [amount, setAmount]         = useState("");
  const [currency, setCurrency]     = useState<"NPR" | "INR">(school.country === "India" ? "INR" : "NPR");
  const [startDate, setStartDate]   = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate]       = useState("");
  const [payMethod, setPayMethod]   = useState("bank_transfer");
  const [payRef, setPayRef]         = useState("");
  const [notes, setNotes]           = useState("");

  const selectedPlan = plans.find((p) => p.id.toString() === planId);

  const suggested = selectedPlan
    ? currency === "NPR"
      ? cycle === "yearly" ? selectedPlan.price_npr_yearly : selectedPlan.price_npr_monthly
      : cycle === "yearly" ? selectedPlan.price_inr_yearly : selectedPlan.price_inr_monthly
    : 0;

  const handlePlanCycleChange = (newPlanId: string, newCycle: typeof cycle) => {
    setPlanId(newPlanId);
    setCycle(newCycle);
    const plan = plans.find((p) => p.id.toString() === newPlanId);
    if (plan && newCycle !== "free") {
      const price =
        currency === "NPR"
          ? newCycle === "yearly" ? plan.price_npr_yearly : plan.price_npr_monthly
          : newCycle === "yearly" ? plan.price_inr_yearly : plan.price_inr_monthly;
      setAmount(price.toString());
    }
    if (newCycle !== "free") {
      const s = new Date(startDate);
      const e = new Date(s);
      newCycle === "yearly" ? e.setFullYear(e.getFullYear() + 1) : e.setMonth(e.getMonth() + 1);
      setEndDate(e.toISOString().split("T")[0]);
    } else {
      setEndDate("");
    }
  };

  const handleSubmit = async () => {
    if (!planId) {
      dispatch(showToast({ type: "error", title: "Error", message: "Please select a plan" }));
      return;
    }
    if (cycle !== "free" && !endDate) {
      dispatch(showToast({ type: "error", title: "Error", message: "End date is required for paid plans" }));
      return;
    }
    try {
      await activate({
        school_id: school.school_id,
        plan_id: parseInt(planId),
        billing_cycle: cycle,
        amount_paid: cycle === "free" ? 0 : parseFloat(amount || "0"),
        currency: cycle === "free" ? undefined : currency,
        start_date: startDate,
        end_date: cycle === "free" ? undefined : endDate,
        payment_method: cycle === "free" ? undefined : payMethod,
        payment_reference: payRef || undefined,
        notes: notes || undefined,
      });
      dispatch(showToast({
        type: "success", title: "Activated",
        message: `${school.school_name} is now on the ${selectedPlan?.name} plan.`,
      }));
      onActivated();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message || "Failed to activate" }));
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520,
          maxHeight: "90vh", overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(191,201,209,0.42)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 900 }}>Activate Subscription</h2>
            <p style={{ fontSize: 12.5, color: "#6b7b86", marginTop: 3 }}>{school.school_name}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#6b7b86" }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "grid", gap: 14 }}>
          {/* Plan */}
          <div className={cx(s("field"))}>
            <label>Plan</label>
            <select
              value={planId}
              onChange={(e) => handlePlanCycleChange(e.target.value, cycle)}
            >
              <option value="">Select a plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className={s("form-grid-2")}>
            <div className={s("field")}>
              <label>Billing Cycle</label>
              <select value={cycle} onChange={(e) => handlePlanCycleChange(planId, e.target.value as typeof cycle)}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="free">Free (downgrade)</option>
              </select>
            </div>
            <div className={s("field")}>
              <label>Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "NPR" | "INR")}
                disabled={cycle === "free"}
              >
                <option value="NPR">NPR</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>

          {cycle !== "free" && (
            <>
              <div className={s("field")}>
                <label>
                  Amount Paid
                  {suggested > 0 && (
                    <span style={{ fontWeight: 600, color: "#6b7b86", marginLeft: 6 }}>
                      (suggested: {suggested})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <div className={s("form-grid-2")}>
                <div className={s("field")}>
                  <label>Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className={s("field")}>
                  <label>End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className={s("field")}>
                <label>Payment Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div className={s("field")}>
                <label>Payment Reference <span style={{ fontWeight: 600, color: "#6b7b86" }}>(optional)</span></label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Transaction ID / receipt"
                />
              </div>
            </>
          )}

          <div className={s("field")}>
            <label>Notes <span style={{ fontWeight: 600, color: "#6b7b86" }}>(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className={s("form-actions")}>
          <button className={cx(s("btn"), s("btn-soft"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={16} /> : <><i className="fa-solid fa-rotate" /> Activate</>}
          </button>
        </div>
      </div>
    </div>
  );
}


