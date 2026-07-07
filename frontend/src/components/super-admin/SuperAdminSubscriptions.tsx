"use client";

import { useState } from "react";
import Topbar from "@/components/shared/Topbar";
import styles from "./sa.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

const s = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

const planBadge = (p: string) => {
  const m: Record<string, string> = { Free: "badge-blue", Pro: "badge-violet", Plus: "badge-teal" };
  return s(m[p] ?? "badge-blue");
};

const subStatusBadge = (st: string) => {
  const m: Record<string, string> = {
    active: "badge-green",
    grace_period: "badge-yellow",
    expired: "badge-red",
    cancelled: "badge-red",
  };
  return s(m[st] ?? "badge-blue");
};

type Tab = "subscriptions" | "plans";

export default function SuperAdminSubscriptions() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>("subscriptions");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);

  const { data: schools, loading: schoolsLoading, refetch: refetchSchools } = useApi<any[]>("/subscriptions/schools");
  const { data: plans, loading: plansLoading, refetch: refetchPlans } = useApi<any[]>("/subscriptions/plans/all");

  /* derived stats */
  const total     = schools?.length ?? 0;
  const active    = schools?.filter((s) => s.status === "active").length ?? 0;
  const grace     = schools?.filter((s) => s.status === "grace_period").length ?? 0;
  const expired   = schools?.filter((s) => s.status === "expired" || s.status === "cancelled").length ?? 0;
  const freeCount = schools?.filter((s) => s.plan_name === "Free").length ?? 0;

  const totalRevenueNPR = schools
    ?.filter((s) => s.amount_paid && s.currency === "NPR")
    .reduce((sum: number, s: any) => sum + parseFloat(s.amount_paid || 0), 0) ?? 0;

  const filtered = (schools ?? []).filter((sc) => {
    const q = search.toLowerCase();
    const matchQ = !q || sc.school_name?.toLowerCase().includes(q) || sc.email?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || sc.status === statusFilter;
    return matchQ && matchStatus;
  });

  /* days left helper */
  const daysLeft = (endDate: string | null) => {
    if (!endDate) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
    return diff;
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "subscriptions", label: "Active Subscriptions", icon: "fa-list" },
    { key: "plans",         label: "Plan Tiers",           icon: "fa-layer-group" },
  ];

  return (
    <div className={s("sa-page")}>
      <Topbar title="Subscriptions" subtitle="Manage plans, billing cycles and school renewals" />

      <main className={s("page-content")}>
        {/* Page header */}
        <div className={s("page-head")}>
          <div>
            <h1>Subscription Management</h1>
            <p>All school plans, statuses and revenue in one place.</p>
          </div>
          <div className={s("head-actions")}>
            <button
              className={cx(s("btn"), s("btn-primary"))}
              onClick={() => setCreatingPlan(true)}
            >
              <i className="fa-solid fa-plus" /> New Plan
            </button>
          </div>
        </div>

        {/* Hero summary */}
        <section className={s("hero-cards")}>
          {[
            { tone: "g1", icon: "fa-building-columns",   label: "Total Schools",    value: total,    sub: "On any plan" },
            { tone: "g2", icon: "fa-circle-check",       label: "Active",           value: active,   sub: "Subscription current" },
            { tone: "g3", icon: "fa-clock",              label: "Grace Period",      value: grace,    sub: "Needs renewal" },
            { tone: "g4", icon: "fa-indian-rupee-sign",  label: "Revenue (NPR)",    value: totalRevenueNPR ? `₹${(totalRevenueNPR / 100000).toFixed(1)}L` : "—", sub: "All time" },
          ].map((c) => (
            <article className={cx(s("hero-card"), s(c.tone))} key={c.label}>
              <div className={s("hc-icon")}><i className={`fa-solid ${c.icon}`} /></div>
              <div className={s("hc-label")}>{c.label}</div>
              <div className={s("hc-value")}>{c.value}</div>
              <div className={s("hc-sub")}>{c.sub}</div>
            </article>
          ))}
        </section>

        {/* Secondary stats */}
        <section className={s("stats-row")}>
          {[
            { tone: "violet", icon: "fa-credit-card",          label: "Paid Plans",       value: active + grace },
            { tone: "amber",  icon: "fa-triangle-exclamation", label: "Expiring (≤7d)",   value: schools?.filter((sc) => { const d = daysLeft(sc.end_date); return d !== null && d <= 7 && d >= 0; }).length ?? 0 },
            { tone: "rose",   icon: "fa-ban",                  label: "Expired / Cancelled", value: expired },
            { tone: "teal",   icon: "fa-circle-half-stroke",   label: "On Free Plan",     value: freeCount },
          ].map((c) => (
            <article className={s("stat-card")} key={c.label}>
              <div className={cx(s("stat-icon"), s(c.tone))}>
                <i className={`fa-solid ${c.icon}`} />
              </div>
              <div>
                <p>{c.label}</p>
                <strong>{c.value}</strong>
              </div>
            </article>
          ))}
        </section>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid rgba(191,201,209,0.5)" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 20px",
                fontSize: 13.5, fontWeight: 800,
                border: "none", background: "none", cursor: "pointer",
                color: tab === t.key ? "#ff9b51" : "#6b7b86",
                borderBottom: tab === t.key ? "2px solid #ff9b51" : "2px solid transparent",
                marginBottom: -2,
                display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <i className={`fa-solid ${t.icon}`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── SUBSCRIPTIONS TAB ── */}
        {tab === "subscriptions" && (
          <>
            {/* Toolbar */}
            <section className={cx(s("card"), s("toolbar"))}>
              <label className={s("search-field")}>
                <i className="fa-solid fa-magnifying-glass" />
                <input
                  type="search"
                  placeholder="Search school name or email…"
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
              <button
                className={cx(s("btn"), s("btn-soft"), s("btn-sm"))}
                onClick={refetchSchools}
              >
                <i className="fa-solid fa-rotate" /> Refresh
              </button>
            </section>

            <section className={s("card")}>
              <div className={s("card-head")}>
                <div>
                  <h3>School Subscriptions</h3>
                  <p>Showing {filtered.length} of {total} schools</p>
                </div>
              </div>
              <div className={s("table-wrap")}>
                {schoolsLoading ? (
                  <div style={{ padding: "3rem", textAlign: "center" }}>
                    <Spinner size={32} color="#ff9b51" />
                  </div>
                ) : (
                  <table className={s("table")}>
                    <thead>
                      <tr>
                        <th>School</th>
                        <th>Plan</th>
                        <th>Billing</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Days Left</th>
                        <th>Account</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((sc) => {
                        const dl = daysLeft(sc.end_date);
                        const urgent = dl !== null && dl <= 7 && dl >= 0;
                        return (
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
                            <td>
                              <span className={cx(s("badge"), planBadge(sc.plan_name))}>
                                {sc.plan_name ?? "Free"}
                              </span>
                            </td>
                            <td style={{ textTransform: "capitalize", color: "#6b7b86", fontSize: 13 }}>
                              {sc.billing_cycle ?? "free"}
                            </td>
                            <td>
                              <span
                                className={cx(s("badge"), subStatusBadge(sc.status))}
                                style={{ textTransform: "capitalize" }}
                              >
                                {sc.status?.replace("_", " ") ?? "active"}
                              </span>
                            </td>
                            <td style={{ color: "#6b7b86", fontSize: 13 }}>
                              {sc.end_date
                                ? new Date(sc.end_date).toLocaleDateString()
                                : "Never"}
                            </td>
                            <td>
                              {dl === null ? (
                                <span style={{ color: "#6b7b86", fontSize: 12 }}>∞</span>
                              ) : (
                                <span
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 13,
                                    color: urgent ? "#be123c" : dl > 30 ? "#15803d" : "#b45309",
                                  }}
                                >
                                  {urgent && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />}
                                  {dl}d
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={cx(
                                  s("badge"),
                                  sc.is_account === "blocked" ? s("badge-red") : s("badge-green")
                                )}
                                style={{ textTransform: "capitalize" }}
                              >
                                {sc.is_account}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: "#6b7b86" }}>
                            No subscriptions found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}

        {/* ── PLANS TAB ── */}
        {tab === "plans" && (
          <>
            {plansLoading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}>
                <Spinner size={32} color="#ff9b51" />
              </div>
            ) : (
              <section className={s("three-col")}>
                {(plans ?? []).map((plan, i) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    featured={i === 1}
                    onEdit={() => setEditingPlan(plan)}
                    schoolCount={
                      schools?.filter((sc) => sc.plan_name === plan.name && sc.status === "active").length ?? 0
                    }
                  />
                ))}
              </section>
            )}
          </>
        )}
      </main>

      {/* Plan edit modal */}
      {editingPlan && (
        <PlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => { setEditingPlan(null); refetchPlans(); }}
        />
      )}
      {creatingPlan && (
        <PlanModal
          plan={null}
          onClose={() => setCreatingPlan(false)}
          onSaved={() => { setCreatingPlan(false); refetchPlans(); }}
        />
      )}
    </div>
  );
}

