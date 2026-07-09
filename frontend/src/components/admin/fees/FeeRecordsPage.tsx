"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const formatINR = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  academic:  { label: "Academic",  cls: "badge-blue"   },
  transport: { label: "Transport", cls: "badge-yellow" },
  hostel:    { label: "Hostel",    cls: "badge-purple" },
};

const STATUS_BADGE: Record<string, string> = {
  paid:    "badge-green",
  partial: "badge-yellow",
  unpaid:  "badge-red",
  waived:  "badge-blue",
};

// ── Payments modal — shows payments for one collection with print links ──────
function PaymentsModal({
  collection,
  onClose,
}: {
  collection: any;
  onClose: () => void;
}) {
  const { data: payments, loading } = useApi<any[]>(
    collection ? `/fees/payments/collection/${collection.id}` : ""
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620,
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #e8eef0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: "#1f2d36" }}>
              Payment History
            </h3>
            <p style={{ fontSize: 12, color: "#6a7882", fontWeight: 700, marginTop: 3 }}>
              {collection.fee_name} · {collection.full_name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #d4dde2", background: "#fff", cursor: "pointer", fontSize: 14, color: "#6a7882" }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 22px", maxHeight: 420, overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}><Spinner size={28} color="#ff9b51" /></div>
          ) : !payments?.length ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#6a7882" }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 28, display: "block", marginBottom: 8, opacity: 0.25 }} />
              <p style={{ fontWeight: 700, fontSize: 13 }}>No payments recorded yet.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Receipt No.", "Date", "Amount", "Method", "Print"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 900, fontSize: 11, color: "#6a7882", textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid #e8eef0" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "11px 12px", fontWeight: 900, color: "#1f2d36" }}>{p.receipt_number}</td>
                    <td style={{ padding: "11px 12px", color: "#6a7882", fontWeight: 700 }}>
                      {new Date(p.payment_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "11px 12px", fontWeight: 900, color: "#12805c" }}>{formatINR(p.paid_amount)}</td>
                    <td style={{ padding: "11px 12px", color: "#6a7882", fontWeight: 700, textTransform: "capitalize" }}>
                      {(p.payment_method || "—").replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "11px 12px" }}>
                      <a
                        href={`/fees/receipt/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 7,
                          background: "#1e3a5f", color: "#fff",
                          fontWeight: 800, fontSize: 11, textDecoration: "none",
                        }}
                      >
                        <i className="fa-solid fa-print" style={{ fontSize: 10 }} />
                        Print
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FeeRecordsPage() {
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: collections, loading, error } = useApi<any[]>(
    activeYear?.id ? `/fees/collections?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [modalCol,     setModalCol]     = useState<any | null>(null);

  const filtered = (collections || []).filter(col => {
    const q = search.toLowerCase();
    const matchSearch =
      col.fee_name?.toLowerCase().includes(q) ||
      col.full_name?.toLowerCase().includes(q) ||
      col.admission_number?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || col.status === statusFilter;
    const matchType   = typeFilter   === "all" || (col.fee_type || "academic") === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalPaid    = (collections || []).reduce((s, c) => s + parseFloat(c.paid_amount      || "0"), 0);
  const totalPending = (collections || []).filter(c => c.status !== "paid")
    .reduce((s, c) => s + parseFloat(c.remaining_amount || "0"), 0);
  const transportBills = (collections || []).filter(c => (c.fee_type || "academic") === "transport").length;

  return (
    <div className={s("fees-page")}>
      <Topbar title="Fee Records" subtitle="View all fee collections and payment receipts" />
      <main className={s("page-content")}>

        {/* Header */}
        <section className={s("page-head")}>
          <div>
            <h1>All Fee Records</h1>
            <p>Track collected fees and pending dues. Click on any paid row to view receipts.</p>
          </div>
          <div className={s("head-actions")}>
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees">
              <i className="fa-solid fa-arrow-left" /> Overview
            </Link>
            <Link className={cx(s("btn"), s("btn-primary"))} href="/fees/collect">
              <i className="fa-solid fa-plus" /> Collect Fee
            </Link>
          </div>
        </section>

        {/* Stats */}
        <section className={s("summary-cards")}>
          {[
            ["fa-indian-rupee-sign", "Total Collected",  formatINR(totalPaid),              "This academic year", "blue"  ],
            ["fa-receipt",           "Total Records",    (collections?.length || 0).toString(), "Generated records", "green"],
            ["fa-bus",               "Transport Bills",  transportBills.toString(),          "Billed records",     "orange"],
            ["fa-clock",             "Total Outstanding",formatINR(totalPending),            "Open dues",          "rose"  ],
          ].map(([icon, label, value, sub, tone]) => (
            <article className={s("structure-stat-card")} key={label}>
              <div className={cx(s("structure-stat-icon"), s(tone))}><i className={`fa-solid ${icon}`} /></div>
              <div><p>{label}</p><strong>{value}</strong><small>{sub}</small></div>
            </article>
          ))}
        </section>

        {/* Toolbar */}
        <section className={cx(s("card"), s("records-toolbar"))}>
          <label className={s("search-field")}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="search"
              placeholder="Search by student name, admission no or fee name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select className={s("filter-field")} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
            <option value="waived">Waived</option>
          </select>
          <select className={s("filter-field")} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="academic">Academic</option>
            <option value="transport">Transport</option>
            <option value="hostel">Hostel</option>
          </select>
        </section>

        {/* Table */}
        <section className={s("card")}>
          <div className={s("card-head")}>
            <div><h3><i className="fa-solid fa-table-list" /> Collection Records</h3></div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
              {filtered.length} records
            </span>
          </div>
          <div className={s("table-wrap")}>
            {loading ? (
              <div style={{ padding: "3rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
            ) : error ? (
              <div style={{ padding: "2rem", color: "#b42318" }}>{error}</div>
            ) : (
              <table className={s("records-table")}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Fee Name</th>
                    <th>Type</th>
                    <th>Due Date</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "2.5rem", color: "#6a7882" }}>
                        <i className="fa-solid fa-inbox" style={{ fontSize: 22, display: "block", marginBottom: 8 }} />
                        No records found.
                      </td>
                    </tr>
                  ) : filtered.map(col => {
                    const isOverdue  = col.status !== "paid" && new Date(col.due_date) < new Date();
                    const typeMeta   = TYPE_BADGE[col.fee_type || "academic"] || TYPE_BADGE.academic;
                    const hasPaid    = col.status === "paid" || col.status === "partial";
                    return (
                      <tr key={col.id} style={isOverdue ? { background: "#fff5f5" } : undefined}>
                        <td>
                          <div className={s("record-student")}>
                            <strong>{col.full_name || `Student #${col.student_id}`}</strong>
                            <span>{col.admission_number || ""}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 13, maxWidth: 220 }}>{col.fee_name || "—"}</td>
                        <td>
                          <span className={cx(s("badge"), s(typeMeta.cls))}>{typeMeta.label}</span>
                        </td>
                        <td className={isOverdue ? s("danger-text") : ""} style={{ fontSize: 13 }}>
                          {new Date(col.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          {isOverdue && <span style={{ display: "block", fontSize: 10, color: "#b42318", fontWeight: 800 }}>OVERDUE</span>}
                        </td>
                        <td><strong>{formatINR(col.total_amount)}</strong></td>
                        <td className={s("success-text")}>{formatINR(col.paid_amount || 0)}</td>
                        <td>
                          <strong className={parseFloat(col.remaining_amount) > 0 ? s("danger-text") : ""}>
                            {formatINR(col.remaining_amount || 0)}
                          </strong>
                        </td>
                        <td>
                          <span className={cx(s("badge"), s(STATUS_BADGE[col.status] || "badge-gray"))} style={{ textTransform: "capitalize" }}>
                            {col.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {/* Print receipts — only for collections with at least one payment */}
                            {hasPaid && (
                              <button
                                onClick={() => setModalCol(col)}
                                title="View & Print Receipts"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "5px 10px", borderRadius: 7, border: "none",
                                  background: "#1e3a5f", color: "#fff",
                                  fontWeight: 800, fontSize: 11, cursor: "pointer",
                                }}
                              >
                                <i className="fa-solid fa-print" style={{ fontSize: 10 }} />
                                Receipts
                              </button>
                            )}
                            {col.status !== "paid" && (
                              <Link
                                className={cx(s("btn"), s("btn-primary"), s("btn-sm"))}
                                href="/fees/collect"
                              >
                                Collect
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Payments modal */}
      {modalCol && (
        <PaymentsModal collection={modalCol} onClose={() => setModalCol(null)} />
      )}
    </div>
  );
}
