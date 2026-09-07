"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./sa.module.css";
import { useApi, useMutation } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { apiRequest } from "@/lib/api";
import OfferModal, { computeSavingText } from "./OfferModal";
import ConfirmModal from "@/components/shared/ConfirmModal";

const s  = (c: string) => styles[c] ?? c;
const cx = (...cs: (string | false | undefined)[]) => cs.filter(Boolean).join(" ");

const PLAN_BADGE: Record<string, string> = { Pro: "badge-violet", Plus: "badge-teal", Ultra: "badge-amber" };
const SUB_BADGE:  Record<string, string> = {
  active: "badge-green", grace_period: "badge-yellow",
  expired: "badge-red",  cancelled: "badge-red",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active", grace_period: "Grace Period", expired: "Expired", cancelled: "Cancelled",
};

type Tab = "subscriptions" | "plans" | "offers";

export default function SuperAdminSubscriptions() {
  const dispatch = useAppDispatch();
  const router   = useRouter();

  const [tab,           setTab          ] = useState<Tab>("subscriptions");
  const [search,        setSearch       ] = useState("");
  const [statusFilter,  setStatusFilter ] = useState("all");
  const [activating,    setActivating   ] = useState<any | null>(null);
  const [editingOffer,  setEditingOffer ] = useState<any | null>(null);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [currentPage,   setCurrentPage  ] = useState(1);
  const [pageSize,      setPageSize     ] = useState(10);

  const { data: schools, loading: schoolsL, refetch: refetchSchools } = useApi<any[]>("/subscriptions/schools");
  const { data: plans,   loading: plansL,   refetch: refetchPlans   } = useApi<any[]>("/subscriptions/plans/all");
  const { data: offers,  loading: offersL,  refetch: refetchOffers  } = useApi<any[]>("/subscriptions/offers/all");

  const total   = schools?.length ?? 0;
  const active  = schools?.filter(sc => sc.status === "active").length       ?? 0;
  const grace   = schools?.filter(sc => sc.status === "grace_period").length ?? 0;
  const expired = schools?.filter(sc => ["expired","cancelled"].includes(sc.status)).length ?? 0;
  const revenueNPR = schools
    ?.filter(sc => sc.amount_paid && sc.currency === "NPR")
    .reduce((sum: number, sc: any) => sum + parseFloat(sc.amount_paid || 0), 0) ?? 0;
  const activeOffersCount = (offers ?? []).filter(o => o.is_active).length;

  const daysLeft = (end: string | null) =>
    end ? Math.ceil((new Date(end).getTime() - Date.now()) / 86400000) : null;

  const filtered = (schools ?? []).filter(sc => {
    const q = search.toLowerCase();
    return (
      (!q || sc.school_name?.toLowerCase().includes(q) || sc.email?.toLowerCase().includes(q)) &&
      (statusFilter === "all" || sc.status === statusFilter)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "subscriptions", label: "Subscriptions", icon: "fa-list"        },
    { key: "plans",         label: "Plan Tiers",     icon: "fa-layer-group" },
    { key: "offers",        label: "Offers",         icon: "fa-gift"        },
  ];

  return (
    <div className={s("sa-page")}>
      <main className={s("page-content")}>

        {/* ── Page head ── */}
        <div className={s("page-head")}>
          <div>
            <h1>Subscription Management</h1>
            <p>All school plans, offers, statuses and revenue in one place.</p>
          </div>
          <div className={s("head-actions")}>
            {tab === "plans" && (
              <button className={cx(s("btn"), s("btn-primary"))} onClick={() => router.push("/super-admin/subscriptions/plans/new")}>
                <i className="fa-solid fa-plus" /> New Plan
              </button>
            )}
            {tab === "offers" && (
              <button className={cx(s("btn"), s("btn-primary"))} onClick={() => setCreatingOffer(true)}>
                <i className="fa-solid fa-plus" /> New Offer
              </button>
            )}
          </div>
        </div>

        {/* ── Executive KPI stat cards ── */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {/* Card 1: Total Schools */}
          <div style={{ background: "#ffffff", borderRadius: 14, padding: "18px 20px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>Total Schools</span>
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
                {schools?.filter(sc => sc.plan_name === "Pro").length || 0} Pro · {schools?.filter(sc => sc.plan_name === "Plus").length || 0} Plus · {schools?.filter(sc => sc.plan_name === "Ultra").length || 0} Ultra
              </span>
            </div>
          </div>

          {/* Card 2: Active Subscriptions */}
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
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{expired} expired/cancelled</span>
            </div>
          </div>

          {/* Card 4: Platform Revenue & Expiring Alert */}
          <div style={{ background: "#ffffff", borderRadius: 14, padding: "18px 20px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>Platform Revenue</span>
                <h3 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
                  {revenueNPR ? `₹${(revenueNPR / 100000).toFixed(1)}L` : "₹0.0"}
                </h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdfa", border: "1.5px solid #99f6e4", color: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className="fa-solid fa-wallet" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(() => {
                const expiringSoon = schools?.filter(sc => { const d = daysLeft(sc.end_date); return d !== null && d <= 7 && d >= 0; }).length ?? 0;
                return expiringSoon > 0 ? (
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626", background: "#fef2f2", padding: "2px 7px", borderRadius: 6, border: "1px solid #fca5a5" }}>
                    {expiringSoon} Expiring ≤7d
                  </span>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: "#0f766e", background: "#f0fdfa", padding: "2px 7px", borderRadius: 6, border: "1px solid #99f6e4" }}>
                    NPR Total
                  </span>
                );
              })()}
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>All time collected</span>
            </div>
          </div>

          {/* Card 5: Active Offers */}
          <div style={{ background: "#ffffff", borderRadius: 14, padding: "18px 20px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 }}>Active Offers</span>
                <h3 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{activeOffersCount}</h3>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#faf5ff", border: "1.5px solid #e9d5ff", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <i className="fa-solid fa-gift" />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#9333ea", background: "#faf5ff", padding: "2px 7px", borderRadius: 6, border: "1px solid #e9d5ff" }}>
                Discounts Live
              </span>
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>Campaign active</span>
            </div>
          </div>
        </section>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid rgba(191,201,209,0.5)", marginBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 20px", fontSize: 13.5, fontWeight: 800, border: "none",
              background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              color: tab === t.key ? "#ff9b51" : "#6b7b86",
              borderBottom: tab === t.key ? "2px solid #ff9b51" : "2px solid transparent",
              marginBottom: -2,
            }}>
              <i className={`fa-solid ${t.icon}`} />
              {t.label}
              {t.key === "offers" && activeOffersCount > 0 && (
                <span style={{ background: "#ff9b51", color: "#fff", fontSize: 10, fontWeight: 900, padding: "1px 7px", borderRadius: 999, marginLeft: 2 }}>
                  {activeOffersCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ SUBSCRIPTIONS TAB ══ */}
        {tab === "subscriptions" && (
          <>
            <section className={cx(s("card"), s("toolbar"))}>
              <label className={s("search-field")}>
                <i className="fa-solid fa-magnifying-glass" />
                <input
                  type="search"
                  placeholder="Search school name or email…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </label>
              <select
                className={s("filter-field")}
                value={statusFilter}
                onChange={e => {
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
              <button className={cx(s("btn"), s("btn-soft"), s("btn-sm"))} onClick={refetchSchools}>
                <i className="fa-solid fa-rotate" /> Refresh
              </button>
            </section>

            <section className={s("card")}>
              <div className={s("card-head")}>
                <div>
                  <h3>School Subscriptions</h3>
                  <p>
                    Showing <strong>{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> schools {filtered.length !== total && `(filtered from ${total})`}
                  </p>
                </div>
              </div>
              <div className={s("table-wrap")}>
                {schoolsL ? (
                  <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#ff9b51" /></div>
                ) : (
                  <table className={s("table")}>
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: "center" }}>#</th>
                        <th>School</th>
                        <th>Plan</th>
                        <th>Billing</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Days Left</th>
                        <th>Account</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((sc, idx) => {
                        const dl     = daysLeft(sc.end_date);
                        const urgent = dl !== null && dl <= 7 && dl >= 0;
                        return (
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
                            <td><span className={cx(s("badge"), s(PLAN_BADGE[sc.plan_name] ?? "badge-blue"))}>{sc.plan_name ?? "Free"}</span></td>
                            <td style={{ textTransform: "capitalize", color: "#6b7b86", fontSize: 13 }}>{sc.billing_cycle ?? "free"}</td>
                            <td>
                              <span className={cx(s("badge"), s(SUB_BADGE[sc.status] ?? "badge-blue"))} style={{ textTransform: "capitalize" }}>
                                {STATUS_LABEL[sc.status] ?? sc.status}
                              </span>
                            </td>
                            <td style={{ color: "#6b7b86", fontSize: 13 }}>{sc.end_date ? new Date(sc.end_date).toLocaleDateString() : "Never"}</td>
                            <td>
                              {dl === null
                                ? <span style={{ color: "#6b7b86", fontSize: 12 }}>∞</span>
                                : <span style={{ fontWeight: 900, fontSize: 13, color: urgent ? "#be123c" : dl > 30 ? "#15803d" : "#b45309" }}>
                                    {urgent && <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />}
                                    {dl}d
                                  </span>
                              }
                            </td>
                            <td>
                              <span className={cx(s("badge"), sc.is_account === "blocked" ? s("badge-red") : s("badge-green"))} style={{ textTransform: "capitalize" }}>
                                {sc.is_account}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                className={cx(s("btn"), s("btn-soft"), s("btn-sm"))}
                                onClick={() => setActivating(sc)}
                                style={{
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
                                <i className="fa-solid fa-rocket" /> Activate
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr><td colSpan={9} style={{ textAlign: "center", padding: "2.5rem", color: "#6b7b86" }}>No subscriptions found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>

              {/* ── Pagination Footer Bar ── */}
              {filtered.length > 0 && (
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
                        {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)}
                      </strong>{" "}
                      of <strong style={{ color: "#0f172a" }}>{filtered.length}</strong>
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
                      disabled={currentPage === totalPages || filtered.length === 0}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: "1px solid #cbd5e1",
                        background: currentPage === totalPages || filtered.length === 0 ? "#f1f5f9" : "#fff",
                        color: currentPage === totalPages || filtered.length === 0 ? "#94a3b8" : "#334155",
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: currentPage === totalPages || filtered.length === 0 ? "not-allowed" : "pointer",
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
          </>
        )}

        {/* ══ PLANS TAB ══ */}
        {tab === "plans" && (
          plansL
            ? <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#ff9b51" /></div>
            : <section className={s("three-col")}>
                {(plans ?? [])
                  .filter((plan: any) => plan.name !== "Free")
                  .map((plan: any) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      featured={plan.name === "Plus"}
                      onEdit={() => router.push(`/super-admin/subscriptions/plans/${plan.id}/edit`)}
                      schoolCount={schools?.filter(sc => sc.plan_name === plan.name && sc.status === "active").length ?? 0}
                    />
                  ))}
              </section>
        )}

        {/* ══ OFFERS TAB ══ */}
        {tab === "offers" && (
          <OffersTab
            offers={offers ?? []}
            loading={offersL}
            plans={plans ?? []}
            onEdit={setEditingOffer}
            onRefresh={refetchOffers}
            dispatch={dispatch}
          />
        )}
      </main>

      {/* ── Modals (offers + activate only — plan editing is now a page) ── */}
      {activating    && <ActivateModal school={activating} plans={plans ?? []} onClose={() => setActivating(null)} onSaved={() => { setActivating(null); refetchSchools(); dispatch(showToast({ type: "success", title: "Activated", message: "Subscription activated." })); }} />}
      {editingOffer  && <OfferModal offer={editingOffer}  plans={plans ?? []} onClose={() => setEditingOffer(null)}  onSaved={() => { setEditingOffer(null);  refetchOffers(); dispatch(showToast({ type: "success", title: "Updated", message: "Offer updated." })); }} />}
      {creatingOffer && <OfferModal offer={null}           plans={plans ?? []} onClose={() => setCreatingOffer(false)} onSaved={() => { setCreatingOffer(false); refetchOffers(); dispatch(showToast({ type: "success", title: "Created", message: "Offer created." })); }} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── OFFERS TAB ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function OffersTab({ offers, loading, plans, onEdit, onRefresh, dispatch }: {
  offers: any[]; loading: boolean; plans: any[];
  onEdit: (o: any) => void; onRefresh: () => void; dispatch: any;
}) {
  const [offerToDelete, setOfferToDelete] = useState<any | null>(null);

  const handleConfirmDelete = async () => {
    if (!offerToDelete) return;
    try {
      await apiRequest(`/subscriptions/offers/${offerToDelete.id}`, { method: "DELETE" });
      dispatch(showToast({ type: "success", title: "Deleted", message: "Offer removed." }));
      onRefresh();
      setOfferToDelete(null);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to delete" }));
    }
  };

  const handleToggle = async (offer: any) => {
    try {
      await apiRequest(`/subscriptions/offers/${offer.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !offer.is_active }),
      });
      dispatch(showToast({ type: "success", title: "Updated", message: `Offer ${offer.is_active ? "deactivated" : "activated"}.` }));
      onRefresh();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Error", message: err.message ?? "Failed to update" }));
    }
  };

  if (loading) return <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#ff9b51" /></div>;

  if (offers.length === 0) {
    return (
      <div style={{ padding: "4rem", textAlign: "center", color: "#6b7b86" }}>
        <i className="fa-solid fa-gift" style={{ fontSize: 40, color: "#dce5e9", marginBottom: 16, display: "block" }} />
        <p style={{ fontWeight: 700, margin: "0 0 6px" }}>No offers yet</p>
        <p style={{ fontSize: 13, margin: 0 }}>Click "New Offer" above to create your first promotional offer.</p>
      </div>
    );
  }

  const activeOffers   = offers.filter(o => o.is_active);
  const inactiveOffers = offers.filter(o => !o.is_active);

  const thStyle: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "#6b7b86", letterSpacing: ".4px", whiteSpace: "nowrap" };
  const TH_LABELS = ["Title", "Code", "Discount / Saving", "Billing", "Plan", "Expires", "Status", "Actions"];

  const OfferRow = ({ offer }: { offer: any }) => {
    const dynamicSaving = computeSavingText(
      offer.discount_type, offer.discount_value,
      plans, offer.plan_name ?? null, offer.applies_to_billing ?? null, offer.currency_applies_to ?? null,
    );
    const savingDisplay = offer.saving_text || dynamicSaving;
    const isExpired = offer.valid_until && new Date(offer.valid_until) < new Date();
    const dl = offer.valid_until ? Math.ceil((new Date(offer.valid_until).getTime() - Date.now()) / 86400000) : null;

    return (
      <tr style={{ opacity: !offer.is_active ? 0.65 : 1, borderBottom: "1px solid #f1f5f9" }}>
        <td style={{ padding: "12px 14px" }}>
          <strong style={{ fontSize: 13, color: "#1e293b", display: "block" }}>{offer.title}</strong>
          <span style={{ fontSize: 11, color: "#6b7b86" }}>{offer.description || "—"}</span>
        </td>
        <td style={{ padding: "12px 14px" }}>
          <code style={{ fontSize: 13, fontWeight: 900, color: "#ff9b51", background: "#fff7ed", padding: "3px 8px", borderRadius: 6, letterSpacing: ".5px" }}>
            {offer.code}
          </code>
        </td>
        <td style={{ padding: "12px 14px" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#1e293b", display: "block" }}>
            {offer.discount_type === "percent"     && `${offer.discount_value}% off`}
            {offer.discount_type === "fixed"       && `Fixed discount`}
            {offer.discount_type === "free_months" && `${offer.discount_value} month${offer.discount_value !== 1 ? "s" : ""} free`}
          </span>
          {savingDisplay && (
            <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
              <i className="fa-solid fa-piggy-bank" style={{ fontSize: 9 }} />{savingDisplay}
            </span>
          )}
        </td>
        <td style={{ padding: "12px 14px", fontSize: 12, color: "#6b7b86" }}>
          {offer.applies_to_billing
            ? <span style={{ textTransform: "capitalize", fontWeight: 700, color: "#374151" }}>{offer.applies_to_billing}</span>
            : <span style={{ color: "#94a3b8" }}>Both</span>
          }
        </td>
        <td style={{ padding: "12px 14px" }}>
          {offer.plan_name
            ? <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: "#ede9fe", color: "#6d28d9" }}>{offer.plan_name}</span>
            : <span style={{ fontSize: 12, color: "#94a3b8" }}>Any</span>
          }
        </td>
        <td style={{ padding: "12px 14px" }}>
          {offer.valid_until ? (
            <>
              <span style={{ fontSize: 12, color: isExpired ? "#be123c" : dl !== null && dl <= 7 ? "#b45309" : "#374151", display: "block" }}>
                {new Date(offer.valid_until).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
              {isExpired
                ? <span style={{ fontSize: 10, color: "#be123c", fontWeight: 800 }}>EXPIRED</span>
                : dl !== null && <span style={{ fontSize: 10, color: dl <= 7 ? "#b45309" : "#6b7b86", fontWeight: 700 }}>{dl}d left</span>
              }
            </>
          ) : (
            <span style={{ color: "#15803d", fontWeight: 700, fontSize: 12 }}>∞ No expiry</span>
          )}
        </td>
        <td style={{ padding: "12px 14px" }}>
          <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999, background: offer.is_active ? "#dcfce7" : "#f1f5f9", color: offer.is_active ? "#15803d" : "#64748b" }}>
            {offer.is_active ? "Active" : "Inactive"}
          </span>
        </td>
        <td style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => handleToggle(offer)} title={offer.is_active ? "Deactivate" : "Activate"}
              style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: offer.is_active ? "#fef3c7" : "#f0fdf4", cursor: "pointer", fontSize: 12, fontWeight: 700, color: offer.is_active ? "#b45309" : "#15803d" }}>
              <i className={`fa-solid ${offer.is_active ? "fa-pause" : "fa-play"}`} />
            </button>
            <button onClick={() => onEdit(offer)} title="Edit"
              style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 12, color: "#374151" }}>
              <i className="fa-solid fa-pen" />
            </button>
            <button onClick={() => setOfferToDelete(offer)} title="Delete"
              style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #fee2e2", background: "#fff1f2", cursor: "pointer", fontSize: 12, color: "#be123c" }}>
              <i className="fa-solid fa-trash" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const OfferTable = ({ list, label, accent }: { list: any[]; label: string; accent: string }) => (
    <section style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce5e9", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: accent === "green" ? "#dcfce7" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className={`fa-solid ${accent === "green" ? "fa-circle-check" : "fa-pause"}`} style={{ color: accent === "green" ? "#15803d" : "#64748b", fontSize: 12 }} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: accent === "green" ? "#1e293b" : "#64748b" }}>{label}</h3>
          <p style={{ margin: 0, fontSize: 11, color: "#6b7b86" }}>{list.length} offer{list.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {TH_LABELS.map(h => <th key={h} style={thStyle}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map(o => <OfferRow key={o.id} offer={o} />)}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {activeOffers.length   > 0 && <OfferTable list={activeOffers}   label="Active Offers"            accent="green" />}
      {inactiveOffers.length > 0 && <OfferTable list={inactiveOffers} label="Inactive / Expired Offers" accent="grey"  />}

      {/* Delete Offer Modal */}
      <ConfirmModal
        isOpen={!!offerToDelete}
        onClose={() => setOfferToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Offer"
        message={`Delete offer "${offerToDelete?.title}"? This cannot be undone.`}
        confirmText="Delete Offer"
        cancelText="Cancel"
        confirmVariant="danger"
        icon="fa-trash-can"
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── PLAN CARD ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function PlanCard({ plan, featured, onEdit, schoolCount }: { plan: any; featured: boolean; onEdit: () => void; schoolCount: number }) {
  const featureList = [
    plan.max_students ? `Up to ${plan.max_students} students` : "Unlimited students",
    plan.max_teachers ? `Up to ${plan.max_teachers} teachers` : "Unlimited teachers",
    plan.fee_management_enabled ? "Fee management"  : null,
    plan.online_payment_enabled ? "Online payments" : null,
    `NPR ${plan.price_npr_monthly}/mo · ${plan.price_npr_yearly}/yr`,
    `INR ${plan.price_inr_monthly}/mo · ${plan.price_inr_yearly}/yr`,
  ].filter(Boolean) as string[];

  const yrlySavingNPR = plan.price_npr_monthly
    ? Math.round(plan.price_npr_monthly * 12 - plan.price_npr_yearly)
    : 0;
  const yrlySavingPct = plan.price_npr_monthly && yrlySavingNPR > 0
    ? Math.round((yrlySavingNPR / (plan.price_npr_monthly * 12)) * 100)
    : 0;

  return (
    <article className={cx(s("plan-card"), featured ? s("featured") : undefined)}>
      <p className={s("plan-kicker")}>{plan.name}</p>
      <div className={s("plan-price")}>
        ₹{plan.price_npr_monthly}
        <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7 }}>/mo</span>
      </div>
      <p className={s("plan-sub")}>{schoolCount} school{schoolCount !== 1 ? "s" : ""} active</p>

      {yrlySavingPct > 0 && (
        <div style={{ margin: "4px 0 10px", padding: "4px 10px", borderRadius: 8, background: featured ? "rgba(255,255,255,.12)" : "#f0fdf4", display: "inline-flex", alignItems: "center", gap: 5 }}>
          <i className="fa-solid fa-piggy-bank" style={{ fontSize: 10, color: featured ? "#FF9B51" : "#15803d" }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: featured ? "#FF9B51" : "#15803d" }}>
            Yearly saves {yrlySavingPct}% · NPR {yrlySavingNPR.toLocaleString()}/yr
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
        {featureList.map(f => (
          <div className={s("plan-feature")} key={f}>
            <i className="fa-solid fa-check" /><span>{f}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: plan.fee_management_enabled ? "#dcfce7" : "#fee2e2", color: plan.fee_management_enabled ? "#15803d" : "#be123c" }}>
            Fee Mgmt: {plan.fee_management_enabled ? "✓" : "✗"}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: plan.online_payment_enabled ? "#dcfce7" : "#fee2e2", color: plan.online_payment_enabled ? "#15803d" : "#be123c" }}>
            Online Pay: {plan.online_payment_enabled ? "✓" : "✗"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button
          className={cx(s("btn"), s("btn-sm"), featured ? undefined : s("btn-soft"))}
          style={featured ? { flex: 1, background: "rgba(255,255,255,.18)", color: "#fff" } : { flex: 1 }}
          onClick={onEdit}
        >
          <i className="fa-solid fa-pen" /> Edit Plan
        </button>
        <span className={cx(s("badge"), plan.is_active ? s("badge-green") : s("badge-red"))} style={{ alignSelf: "center" }}>
          {plan.is_active ? "Active" : "Inactive"}
        </span>
      </div>
    </article>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ACTIVATE MODAL ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ActivateModal({ school, plans, onClose, onSaved }: {
  school: any; plans: any[]; onClose: () => void; onSaved: () => void;
}) {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plan_id:           plans[1]?.id ?? plans[0]?.id ?? "",
    billing_cycle:     "monthly" as "monthly" | "yearly" | "free",
    amount_paid:       "",
    currency:          school.country?.toLowerCase() === "india" ? "INR" : "NPR",
    start_date:        new Date().toISOString().split("T")[0],
    end_date:          "",
    payment_method:    "bank_transfer",
    payment_reference: "",
    notes:             "",
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const selectedPlan = plans.find(p => p.id === Number(form.plan_id));
  const yearlySavingNPR = selectedPlan && form.billing_cycle === "yearly"
    ? Math.round(selectedPlan.price_npr_monthly * 12 - selectedPlan.price_npr_yearly)
    : 0;
  const yearlySavingPct = selectedPlan && selectedPlan.price_npr_monthly && yearlySavingNPR > 0
    ? Math.round((yearlySavingNPR / (selectedPlan.price_npr_monthly * 12)) * 100)
    : 0;

  const handleCycleChange = (c: "monthly" | "yearly" | "free") => {
    set("billing_cycle", c);
    if (c === "free") { set("end_date", ""); set("amount_paid", "0"); return; }
    const start = new Date(form.start_date || new Date());
    const end   = new Date(start);
    if (c === "monthly") end.setMonth(end.getMonth() + 1);
    else                  end.setFullYear(end.getFullYear() + 1);
    set("end_date", end.toISOString().split("T")[0]);
    if (selectedPlan) {
      const curr = form.currency;
      const amt  = c === "monthly"
        ? (curr === "INR" ? selectedPlan.price_inr_monthly : selectedPlan.price_npr_monthly)
        : (curr === "INR" ? selectedPlan.price_inr_yearly  : selectedPlan.price_npr_yearly);
      set("amount_paid", String(amt || ""));
    }
  };

  const handleSubmit = async () => {
    if (!form.plan_id) { dispatch(showToast({ type: "error", title: "Error", message: "Select a plan" })); return; }
    if (form.billing_cycle !== "free" && !form.end_date) { dispatch(showToast({ type: "error", title: "Error", message: "End date is required for paid plans" })); return; }
    setSaving(true);
    try {
      await apiRequest("/subscriptions/activate", {
        method: "POST",
        body: JSON.stringify({
          school_id:         school.school_id,
          plan_id:           Number(form.plan_id),
          billing_cycle:     form.billing_cycle,
          amount_paid:       parseFloat(form.amount_paid) || 0,
          currency:          form.currency || undefined,
          start_date:        form.start_date || undefined,
          end_date:          form.billing_cycle !== "free" ? form.end_date : undefined,
          payment_method:    form.payment_method || undefined,
          payment_reference: form.payment_reference || undefined,
          notes:             form.notes || undefined,
        }),
      });
      onSaved();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message ?? "Could not activate subscription" }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: "1rem" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 520, maxHeight: "94vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(15,23,42,.28)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #eef2f3", background: "linear-gradient(135deg, #25343F, #1e2d38)", borderRadius: "18px 18px 0 0" }}>
          <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: "1px", color: "#FF9B51", margin: "0 0 4px" }}>ACTIVATE / RENEW</p>
          <h2 style={{ fontSize: 16, fontWeight: 900, color: "#fff", margin: 0 }}>{school.school_name}</h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.5)", margin: "2px 0 0" }}>{school.email}</p>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>Plan</label>
            <select value={form.plan_id} onChange={e => set("plan_id", e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 700 }}>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 8 }}>Billing Cycle</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["monthly", "yearly", "free"] as const).map(c => (
                <button key={c} onClick={() => handleCycleChange(c)} style={{ flex: 1, padding: "9px 6px", borderRadius: 9, border: form.billing_cycle === c ? "2px solid #FF9B51" : "1px solid #e2e8f0", background: form.billing_cycle === c ? "#fff7ed" : "#f9fafb", fontWeight: 800, fontSize: 12, cursor: "pointer", textTransform: "capitalize", color: form.billing_cycle === c ? "#FF9B51" : "#374151" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {selectedPlan && form.billing_cycle !== "free" && (
            <div style={{ padding: "10px 14px", borderRadius: 9, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 12, color: "#15803d", fontWeight: 700 }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />
              Standard: NPR {form.billing_cycle === "monthly" ? selectedPlan.price_npr_monthly : selectedPlan.price_npr_yearly} / INR {form.billing_cycle === "monthly" ? selectedPlan.price_inr_monthly : selectedPlan.price_inr_yearly}
              {yearlySavingPct > 0 && (
                <span style={{ marginLeft: 8 }}>
                  · <i className="fa-solid fa-piggy-bank" style={{ marginRight: 3 }} />
                  School saves NPR {yearlySavingNPR.toLocaleString()} ({yearlySavingPct}%) vs monthly
                </span>
              )}
            </div>
          )}

          {form.billing_cycle !== "free" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>End Date</label>
                  <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13 }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>Amount Paid</label>
                  <input type="number" value={form.amount_paid} onChange={e => set("amount_paid", e.target.value)} placeholder="0" style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>Currency</label>
                  <select value={form.currency} onChange={e => set("currency", e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 700 }}>
                    <option value="NPR">NPR</option><option value="INR">INR</option><option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>Payment Method</label>
                  <select value={form.payment_method} onChange={e => set("payment_method", e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 700 }}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="esewa">eSewa</option>
                    <option value="khalti">Khalti</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>Transaction / Reference</label>
                  <input value={form.payment_reference} onChange={e => set("payment_reference", e.target.value)} placeholder="e.g. TXN123456" style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13 }} />
                </div>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 900, color: "#374151", display: "block", marginBottom: 6 }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="e.g. 1 month free promo applied" style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid #d1d5db", fontSize: 13, resize: "none" }} />
          </div>
        </div>

        <div style={{ padding: "14px 24px 20px", display: "flex", gap: 10, borderTop: "1px solid #eef2f3" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: "10px", borderRadius: 9, border: "none", background: "#FF9B51", color: "#fff", fontWeight: 800, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.75 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {saving ? <Spinner size={16} /> : <><i className="fa-solid fa-rocket" /> Activate Subscription</>}
          </button>
        </div>
      </div>
    </div>
  );
}
