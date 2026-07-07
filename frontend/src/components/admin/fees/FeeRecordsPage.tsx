"use client";

import { useState } from "react";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const formatINR = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n || 0));

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  academic:  { label: "Academic",  cls: "badge-blue"   },
  transport: { label: "Transport", cls: "badge-yellow"  },
  hostel:    { label: "Hostel",    cls: "badge-purple" },
};

const STATUS_BADGE: Record<string, string> = {
  paid:    "badge-green",
  partial: "badge-yellow",
  unpaid:  "badge-red",
  waived:  "badge-blue",
};

export default function FeeRecordsPage() {
  const { data: activeYear } = useApi<any>("/academic-years/active");
  const { data: collections, loading, error } = useApi<any[]>(
    activeYear?.id ? `/fees/collections?academic_year_id=${activeYear.id}` : "",
    [activeYear?.id]
  );

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter,   setTypeFilter]   = useState("all");

  const filtered = (collections || []).filter(col => {
    const q = search.toLowerCase();
    const matchSearch =
      col.fee_name?.toLowerCase().includes(q) ||
      col.full_name?.toLowerCase().includes(q) ||
      col.admission_number?.toLowerCase().includes(q) ||
      String(col.student_id).includes(q);
    const matchStatus = statusFilter === "all" || col.status === statusFilter;
    const matchType   = typeFilter   === "all" || (col.fee_type || "academic") === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const totalPaid    = (collections || []).reduce((s, c) => s + parseFloat(c.paid_amount  || "0"), 0);
  const totalPending = (collections || []).filter(c => c.status !== "paid")
    .reduce((s, c) => s + parseFloat(c.remaining_amount || "0"), 0);
  const transportBills = (collections || []).filter(c => (c.fee_type || "academic") === "transport").length;

  return (
    <div className={s("fees-page")}>
      <Topbar title="Fee Records" subtitle="View all fee collections" />
      <main className={s("page-content")}>

        <section className={s("page-head")}>
          <div>
            <h1>All Fee Records</h1>
            <p>Track collected fees and pending dues across academic and transport billing.</p>
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
            ["fa-indian-rupee-sign", "Total Collected",    formatINR(totalPaid),         "This academic year", "blue"  ],
            ["fa-receipt",           "Total Records",       (collections?.length || 0).toString(), "Generated records", "green"  ],
            ["fa-bus",               "Transport Bills",     transportBills.toString(),    "Billed records",     "orange" ],
            ["fa-clock",             "Total Outstanding",   formatINR(totalPending),      "Open dues",          "rose"   ],
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
                    <th></th>
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
                    const isOverdue = col.status !== "paid" && new Date(col.due_date) < new Date();
                    const typeMeta  = TYPE_BADGE[col.fee_type || "academic"] || TYPE_BADGE.academic;
                    return (
                      <tr key={col.id} style={isOverdue ? { background: "#fff5f5" } : undefined}>
                        <td>
                          <div className={s("record-student")}>
                            <strong>{col.full_name || `Student #${col.student_id}`}</strong>
                            <span>{col.admission_number || ""}</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 700, fontSize: 13, maxWidth: 220 }}>
                          {col.fee_name || "—"}
                        </td>
                        <td>
                          <span className={cx(s("badge"), s(typeMeta.cls))}>
                            {typeMeta.label}
                          </span>
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
                          {col.status !== "paid" && (
                            <Link className={cx(s("btn"), s("btn-primary"), s("btn-sm"))} href="/fees/collect">
                              Collect
                            </Link>
                          )}
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
    </div>
  );
}
