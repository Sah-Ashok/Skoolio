"use client";

import { useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import styles from "./fees.module.css";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

// ── helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "badge-green", partial: "badge-yellow", unpaid: "badge-red", waived: "badge-blue",
  };
  return (
    <span className={cx(s("badge"), s(map[status] ?? "badge-red"))} style={{ textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    academic:  { bg: "#e8edff", color: "#3b5bdb" },
    transport: { bg: "#fff1df", color: "#c46a14" },
    hostel:    { bg: "#f3e8ff", color: "#7c3aed" },
  };
  const cfg = colors[type] || colors.academic;
  return (
    <span style={{
      fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 999,
      background: cfg.bg, color: cfg.color, textTransform: "uppercase", letterSpacing: 0.3,
    }}>
      {type}
    </span>
  );
}

// ── Month grouping helper ─────────────────────────────────────────────────────

function groupByMonth(collections: any[], payments: any[]) {
  // Build a map of collection_id → payments
  const payMap: Record<number, any[]> = {};
  payments.forEach((p: any) => {
    if (!payMap[p.collection_id]) payMap[p.collection_id] = [];
    payMap[p.collection_id].push(p);
  });

  // Group collections by "due_date YYYY-MM"
  const months: Record<string, any[]> = {};
  collections.forEach((c: any) => {
    const key = (c.due_date || "").slice(0, 7) || "unknown";
    if (!months[key]) months[key] = [];
    months[key].push({ ...c, _payments: payMap[c.id] || [] });
  });

  return Object.entries(months)
    .sort(([a], [b]) => b.localeCompare(a)); // newest first
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: string }) {
  return (
    <div style={{
      padding: "14px 18px", borderRadius: 12, background: "#fff",
      border: "1px solid #e5ebee", boxShadow: "0 1px 6px rgba(31,45,54,.05)",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${accent}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 17, color: accent,
      }}>
        <i className={`fa-solid ${icon}`} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
        <strong style={{ fontSize: 20, fontWeight: 900, color: "#1f2d36", display: "block", marginTop: 1 }}>{value}</strong>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FeeHistoryPage() {
  const searchParams       = useSearchParams();
  const studentId          = searchParams?.get("student_id");
  const { formatDate }     = useDateFormat();
  const { fmt }            = useCurrency();
  const { activeYear }     = useAcademicYear();

  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search,       setSearch]       = useState("");

  // Fetch student info
  const { data: student }    = useApi<any>(studentId ? `/students/${studentId}` : "");

  // Fetch all collections (all years — no year filter so history is complete)
  const { data: collectionsRaw, loading: collLoading } =
    useApi<any[]>(
      studentId ? `/fees/collections/student/${studentId}` : "",
      [studentId]
    );

  // Fetch all payments
  const { data: paymentsRaw, loading: payLoading } =
    useApi<any[]>(
      studentId ? `/fees/payments/student/${studentId}` : "",
      [studentId]
    );

  const collections = collectionsRaw || [];
  const payments    = paymentsRaw    || [];

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalBilled  = collections.reduce((a, c) => a + parseFloat(c.net_amount    || 0), 0);
  const totalPaid    = collections.reduce((a, c) => a + parseFloat(c.paid_amount   || 0), 0);
  const totalPending = collections.reduce((a, c) => a + parseFloat(c.remaining_amount || 0), 0);
  const overdueCt    = collections.filter(c =>
    c.status !== "paid" && c.status !== "waived" && new Date(c.due_date) < new Date()
  ).length;

  // ── Filtered collections ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return collections.filter(c => {
      const matchType   = typeFilter   === "all" || (c.fee_type || "academic") === typeFilter;
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      const matchSearch = !search.trim() ||
        c.fee_name?.toLowerCase().includes(search.toLowerCase());
      return matchType && matchStatus && matchSearch;
    });
  }, [collections, typeFilter, statusFilter, search]);

  // ── Group by month ────────────────────────────────────────────────────────
  const monthGroups = useMemo(() => groupByMonth(filtered, payments), [filtered, payments]);

  // ── Pending fees (across all years) ───────────────────────────────────────
  const pendingFees = useMemo(() =>
    collections
      .filter(c => c.status !== "paid" && c.status !== "waived")
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [collections]
  );

  const loading = collLoading || payLoading;

  const initials = (student?.full_name || "S").split(" ")
    .map((p: string) => p[0]).join("").substring(0, 2).toUpperCase();

  return (
    <div className={s("fees-page")}>
      <Topbar title="Fee History" subtitle="Complete monthly fee breakdown and pending dues" />

      <main className={s("page-content")}>

        {/* ── Header ── */}
        <section className={s("page-head")}>
          <div>
            <h1>Fee History</h1>
            <p>
              {student
                ? `${student.full_name} · ${student.admission_number}`
                : studentId ? "Loading student…" : "No student selected"}
            </p>
          </div>
          <div className={s("head-actions")}>
            {studentId && (
              <Link
                className={cx(s("btn"), s("btn-primary"))}
                href={`/fees/collect?student_id=${studentId}`}
              >
                <i className="fa-solid fa-circle-plus" /> Collect Fee
              </Link>
            )}
            {studentId && (
              <Link
                className={cx(s("btn"), s("btn-outline"))}
                href={`/students/profile?id=${studentId}`}
              >
                <i className="fa-solid fa-user" /> Student Profile
              </Link>
            )}
            <Link className={cx(s("btn"), s("btn-outline"))} href="/fees">
              <i className="fa-solid fa-arrow-left" /> Back to Fees
            </Link>
          </div>
        </section>

        {!studentId ? (
          <div style={{
            padding: "5rem 2rem", textAlign: "center",
            border: "2px dashed #d4dde2", borderRadius: 14, background: "#fff",
          }}>
            <i className="fa-solid fa-user-graduate" style={{ fontSize: 36, color: "#c8d6de", display: "block", marginBottom: 14 }} />
            <p style={{ fontSize: 15, fontWeight: 800, color: "#6a7882", margin: 0 }}>
              No student selected. Open this page from a student's profile.
            </p>
          </div>
        ) : loading ? (
          <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#ff9b51" /></div>
        ) : (
          <>
            {/* ── Student hero ── */}
            {student && (
              <div style={{
                marginBottom: 20, padding: "16px 20px",
                borderRadius: 14, background: "#fff",
                border: "1px solid #e5ebee",
                boxShadow: "0 2px 10px rgba(31,45,54,.06)",
                display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: student.photo ? "transparent" : "#1f2d36",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 900, color: "#ff9b51", overflow: "hidden",
                }}>
                  {student.photo
                    ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 17, fontWeight: 900, color: "#1f2d36", display: "block" }}>
                    {student.full_name}
                  </strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
                    {student.admission_number}
                    {student.class_name ? ` · Class ${student.class_name}` : ""}
                    {student.section_name ? ` · Sec ${student.section_name}` : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {totalPending > 0 ? (
                    <span style={{ padding: "4px 12px", borderRadius: 999, background: "#fee2e2", color: "#dc2626", fontSize: 12, fontWeight: 900 }}>
                      <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 5 }} />
                      Due: {fmt(totalPending)}
                    </span>
                  ) : (
                    <span style={{ padding: "4px 12px", borderRadius: 999, background: "#dcfce7", color: "#15803d", fontSize: 12, fontWeight: 900 }}>
                      <i className="fa-solid fa-circle-check" style={{ marginRight: 5 }} />
                      All Cleared
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ── Summary stats ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
              <StatCard label="Total Billed"  value={fmt(totalBilled)}  accent="#3b5bdb" icon="fa-file-invoice"    />
              <StatCard label="Total Paid"    value={fmt(totalPaid)}    accent="#059669" icon="fa-circle-check"    />
              <StatCard label="Pending"       value={fmt(totalPending)} accent="#dc2626" icon="fa-hourglass-half"  />
              <StatCard label="Overdue Bills" value={String(overdueCt)} accent="#d97706" icon="fa-triangle-exclamation" />
              <StatCard label="Total Payments" value={String(payments.length)} accent="#7c3aed" icon="fa-receipt" />
            </div>

            {/* ── Pending dues banner ── */}
            {pendingFees.length > 0 && (
              <div style={{
                marginBottom: 20, padding: "16px 20px",
                borderRadius: 14, background: "#fff",
                border: "1.5px solid #fca5a5",
                boxShadow: "0 1px 6px rgba(220,38,38,.08)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", fontSize: 16 }}>
                      <i className="fa-solid fa-triangle-exclamation" />
                    </div>
                    <div>
                      <strong style={{ fontSize: 15, fontWeight: 900, color: "#1f2d36", display: "block" }}>
                        Pending Dues — {pendingFees.length} bill{pendingFees.length !== 1 ? "s" : ""}
                      </strong>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
                        Total outstanding: {fmt(totalPending)}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/fees/collect?student_id=${studentId}`}
                    style={{
                      padding: "8px 16px", borderRadius: 9, background: "#ff9b51",
                      color: "#fff", fontSize: 13, fontWeight: 900, textDecoration: "none",
                      display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                    }}
                  >
                    <i className="fa-solid fa-money-bill-wave" /> Collect Now
                  </Link>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                    <thead>
                      <tr style={{ background: "#fff5f5", borderBottom: "1px solid #fca5a5" }}>
                        {["Fee Name", "Type", "Due Date", "Total", "Paid", "Outstanding", "Status"].map(h => (
                          <th key={h} style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pendingFees.map((c: any, i: number) => {
                        const isOverdue = new Date(c.due_date) < new Date();
                        return (
                          <tr key={c.id} style={{ borderBottom: "1px solid #fef2f2", background: i % 2 ? "#fff5f5" : "#fff" }}>
                            <td style={{ padding: "10px 13px", fontWeight: 800, color: "#1f2d36" }}>
                              {c.fee_name}
                              {isOverdue && (
                                <span style={{ display: "block", fontSize: 9, fontWeight: 900, color: "#dc2626", letterSpacing: 0.5, marginTop: 2 }}>OVERDUE</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 13px" }}><TypeBadge type={c.fee_type || "academic"} /></td>
                            <td style={{ padding: "10px 13px", fontSize: 12, fontWeight: 700, color: isOverdue ? "#dc2626" : "#6a7882", whiteSpace: "nowrap" }}>
                              {formatDate(c.due_date?.slice(0, 10))}
                            </td>
                            <td style={{ padding: "10px 13px", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{fmt(c.net_amount)}</td>
                            <td style={{ padding: "10px 13px", fontWeight: 700, color: "#059669", whiteSpace: "nowrap" }}>{fmt(c.paid_amount || 0)}</td>
                            <td style={{ padding: "10px 13px", fontWeight: 900, color: "#dc2626", whiteSpace: "nowrap" }}>{fmt(c.remaining_amount || 0)}</td>
                            <td style={{ padding: "10px 13px" }}><StatusBadge status={c.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "#fff5f5", borderTop: "1.5px solid #fca5a5" }}>
                        <td colSpan={5} style={{ padding: "10px 13px", fontSize: 12, fontWeight: 900, color: "#6a7882" }}>Total Outstanding</td>
                        <td style={{ padding: "10px 13px", fontWeight: 900, color: "#dc2626", fontSize: 15 }}>{fmt(totalPending)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── Filters ── */}
            <div style={{
              marginBottom: 16, padding: "14px 18px",
              borderRadius: 12, background: "#fff",
              border: "1px solid #e5ebee",
              display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
            }}>
              <div style={{
                flex: 1, minWidth: 200, minHeight: 38,
                border: "1.5px solid #d4dde2", borderRadius: 8,
                display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
                background: "#f8fafc",
              }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 12 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by fee name…"
                  style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, fontWeight: 600, color: "#1f2d36" }}
                />
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                style={{ minHeight: 38, border: "1.5px solid #d4dde2", borderRadius: 8, padding: "0 12px", fontSize: 13, fontWeight: 700, background: "#fff", color: "#1f2d36", outline: "none" }}
              >
                <option value="all">All Types</option>
                <option value="academic">Academic</option>
                <option value="transport">Transport</option>
                <option value="hostel">Hostel</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ minHeight: 38, border: "1.5px solid #d4dde2", borderRadius: 8, padding: "0 12px", fontSize: 13, fontWeight: 700, background: "#fff", color: "#1f2d36", outline: "none" }}
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
                <option value="waived">Waived</option>
              </select>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882", marginLeft: "auto" }}>
                {filtered.length} record{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* ── Monthly groups ── */}
            {monthGroups.length === 0 ? (
              <div style={{
                padding: "4rem 2rem", textAlign: "center",
                border: "2px dashed #d4dde2", borderRadius: 14, background: "#fff",
              }}>
                <i className="fa-solid fa-file-invoice" style={{ fontSize: 32, color: "#c8d6de", display: "block", marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: "#6a7882", margin: 0 }}>No fee records found.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {monthGroups.map(([monthKey, cols]) => {
                  const monthPaid    = cols.reduce((a, c) => a + parseFloat(c.paid_amount   || 0), 0);
                  const monthTotal   = cols.reduce((a, c) => a + parseFloat(c.net_amount    || 0), 0);
                  const monthPending = cols.reduce((a, c) => a + parseFloat(c.remaining_amount || 0), 0);
                  const allPaid      = monthPending === 0;
                  const label        = monthKey === "unknown" ? "No Due Date" : monthKey;

                  return (
                    <div key={monthKey} style={{
                      borderRadius: 14, background: "#fff",
                      border: `1px solid ${allPaid ? "#bbf7d0" : "#e5ebee"}`,
                      boxShadow: "0 1px 8px rgba(31,45,54,.05)",
                      overflow: "hidden",
                    }}>
                      {/* Month header */}
                      <div style={{
                        padding: "13px 18px",
                        borderBottom: "1px solid #f1f5f9",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                        background: allPaid ? "#f0fdf4" : "#f8fafc",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 9,
                            background: allPaid ? "#dcfce7" : "#f1f5f9",
                            color:      allPaid ? "#16a34a" : "#64748b",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                          }}>
                            <i className={`fa-solid ${allPaid ? "fa-circle-check" : "fa-calendar-days"}`} />
                          </div>
                          <div>
                            <strong style={{ fontSize: 15, fontWeight: 900, color: "#1f2d36", display: "block" }}>
                              {label}
                            </strong>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882" }}>
                              {cols.length} bill{cols.length !== 1 ? "s" : ""}
                              {allPaid ? " · All paid" : monthPaid > 0 ? " · Partially paid" : " · Unpaid"}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#6a7882", textTransform: "uppercase" }}>Billed</span>
                            <strong style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>{fmt(monthTotal)}</strong>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#6a7882", textTransform: "uppercase" }}>Paid</span>
                            <strong style={{ fontSize: 14, fontWeight: 900, color: "#16a34a" }}>{fmt(monthPaid)}</strong>
                          </div>
                          {monthPending > 0 && (
                            <div style={{ textAlign: "right" }}>
                              <span style={{ display: "block", fontSize: 10, fontWeight: 800, color: "#6a7882", textTransform: "uppercase" }}>Pending</span>
                              <strong style={{ fontSize: 14, fontWeight: 900, color: "#dc2626" }}>{fmt(monthPending)}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Collections in this month */}
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                              {["Fee Name", "Type", "Due Date", "Invoice", "Discount", "Paid", "Remaining", "Status"].map(h => (
                                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {cols.map((c: any, i: number) => {
                              const isOverdue = c.status !== "paid" && c.status !== "waived" && new Date(c.due_date) < new Date();
                              return (
                                <>
                                  <tr
                                    key={c.id}
                                    style={{
                                      borderBottom: c._payments.length ? "none" : "1px solid #f8fafc",
                                      background: i % 2 ? "#fafcfd" : "#fff",
                                    }}
                                  >
                                    <td style={{ padding: "11px 14px", fontWeight: 800, color: "#1f2d36" }}>
                                      {c.fee_name}
                                      {isOverdue && (
                                        <span style={{ display: "block", fontSize: 9, fontWeight: 900, color: "#dc2626", letterSpacing: 0.5, marginTop: 2 }}>OVERDUE</span>
                                      )}
                                    </td>
                                    <td style={{ padding: "11px 14px" }}><TypeBadge type={c.fee_type || "academic"} /></td>
                                    <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 700, color: isOverdue ? "#dc2626" : "#6a7882", whiteSpace: "nowrap" }}>
                                      {formatDate(c.due_date?.slice(0, 10))}
                                    </td>
                                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{fmt(c.net_amount)}</td>
                                    <td style={{ padding: "11px 14px", fontWeight: 700, color: c.discount_amount > 0 ? "#16a34a" : "#c8d6de", whiteSpace: "nowrap" }}>
                                      {c.discount_amount > 0 ? `-${fmt(c.discount_amount)}` : "—"}
                                    </td>
                                    <td style={{ padding: "11px 14px", fontWeight: 700, color: "#16a34a", whiteSpace: "nowrap" }}>{fmt(c.paid_amount || 0)}</td>
                                    <td style={{ padding: "11px 14px", fontWeight: 900, color: parseFloat(c.remaining_amount || 0) > 0 ? "#dc2626" : "#16a34a", whiteSpace: "nowrap" }}>
                                      {fmt(c.remaining_amount || 0)}
                                    </td>
                                    <td style={{ padding: "11px 14px" }}><StatusBadge status={c.status} /></td>
                                  </tr>
                                  {/* Payment receipts sub-rows */}
                                  {c._payments.map((p: any) => (
                                    <tr key={`pay-${p.id}`} style={{ background: "#f0fdf4", borderBottom: "1px solid #dcfce7" }}>
                                      <td colSpan={2} style={{ padding: "7px 14px 7px 30px", fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
                                        <i className="fa-solid fa-arrow-turn-down-right" style={{ marginRight: 6, opacity: 0.6 }} />
                                        <Link
                                          href={`/fees/receipt/${p.id}`}
                                          style={{ color: "#c46a14", fontWeight: 900, textDecoration: "none", fontFamily: "monospace", fontSize: 12 }}
                                        >
                                          {p.receipt_number || `#${p.id}`}
                                        </Link>
                                      </td>
                                      <td style={{ padding: "7px 14px", fontSize: 11, fontWeight: 700, color: "#6a7882", whiteSpace: "nowrap" }}>
                                        {formatDate(p.payment_date?.slice(0, 10))}
                                      </td>
                                      <td colSpan={2} style={{ padding: "7px 14px", fontSize: 11, fontWeight: 700, color: "#6a7882", textTransform: "capitalize" }}>
                                        {(p.payment_method || "").replace(/_/g, " ")}
                                      </td>
                                      <td style={{ padding: "7px 14px", fontWeight: 900, color: "#16a34a", fontSize: 12, whiteSpace: "nowrap" }}>
                                        {fmt(p.paid_amount || 0)}
                                      </td>
                                      <td colSpan={2} />
                                    </tr>
                                  ))}
                                </>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: "#f8fafc", borderTop: "1.5px solid #e5ebee" }}>
                              <td colSpan={3} style={{ padding: "10px 14px", fontSize: 12, fontWeight: 900, color: "#6a7882" }}>Month Total</td>
                              <td style={{ padding: "10px 14px", fontWeight: 900, color: "#1f2d36", whiteSpace: "nowrap" }}>{fmt(monthTotal)}</td>
                              <td />
                              <td style={{ padding: "10px 14px", fontWeight: 900, color: "#16a34a", whiteSpace: "nowrap" }}>{fmt(monthPaid)}</td>
                              <td style={{ padding: "10px 14px", fontWeight: 900, color: monthPending > 0 ? "#dc2626" : "#16a34a", whiteSpace: "nowrap" }}>{fmt(monthPending)}</td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Progress bar */}
                      {monthTotal > 0 && (
                        <div style={{ padding: "10px 18px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, height: 7, borderRadius: 999, background: "#e5ebee", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", borderRadius: 999,
                              width: `${Math.min(100, (monthPaid / monthTotal) * 100).toFixed(1)}%`,
                              background: allPaid ? "#16a34a" : "linear-gradient(90deg,#ff9b51,#ea580c)",
                              transition: "width .5s ease",
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: allPaid ? "#16a34a" : "#c46a14", whiteSpace: "nowrap" }}>
                            {((monthPaid / monthTotal) * 100).toFixed(0)}% paid
                          </span>
                          {monthPending > 0 && studentId && (
                            <Link
                              href={`/fees/collect?student_id=${studentId}`}
                              style={{
                                padding: "4px 12px", borderRadius: 7, background: "#ff9b51",
                                color: "#fff", fontSize: 11, fontWeight: 900, textDecoration: "none",
                                display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                              }}
                            >
                              <i className="fa-solid fa-plus" /> Collect
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
