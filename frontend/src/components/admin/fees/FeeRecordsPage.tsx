"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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

import { useCurrency, NepaliCurrency, CurrencyAmount } from "@/lib/useCurrency";

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

function formatClassSection(className?: string, sectionName?: string): string {
  if (!className) return "—";
  if (!sectionName) return className;
  const cleanSec = sectionName.replace(/^sec(tion)?\s*/i, "").trim();
  return `${className}-${cleanSec || sectionName}`;
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

  const [activeMenuColId, setActiveMenuColId] = useState<number | null>(null);

  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuColId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleResetFilters = () => {
    setSearch("");
    setClassFilter("all");
    setSectionFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setPaymentMethodFilter("all");
    setCurrentPage(1);
  };

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
    status_counts?: {
      all: number;
      paid: number;
      unpaid: number;
      cancelled: number;
      waived: number;
    };
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
  const collectionRate = (totalPaid + totalPending) > 0
    ? Math.round((totalPaid / (totalPaid + totalPending)) * 100)
    : 0;
  const statusCounts   = apiResult?.status_counts || {
    all: totalInvoices,
    paid: 0,
    unpaid: 0,
    cancelled: 0,
    waived: 0,
  };

  return (
    <div className={s("feesPage")}>
      <main className={s("pageContent")}>

        {/* ── Page Header ── */}
        <section style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#ea580c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 20,
              flexShrink: 0,
              boxShadow: "0 3px 10px rgba(234, 88, 12, 0.25)",
            }}>
              <i className="fa-solid fa-file-invoice" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.4px" }}>
                All Fee Records
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                Track collected fees, pending dues, and view complete payment history.
              </p>
            </div>
          </div>

          {/* Breadcrumb Right */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "#64748b", paddingTop: 6 }}>
            <Link href={overviewUrl} style={{ color: "#64748b", textDecoration: "none" }}>
              Fee Management
            </Link>
            <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: "#94a3b8" }} />
            <span style={{ color: "#0f172a" }}>Fee Records</span>
          </div>
        </section>

        {/* ── 4 Stat Cards with Sparklines & Mini Bar Charts ── */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
          marginBottom: 20,
        }}>
          {/* Card 1: Total Collected */}
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            padding: "18px 20px",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 2 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#ecfdf5",
                border: "1.5px solid #d1fae5",
                color: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}>
                <NepaliCurrency size={20} color="#059669" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Total Collected</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1.25, margin: "2px 0 1px" }}>
                  <CurrencyAmount amount={totalPaid} size={20} customSymbol={currSymbol} />
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#059669" }}>This academic year</div>
              </div>
            </div>

            {/* Top Right Trend Badge */}
            <div style={{
              position: "absolute",
              top: 14,
              right: 16,
              background: collectionRate >= 50 ? "#ecfdf5" : "#fff7ed",
              border: collectionRate >= 50 ? "1px solid #a7f3d0" : "1px solid #fed7aa",
              color: collectionRate >= 50 ? "#059669" : "#ea580c",
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}>
              <i className={`fa-solid ${collectionRate >= 50 ? "fa-arrow-up" : "fa-arrow-down"}`} style={{ fontSize: 9.5 }} /> {collectionRate}%
            </div>

            {/* Bottom Right Green Wave Sparkline */}
            <svg width="65" height="24" viewBox="0 0 65 24" fill="none" style={{ position: "absolute", right: 14, bottom: 14, pointerEvents: "none" }}>
              <path d="M 2 14 C 12 6, 22 20, 32 12 C 42 4, 52 18, 62 10" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Card 2: Total Invoices */}
          <div
            onClick={() => { setActiveTab("invoices"); setCurrentPage(1); }}
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: activeTab === "invoices" ? "1.5px solid #bfdbfe" : "1px solid #e2e8f0",
              padding: "18px 20px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#eff6ff",
                border: "1.5px solid #dbeafe",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}>
                <i className="fa-solid fa-file-invoice" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Total Invoices</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1.25, margin: "2px 0 1px" }}>
                  {totalInvoices}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#2563eb" }}>Generated bills</div>
              </div>
            </div>

            {/* Right Stepped Blue Mini Bars with trend curve */}
            <svg width="85" height="44" viewBox="0 0 85 44" fill="none" style={{ position: "absolute", right: 14, bottom: 10, pointerEvents: "none" }}>
              <rect x="12" y="28" width="5.5" height="16" rx="2" fill="#bfdbfe" />
              <rect x="26" y="22" width="5.5" height="22" rx="2" fill="#93c5fd" />
              <rect x="40" y="16" width="5.5" height="28" rx="2" fill="#60a5fa" />
              <rect x="54" y="9" width="5.5" height="35" rx="2" fill="#3b82f6" />
              <rect x="68" y="2" width="5.5" height="42" rx="2" fill="#2563eb" />
              <path d="M4 36 C 20 32, 34 22, 50 16 C 62 12, 69 5, 74 2" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          {/* Card 3: Payment Receipts */}
          <div
            onClick={() => { setActiveTab("receipts"); setCurrentPage(1); }}
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: activeTab === "receipts" ? "1.5px solid #d8b4fe" : "1px solid #e2e8f0",
              padding: "18px 20px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
              overflow: "hidden",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#faf5ff",
                border: "1.5px solid #f3e8ff",
                color: "#9333ea",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}>
                <i className="fa-solid fa-receipt" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Payment Receipts</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1.25, margin: "2px 0 1px" }}>
                  {totalReceiptsCount}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#9333ea" }}>Issued vouchers</div>
              </div>
            </div>

            {/* Right Stepped Purple Mini Bars */}
            <svg width="85" height="44" viewBox="0 0 85 44" fill="none" style={{ position: "absolute", right: 14, bottom: 10, pointerEvents: "none" }}>
              <rect x="14" y="30" width="5.5" height="14" rx="2" fill="#f3e8ff" />
              <rect x="27" y="24" width="5.5" height="20" rx="2" fill="#e9d5ff" />
              <rect x="40" y="18" width="5.5" height="26" rx="2" fill="#d8b4fe" />
              <rect x="53" y="12" width="5.5" height="32" rx="2" fill="#c084fc" />
              <rect x="66" y="5" width="5.5" height="39" rx="2" fill="#a855f7" />
            </svg>
          </div>

          {/* Card 4: Total Outstanding */}
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            padding: "18px 20px",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
            overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 2 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#fff7ed",
                border: "1.5px solid #fed7aa",
                color: "#ea580c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}>
                <i className="fa-solid fa-clock-rotate-left" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b" }}>Total Outstanding</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1.25, margin: "2px 0 1px" }}>
                  <CurrencyAmount amount={totalPending} size={20} customSymbol={currSymbol} />
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#ea580c" }}>Pending student dues</div>
              </div>
            </div>

            {/* Right Orange Wave Sparkline */}
            <svg width="65" height="24" viewBox="0 0 65 24" fill="none" style={{ position: "absolute", right: 14, bottom: 14, pointerEvents: "none" }}>
              <path d="M 2 14 C 12 6, 22 20, 32 12 C 42 4, 52 18, 62 10" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        {/* ── Search & Filter Bar ── */}
        <section style={{
          background: "#ffffff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
        }}>
          {/* Search input */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: 1,
            minWidth: 260,
            height: 40,
            padding: "0 14px",
            background: "#ffffff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 8,
          }}>
            <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 14 }} />
            <input
              type="search"
              placeholder={activeTab === "invoices" ? "Search by student name, roll no, admission no, fee title..." : "Search by receipt #, student name, roll no..."}
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{
                border: "none",
                outline: "none",
                width: "100%",
                fontSize: 13,
                fontWeight: 600,
                color: "#0f172a",
                background: "transparent",
              }}
            />
          </div>

          {/* Classes Dropdown */}
          <select
            value={classFilter}
            onChange={e => {
              setClassFilter(e.target.value);
              setSectionFilter("all");
              setCurrentPage(1);
            }}
            style={{
              height: 40,
              padding: "0 12px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              background: "#ffffff",
              color: "#0f172a",
              fontSize: 12.5,
              fontWeight: 700,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">All Classes</option>
            {classes?.map(c => (
              <option key={c.id} value={c.id.toString()}>{c.name}</option>
            ))}
          </select>

          {/* Sections Dropdown */}
          <select
            value={sectionFilter}
            onChange={e => { setSectionFilter(e.target.value); setCurrentPage(1); }}
            disabled={classFilter === "all" || !availableSections.length}
            style={{
              height: 40,
              padding: "0 12px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              background: classFilter === "all" || !availableSections.length ? "#f8fafc" : "#ffffff",
              color: classFilter === "all" || !availableSections.length ? "#94a3b8" : "#0f172a",
              fontSize: 12.5,
              fontWeight: 700,
              outline: "none",
              cursor: classFilter === "all" || !availableSections.length ? "not-allowed" : "pointer",
            }}
          >
            <option value="all">All Sections</option>
            {availableSections.map((sec: any) => (
              <option key={sec.id || sec.name} value={sec.name}>{sec.name}</option>
            ))}
          </select>

          {activeTab === "invoices" ? (
            <>
              {/* Statuses Dropdown */}
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: 12.5,
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="cancelled">Cancelled</option>
                <option value="waived">Waived</option>
              </select>

              {/* Fee Types Dropdown */}
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                style={{
                  height: 40,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: 12.5,
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Fee Types</option>
                <option value="academic">Academic Fees</option>
                <option value="transport">Transport</option>
                <option value="hostel">Hostel</option>
              </select>
            </>
          ) : (
            <select
              value={paymentMethodFilter}
              onChange={e => { setPaymentMethodFilter(e.target.value); setCurrentPage(1); }}
              style={{
                height: 40,
                padding: "0 12px",
                borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 12.5,
                fontWeight: 700,
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          )}

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 8,
              border: "1.5px solid #e2e8f0",
              background: "#ffffff",
              color: "#334155",
              fontSize: 12.5,
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <i className="fa-solid fa-rotate-right" style={{ fontSize: 13 }} /> Reset
          </button>
        </section>

        {/* ── Table Card ── */}
        <section style={{
          background: "#ffffff",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
          overflow: "hidden",
        }}>
          {/* Top Bar with Status Pills & Actions */}
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}>
            {activeTab === "invoices" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* All Records Pill */}
                <button
                  type="button"
                  onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 15px",
                    borderRadius: 8,
                    border: statusFilter === "all" ? "none" : "1.5px solid #e2e8f0",
                    background: statusFilter === "all" ? "#ea580c" : "#ffffff",
                    color: statusFilter === "all" ? "#ffffff" : "#475569",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: statusFilter === "all" ? "0 2px 6px rgba(234, 88, 12, 0.25)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <i className="fa-solid fa-bars" style={{ fontSize: 11 }} />
                  <span>All Records ({statusCounts.all})</span>
                </button>

                {/* Paid Pill */}
                <button
                  type="button"
                  onClick={() => { setStatusFilter("paid"); setCurrentPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 15px",
                    borderRadius: 8,
                    border: statusFilter === "paid" ? "1.5px solid #a7f3d0" : "1.5px solid #e2e8f0",
                    background: statusFilter === "paid" ? "#ecfdf5" : "#ffffff",
                    color: statusFilter === "paid" ? "#059669" : "#475569",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                  <span>Paid ({statusCounts.paid})</span>
                </button>

                {/* Unpaid Pill */}
                <button
                  type="button"
                  onClick={() => { setStatusFilter("unpaid"); setCurrentPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 15px",
                    borderRadius: 8,
                    border: statusFilter === "unpaid" ? "1.5px solid #fecaca" : "1.5px solid #e2e8f0",
                    background: statusFilter === "unpaid" ? "#fef2f2" : "#ffffff",
                    color: statusFilter === "unpaid" ? "#dc2626" : "#475569",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
                  <span>Unpaid ({statusCounts.unpaid})</span>
                </button>

                {/* Cancelled Pill */}
                <button
                  type="button"
                  onClick={() => { setStatusFilter("cancelled"); setCurrentPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 15px",
                    borderRadius: 8,
                    border: statusFilter === "cancelled" ? "1.5px solid #cbd5e1" : "1.5px solid #e2e8f0",
                    background: statusFilter === "cancelled" ? "#f1f5f9" : "#ffffff",
                    color: statusFilter === "cancelled" ? "#334155" : "#475569",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#64748b", display: "inline-block" }} />
                  <span>Cancelled ({statusCounts.cancelled})</span>
                </button>

                {/* Waived Pill */}
                <button
                  type="button"
                  onClick={() => { setStatusFilter("waived"); setCurrentPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 15px",
                    borderRadius: 8,
                    border: statusFilter === "waived" ? "1.5px solid #e9d5ff" : "1.5px solid #e2e8f0",
                    background: statusFilter === "waived" ? "#faf5ff" : "#ffffff",
                    color: statusFilter === "waived" ? "#7c3aed" : "#475569",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#8b5cf6", display: "inline-block" }} />
                  <span>Waived ({statusCounts.waived})</span>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab("invoices"); setCurrentPage(1); }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #e2e8f0",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <i className="fa-solid fa-arrow-left" style={{ fontSize: 11 }} />
                  <span>All Fee Records</span>
                </button>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                  <i className="fa-solid fa-receipt" style={{ color: "#9333ea", marginRight: 8 }} />
                  Payment Receipts Register ({totalReceiptsCount})
                </span>
              </div>
            )}

            {/* Right Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Export CSV Button */}
              <button
                type="button"
                onClick={activeTab === "invoices" ? handleExportCSV : handleExportReceiptsCSV}
                disabled={exporting || (activeTab === "invoices" ? loading : paymentsLoading)}
                style={{
                  height: 38,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
                }}
              >
                {exporting ? (
                  <><Spinner size={12} color="#059669" /> Exporting…</>
                ) : (
                  <><i className="fa-solid fa-download" style={{ fontSize: 13 }} /> Export CSV</>
                )}
              </button>

              {/* Collect Fee Button */}
              <Link
                href={collectUrl}
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 8,
                  background: "#ea580c",
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  textDecoration: "none",
                  boxShadow: "0 2px 6px rgba(234, 88, 12, 0.25)",
                }}
              >
                <i className="fa-solid fa-plus" style={{ fontSize: 12 }} /> Collect Fee
              </Link>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ width: "100%", overflowX: "auto" }}>
            {currentLoading ? (
              <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
                <Loader fullScreen={false} size="md" text={activeTab === "invoices" ? "Loading fee records…" : "Loading payment receipts…"} />
              </div>
            ) : currentError ? (
              <div style={{ padding: "2.5rem", color: "#dc2626", textAlign: "center", fontWeight: 700 }}>{currentError}</div>
            ) : activeTab === "invoices" ? (
              collections.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3.5rem 1rem", color: "#64748b" }}>
                  <i className="fa-solid fa-file-invoice" style={{ fontSize: 36, color: "#cbd5e1", marginBottom: 10, display: "block" }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>No fee records match the selected search or filters.</p>
                </div>
              ) : (
                <table style={{ width: "100%", minWidth: 1100, borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ background: "#ffffff", borderBottom: "1.5px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 14px", width: 50, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>#</th>
                      <th style={{ padding: "12px 14px", width: 210, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>STUDENT</th>
                      <th style={{ padding: "12px 14px", width: 140, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>CLASS &amp; SECTION</th>
                      <th style={{ padding: "12px 14px", width: 180, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>FEE TITLE</th>
                      <th style={{ padding: "12px 14px", width: 170, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>DUE DATE</th>
                      <th style={{ padding: "12px 14px", width: 180, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>AMOUNT</th>
                      <th style={{ padding: "12px 14px", width: 120, textAlign: "center", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>STATUS</th>
                      <th style={{ padding: "12px 14px", width: 130, textAlign: "right", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collections.map((col, idx) => {
                      const totalAmt    = parseFloat(col.total_amount || 0);
                      const discountAmt = parseFloat(col.discount_amount || 0);
                      const netAmt      = parseFloat(col.net_amount ?? (totalAmt - discountAmt));
                      const paidAmt     = parseFloat(col.paid_amount || 0);
                      const remAmt      = parseFloat(col.remaining_amount ?? (netAmt - paidAmt));
                      const hasDiscount = discountAmt > 0;

                      // Overdue is calculated from the billed date:
                      // If the bill's due_date is in the past relative to when the bill was created (back-dated billing e.g. billed on 25 Bhadra for 10 Bhadra),
                      // effective due date gives 15 days grace from the billed date.
                      const billedDate = col.created_at ? new Date(col.created_at) : null;
                      const dueDate = col.due_date ? new Date(col.due_date) : null;
                      const today = new Date();
                      let effectiveDueDate = dueDate;
                      if (dueDate && billedDate) {
                        const dDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                        const bDate = new Date(billedDate.getFullYear(), billedDate.getMonth(), billedDate.getDate());
                        if (dDate <= bDate) {
                          effectiveDueDate = new Date(bDate.getTime() + 15 * 24 * 60 * 60 * 1000);
                        }
                      }
                      const isOverdue   = col.status !== "paid" && col.status !== "waived" && col.status !== "cancelled" && Boolean(effectiveDueDate) && effectiveDueDate! < today;
                      const isFullyPaid = col.status === "paid";
                      const isWaived    = col.status === "waived";
                      const isCancelled = col.status === "cancelled";
                      const isUnpaid    = col.status === "unpaid";
                      const isPartial   = col.status === "partial";

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
                          feePeriod = (y1 && y1 !== y2) ? `${m1} ${y1} – ${m2} ${y2}` : `${m1} – ${m2} ${y2}`;
                        } else {
                          feePeriod = inner;
                        }
                      }

                      const firstReceipt = col.payments?.[0];

                      return (
                        <tr
                          key={col.id}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            background: isOverdue ? "#fffcfb" : "#ffffff",
                            transition: "background 0.12s ease",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = isOverdue ? "#fff7f5" : "#fafbfc"}
                          onMouseLeave={e => e.currentTarget.style.background = isOverdue ? "#fffcfb" : "#ffffff"}
                        >
                          {/* 1. Row number */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle", fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                            {(currentPage - 1) * pageSize + idx + 1}
                          </td>

                          {/* 2. STUDENT */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={col.full_name}
                              >
                                {col.full_name || `Student #${col.student_id}`}
                              </span>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#94a3b8" }}>
                                {col.admission_number || col.student_roll || "—"}
                              </span>
                            </div>
                          </td>

                          {/* 3. CLASS & SECTION */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "3.5px 10px",
                              borderRadius: 6,
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#1d4ed8",
                              fontSize: 12,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}>
                              {formatClassSection(col.class_name, col.section_name)}
                            </span>
                          </td>

                          {/* 4. FEE TITLE */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start", minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: "100%",
                                }}
                                title={cleanTitle}
                              >
                                {cleanTitle}
                              </span>
                              {feePeriod ? (
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  background: "#fffbeb",
                                  border: "1px solid #fde68a",
                                  color: "#b45309",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}>
                                  <i className="fa-regular fa-calendar" style={{ fontSize: 9.5, color: "#d97706" }} />
                                  {feePeriod}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* 5. DUE DATE */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 800, color: isOverdue ? "#dc2626" : "#0f172a", whiteSpace: "nowrap" }}>
                                  {col.due_date ? formatDate(col.due_date.slice(0, 10)) : "—"}
                                </span>
                                {isOverdue && (
                                  <span style={{
                                    display: "inline-block",
                                    fontSize: 9,
                                    fontWeight: 900,
                                    color: "#dc2626",
                                    background: "#fef2f2",
                                    border: "1px solid #fecaca",
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                    letterSpacing: "0.5px",
                                  }}>
                                    OVERDUE
                                  </span>
                                )}
                              </div>
                              {col.created_at && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", whiteSpace: "nowrap" }}>
                                  Billed: {formatDate(String(col.created_at).slice(0, 10))}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 6. AMOUNT */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {isCancelled ? (
                                <span style={{ fontSize: 13.5, fontWeight: 800, color: "#dc2626" }}>
                                  {formatCurrency(netAmt)}
                                </span>
                              ) : isFullyPaid ? (
                                <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                                  <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#16a34a" }}>
                                    {formatCurrency(paidAmt > 0 ? paidAmt : netAmt)}
                                  </strong>
                                  {hasDiscount && (
                                    <>
                                      <span style={{ textDecoration: "line-through", color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>
                                        {formatCurrency(totalAmt)}
                                      </span>
                                      <span style={{
                                        background: "#ecfdf5",
                                        border: "1px solid #a7f3d0",
                                        color: "#059669",
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: "1px 5px",
                                        borderRadius: 4,
                                      }}>
                                        {col.discount_reason || `10% disc.`}
                                      </span>
                                    </>
                                  )}
                                </div>
                              ) : isWaived ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  {paidAmt > 0 ? (
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                                      <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#16a34a" }}>
                                        {formatCurrency(paidAmt)}
                                      </strong>
                                      <span style={{ textDecoration: "line-through", color: "#94a3b8", fontSize: 11, fontWeight: 600 }}>
                                        {formatCurrency(totalAmt)}
                                      </span>
                                      <span style={{
                                        background: "#ecfdf5",
                                        border: "1px solid #a7f3d0",
                                        color: "#059669",
                                        fontSize: 10,
                                        fontWeight: 800,
                                        padding: "1px 5px",
                                        borderRadius: 4,
                                      }}>
                                        {col.discount_reason || `10% disc.`}
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      <span style={{ fontSize: 13.5, fontWeight: 800, color: "#7c3aed" }}>
                                        {formatCurrency(netAmt)} · Waived
                                      </span>
                                      {col.fine_reason && (
                                        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#7c3aed", display: "flex", alignItems: "center", gap: 3.5 }}>
                                          <i className="fa-solid fa-award" style={{ fontSize: 9 }} /> {col.fine_reason}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              ) : isPartial ? (
                                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                                  <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#ea580c" }}>{formatCurrency(remAmt)}</strong>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>/ {formatCurrency(netAmt)}</span>
                                </div>
                              ) : (
                                <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>
                                  {formatCurrency(remAmt)}
                                </strong>
                              )}
                            </div>
                          </td>

                          {/* 7. STATUS */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle", textAlign: "center" }}>
                            <span style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              letterSpacing: "0.4px",
                              background: isFullyPaid ? "#ecfdf5" : (isCancelled || isUnpaid) ? "#fef2f2" : isWaived ? "#f5f3ff" : "#fffbeb",
                              border: isFullyPaid ? "1px solid #a7f3d0" : (isCancelled || isUnpaid) ? "1px solid #fecaca" : isWaived ? "1px solid #ddd6fe" : "1px solid #fde68a",
                              color: isFullyPaid ? "#059669" : (isCancelled || isUnpaid) ? "#dc2626" : isWaived ? "#7c3aed" : "#d97706",
                            }}>
                              {col.status}
                            </span>
                          </td>

                          {/* 8. ACTIONS */}
                          <td style={{ padding: "14px 14px", verticalAlign: "middle", textAlign: "right" }}>
                            <div style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: 8,
                              position: "relative",
                            }}>
                              {/* Main Action Button */}
                              {isUnpaid || isPartial ? (
                                <Link
                                  href={`${collectUrl}?student_id=${col.student_id}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "5px 12px",
                                    borderRadius: 6,
                                    background: "#ea580c",
                                    color: "#ffffff",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    textDecoration: "none",
                                    boxShadow: "0 1px 3px rgba(234, 88, 12, 0.25)",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <i className="fa-solid fa-arrow-down-to-bracket" style={{ fontSize: 11 }} /> Collect
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setModalCol(col);
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "5px 12px",
                                    borderRadius: 6,
                                    background: "#ffffff",
                                    border: "1.5px solid #e2e8f0",
                                    color: "#334155",
                                    fontSize: 12,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  <i className="fa-regular fa-eye" style={{ fontSize: 11 }} /> View
                                </button>
                              )}

                              {/* Three dots menu button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuColId(activeMenuColId === col.id ? null : col.id);
                                }}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  border: "none",
                                  background: activeMenuColId === col.id ? "#f1f5f9" : "transparent",
                                  color: "#64748b",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  fontSize: 14,
                                }}
                              >
                                <i className="fa-solid fa-ellipsis-vertical" />
                              </button>

                              {/* Dropdown Menu */}
                              {activeMenuColId === col.id && (
                                <div
                                  onClick={e => e.stopPropagation()}
                                  style={{
                                    position: "absolute",
                                    top: "100%",
                                    right: 0,
                                    zIndex: 90,
                                    marginTop: 4,
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 10,
                                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                                    minWidth: 175,
                                    padding: 4,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                  }}
                                >
                                  {col.payments && col.payments.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => { setModalCol(col); setActiveMenuColId(null); }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "7px 10px",
                                        border: "none",
                                        background: "transparent",
                                        width: "100%",
                                        textAlign: "left",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#0f172a",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                      <i className="fa-solid fa-receipt" style={{ color: "#059669", width: 14 }} />
                                      <span>View Receipts ({col.payments.length})</span>
                                    </button>
                                  )}

                                  {isOverdue && !isFullyPaid && !isWaived && !isCancelled && (
                                    <button
                                      type="button"
                                      onClick={() => { setFineTarget(col); setFineAmount(""); setFineReason(""); setActiveMenuColId(null); }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "7px 10px",
                                        border: "none",
                                        background: "transparent",
                                        width: "100%",
                                        textAlign: "left",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#dc2626",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                      <i className="fa-solid fa-bolt" style={{ color: "#dc2626", width: 14 }} />
                                      <span>Apply Late Fine</span>
                                    </button>
                                  )}

                                  {!isFullyPaid && !isWaived && !isCancelled && (
                                    <button
                                      type="button"
                                      onClick={() => { setWaiveTarget(col); setWaiveReason("Waived by admin"); setActiveMenuColId(null); }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "7px 10px",
                                        border: "none",
                                        background: "transparent",
                                        width: "100%",
                                        textAlign: "left",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#d97706",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = "#fffbeb"}
                                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                      <i className="fa-solid fa-award" style={{ color: "#d97706", width: 14 }} />
                                      <span>Waive Fee</span>
                                    </button>
                                  )}

                                  {paidAmt === 0 && !isCancelled && (
                                    <button
                                      type="button"
                                      onClick={() => { setCancelTarget(col); setCancelReason("Wrong billing entry"); setActiveMenuColId(null); }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        padding: "7px 10px",
                                        border: "none",
                                        background: "transparent",
                                        width: "100%",
                                        textAlign: "left",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "#dc2626",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                    >
                                      <i className="fa-solid fa-ban" style={{ color: "#dc2626", width: 14 }} />
                                      <span>Cancel / Void Bill</span>
                                    </button>
                                  )}
                                </div>
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
                <div style={{ textAlign: "center", padding: "3.5rem 1rem", color: "#64748b" }}>
                  <i className="fa-solid fa-receipt" style={{ fontSize: 36, color: "#cbd5e1", marginBottom: 10, display: "block" }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>No payment receipts match the selected search or filters.</p>
                </div>
              ) : (
                <table style={{ width: "100%", minWidth: 1240, borderCollapse: "collapse", tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ background: "#ffffff", borderBottom: "1.5px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 14px", width: 160, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Receipt #</th>
                      <th style={{ padding: "12px 14px", width: 140, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</th>
                      <th style={{ padding: "12px 14px", width: 200, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Student</th>
                      <th style={{ padding: "12px 14px", width: 140, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Class &amp; Section</th>
                      <th style={{ padding: "12px 14px", width: 260, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Settled Fee Items</th>
                      <th style={{ padding: "12px 14px", width: 130, textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Payment Mode</th>
                      <th style={{ padding: "12px 14px", width: 130, textAlign: "right", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Paid</th>
                      <th style={{ padding: "12px 14px", width: 120, textAlign: "right", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Action</th>
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
                        <tr
                          key={voucher.receipt_number}
                          style={{ borderBottom: "1px solid #f1f5f9", background: "#ffffff", transition: "background 0.12s ease" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fafbfc"}
                          onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}
                        >
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              fontWeight: 800,
                              fontSize: 12.5,
                              color: "#0f172a",
                              background: "#f1f5f9",
                              padding: "3px 8px",
                              borderRadius: 6,
                              border: "1px solid #e2e8f0",
                              width: "fit-content",
                              whiteSpace: "nowrap",
                            }}>
                              <i className="fa-solid fa-receipt" style={{ color: "#059669", fontSize: 11 }} />
                              {voucher.receipt_number}
                            </span>
                          </td>
                          <td style={{ padding: "14px 14px", verticalAlign: "middle", fontSize: 12.5, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap" }}>
                            {voucher.payment_date ? formatDate(String(voucher.payment_date).slice(0, 10)) : "—"}
                          </td>
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>
                                {voucher.student_name || `Student #${voucher.student_id}`}
                              </span>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#94a3b8" }}>
                                {voucher.admission_number || "—"}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "3.5px 10px",
                              borderRadius: 6,
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#1d4ed8",
                              fontSize: 12,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                            }}>
                              {formatClassSection(voucher.class_name, voucher.section_name)}
                            </span>
                          </td>
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              {voucher.settled_items && voucher.settled_items.length > 0 ? (
                                voucher.settled_items.map((it: any, i: number) => (
                                  <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5 }}>
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
                          <td style={{ padding: "14px 14px", verticalAlign: "middle" }}>
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
                              whiteSpace: "nowrap",
                            }}>
                              <i className={modeIcon} style={{ fontSize: 10 }} />
                              {mode.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ padding: "14px 14px", verticalAlign: "middle", textAlign: "right" }}>
                            <strong style={{ fontSize: 13.5, fontWeight: 900, color: "#059669", whiteSpace: "nowrap" }}>
                              {formatCurrency(voucher.total_paid)}
                            </strong>
                          </td>
                          <td style={{ padding: "14px 14px", verticalAlign: "middle", textAlign: "right" }}>
                            <Link
                              href={`${receiptBase}/${voucher.payment_id}`}
                              target="_blank"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "5px 12px",
                                borderRadius: 6,
                                background: "#ffffff",
                                border: "1.5px solid #e2e8f0",
                                color: "#334155",
                                fontWeight: 800,
                                fontSize: 11.5,
                                textDecoration: "none",
                              }}
                              title={`View receipt voucher ${voucher.receipt_number}`}
                            >
                              <i className="fa-regular fa-eye" style={{ fontSize: 11 }} />
                              <span>View</span>
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

          {/* ── Table Footer ── */}
          <div style={{
            padding: "14px 20px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            background: "#ffffff",
          }}>
            {/* Showing records count and page size dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#64748b" }}>
                Showing {currentTotal > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, currentTotal)} of {currentTotal} records
              </span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                style={{
                  height: 32,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: "1.5px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#334155",
                  fontSize: 12,
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Prev Button */}
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1.5px solid #e2e8f0",
                  background: "#ffffff",
                  color: currentPage === 1 ? "#cbd5e1" : "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  fontSize: 12,
                }}
              >
                <i className="fa-solid fa-chevron-left" />
              </button>

              {/* Page Numbers */}
              {getPaginationItems(currentPage, totalPages).map((item, i) => {
                if (item === "...") {
                  return (
                    <span key={`ellip-${i}`} style={{ width: 28, textAlign: "center", color: "#94a3b8", fontWeight: 800, fontSize: 12 }}>
                      …
                    </span>
                  );
                }
                const isActive = item === currentPage;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      border: isActive ? "none" : "1.5px solid #e2e8f0",
                      background: isActive ? "#ea580c" : "#ffffff",
                      color: isActive ? "#ffffff" : "#334155",
                      fontWeight: 800,
                      fontSize: 12.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: isActive ? "0 2px 5px rgba(234, 88, 12, 0.25)" : "none",
                    }}
                  >
                    {item}
                  </button>
                );
              })}

              {/* Next Button */}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: "1.5px solid #e2e8f0",
                  background: "#ffffff",
                  color: currentPage >= totalPages ? "#cbd5e1" : "#334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  fontSize: 12,
                }}
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
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
                <span>Fine Amount ({currSymbol}) <b>*</b></span>
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
