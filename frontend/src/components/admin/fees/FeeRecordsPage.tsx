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
  paid:      "badgeGreen",
  partial:   "badgeYellow",
  unpaid:    "badgeRed",
  waived:    "badgeBlue",
  cancelled: "badgeRed",
};

// ── Payments modal — shows payments for one collection with print links ──────
function PaymentsModal({
  collection,
  onClose,
  basePath,
}: {
  collection: any;
  onClose: () => void;
  basePath?: string;
}) {
  const { formatDate, formatFeeName } = useDateFormat();
  const { fmt: formatCurrency } = useCurrency();
  const { data: payments, loading } = useApi<any[]>(
    collection ? `/fees/payments/collection/${collection.id}` : ""
  );

  // Normalize basePath so /fees is never duplicated (e.g. "/finance/fees" -> "/finance")
  const cleanBase = (basePath || "").replace(/\/fees\/?$/, "");
  const receiptBase = `${cleanBase}/fees/receipt`;

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
                        href={`${receiptBase}/${p.id}`}
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

  // ── view tab state ("invoices" vs "receipts") ──────────────────────────────
  const [activeTab, setActiveTab] = useState<"invoices" | "receipts">("invoices");

  // ── filter state ──────────────────────────────────────────────────────────
  const [search,              setSearch]              = useState("");
  const [classFilter,         setClassFilter]         = useState("all");
  const [sectionFilter,       setSectionFilter]       = useState("all");
  const [statusFilter,        setStatusFilter]        = useState("all");
  const [typeFilter,          setTypeFilter]          = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [currentPage,         setCurrentPage]         = useState(1);
  const [pageSize,            setPageSize]            = useState(10);

  // debounce search so we don't fire on every keystroke
  const debouncedSearch = useDebounce(search, 350);

  // ── modal / action state ──────────────────────────────────────────────────
  const [modalCol,    setModalCol]    = useState<any | null>(null);
  const [waiving,     setWaiving]     = useState<number | null>(null);
  const [waiveTarget, setWaiveTarget] = useState<any | null>(null);
  const [waiveReason, setWaiveReason] = useState("Waived by admin");
  const [fineTarget,  setFineTarget]  = useState<any | null>(null);
  const [fineAmount,  setFineAmount]  = useState("");
  const [fineReason,  setFineReason]  = useState("");
  const [addingFine,  setAddingFine]  = useState(false);

  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("Wrong billing entry");
  const [cancelling,   setCancelling]   = useState(false);

  const cleanBase = (basePath || "").replace(/\/fees\/?$/, "");
  const receiptBase = isFinance || cleanBase === "/finance" ? "/finance/fees/receipt" : "/fees/receipt";

  // ── build server-side URL — Invoices / Collections
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

  // ── build server-side URL — Payment Receipts Register
  const paymentsUrl = useMemo(() => {
    if (!academicYearId) return "";
    const p = new URLSearchParams();
    p.set("academic_year_id", String(academicYearId));
    p.set("page",  String(currentPage));
    p.set("limit", String(pageSize));
    if (debouncedSearch)                 p.set("search",         debouncedSearch);
    if (classFilter   !== "all")         p.set("class_id",       classFilter);
    if (sectionFilter !== "all")         p.set("section_id",     sectionFilter);
    if (paymentMethodFilter !== "all")   p.set("payment_method", paymentMethodFilter);
    return `/fees/payments?${p.toString()}`;
  }, [academicYearId, currentPage, pageSize, debouncedSearch, classFilter, sectionFilter, paymentMethodFilter]);

  const { data: paymentsApiResult, loading: paymentsLoading, error: paymentsError, refetch: refetchPayments } = useApi<{
    data: any[];
    total: number;
    total_collected?: number;
  }>(
    activeTab === "receipts" ? paymentsUrl : (academicYearId ? `/fees/payments?academic_year_id=${academicYearId}&page=1&limit=1` : ""),
    [paymentsUrl, activeTab, academicYearId]
  );

  const collections          = apiResult?.data  ?? [];
  const totalInvoices        = apiResult?.total ?? 0;
  const paymentsList         = paymentsApiResult?.data ?? [];
  const totalReceiptsCount   = paymentsApiResult?.total ?? 0;

  const currentTotal         = activeTab === "invoices" ? totalInvoices : totalReceiptsCount;
  const totalPages           = Math.max(1, Math.ceil(currentTotal / pageSize));
  const currentLoading       = activeTab === "invoices" ? loading : paymentsLoading;
  const currentError         = activeTab === "invoices" ? error : paymentsError;

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
    if (!totalInvoices) {
      return dispatch(showToast({ type: "error", title: "No Records", message: "No records to export." }));
    }
    setExporting(true);
    try {
      const p = new URLSearchParams();
      p.set("academic_year_id", String(academicYearId));
      p.set("page", "1");
      p.set("limit", String(Math.min(totalInvoices, 10000)));
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

      const headers = ["Student Name", "Admission / Roll No", "Class", "Section", "Fee Title", "Due Date", `Gross Total (${currSymbol})`, `Discount (${currSymbol})`, `Net Payable (${currSymbol})`, `Paid (${currSymbol})`, `Remaining Due (${currSymbol})`, "Status"];
      const rows = exportList.map(col => {
        let rawFee = col.fee_name || "Fee";
        let cleanTitle = rawFee.replace(/\s*\([^)]*\)/g, "").trim() || rawFee;
        const total = parseFloat(col.total_amount || 0);
        const discount = parseFloat(col.discount_amount || 0);
        const net = parseFloat(col.net_amount ?? (total - discount));
        const paid = parseFloat(col.paid_amount || 0);
        const rem = parseFloat(col.remaining_amount ?? (net - paid));

        return [
          `"${(col.full_name || "").replace(/"/g, '""')}"`,
          `"${(col.admission_number || col.student_roll || "").replace(/"/g, '""')}"`,
          `"${(col.class_name || "").replace(/"/g, '""')}"`,
          `"${(col.section_name || "").replace(/"/g, '""')}"`,
          `"${cleanTitle.replace(/"/g, '""')}"`,
          `"${col.due_date ? col.due_date.slice(0, 10) : ""}"`,
          total.toFixed(2),
          discount.toFixed(2),
          net.toFixed(2),
          paid.toFixed(2),
          rem.toFixed(2),
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

  const handleExportReceiptsCSV = async () => {
    if (!totalReceiptsCount) {
      return dispatch(showToast({ type: "error", title: "No Records", message: "No receipts found to export." }));
    }
    setExporting(true);
    try {
      const p = new URLSearchParams();
      p.set("academic_year_id", String(academicYearId));
      p.set("page", "1");
      p.set("limit", String(Math.min(totalReceiptsCount, 10000)));
      if (debouncedSearch)                 p.set("search",         debouncedSearch);
      if (classFilter   !== "all")         p.set("class_id",       classFilter);
      if (sectionFilter !== "all")         p.set("section_id",     sectionFilter);
      if (paymentMethodFilter !== "all")   p.set("payment_method", paymentMethodFilter);

      const res = await apiRequest<{ data: any[]; total: number }>(`/fees/payments?${p.toString()}`);
      const list: any[] = res?.data ?? (Array.isArray(res) ? res : []);
      if (!list.length) {
        return dispatch(showToast({ type: "error", title: "No Records", message: "No receipts found to export." }));
      }

      const headers = ["Receipt Number", "Payment Date", "Student Name", "Admission / Roll No", "Class", "Section", "Payment Method", "Items Settled", `Total Paid (${currSymbol})`];
      const rows = list.map(v => {
        const settledText = (v.settled_items || []).map((i: any) => `${i.fee_name}: ${i.paid_amount}`).join(" | ");
        return [
          `"${v.receipt_number}"`,
          `"${v.payment_date ? String(v.payment_date).slice(0, 10) : ""}"`,
          `"${(v.student_name || "").replace(/"/g, '""')}"`,
          `"${(v.admission_number || "").replace(/"/g, '""')}"`,
          `"${(v.class_name || "").replace(/"/g, '""')}"`,
          `"${(v.section_name || "").replace(/"/g, '""')}"`,
          `"${(v.payment_method || "Cash").toUpperCase()}"`,
          `"${settledText.replace(/"/g, '""')}"`,
          Number(v.total_paid || 0).toFixed(2),
        ].join(",");
      });

      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute("download", `Fee_Receipts_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      dispatch(showToast({ type: "success", title: "Exported", message: `Exported ${list.length} receipts to CSV.` }));
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

  const handleConfirmWaive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiveTarget) return;
    setWaiving(waiveTarget.id);
    try {
      await apiRequest(`/fees/collections/${waiveTarget.id}/waive`, {
        method: 'POST',
        body: JSON.stringify({ reason: waiveReason.trim() || 'Waived by admin' }),
      });
      dispatch(showToast({ type: 'success', title: 'Fee Waived', message: `${waiveTarget.fee_name} has been waived.` }));
      refetch();
      setWaiveTarget(null);
      setWaiveReason('Waived by admin');
    } catch (err: any) {
      dispatch(showToast({ type: 'error', title: 'Failed', message: err.message || 'Could not waive fee.' }));
    } finally {
      setWaiving(null);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiRequest(`/fees/collections/${cancelTarget.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelReason.trim() || "Cancelled by admin" }),
      });
      dispatch(showToast({ type: "success", title: "Bill Voided", message: `${cancelTarget.fee_name} has been cancelled.` }));
      refetch();
      setCancelTarget(null);
      setCancelReason("Wrong billing entry");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not cancel fee bill." }));
    } finally {
      setCancelling(false);
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
            <Link className={cx(s("btn"), s("btnPrimary"))} href={collectUrl}>
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
              <strong className={s("hcValue")}>{totalInvoices}</strong>
              <span className={s("hcSub")}>Generated bills</span>
            </div>
            <div className={s("hcIcon")}><i className="fa-solid fa-file-invoice" /></div>
          </article>

          <article className={cx(s("heroCard"), s("c4"))}>
            <div className={s("hcInfo")}>
              <span className={s("hcLabel")}>Payment Receipts</span>
              <strong className={s("hcValue")}>{totalReceiptsCount}</strong>
              <span className={s("hcSub")}>Issued vouchers</span>
            </div>
            <div className={s("hcIcon")}><i className="fa-solid fa-receipt" /></div>
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
                placeholder={activeTab === "invoices" ? "Search by student, roll no, fee…" : "Search by receipt #, student, roll no…"}
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

              {/* Filters for Invoices Tab */}
              {activeTab === "invoices" ? (
                <>
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
                    <option value="cancelled">Cancelled</option>
                  </select>

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
                </>
              ) : (
                /* Filter for Receipts Tab */
                <select
                  value={paymentMethodFilter}
                  onChange={e => { setPaymentMethodFilter(e.target.value); resetPage(); }}
                  style={{
                    height: 38, padding: "0 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                    background: "#fff", color: "#0f172a", fontSize: 12.5, fontWeight: 700, outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="all">All Payment Modes</option>
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              )}
            </div>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#64748b" }}>
            Showing <strong>{currentTotal}</strong> {activeTab === "invoices" ? "invoice" : "receipt"}{currentTotal !== 1 ? "s" : ""}
          </div>
        </section>

        {/* ── Table Card ── */}
        <section className={s("card")}>
          <div className={s("cardHead")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0 }}>
                  <i className={activeTab === "invoices" ? "fa-solid fa-file-invoice" : "fa-solid fa-receipt"} />{" "}
                  {activeTab === "invoices" ? "Collection Records" : "Payment Receipts"}
                </h3>
              </div>
              <p style={{ margin: "3px 0 0" }}>
                {activeTab === "invoices"
                  ? "Detailed breakdown of fee payments, dues, and transaction histories"
                  : "Cashier register of all issued payment receipts and settled student vouchers"}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Tab Switcher Pills */}
              <div style={{
                display: "inline-flex",
                background: "#f1f5f9",
                padding: "3px",
                borderRadius: "10px",
                border: "1.5px solid #e2e8f0",
              }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab("invoices"); resetPage(); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: "7px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                    background: activeTab === "invoices" ? "#ffffff" : "transparent",
                    color: activeTab === "invoices" ? "#0f172a" : "#64748b",
                    boxShadow: activeTab === "invoices" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <i className="fa-solid fa-file-invoice" style={{ color: activeTab === "invoices" ? "#2563eb" : "#94a3b8" }} />
                  <span>Billed Invoices</span>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 900,
                    background: activeTab === "invoices" ? "#eff6ff" : "#e2e8f0",
                    color: activeTab === "invoices" ? "#1e40af" : "#64748b",
                    padding: "1px 7px",
                    borderRadius: "999px",
                  }}>
                    {totalInvoices}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab("receipts"); resetPage(); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: "7px",
                    border: "none",
                    fontSize: "12.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                    background: activeTab === "receipts" ? "#ffffff" : "transparent",
                    color: activeTab === "receipts" ? "#0f172a" : "#64748b",
                    boxShadow: activeTab === "receipts" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <i className="fa-solid fa-receipt" style={{ color: activeTab === "receipts" ? "#059669" : "#94a3b8" }} />
                  <span>Payment Receipts</span>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 900,
                    background: activeTab === "receipts" ? "#ecfdf5" : "#e2e8f0",
                    color: activeTab === "receipts" ? "#065f46" : "#64748b",
                    padding: "1px 7px",
                    borderRadius: "999px",
                  }}>
                    {totalReceiptsCount}
                  </span>
                </button>
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={activeTab === "invoices" ? handleExportCSV : handleExportReceiptsCSV}
                disabled={exporting || (activeTab === "invoices" ? loading : paymentsLoading)}
                className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                title={activeTab === "invoices" ? "Download Invoices CSV report" : "Download Payment Receipts CSV"}
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
            {currentLoading ? (
              <Loader fullScreen={false} size="md" text={activeTab === "invoices" ? "Loading fee records…" : "Loading payment receipts…"} />
            ) : currentError ? (
              <div style={{ padding: "2.5rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{currentError}</div>
            ) : activeTab === "invoices" ? (
              collections.length === 0 ? (
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
                      <th>Due &amp; Billed Date</th>
                      <th>Amount (Due / Total)</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map(col => {
                      const totalAmt    = parseFloat(col.total_amount || 0);
                      const discountAmt = parseFloat(col.discount_amount || 0);
                      const netAmt      = parseFloat(col.net_amount ?? (totalAmt - discountAmt));
                      const paidAmt     = parseFloat(col.paid_amount || 0);
                      const remAmt      = parseFloat(col.remaining_amount ?? (netAmt - paidAmt));
                      const hasDiscount = discountAmt > 0;
                      const isOverdue   = col.status !== "paid" && col.status !== "waived" && col.status !== "cancelled" && Boolean(col.due_date) && new Date(col.due_date) < new Date();
                      const hasPaid     = col.status === "paid" || col.status === "partial" || paidAmt > 0;
                      const isFullyPaid = col.status === "paid";
                      const isWaived    = col.status === "waived";
                      const isCancelled = col.status === "cancelled";

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
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {/* Primary: Due Date */}
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span className={s("dateCell")} style={{ fontWeight: 800, color: isOverdue ? "#dc2626" : "#0f172a" }}>
                                  {col.due_date ? formatDate(col.due_date.slice(0, 10)) : "—"}
                                </span>
                                {isOverdue && (
                                  <span style={{
                                    display: "inline-block",
                                    fontSize: 9,
                                    color: "#dc2626",
                                    background: "#fef2f2",
                                    border: "1px solid #fecaca",
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                    fontWeight: 900,
                                    letterSpacing: "0.02em",
                                  }}>
                                    OVERDUE
                                  </span>
                                )}
                              </div>

                              {/* Secondary: Bill Generated Date */}
                              {col.created_at && (
                                <div style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 11,
                                  color: "#64748b",
                                  fontWeight: 600,
                                }}>
                                  <i className="fa-solid fa-file-lines" style={{ fontSize: 9.5, color: "#94a3b8" }} />
                                  <span>Billed: {formatDate(String(col.created_at).slice(0, 10))}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                {isFullyPaid ? (
                                  <>
                                    <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#059669" }}>
                                      {formatCurrency(paidAmt > 0 ? paidAmt : netAmt)}
                                    </strong>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>· Paid</span>
                                  </>
                                ) : isWaived ? (
                                  <>
                                    <strong style={{ fontSize: 13.5, fontWeight: 900, color: paidAmt > 0 ? "#059669" : "#7c3aed" }}>
                                      {paidAmt > 0 ? formatCurrency(paidAmt) : formatCurrency(netAmt)}
                                    </strong>
                                    {paidAmt > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>/ {formatCurrency(netAmt)}</span>}
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed" }}>· Waived</span>
                                  </>
                                ) : isCancelled ? (
                                  <>
                                    <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#dc2626" }}>
                                      {formatCurrency(netAmt)}
                                    </strong>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626" }}>· Voided</span>
                                  </>
                                ) : paidAmt > 0 ? (
                                  <>
                                    <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#ea580c" }}>{formatCurrency(remAmt)}</strong>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>/ {formatCurrency(netAmt)}</span>
                                  </>
                                ) : (
                                  <>
                                    <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>{formatCurrency(remAmt)}</strong>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Due</span>
                                  </>
                                )}
                              </div>

                              {/* Waived note */}
                              {isWaived && col.fine_reason && (
                                <div style={{ fontSize: 10.5, color: "#7c3aed", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3.5 }}>
                                  <i className="fa-solid fa-award" style={{ fontSize: 9 }} />
                                  <span>{col.fine_reason}</span>
                                </div>
                              )}

                              {/* Cancelled note */}
                              {isCancelled && col.fine_reason && (
                                <div style={{ fontSize: 10.5, color: "#dc2626", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3.5 }}>
                                  <i className="fa-solid fa-ban" style={{ fontSize: 9 }} />
                                  <span>{col.fine_reason}</span>
                                </div>
                              )}

                              {/* Scholarship / Concession Indicator */}
                              {hasDiscount && (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 1, flexWrap: "wrap" }}>
                                  <span style={{ textDecoration: "line-through", color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>
                                    {formatCurrency(totalAmt)}
                                  </span>
                                  <span style={{
                                    fontSize: 10, fontWeight: 800, color: "#166534", background: "#dcfce7",
                                    padding: "1px 5px", borderRadius: 4, border: "1px solid #bbf7d0",
                                  }}>
                                    {col.discount_reason || `-${formatCurrency(discountAmt)} Concession`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={cx(s("badge"), s(STATUS_BADGE[col.status] || "badgeGray"))}>
                              {col.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
                              {/* Receipt Badges */}
                              {col.payments && col.payments.length > 0 ? (
                                <div style={{ display: "inline-flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                                  {col.payments.map((p: any) => (
                                    <Link
                                      key={p.id}
                                      href={`${receiptBase}/${p.id}`}
                                      target="_blank"
                                      title={`View Receipt ${p.receipt_number} (${formatCurrency(p.paid_amount)})`}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4.5,
                                        padding: "4px 9px",
                                        borderRadius: 6,
                                        background: "#0f172a",
                                        color: "#ffffff",
                                        fontSize: 11,
                                        fontWeight: 800,
                                        textDecoration: "none",
                                        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.12)",
                                      }}
                                    >
                                      <i className="fa-solid fa-receipt" style={{ fontSize: 9.5, color: "#38bdf8" }} />
                                      <span>{p.receipt_number}</span>
                                    </Link>
                                  ))}
                                </div>
                              ) : hasPaid ? (
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
                              ) : null}

                              {/* 3. Operational Actions for Unpaid/Partial bills */}
                              {col.status !== "paid" && col.status !== "waived" && col.status !== "cancelled" && (
                                <>
                                  <Link
                                    className={cx(s("btn"), s("btnSoft"), s("btnSm"))}
                                    href={`${collectUrl}?student_id=${col.student_id}`}
                                  >
                                    <i className="fa-solid fa-hand-holding-dollar" /> Collect
                                  </Link>

                                  {/* Cancel / Void Mistaken Bill (only if zero payments) */}
                                  {paidAmt === 0 && (
                                    <button
                                      onClick={() => { setCancelTarget(col); setCancelReason("Wrong billing entry"); }}
                                      disabled={cancelling}
                                      title="Void / Cancel this mistaken bill"
                                      className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                                      style={{ color: "#dc2626", borderColor: "#fecaca" }}
                                    >
                                      <i className="fa-solid fa-ban" /> Cancel
                                    </button>
                                  )}

                                  {/* Waive for genuine scholarship / concession */}
                                  <button
                                    onClick={() => { setWaiveTarget(col); setWaiveReason("Waived by admin"); }}
                                    disabled={waiving === col.id}
                                    title="Waive fee (scholarship / concession)"
                                    className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                                    style={{ color: "#d97706", borderColor: "#fde68a" }}
                                  >
                                    {waiving === col.id ? <Spinner size={10} /> : <i className="fa-solid fa-award" />} Waive
                                  </button>

                                  {isOverdue && (
                                    <button
                                      onClick={() => { setFineTarget(col); setFineAmount(''); setFineReason(''); }}
                                      title="Apply late fine"
                                      className={cx(s("btn"), s("btnOutline"), s("btnSm"))}
                                      style={{ color: "#dc2626", borderColor: "#fecaca" }}
                                    >
                                      <i className="fa-solid fa-bolt" /> Fine
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : (
              paymentsList.length === 0 ? (
                <div className={s("emptyState")}>
                  <div className={s("emptyIcon")}><i className="fa-solid fa-receipt" /></div>
                  <p>No payment receipts match the selected search or filters.</p>
                </div>
              ) : (
                <table className={s("table")}>
                  <thead>
                    <tr>
                      <th>Receipt #</th>
                      <th>Date</th>
                      <th>Student</th>
                      <th>Class & Section</th>
                      <th>Settled Fee Items</th>
                      <th>Payment Mode</th>
                      <th>Total Paid</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsList.map((voucher: any) => {
                      const mode = (voucher.payment_method || "cash").toLowerCase();
                      let modeBg = "#ecfdf5";
                      let modeFg = "#065f46";
                      let modeBorder = "#a7f3d0";
                      let modeIcon = "fa-solid fa-money-bill-wave";

                      if (mode === "online") {
                        modeBg = "#eff6ff"; modeFg = "#1e40af"; modeBorder = "#bfdbfe"; modeIcon = "fa-solid fa-globe";
                      } else if (mode === "bank_transfer") {
                        modeBg = "#eef2ff"; modeFg = "#3730a3"; modeBorder = "#c7d2fe"; modeIcon = "fa-solid fa-building-columns";
                      } else if (mode === "cheque") {
                        modeBg = "#fffbeb"; modeFg = "#92400e"; modeBorder = "#fde68a"; modeIcon = "fa-solid fa-money-check";
                      }

                      return (
                        <tr key={voucher.receipt_number}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                fontWeight: 900,
                                fontSize: 12.5,
                                color: "#0f172a",
                                background: "#f1f5f9",
                                padding: "3px 8px",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                width: "fit-content",
                              }}>
                                <i className="fa-solid fa-receipt" style={{ color: "#059669", fontSize: 11 }} />
                                {voucher.receipt_number}
                              </span>
                              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                                {voucher.items_count} item{voucher.items_count !== 1 ? "s" : ""} settled
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                              <i className="fa-regular fa-calendar" style={{ fontSize: 11, color: "#64748b" }} />
                              <span>{voucher.payment_date ? formatDate(String(voucher.payment_date).slice(0, 10)) : "—"}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span className={s("studentName")}>
                                {voucher.student_name || `Student #${voucher.student_id}`}
                              </span>
                              <span className={s("studentCode")}>
                                {voucher.admission_number || "—"}
                              </span>
                            </div>
                          </td>
                          <td>
                            {voucher.class_name ? (
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
                                  {voucher.class_name}
                                </span>
                                {voucher.section_name && (
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
                                    Sec {voucher.section_name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {voucher.settled_items && voucher.settled_items.length > 0 ? (
                                voucher.settled_items.map((it: any, idx: number) => (
                                  <div key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
                                    <span style={{ color: "#059669", fontWeight: 900 }}>•</span>
                                    <span style={{ color: "#334155", fontWeight: 600 }}>{formatFeeName(it.fee_name)}:</span>
                                    <strong style={{ color: "#0f172a" }}>{formatCurrency(it.paid_amount)}</strong>
                                  </div>
                                ))
                              ) : (
                                <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              background: modeBg,
                              color: modeFg,
                              border: `1px solid ${modeBorder}`,
                            }}>
                              <i className={modeIcon} style={{ fontSize: 10 }} />
                              {mode.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#059669" }}>
                              {formatCurrency(voucher.total_paid)}
                            </strong>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Link
                              href={`${receiptBase}/${voucher.payment_id}`}
                              target="_blank"
                              className={cx(s("btn"), s("btnSm"))}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "5px 11px",
                                borderRadius: 7,
                                background: "#0f172a",
                                color: "#ffffff",
                                fontWeight: 800,
                                fontSize: 11.5,
                                textDecoration: "none",
                                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.12)",
                              }}
                              title={`View and print receipt voucher ${voucher.receipt_number}`}
                            >
                              <i className="fa-solid fa-print" style={{ fontSize: 11, color: "#38bdf8" }} />
                              <span>Print Receipt</span>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>

          {/* ── Table Pagination Footer ── */}
          {currentTotal > pageSize && (
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
                  Showing <strong>{(currentPage - 1) * pageSize + 1}</strong>–<strong>{Math.min(currentPage * pageSize, currentTotal)}</strong> of <strong>{currentTotal}</strong> {activeTab === "invoices" ? "invoices" : "receipts"}
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
        <PaymentsModal
          collection={modalCol}
          onClose={() => setModalCol(null)}
          basePath={basePath || (isFinance ? "/finance" : "")}
        />
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

      {/* Waive Fee modal */}
      {waiveTarget && (
        <div
          onClick={() => setWaiveTarget(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
              boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)', overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fffbeb',
            }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#92400e', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fa-solid fa-ban" style={{ color: '#d97706' }} />
                  Waive Fee Bill
                </h3>
                <p style={{ fontSize: 12, color: '#b45309', fontWeight: 600, marginTop: 2 }}>
                  {formatFeeName(waiveTarget.fee_name)} · {waiveTarget.full_name}
                </p>
              </div>
              <button
                onClick={() => setWaiveTarget(null)}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: '1px solid #fde68a',
                  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#92400e',
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleConfirmWaive} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: '#f8fafc', padding: '10px 14px', borderRadius: 8,
                border: '1px solid #e2e8f0', fontSize: 12.5, color: '#334155',
              }}>
                <span style={{ display: 'block', color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                  Outstanding Due to Waive:
                </span>
                <strong style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  {formatCurrency(Number(waiveTarget.remaining_amount ?? waiveTarget.net_amount ?? 0))}
                </strong>
                <span style={{ fontSize: 11.5, color: '#64748b', display: 'block', marginTop: 4 }}>
                  Waiving this bill sets its remaining payable balance to zero.
                </span>
              </div>

              <label className={s("field")}>
                <span>Reason for Waiving <b>*</b></span>
                <input
                  value={waiveReason}
                  onChange={e => setWaiveReason(e.target.value)}
                  placeholder="e.g. Scholarship adjustment, financial aid, management waiver"
                  required
                  autoFocus
                />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setWaiveTarget(null)}
                  className={cx(s("btn"), s("btnOutline"))}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={waiving === waiveTarget.id}
                  className={cx(s("btn"), s("btnPrimary"))}
                  style={{ flex: 1, background: '#d97706', borderColor: '#d97706' }}
                >
                  {waiving === waiveTarget.id ? (
                    <><Spinner size={14} color="#fff" /> Waiving…</>
                  ) : (
                    <><i className="fa-solid fa-check" /> Confirm Waive</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel / Void Bill modal */}
      {cancelTarget && (
        <div
          onClick={() => setCancelTarget(null)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
              boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)', overflow: 'hidden',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fef2f2',
            }}>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <i className="fa-solid fa-ban" style={{ color: '#dc2626' }} />
                  Void / Cancel Fee Record
                </h3>
                <p style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, marginTop: 2 }}>
                  {formatFeeName(cancelTarget.fee_name)} · {cancelTarget.full_name}
                </p>
              </div>
              <button
                onClick={() => setCancelTarget(null)}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: '1px solid #fecaca',
                  background: '#fff', cursor: 'pointer', fontSize: 13, color: '#991b1b',
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                background: '#fff1f2', padding: '12px 14px', borderRadius: 8,
                border: '1px solid #fecdd3', fontSize: 12.5, color: '#881337',
              }}>
                <span style={{ display: 'block', color: '#9f1239', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
                  Notice: Voiding Mistaken Entry
                </span>
                <strong style={{ fontSize: 15, fontWeight: 800, color: '#881337' }}>
                  Amount: {formatCurrency(Number(cancelTarget.remaining_amount ?? cancelTarget.net_amount ?? 0))}
                </strong>
                <span style={{ fontSize: 11.5, color: '#9f1239', display: 'block', marginTop: 4 }}>
                  This marks the record as <strong>CANCELLED</strong> and resets remaining dues to zero. It will not record a false scholarship or waiver expense.
                </span>
              </div>

              <label className={s("field")}>
                <span>Reason for Cancellation <b>*</b></span>
                <input
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Wrong billing entry, loan fee mistakenly billed, duplicate"
                  required
                  autoFocus
                />
              </label>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className={cx(s("btn"), s("btnOutline"))}
                  style={{ flex: 1 }}
                >
                  Keep Bill
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className={cx(s("btn"), s("btnPrimary"))}
                  style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
                >
                  {cancelling ? (
                    <><Spinner size={14} color="#fff" /> Voiding…</>
                  ) : (
                    <><i className="fa-solid fa-ban" /> Confirm Void</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
