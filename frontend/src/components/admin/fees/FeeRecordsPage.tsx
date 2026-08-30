"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";

import { useCurrency } from "@/lib/useCurrency";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  academic:  { label: "Academic",  cls: "badgeBlue"   },
  transport: { label: "Transport", cls: "badgeYellow" },
  hostel:    { label: "Hostel",    cls: "badgePurple" },
};

const STATUS_BADGE: Record<string, string> = {
  paid:    "badgeGreen",
  partial: "badgeYellow",
  unpaid:  "badgeRed",
  waived:  "badgeBlue",
};

// ── Payments modal — shows payments for one collection with print links ──────
function PaymentsModal({
  collection,
  onClose,
}: {
  collection: any;
  onClose: () => void;
}) {
  const { formatDate, formatFeeName } = useDateFormat();
  const { fmt: formatCurrency } = useCurrency();
  const { data: payments, loading } = useApi<any[]>(
    collection ? `/fees/payments/collection/${collection.id}` : ""
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16, width: "100%", maxWidth: 640,
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)", overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="fa-solid fa-receipt" style={{ color: "#FF9B51" }} />
              Payment History & Receipts
            </h3>
            <p style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, marginTop: 3 }}>
              {formatFeeName(collection.fee_name)} · {collection.full_name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, color: "#64748b" }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px", maxHeight: 420, overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2.5rem" }}><Spinner size={28} color="#ff9b51" /></div>
          ) : !payments?.length ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: 32, display: "block", marginBottom: 8, opacity: 0.25 }} />
              <p style={{ fontWeight: 700, fontSize: 13 }}>No payment receipts recorded yet.</p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Receipt No.", "Date", "Amount", "Method", "Action"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid #e2e8f0" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 800, color: "#0f172a" }}>{p.receipt_number}</td>
                    <td style={{ padding: "12px 14px", color: "#64748b", fontWeight: 600 }}>
                      {formatDate(p.payment_date?.slice(0, 10))}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 900, color: "#059669" }}>{formatCurrency(p.paid_amount)}</td>
                    <td style={{ padding: "12px 14px", color: "#475569", fontWeight: 600, textTransform: "capitalize" }}>
                      {(p.payment_method || "—").replace(/_/g, " ")}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <a
                        href={`/fees/receipt/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "6px 12px", borderRadius: 7,
                          background: "#0f172a", color: "#fff",
                          fontWeight: 700, fontSize: 11.5, textDecoration: "none",
                        }}
                      >
                        <i className="fa-solid fa-print" style={{ fontSize: 11 }} />
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
  const dispatch = useAppDispatch();
  const { formatDate, formatFeeName } = useDateFormat();
  const { fmt: formatCurrency, symbol: currSymbol } = useCurrency();
  const { academicYearId } = useAcademicYear();
  const { data: collections, loading, error, refetch } = useApi<any[]>(
    academicYearId ? `/fees/collections?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );
  const { data: classes } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );

  const [search,        setSearch]        = useState("");
  const [classFilter,   setClassFilter]   = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [modalCol,      setModalCol]      = useState<any | null>(null);
  const [waiving,       setWaiving]       = useState<number | null>(null);
  const [fineTarget,    setFineTarget]    = useState<any | null>(null);
  const [fineAmount,    setFineAmount]    = useState("");
  const [fineReason,    setFineReason]    = useState("");
  const [addingFine,    setAddingFine]    = useState(false);

  // Fetch sections for the selected class
  const { data: sections } = useApi<any[]>(
    classFilter !== "all" ? `/classes/${classFilter}/sections` : "",
    [classFilter]
  );

  // Available sections (API or derived from collections fallback)
  const availableSections = useMemo(() => {
    if (sections && sections.length > 0) return sections;
    if (classFilter === "all") return [];
    const secMap = new Map<string, any>();
    const selectedClassObj = classes?.find(c => String(c.id) === classFilter);
    (collections || []).forEach(c => {
      const matchCls = String(c.class_id) === classFilter ||
        (selectedClassObj && c.class_name?.toLowerCase() === selectedClassObj.name?.toLowerCase()) ||
        c.class_name?.toLowerCase() === classFilter.toLowerCase();
      if (matchCls && c.section_name) {
        secMap.set(c.section_name, { id: c.section_id || c.section_name, name: c.section_name });
      }
    });
    return Array.from(secMap.values());
  }, [sections, classFilter, collections, classes]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  const handleExportCSV = () => {
    if (!filtered.length) {
      return dispatch(showToast({ type: "error", title: "No Records", message: "No records to export." }));
    }
    const headers = ["Student Name", "Admission / Roll No", "Class", "Section", "Fee Title", "Due Date", `Total (${currSymbol})`, `Paid (${currSymbol})`, `Remaining Due (${currSymbol})`, "Status"];
    const rows = filtered.map(col => {
      let rawFee = col.fee_name || "Fee";
      let cleanTitle = rawFee.replace(/\s*\([^)]*\)/g, "").trim() || rawFee;
      return [
        `"${(col.full_name || "").replace(/"/g, '""')}"`,
        `"${(col.admission_number || col.student_roll || "").replace(/"/g, '""')}"`,
        `"${(col.class_name || "").replace(/"/g, '""')}"`,
        `"${(col.section_name || "").replace(/"/g, '""')}"`,
        `"${cleanTitle.replace(/"/g, '""')}"`,
        `"${col.due_date ? col.due_date.slice(0, 10) : ""}"`,
        parseFloat(col.total_amount || 0).toFixed(2),
        parseFloat(col.paid_amount || 0).toFixed(2),
        parseFloat(col.remaining_amount || col.total_amount || 0).toFixed(2),
        `"${col.status || ""}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `Fee_Records_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    dispatch(showToast({ type: "success", title: "Exported", message: `Exported ${filtered.length} fee records to CSV.` }));
  };

  const handleAddFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineTarget) return;
    const amt = parseFloat(fineAmount);
    if (!amt || amt <= 0) return dispatch(showToast({ type: 'error', title: 'Error', message: 'Enter a valid fine amount.' }));
    setAddingFine(true);
    try {
      await apiRequest(`/fees/collections/${fineTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ fine_amount: amt, fine_reason: fineReason || 'Late payment fine' }),
      });
      dispatch(showToast({ type: 'success', title: 'Fine Applied', message: `${currSymbol} ${fineAmount} fine added to ${fineTarget.fee_name}.` }));
      refetch();
      setFineTarget(null); setFineAmount(''); setFineReason('');
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: err.message || 'Could not apply fine.' }));
    } finally { setAddingFine(false); }
  };

  const handleWaive = async (col: any) => {
    const reason = window.prompt(`Waive reason for "${col.fee_name}" (${col.full_name})?`, 'Waived by admin');
    if (reason === null) return;
    setWaiving(col.id);
    try {
      await apiRequest(`/fees/collections/${col.id}/waive`, { method: 'POST', body: JSON.stringify({ reason: reason || 'Waived by admin' }) });
      dispatch(showToast({ type: 'success', title: 'Fee Waived', message: `${col.fee_name} has been waived.` }));
      refetch();
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: err.message || 'Could not waive fee.' }));
    } finally {
      setWaiving(null);
    }
  };

  const filtered = useMemo(() => {
    const selectedClassObj = classes?.find(c => String(c.id) === classFilter);
    return (collections || []).filter(col => {
      const q = search.toLowerCase();
      const matchSearch =
        col.fee_name?.toLowerCase().includes(q) ||
        col.full_name?.toLowerCase().includes(q) ||
        col.admission_number?.toLowerCase().includes(q) ||
        col.student_roll?.toLowerCase().includes(q);

      const matchClass =
        classFilter === "all" ||
        String(col.class_id) === classFilter ||
        (selectedClassObj && col.class_name?.toLowerCase() === selectedClassObj.name?.toLowerCase()) ||
        col.class_name?.toLowerCase() === classFilter.toLowerCase();

      const matchSection =
        sectionFilter === "all" ||
        String(col.section_id) === sectionFilter ||
        col.section_name?.toLowerCase() === sectionFilter.toLowerCase();

      const matchStatus  = statusFilter  === "all" || col.status === statusFilter;
      const matchType    = typeFilter    === "all" || (col.fee_type || "academic") === typeFilter;
      return matchSearch && matchClass && matchSection && matchStatus && matchType;
    });
  }, [collections, search, classFilter, sectionFilter, statusFilter, typeFilter, classes]);

  // Paginated records
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalPaid    = (collections || []).reduce((s, c) => s + parseFloat(c.paid_amount || "0"), 0);
  const totalPending = (collections || []).filter(c => c.status !== "paid" && c.status !== "waived")
    .reduce((s, c) => s + parseFloat(c.remaining_amount || "0"), 0);
  const transportBills = (collections || []).filter(c => (c.fee_type || "academic") === "transport").length;

  return (
    <div className={s("feesPage")}>
      <main className={s("pageContent")}>

        {/* ── Page Header ── */}
        <section className={s("pageHead")}>
          <div className={s("headLeft")}>
            <div className={s("headIcon")}>
              <i className="fa-solid fa-table-list" />
            </div>
            <div>
              <h1>All Fee Records</h1>
              <p>Track collected fees, pending student dues, and view payment receipts.</p>
            </div>
          </div>
          <div className={s("headActions")}>
            <Link className={cx(s("btn"), s("btnOutline"))} href="/fees">
              <i className="fa-solid fa-arrow-left" /> Fee Overview
            </Link>
            <Link className={cx(s("btn"), s("btnPrimary"))} href="/fees/collect">
              <i className="fa-solid fa-hand-holding-dollar" /> Collect Fee
            </Link>
          </div>
        </section>

        {/* ── 4 Compact Stat Cards (~75px) ── */}
        <section className={s("heroCards")}>
          <article className={cx(s("heroCard"), s("c1"))}>
            <div className={s("hcInfo")}>
              <span className={s("hcLabel")}>Total Collected</span>
              <strong className={s("hcValue")}>{formatCurrency(totalPaid)}</strong>
              <span className={s("hcSub")}>Active academic year</span>
            </div>
            <div className={s("hcIcon")}><i className="fa-solid fa-wallet" /></div>
          </article>

          <article className={cx(s("heroCard"), s("c3"))}>
            <div className={s("hcInfo")}>
              <span className={s("hcLabel")}>Total Invoices</span>
              <strong className={s("hcValue")}>{collections?.length || 0}</strong>
              <span className={s("hcSub")}>Generated records</span>
            </div>
            <div className={s("hcIcon")}><i className="fa-solid fa-receipt" /></div>
          </article>

          <article className={cx(s("heroCard"), s("c4"))}>
            <div className={s("hcInfo")}>
              <span className={s("hcLabel")}>Transport & Facility</span>
              <strong className={s("hcValue")}>{transportBills}</strong>
              <span className={s("hcSub")}>Billed facility records</span>
            </div>
            <div className={s("hcIcon")}><i className="fa-solid fa-bus" /></div>
          </article>

          <article className={cx(s("heroCard"), s("c2"))}>
            <div className={s("hcInfo")}>
              <span className={s("hcLabel")}>Total Outstanding</span>
              <strong className={s("hcValue")}>{formatCurrency(totalPending)}</strong>
              <span className={s("hcSub")}>Pending student dues</span>
            </div>
            <div className={s("hcIcon")}><i className="fa-solid fa-clock-rotate-left" /></div>
          </article>
        </section>

        {/* ── Toolbar (Search & Filter dropdowns) ── */}
        <section className={s("subBar")} style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
            <div className={s("searchField")} style={{ maxWidth: 300, minWidth: 200 }}>
              <i className="fa-solid fa-magnifying-glass" />
              <input
                type="search"
                placeholder="Search by student, roll no, fee…"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={e => {
                  setClassFilter(e.target.value);
                  setSectionFilter("all");
                  setCurrentPage(1);
                }}
                style={{
                  height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#0f172a", fontSize: 12.5, fontWeight: 700, outline: "none", cursor: "pointer",
                }}
              >
                <option value="all">All Classes</option>
                {classes?.map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.name}</option>
                ))}
              </select>

              {/* Section Filter */}
              <select
                value={sectionFilter}
                onChange={e => { setSectionFilter(e.target.value); setCurrentPage(1); }}
                disabled={classFilter === "all" || !availableSections.length}
                style={{
                  height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                  background: classFilter === "all" || !availableSections.length ? "#f8fafc" : "#fff",
                  color: classFilter === "all" || !availableSections.length ? "#94a3b8" : "#0f172a",
                  fontSize: 12.5, fontWeight: 700, outline: "none",
                  cursor: classFilter === "all" || !availableSections.length ? "not-allowed" : "pointer",
                }}
              >
                <option value="all">All Sections</option>
                {availableSections.map((sec: any) => (
                  <option key={sec.id || sec.name} value={sec.name}>{sec.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                style={{
                  height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#0f172a", fontSize: 12.5, fontWeight: 700, outline: "none", cursor: "pointer",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
                <option value="waived">Waived</option>
              </select>

              {/* Fee Type Filter */}
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                style={{
                  height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#0f172a", fontSize: 12.5, fontWeight: 700, outline: "none", cursor: "pointer",
                }}
              >
                <option value="all">All Fee Types</option>
                <option value="academic">Academic Fees</option>
                <option value="transport">Transport</option>
                <option value="hostel">Hostel</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#64748b" }}>
            Showing <strong>{filtered.length}</strong> record{filtered.length !== 1 ? "s" : ""}
          </div>
        </section>

        {/* ── Table Card ── */}
        <section className={s("card")}>
          <div className={s("cardHead")}>
            <div>
              <h3><i className="fa-solid fa-table-list" /> Collection Records</h3>
              <p>Detailed breakdown of fee payments, dues, and transaction histories</p>
            </div>
            <div>
              <button
                type="button"
                onClick={handleExportCSV}
                className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                title="Download CSV report for class section teachers & accounting"
              >
                <i className="fa-solid fa-file-csv" style={{ color: "#059669" }} /> Export CSV
              </button>
            </div>
          </div>

          <div className={s("tableWrap")}>
            {loading ? (
              <div style={{ padding: "4rem", textAlign: "center" }}>
                <Spinner size={32} color="#FF9B51" />
                <p style={{ marginTop: 10, color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Loading fee records…</p>
              </div>
            ) : error ? (
              <div style={{ padding: "2.5rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div className={s("emptyState")}>
                <div className={s("emptyIcon")}><i className="fa-solid fa-inbox" /></div>
                <p>No fee records match the selected search or filters.</p>
              </div>
            ) : (
              <table className={s("table")}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class & Section</th>
                    <th>Fee Title</th>
                    <th>Due Date</th>
                    <th>Amount (Due / Total)</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map(col => {
                    const isOverdue = col.status !== "paid" && col.status !== "waived" && Boolean(col.due_date) && new Date(col.due_date) < new Date();
                    const hasPaid   = col.status === "paid" || col.status === "partial";
                    const isFullyPaid = col.status === "paid";
                    const isWaived    = col.status === "waived";

                    // Parse Fee Title and Month Range Period
                    let rawFee = col.fee_name || "Fee";
                    const formattedFee = formatFeeName(rawFee);
                    const parenMatch = formattedFee.match(/\(([^)]+)\)/);
                    let cleanTitle = formattedFee.replace(/\s*\([^)]*\)/g, "").trim();
                    if (!cleanTitle) cleanTitle = rawFee;
                    cleanTitle = cleanTitle.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

                    let feePeriod = "";
                    if (parenMatch) {
                      let inner = parenMatch[1].replace(/·\s*\d+\s*Months?/i, "").trim();
                      const rangeMatch = inner.match(/([A-Za-z]+)\s*(\d{4})?\s*(?:to|–|-)\s*([A-Za-z]+)\s*(\d{4})/i);
                      if (rangeMatch) {
                        const m1 = rangeMatch[1];
                        const y1 = rangeMatch[2];
                        const m2 = rangeMatch[3];
                        const y2 = rangeMatch[4];
                        if (y1 && y1 !== y2) {
                          feePeriod = `${m1} ${y1} – ${m2} ${y2}`;
                        } else {
                          feePeriod = `${m1} – ${m2} ${y2}`;
                        }
                      } else {
                        feePeriod = inner;
                      }
                    }

                    const totalAmt = parseFloat(col.total_amount || 0);
                    const remAmt   = parseFloat(col.remaining_amount || col.total_amount || 0);
                    const paidAmt  = parseFloat(col.paid_amount || 0);

                    return (
                      <tr key={col.id} style={isOverdue ? { background: "#fffaf5" } : undefined}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span className={s("studentName")}>
                              {col.full_name || `Student #${col.student_id}`}
                            </span>
                            <span className={s("studentCode")}>
                              {col.admission_number || col.student_roll || "—"}
                            </span>
                          </div>
                        </td>
                        <td>
                          {col.class_name ? (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: "#1e40af",
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                padding: "2px 7px",
                                borderRadius: 6,
                                whiteSpace: "nowrap",
                              }}>
                                {col.class_name}
                              </span>
                              {col.section_name && (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: "#7c3aed",
                                  background: "#faf5ff",
                                  border: "1px solid #e9d5ff",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  whiteSpace: "nowrap",
                                }}>
                                  Sec {col.section_name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span className={s("feeTitle")} style={{ fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                              {cleanTitle}
                            </span>
                            {feePeriod && (
                              <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#b45309",
                                background: "#fffbeb",
                                border: "1px solid #fde68a",
                                padding: "1.5px 7px",
                                borderRadius: 5,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                width: "fit-content",
                                whiteSpace: "nowrap",
                              }}>
                                <i className="fa-regular fa-calendar" style={{ fontSize: 10, color: "#d97706" }} />
                                {feePeriod}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={s("dateCell")}>
                            {col.due_date ? formatDate(col.due_date.slice(0, 10)) : "—"}
                          </span>
                          {isOverdue && (
                            <span style={{ display: "block", fontSize: 10, color: "#dc2626", fontWeight: 900, marginTop: 1 }}>
                              OVERDUE
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            {isFullyPaid ? (
                              <>
                                <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#059669" }}>{formatCurrency(totalAmt)}</strong>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>· Paid</span>
                              </>
                            ) : isWaived ? (
                              <>
                                <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#64748b" }}>{currSymbol}0</strong>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6" }}>· Waived</span>
                              </>
                            ) : paidAmt > 0 ? (
                              <>
                                <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#ea580c" }}>{formatCurrency(remAmt)}</strong>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>/ {formatCurrency(totalAmt)}</span>
                              </>
                            ) : (
                              <>
                                <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{formatCurrency(remAmt)}</strong>
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Due</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={cx(s("badge"), s(STATUS_BADGE[col.status] || "badgeGray"))}>
                            {col.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                            {hasPaid && (
                              <button
                                onClick={() => setModalCol(col)}
                                title="View Receipts"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "5px 10px", borderRadius: 7, border: "none",
                                  background: "#0f172a", color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer",
                                }}
                              >
                                <i className="fa-solid fa-receipt" style={{ fontSize: 10 }} /> Receipts
                              </button>
                            )}
                            {col.status !== "paid" && col.status !== "waived" && (
                              <Link
                                className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                                href={`/fees/collect?student_id=${col.student_id}`}
                              >
                                <i className="fa-solid fa-hand-holding-dollar" /> Collect
                              </Link>
                            )}
                            {col.status !== "paid" && col.status !== "waived" && (
                              <button
                                onClick={() => handleWaive(col)}
                                disabled={waiving === col.id}
                                title="Waive fee"
                                className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                                style={{ color: "#d97706", borderColor: "#fde68a" }}
                              >
                                {waiving === col.id ? <Spinner size={10} /> : <i className="fa-solid fa-ban" />} Waive
                              </button>
                            )}
                            {col.status !== "paid" && col.status !== "waived" && isOverdue && (
                              <button
                                onClick={() => { setFineTarget(col); setFineAmount(''); setFineReason(''); }}
                                title="Apply late fine"
                                className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                                style={{ color: "#dc2626", borderColor: "#fecaca" }}
                              >
                                <i className="fa-solid fa-bolt" /> Fine
                              </button>
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

          {/* ── Table Pagination Footer ── */}
          {filtered.length > pageSize && (
            <div style={{
              padding: "14px 20px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              background: "#ffffff",
            }}>
              <div style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>
                <span>
                  Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>–<strong>{Math.min(currentPage * pageSize, filtered.length)}</strong> of <strong>{filtered.length}</strong> records
                </span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  style={{
                    height: 30, padding: "0 8px", borderRadius: 6, border: "1.5px solid #e2e8f0",
                    background: "#fff", color: "#475569", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer",
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                  style={{ padding: "0 10px" }}
                >
                  <i className="fa-solid fa-chevron-left" /> Prev
                </button>

                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={cx(s("btn"), currentPage === pNum ? s("btnPrimary") : s("btnOutline"), s("btnSm"))}
                      style={{ minWidth: 32, padding: 0 }}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                  style={{ padding: "0 10px" }}
                >
                  Next <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Payments modal */}
      {modalCol && (
        <PaymentsModal collection={modalCol} onClose={() => setModalCol(null)} />
      )}

      {/* Add Fine modal */}
      {fineTarget && (
        <div
          onClick={() => setFineTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)', overflow: 'hidden', border: '1px solid #e2e8f0' }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fa-solid fa-bolt" style={{ color: '#ea580c' }} />
                  Apply Late Fine
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginTop: 2 }}>{formatFeeName(fineTarget.fee_name)} · {fineTarget.full_name}</p>
              </div>
              <button onClick={() => setFineTarget(null)}
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 13, color: '#64748b' }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleAddFine} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className={s("field")}>
                <span>Fine Amount (₹) <b>*</b></span>
                <input
                  value={fineAmount}
                  onChange={e => setFineAmount(e.target.value)}
                  type="number" min="0.01" step="0.01" required placeholder="0.00"
                  autoFocus
                />
              </label>
              <label className={s("field")}>
                <span>Reason / Remarks</span>
                <input
                  value={fineReason}
                  onChange={e => setFineReason(e.target.value)}
                  placeholder="e.g. Late payment charge after due date"
                />
              </label>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="button" onClick={() => setFineTarget(null)}
                  className={cx(s("btn"), s("btnOutline"))} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" disabled={addingFine}
                  className={cx(s("btn"), s("btnPrimary"))} style={{ flex: 1 }}>
                  {addingFine ? <><Spinner size={14} color="#fff" /> Applying…</> : <><i className="fa-solid fa-check" /> Apply Fine</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
