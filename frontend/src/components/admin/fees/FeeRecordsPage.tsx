"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { apiRequest } from "@/lib/api";
import Loader, { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { useDebounce } from "@/hooks/useDebounce";

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
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          overflow: "hidden", border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#f8fafc",
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
              <i className="fa-solid fa-receipt" style={{ color: "#ea580c", marginRight: 8 }} />
              Payment Receipts
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              {formatFeeName(collection?.fee_name)} · {collection?.full_name}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid #e2e8f0",
              background: "#fff", cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#64748b", fontSize: 14,
            }}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 24px", maxHeight: 420, overflowY: "auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem" }}><Loader fullScreen={false} size="sm" text="Loading receipts…" /></div>
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
                    <td style={{ padding: "12px 14px", fontWeight: 800, color: "#16a34a" }}>
                      {formatCurrency(p.paid_amount)}
                    </td>
                    <td style={{ padding: "12px 14px", textTransform: "capitalize", color: "#334155", fontWeight: 600 }}>
                      {p.payment_mode || "cash"}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <Link
                        href={`/fees/receipt/${p.id}`}
                        target="_blank"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 6,
                          background: "#f1f5f9", color: "#0f172a", textDecoration: "none",
                          fontSize: 12, fontWeight: 700, border: "1px solid #cbd5e1",
                        }}
                      >
                        <i className="fa-solid fa-print" /> View Receipt
                      </Link>
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

function getPaginationItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const items: (number | "...")[] = [];
  if (current <= 4) {
    items.push(1, 2, 3, 4, 5, "...", total);
  } else if (current >= total - 3) {
    items.push(1, "...", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    items.push(1, "...", current - 1, current, current + 1, "...", total);
  }
  return items;
}

interface FeeRecordsPageProps {
  basePath?: string;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FeeRecordsPage({ basePath }: FeeRecordsPageProps = {}) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isFinance = user?.role === 'finance';
  const overviewUrl = isFinance ? '/finance/dashboard' : (basePath || '/fees');
  const collectUrl = isFinance ? '/finance/fees/collect' : '/fees/collect';

  const { formatDate, formatFeeName } = useDateFormat();
  const { fmt: formatCurrency, symbol: currSymbol } = useCurrency();
  const { academicYearId } = useAcademicYear();

  // ── filter state ──────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState("");
  const [classFilter,   setClassFilter]   = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [typeFilter,    setTypeFilter]    = useState("all");
  const [currentPage,   setCurrentPage]   = useState(1);
  const [pageSize,      setPageSize]      = useState(10);

  // debounce search so we don't fire on every keystroke
  const debouncedSearch = useDebounce(search, 350);

  // ── modal / action state ──────────────────────────────────────────────────
  const [modalCol,   setModalCol]   = useState<any | null>(null);
  const [waiving,    setWaiving]    = useState<number | null>(null);
  const [fineTarget, setFineTarget] = useState<any | null>(null);
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [addingFine, setAddingFine] = useState(false);

  // ── build server-side URL — all filtering & pagination happen on the backend
  const collectionsUrl = useMemo(() => {
    if (!academicYearId) return "";
    const p = new URLSearchParams();
    p.set("academic_year_id", String(academicYearId));
    p.set("page",  String(currentPage));
    p.set("limit", String(pageSize));
    if (debouncedSearch)              p.set("search",     debouncedSearch);
    if (classFilter   !== "all")      p.set("class_id",   classFilter);
    if (sectionFilter !== "all")      p.set("section_id", sectionFilter);
    if (statusFilter  !== "all")      p.set("status",     statusFilter);
    if (typeFilter    !== "all")      p.set("fee_type",   typeFilter);
    return `/fees/collections?${p.toString()}`;
  }, [academicYearId, currentPage, pageSize, debouncedSearch, classFilter, sectionFilter, statusFilter, typeFilter]);

  const { data: apiResult, loading, error, refetch } = useApi<{
    data: any[];
    total: number;
    total_collected?: number;
    total_pending?: number;
    transport_bills_count?: number;
  }>(
    collectionsUrl,
    [collectionsUrl]
  );

  const collections   = apiResult?.data  ?? [];
  const totalRecords  = apiResult?.total ?? 0;
  const totalPages    = Math.max(1, Math.ceil(totalRecords / pageSize));

  // ── classes & sections for the filter dropdowns ───────────────────────────
  const { data: classes } = useApi<any[]>(
    academicYearId ? `/classes?academic_year_id=${academicYearId}` : "",
    [academicYearId]
  );
  const { data: sections } = useApi<any[]>(
    classFilter !== "all" ? `/classes/${classFilter}/sections` : "",
    [classFilter]
  );
  const availableSections: any[] = sections ?? [];