/* ── Plan Card ──────────────────────────────────────────────────── */
function PlanCard({
  plan,
  featured,
  onEdit,
  schoolCount,
}: {
  plan: any;
  featured: boolean;
  onEdit: () => void;
  schoolCount: number;
}) {
  const s = (c: string) => styles[c] ?? c;
  const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

  const features: string[] = [];
  if (plan.max_students) features.push(`Up to ${plan.max_students} students`);
  else features.push("Unlimited students");
  if (plan.max_teachers) features.push(`Up to ${plan.max_teachers} teachers`);
  else features.push("Unlimited teachers");
  if (plan.fee_management_enabled) features.push("Fee management enabled");
  features.push(`NPR ${plan.price_npr_monthly}/mo or ${plan.price_npr_yearly}/yr`);
  features.push(`INR ${plan.price_inr_monthly}/mo or ${plan.price_inr_yearly}/yr`);

  return (
    <article className={cx(s("plan-card"), featured ? s("featured") : undefined)}>
      <p className={s("plan-kicker")}>{plan.name}</p>
      <div className={s("plan-price")}>
        ₹{plan.price_npr_monthly}
        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>/mo</span>
      </div>
      <p className={s("plan-sub")}>{schoolCount} school{schoolCount !== 1 ? "s" : ""} active</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
        {features.map((f) => (
          <div className={s("plan-feature")} key={f}>
            <i className="fa-solid fa-check" />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button
          className={cx(s("btn"), s("btn-sm"), featured ? undefined : s("btn-soft"))}
          style={
            featured
              ? { flex: 1, background: "rgba(255,255,255,0.18)", color: "#fff" }
              : { flex: 1 }
          }
          onClick={onEdit}
        >
          <i className="fa-solid fa-pen" /> Edit Plan
        </button>
        <span
          className={cx(s("badge"), plan.is_active ? s("badge-green") : s("badge-red"))}
          style={{ alignSelf: "center" }}
        >
          {plan.is_active ? "Active" : "Inactive"}
        </span>
      </div>
    </article>
  );
}

/* ── Plan Create / Edit Modal ───────────────────────────────────── */
function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const isEdit = !!plan;
  const { execute, loading } = useMutation(
    isEdit ? `/subscriptions/plans/${plan?.id}` : "/subscriptions/plans",
    isEdit ? "PATCH" : "POST"
  );

  const s = (c: string) => styles[c] ?? c;
  const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

  const [form, setForm] = useState({
    name: plan?.name ?? "",
    max_students: plan?.max_students ?? "",
    max_teachers: plan?.max_teachers ?? "",
    fee_management_enabled: plan?.fee_management_enabled ?? true,
    price_npr_monthly: plan?.price_npr_monthly ?? "",
    price_npr_yearly: plan?.price_npr_yearly ?? "",
    price_inr_monthly: plan?.price_inr_monthly ?? "",
    price_inr_yearly: plan?.price_inr_yearly ?? "",
    is_active: plan?.is_active ?? true,
  });

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      dispatch(showToast({ type: "error", title: "Error", message: "Plan name is required" }));
      return;
    }
    try {
      await execute({
        ...form,
        max_students: form.max_students ? parseInt(form.max_students) : null,
        max_teachers: form.max_teachers ? parseInt(form.max_teachers) : null,
        price_npr_monthly: parseFloat(form.price_npr_monthly) || 0,
        price_npr_yearly: parseFloat(form.price_npr_yearly) || 0,
        price_inr_monthly: parseFloat(form.price_inr_monthly) || 0,
        price_inr_yearly: parseFloat(form.price_inr_yearly) || 0,
      });
      dispatch(showToast({ type: "success", title: isEdit ? "Updated" : "Created", message: `Plan "${form.name}" saved.` }));
      onSaved();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to save plan" }));
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 540, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(15,23,42,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid rgba(191,201,209,0.42)" }}>
          <h2 style={{ fontSize: 17, fontWeight: 900 }}>{isEdit ? "Edit Plan" : "Create New Plan"}</h2>
          <p style={{ fontSize: 12.5, color: "#6b7b86", marginTop: 3 }}>
            {isEdit ? `Editing: ${plan.name}` : "Fill in plan details"}
          </p>
        </div>

        <div className={s("form-body")}>
          <div className={s("field")}>
            <label>Plan Name</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pro" />
          </div>

          <div className={s("form-grid-2")}>
            <div className={s("field")}>
              <label>Max Students <span style={{ color: "#6b7b86", fontWeight: 600 }}>(blank = unlimited)</span></label>
              <input type="number" value={form.max_students} onChange={(e) => set("max_students", e.target.value)} placeholder="e.g. 500" />
            </div>
            <div className={s("field")}>
              <label>Max Teachers <span style={{ color: "#6b7b86", fontWeight: 600 }}>(blank = unlimited)</span></label>
              <input type="number" value={form.max_teachers} onChange={(e) => set("max_teachers", e.target.value)} placeholder="e.g. 30" />
            </div>
          </div>

          <p style={{ fontSize: 12.5, fontWeight: 900, color: "#6b7b86", marginBottom: -8 }}>NPR Pricing</p>
          <div className={s("form-grid-2")}>
            <div className={s("field")}>
              <label>Monthly (NPR)</label>
              <input type="number" value={form.price_npr_monthly} onChange={(e) => set("price_npr_monthly", e.target.value)} placeholder="0" />
            </div>
            <div className={s("field")}>
              <label>Yearly (NPR)</label>
              <input type="number" value={form.price_npr_yearly} onChange={(e) => set("price_npr_yearly", e.target.value)} placeholder="0" />
            </div>
          </div>

          <p style={{ fontSize: 12.5, fontWeight: 900, color: "#6b7b86", marginBottom: -8 }}>INR Pricing</p>
          <div className={s("form-grid-2")}>
            <div className={s("field")}>
              <label>Monthly (INR)</label>
              <input type="number" value={form.price_inr_monthly} onChange={(e) => set("price_inr_monthly", e.target.value)} placeholder="0" />
            </div>
            <div className={s("field")}>
              <label>Yearly (INR)</label>
              <input type="number" value={form.price_inr_yearly} onChange={(e) => set("price_inr_yearly", e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              { key: "fee_management_enabled", label: "Fee Management Enabled", desc: "Schools on this plan can use the fee module" },
              { key: "is_active",              label: "Plan Active",             desc: "Inactive plans are hidden from school admins" },
            ].map((t) => (
              <div key={t.key} className={s("toggle-row")}>
                <div className={s("toggle-info")}>
                  <p>{t.label}</p>
                  <span>{t.desc}</span>
                </div>
                <button
                  className={cx(s("toggle"), (form as any)[t.key] ? s("toggle-on") : s("toggle-off"))}
                  onClick={() => set(t.key, !(form as any)[t.key])}
                />
              </div>
            ))}
          </div>
        </div>

        <div className={s("form-actions")}>
          <button className={cx(s("btn"), s("btn-soft"))} onClick={onClose}>Cancel</button>
          <button className={cx(s("btn"), s("btn-primary"))} onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size={16} /> : <><i className="fa-solid fa-floppy-disk" /> {isEdit ? "Save Changes" : "Create Plan"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
