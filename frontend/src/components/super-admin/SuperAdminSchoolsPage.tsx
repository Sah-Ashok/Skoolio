"use client";

import { useState, useMemo } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useRouter } from "next/navigation";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

const planBadge = (p: string) => {
  const m: Record<string, string> = { Free: "badge-blue", Pro: "badge-violet", Plus: "badge-teal" };
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
        {/* Page header */}
        <div className={s("page-head")}>
          <div>
            <h1>All Schools</h1>
            <p>Every school on the platform — view, activate, or manage their plan.</p>
          </div>
        </div>

        {/* Hero stat cards */}
        <section className={s("hero-cards")}>
          {[
            { tone: "g1", icon: "fa-building-columns",  label: "Total Schools",      value: total   },
            { tone: "g2", icon: "fa-circle-check",       label: "Active Plans",       value: active  },
            { tone: "g3", icon: "fa-hourglass-half",     label: "Grace Period",       value: grace   },
            { tone: "g4", icon: "fa-ban",                label: "Expired / Cancelled",value: expired },
          ].map((c) => (
            <article className={cx(s("hero-card"), s(c.tone))} key={c.label}>
              <div className={s("hc-icon")}><i className={`fa-solid ${c.icon}`} /></div>
              <div className={s("hc-label")}>{c.label}</div>
              <div className={s("hc-value")}>{c.value}</div>
              <div className={s("hc-sub")}>{freePlan} on free plan</div>
            </article>
          ))}
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>

            <select
              className={s("filter-field")}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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
              onChange={(e) => setPlanFilter(e.target.value)}
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
                Showing <strong>{filteredSchools.length}</strong> of {total} schools
              </p>
            </div>
          </div>

          <div className={s("table-wrap")}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <Spinner size={32} color="#FF9B51" />
              </div>
            ) : (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Country</th>
                    <th>Plan</th>
                    <th>Sub Status</th>
                    <th>Expires</th>
                    <th>Verified</th>
                    <th>Account</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.map((sc) => (
                    <tr key={sc.school_id}>
                      <td>
                        <div className={s("avatar-cell")}>
                          <div className={s("avatar")}>{sc.school_name?.charAt(0)}</div>
                          <div>
                            <strong>{sc.school_name}</strong>
                            <span>{sc.email}</span>
                          </div>
                        </div>
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
                          : <span style={{ color: "#0f766e", fontWeight: 700 }}>Never (Free)</span>}
                      </td>
                      <td>
                        <span
                          className={cx(s("badge"), sc.is_verified ? s("badge-green") : s("badge-yellow"))}
                        >
                          {sc.is_verified ? <><i className="fa-solid fa-circle-check" /> Verified</> : <><i className="fa-solid fa-clock" /> Pending</>}
                        </span>
                      </td>
                      <td>
                        <span
                          className={cx(s("badge"), accountBadge(sc.is_account))}
                          style={{ textTransform: "capitalize" }}
                        >
                          {sc.is_account}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {!sc.is_verified && (
                            <button
                              className={cx(s("btn"), s("btn-sm"), s("btn-success"))}
                              onClick={() => handleVerify(sc)}
                              disabled={actionLoading === sc.school_id}
                              title="Verify this school so they can log in"
                            >
                              {actionLoading === sc.school_id
                                ? <Spinner size={12} />
                                : <><i className="fa-solid fa-circle-check" /> Verify</>
                              }
                            </button>
                          )}
                          <button
                            className={cx(s("btn"), s("btn-sm"), s("btn-primary"))}
                            onClick={() => setActivating(sc)}
                          >
                            <i className="fa-solid fa-rotate" /> Activate
                          </button>
                          <button
                            className={cx(s("btn"), s("btn-sm"), s("btn-soft"))}
                            onClick={() => router.push(`/super-admin/schools/${sc.school_id}/history`)}
                            title="Subscription history"
                          >
                            <i className="fa-solid fa-clock-rotate-left" />
                          </button>
                          <button
                            className={cx(s("btn"), s("btn-sm"), sc.is_account === 'blocked' ? s("btn-soft") : s("btn-danger"))}
                            onClick={() => handleBlockUnblock(sc)}
                            disabled={actionLoading === sc.school_id}
                            title={sc.is_account === 'blocked' ? 'Unblock school' : 'Block school'}
                          >
                            {actionLoading === sc.school_id
                              ? <Spinner size={12} />
                              : <><i className={`fa-solid ${sc.is_account === 'blocked' ? 'fa-lock-open' : 'fa-ban'}`} /> {sc.is_account === 'blocked' ? 'Unblock' : 'Block'}</>
                            }
                          </button>
                          <button
                            className={cx(s("btn"), s("btn-sm"), sc.two_fa_enabled ? s("btn-soft") : s("btn-outline"))}
                            onClick={() => handleToggle2FA(sc)}
                            disabled={actionLoading === sc.school_id}
                            title={sc.two_fa_enabled ? 'Disable 2FA' : 'Enable 2FA'}
                          >
                            <i className={`fa-solid fa-shield-${sc.two_fa_enabled ? 'halved' : 'blank'}`} />
                            {sc.two_fa_enabled ? '2FA On' : '2FA Off'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredSchools.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "#6b7b86" }}>
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