  // reset page when filters change
  const resetPage = useCallback(() => setCurrentPage(1), []);

  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!totalRecords) {
      return dispatch(showToast({ type: "error", title: "No Records", message: "No records to export." }));
    }
    setExporting(true);
    try {
      const p = new URLSearchParams();
      p.set("academic_year_id", String(academicYearId));
      p.set("page", "1");
      p.set("limit", String(Math.min(totalRecords, 10000)));
      if (debouncedSearch)              p.set("search",     debouncedSearch);
      if (classFilter   !== "all")      p.set("class_id",   classFilter);
      if (sectionFilter !== "all")      p.set("section_id", sectionFilter);
      if (statusFilter  !== "all")      p.set("status",     statusFilter);
      if (typeFilter    !== "all")      p.set("fee_type",   typeFilter);

      const res = await apiRequest<{ data: any[]; total: number }>(`/fees/collections?${p.toString()}`);
      const exportList: any[] = res?.data ?? (Array.isArray(res) ? res : []);
      if (!exportList.length) {
        return dispatch(showToast({ type: "error", title: "No Records", message: "No records found to export." }));
      }

      const headers = ["Student Name", "Admission / Roll No", "Class", "Section", "Fee Title", "Due Date", `Total (${currSymbol})`, `Paid (${currSymbol})`, `Remaining Due (${currSymbol})`, "Status"];
      const rows = exportList.map(col => {
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
      dispatch(showToast({ type: "success", title: "Exported", message: `Exported ${exportList.length} fee records to CSV.` }));
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Export Failed", message: err?.message || "Could not export CSV." }));
    } finally {
      setExporting(false);
    }
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

  // Stat card aggregates — provided by server for the entire filtered dataset.
  const totalPaid      = apiResult?.total_collected ?? 0;
  const totalPending   = apiResult?.total_pending ?? 0;
  const transportBills = apiResult?.transport_bills_count ?? 0;

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
            <Link className={cx(s("btn"), s("btnOutline"))} href={overviewUrl}>
              <i className="fa-solid fa-arrow-left" /> Fee Overview
            </Link>
            {isFinance && (
              <Link className={cx(s("btn"), s("btnPrimary"))} href={collectUrl}>
                <i className="fa-solid fa-hand-holding-dollar" /> Collect Fee
              </Link>
            )}
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
              <strong className={s("hcValue")}>{totalRecords}</strong>
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
                onChange={e => { setSearch(e.target.value); resetPage(); }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Class Filter */}
              <select
                value={classFilter}
                onChange={e => {
                  setClassFilter(e.target.value);
                  setSectionFilter("all");
                  resetPage();
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
                onChange={e => { setSectionFilter(e.target.value); resetPage(); }}
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
                onChange={e => { setStatusFilter(e.target.value); resetPage(); }}
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
                onChange={e => { setTypeFilter(e.target.value); resetPage(); }}
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
            Showing <strong>{totalRecords}</strong> record{totalRecords !== 1 ? "s" : ""}
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
                disabled={exporting || loading}
                className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                title="Download CSV report for class section teachers & accounting"
              >
                {exporting ? (
                  <>
                    <Spinner size={12} color="#059669" /> Exporting…
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-file-csv" style={{ color: "#059669" }} /> Export CSV
                  </>
                )}
              </button>
            </div>
          </div>

          <div className={s("tableWrap")}>
            {loading ? (
              <Loader fullScreen={false} size="md" text="Loading fee records…" />
            ) : error ? (
              <div style={{ padding: "2.5rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{error}</div>
            ) : collections.length === 0 ? (
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
                  {collections.map(col => {
                    const totalAmt = parseFloat(col.total_amount || 0);
                    const remAmt   = parseFloat(col.remaining_amount || col.total_amount || 0);
                    const paidAmt  = parseFloat(col.paid_amount || 0);
                    const isOverdue = col.status !== "paid" && col.status !== "waived" && Boolean(col.due_date) && new Date(col.due_date) < new Date();
                    const hasPaid   = col.status === "paid" || col.status === "partial" || paidAmt > 0;
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
                                <strong style={{ fontSize: 13.5, fontWeight: 900, color: paidAmt > 0 ? "#059669" : "#64748b" }}>
                                  {paidAmt > 0 ? formatCurrency(paidAmt) : formatCurrency(totalAmt)}
                                </strong>
                                {paidAmt > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>/ {formatCurrency(totalAmt)}</span>}
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
                            {isFinance && col.status !== "paid" && col.status !== "waived" && (
                              <Link
                                className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                                href={`${collectUrl}?student_id=${col.student_id}`}
                              >
                                <i className="fa-solid fa-hand-holding-dollar" /> Collect
                              </Link>
                            )}
                            {isFinance && col.status !== "paid" && col.status !== "waived" && (
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
                            {isFinance && col.status !== "paid" && col.status !== "waived" && isOverdue && (
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
          {totalRecords > pageSize && (
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
                  Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>–<strong>{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong>{totalRecords}</strong> records
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
                  onClick={() => setCurrentPage(1)}
                  className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                  style={{ padding: "0 8px" }}
                  title="First Page"
                >
                  <i className="fa-solid fa-angles-left" />
                </button>

                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                  style={{ padding: "0 10px" }}
                >
                  <i className="fa-solid fa-chevron-left" /> Prev
                </button>

                {getPaginationItems(currentPage, totalPages).map((item, idx) => {
                  if (item === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} style={{ minWidth: 28, textAlign: "center", color: "#94a3b8", fontWeight: 800 }}>
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={cx(s("btn"), currentPage === item ? s("btnPrimary") : s("btnOutline"), s("btnSm"))}
                      style={{ minWidth: 32, padding: 0 }}
                    >
                      {item}
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

                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                  style={{ padding: "0 8px" }}
                  title="Last Page"
                >
                  <i className="fa-solid fa-angles-right" />
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
