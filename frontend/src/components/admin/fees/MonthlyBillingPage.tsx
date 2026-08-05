"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";
import { adToBS, bsToISO, BS_MONTH_NAMES } from "@/lib/bs-ad";

const PAGE_SIZE = 15;

// ── Fee type metadata ─────────────────────────────────────────────────────────
const FEE_TYPES = [
  { value: "academic",  label: "Academic Fees",  icon: "fa-graduation-cap", color: "#2563eb", border: "#bfdbfe", bg: "#eff6ff" },
  { value: "transport", label: "Transport Fees", icon: "fa-bus",            color: "#c46a14", border: "#fed7aa", bg: "#fff7ed" },
  { value: "hostel",    label: "Hostel Fees",    icon: "fa-building",      color: "#7c3aed", border: "#ddd6fe", bg: "#f5f3ff" },
] as const;
type FeeTypeValue = "academic" | "transport" | "hostel";
const TYPE_META = Object.fromEntries(
  FEE_TYPES.map(t => [t.value, t])
) as Record<FeeTypeValue, typeof FEE_TYPES[number]>;

// ── Student grouping ──────────────────────────────────────────────────────────
type StudentSummary = {
  student_id: number; full_name: string; admission_number: string;
  class_name: string; section_name: string; bills: any[];
  total_amount: number; paid_amount: number; remaining_amount: number;
  overallStatus: "paid" | "partial" | "unpaid";
};

function groupByStudent(bills: any[]): StudentSummary[] {
  const map = new Map<number, StudentSummary>();
  for (const b of bills) {
    if (!map.has(b.student_id))
      map.set(b.student_id, {
        student_id: b.student_id, full_name: b.full_name,
        admission_number: b.admission_number,
        class_name: b.class_name || "—", section_name: b.section_name || "",
        bills: [], total_amount: 0, paid_amount: 0, remaining_amount: 0,
        overallStatus: "unpaid",
      });
    const e = map.get(b.student_id)!;
    e.bills.push(b);
    e.total_amount     += Number(b.net_amount    || b.total_amount || 0);
    e.paid_amount      += Number(b.paid_amount   || 0);
    e.remaining_amount += Number(b.remaining_amount || 0);
  }
  for (const e of map.values()) {
    const cleared = e.bills.every((x: any) => x.status === "paid" || x.status === "waived");
    e.overallStatus = (cleared || e.remaining_amount <= 0) ? "paid"
      : e.paid_amount > 0 ? "partial" : "unpaid";
  }
  return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

type BillingPreview = {
  student_id: number; full_name: string; admission_number: string;
  amount: number; assignment: string; already_billed: boolean;
};

// ── BS month options ──────────────────────────────────────────────────────────
function useBsMonthOptions(isBS: boolean, activeYear: any) {
  return useMemo(() => {
    if (!isBS) return [];
    const startAD = activeYear?.start_date
      ? new Date(activeYear.start_date + "T00:00:00")
      : (() => { const d = new Date(); d.setMonth(d.getMonth() - 12); return d; })();
    const endAD = activeYear?.end_date
      ? new Date(activeYear.end_date + "T00:00:00")
      : (() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d; })();
    const startBS = adToBS(startAD), endBS = adToBS(endAD);
    const opts: { label: string; adValue: string }[] = [];
    let y = startBS.year, m = startBS.month;
    while (y < endBS.year || (y === endBS.year && m <= endBS.month)) {
      const ad = new Date(bsToISO({ year: y, month: m, day: 15 }) + "T00:00:00");
      opts.push({
        label: `${BS_MONTH_NAMES[m - 1]} ${y}`,
        adValue: `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}`,
      });
      if (m === 12) { y++; m = 1; } else m++;
    }
    return opts;
  }, [isBS, activeYear]);
}

function toLabel(adValue: string, isBS: boolean, bsOpts: { label: string; adValue: string }[]) {
  if (!adValue) return "";
  if (isBS) { const o = bsOpts.find(o => o.adValue === adValue); if (o) return o.label; }
  const [y, m] = adValue.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function toShortLabel(adValue: string, isBS: boolean, bsOpts: { label: string; adValue: string }[]) {
  if (!adValue) return "";
  if (isBS) { const o = bsOpts.find(o => o.adValue === adValue); if (o) return o.label; }
  const [y, m] = adValue.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

const nowAD = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};

// ── Shared input style ────────────────────────────────────────────────────────
const INP: React.CSSProperties = {
  height: 38, padding: "0 10px", border: "1.5px solid #d1d9e0", borderRadius: 8,
  fontSize: 13, fontWeight: 700, background: "#fff", outline: "none",
  fontFamily: "inherit", color: "#1e293b",
};

// ── MonthSelect ───────────────────────────────────────────────────────────────
function MonthSelect({ label, value, onChange, isBS, bsOpts }: {
  label?: string; value: string; onChange: (v: string) => void;
  isBS: boolean; bsOpts: { label: string; adValue: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
      )}
      {isBS ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ ...INP, minWidth: 160, paddingRight: 28 }}>
          {bsOpts.map(o => <option key={o.adValue} value={o.adValue}>{o.label}</option>)}
        </select>
      ) : (
        <input type="month" value={value} onChange={e => onChange(e.target.value)}
          style={{ ...INP, minWidth: 150 }} />
      )}
    </div>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, [string, string]> = {
    paid:    ["#dcfce7", "#15803d"],
    partial: ["#fef9c3", "#92400e"],
    unpaid:  ["#fee2e2", "#b91c1c"],
    waived:  ["#e0e7ff", "#3730a3"],
  };
  const [bg, color] = MAP[status] ?? ["#f1f5f9", "#64748b"];
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: bg, color, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

// ── PgBtn ─────────────────────────────────────────────────────────────────────
function PgBtn({ onClick, disabled, active, children }: {
  onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: 32, height: 32, borderRadius: 7,
        border: active ? "2px solid #FF9B51" : "1px solid #e2e8f0",
        background: active ? "#FF9B51" : disabled ? "#f8fafc" : "#fff",
        color: active ? "#fff" : disabled ? "#d1d5db" : "#374151",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700, fontSize: 12.5, display: "grid", placeItems: "center",
        fontFamily: "inherit", transition: "all 0.12s",
      }}>
      {children}
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function MonthlyBillingPage() {
  const dispatch = useAppDispatch();
  const { isBS, formatDate } = useDateFormat();
  const { fmt } = useCurrency();
  const { activeYear, academicYearId } = useAcademicYear();
  const bsOpts = useBsMonthOptions(isBS, activeYear);

  // ── Generate panel state ──────────────────────────────────────────────────
  const [fromMonth,  setFromMonth]  = useState(nowAD);
  const [toMonth,    setToMonth]    = useState(nowAD);
  const [dueDay,     setDueDay]     = useState("10");
  const [generating, setGenerating] = useState(false);

  // ── The VIEW table is driven by fromMonth + activeFeeType (set when you
  //    click a generate button, or manually via the fee type tabs in toolbar).
  //    No separate viewMonth picker — the table always shows fromMonth data.
  const [activeFeeType,   setActiveFeeType]   = useState<FeeTypeValue>("academic");
  const [search,          setSearch]          = useState("");
  const [dueFilter,       setDueFilter]       = useState<"all" | "overdue" | "this_week">("all");
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [page,            setPage]            = useState(1);

  // ── Transport/hostel student-select modal ─────────────────────────────────
  const [showModal,          setShowModal]          = useState(false);
  const [modalFeeType,       setModalFeeType]       = useState<FeeTypeValue>("academic");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

  // ── Month range list (for breakdown table + generate loop) ────────────────
  const monthRange = useMemo(() => {
    const months: string[] = [];
    let [cy, cm] = fromMonth.split("-").map(Number);
    const [ey, em] = toMonth.split("-").map(Number);
    while (cy < ey || (cy === ey && cm <= em)) {
      months.push(`${cy}-${String(cm).padStart(2, "0")}`);
      cm++; if (cm > 12) { cy++; cm = 1; }
    }
    return months;
  }, [fromMonth, toMonth]);

  // ── Bills API: always fetches fromMonth data for the active fee type ──────
  const viewApiUrl = academicYearId && fromMonth
    ? `/fees/collections?academic_year_id=${academicYearId}&billing_month=${fromMonth}` : "";
  const { data: rawBills, loading: billsLoading, refetch } = useApi<any>(viewApiUrl, [academicYearId, fromMonth]);
  const allBills: any[] = Array.isArray(rawBills) ? rawBills : (rawBills?.data ?? []);

  // ── Preview for modal (transport/hostel) ──────────────────────────────────
  const previewUrl = showModal && academicYearId && fromMonth
    ? `/fees/${modalFeeType}/preview?academic_year_id=${academicYearId}&billing_month=${fromMonth}` : "";
  const { data: previewData, loading: previewLoading, error: previewError } =
    useApi<BillingPreview[]>(previewUrl, [previewUrl]);
  const previewRows  = Array.isArray(previewData) ? previewData : [];
  const billableRows = previewRows.filter(r => !r.already_billed);

  // ── Filter bills by activeFeeType + dueFilter ─────────────────────────────
  const pendingBills = useMemo(() => {
    const today   = new Date(); today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7);
    return allBills.filter(b => {
      if ((b.fee_type || "academic") !== activeFeeType) return false;
      if (Number(b.remaining_amount || 0) <= 0) return false;
      const due = new Date(`${String(b.due_date).slice(0, 10)}T00:00:00`);
      if (dueFilter === "overdue")   return due < today;
      if (dueFilter === "this_week") return due >= today && due <= weekEnd;
      return true;
    });
  }, [allBills, activeFeeType, dueFilter]);

  const summaries = useMemo(() => groupByStudent(pendingBills), [pendingBills]);

  const filtered = useMemo(() => summaries.filter(st => {
    const q = search.toLowerCase();
    return !q
      || st.full_name.toLowerCase().includes(q)
      || st.admission_number.toLowerCase().includes(q)
      || st.class_name.toLowerCase().includes(q);
  }), [summaries, search]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ── Summary totals for footer row ────────────────────────────────────────
  const totalBilledSum   = summaries.reduce((a, s) => a + s.total_amount,     0);
  const totalPaidSum     = summaries.reduce((a, s) => a + s.paid_amount,      0);
  const totalOutstanding = summaries.reduce((a, s) => a + s.remaining_amount, 0);
  const paidCount        = summaries.filter(s => s.overallStatus === "paid").length;
  const partialCount     = summaries.filter(s => s.overallStatus === "partial").length;
  const unpaidCount      = summaries.filter(s => s.overallStatus === "unpaid").length;

  // ── Generate handler ──────────────────────────────────────────────────────
  const handleGenerate = async (feeType: FeeTypeValue, studentIds?: number[]) => {
    if (!academicYearId) return;
    setGenerating(true);
    setShowModal(false);

    const ENDPOINTS: Record<FeeTypeValue, string> = {
      academic:  "/fees/monthly/generate",
      transport: "/fees/transport/generate",
      hostel:    "/fees/hostel/generate",
    };

    let totalCreated = 0, totalSkipped = 0;
    try {
      for (const bm of monthRange) {
        const body: Record<string, any> = { academic_year_id: academicYearId, billing_month: bm };
        if (feeType !== "academic") {
          body.due_day     = Math.min(Math.max(parseInt(dueDay || "10", 10), 1), 28);
          body.student_ids = studentIds ?? [];
        }
        const res = await apiRequest<{ data: any }>(ENDPOINTS[feeType], {
          method: "POST", body: JSON.stringify(body),
        });
        const { created = 0, skipped = 0 } = res.data ?? res;
        totalCreated += Number(created);
        totalSkipped += Number(skipped);
      }
      dispatch(showToast({
        type: "success", title: `${TYPE_META[feeType].label} Generated`,
        message: `${totalCreated} new bills created, ${totalSkipped} already existed`,
      }));
      // Switch table to show the generated fee type + refresh
      setActiveFeeType(feeType);
      setSearch("");
      setPage(1);
      refetch();
    } catch (err: any) {
      dispatch(showToast({
        type: "error", title: "Failed",
        message: err.message || "Could not generate bills",
      }));
    } finally {
      setGenerating(false);
    }
  };

  const onClickGenerate = (feeType: FeeTypeValue) => {
    if (!academicYearId) return;
    if (feeType === "academic") {
      handleGenerate("academic");
    } else {
      setModalFeeType(feeType);
      setSelectedStudentIds([]);
      setShowModal(true);
    }
  };

  const activeMeta  = TYPE_META[activeFeeType];
  const modalMeta   = TYPE_META[modalFeeType];
  const viewLabel   = toLabel(fromMonth, isBS, bsOpts);

  return (
    <div style={{ minHeight: "100vh", background: "#EAEFEF" }}>
      <style>{`
        .mb-tr:hover td { background: #f8fafc !important; }
        .mb-sub-tr:hover td { background: #f0f7ff !important; }
      `}</style>

      <main style={{ padding: "24px 28px 72px", maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: "#FF9B51", margin: 0 }}>
              Finance · {activeYear?.year_name ?? "…"}
            </p>
            <h1 style={{ fontSize: 23, fontWeight: 900, color: "#25343F", letterSpacing: -0.4, margin: "4px 0 0" }}>
              Monthly Billing System
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginTop: 3 }}>
              Generate and manage monthly fee bills for students with flexible date range.
            </p>
          </div>
          <Link href="/fees/history"
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "1.5px solid #d1d9e0", background: "#fff", color: "#374151", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            <i className="fa-solid fa-clock-rotate-left" /> Billing History
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            GENERATE CARD
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>

          {/* Info banner */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 22px", background: "#f0f7ff", borderBottom: "1px solid #dbeafe" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>
              <i className="fa-solid fa-circle-info" />
            </div>
            <div>
              <strong style={{ fontSize: 13, fontWeight: 900, color: "#1e40af" }}>Bill for Multiple Months</strong>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#1d4ed8", fontWeight: 500 }}>
                Create fee bills for any consecutive months (e.g., Jan – Mar, Apr – Jun).
              </p>
            </div>
          </div>

          <div style={{ padding: "20px 22px 0" }}>

            {/* Step 1 — Date Range ──────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>1</div>
              <strong style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Select Date Range (Months)</strong>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
              <MonthSelect
                label="From Month"
                value={fromMonth}
                onChange={v => { setFromMonth(v); if (v > toMonth) setToMonth(v); setPage(1); }}
                isBS={isBS} bsOpts={bsOpts}
              />
              <div style={{ paddingBottom: 6, color: "#94a3b8", fontSize: 20, fontWeight: 900 }}>→</div>
              <MonthSelect
                label="To Month"
                value={toMonth}
                onChange={v => setToMonth(v < fromMonth ? fromMonth : v)}
                isBS={isBS} bsOpts={bsOpts}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Due Day <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>(transport/hostel)</span>
                </span>
                <input type="number" min={1} max={28} value={dueDay}
                  onChange={e => setDueDay(e.target.value)}
                  style={{ ...INP, width: 72, textAlign: "center" }} />
              </div>

              {/* Selected period card — pushed right */}
              <div style={{
                marginLeft: "auto",
                padding: "12px 20px", borderRadius: 12,
                background: "linear-gradient(135deg,#fff7ed,#ffedd5)",
                border: "1.5px solid #fed7aa", minWidth: 200,
              }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#c2410c", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  <i className="fa-solid fa-calendar-days" style={{ marginRight: 5 }} />Selected Period
                </p>
                <strong style={{ fontSize: 15, fontWeight: 900, color: "#9a3412", display: "block" }}>
                  {toShortLabel(fromMonth, isBS, bsOpts)}
                  {fromMonth !== toMonth && ` – ${toShortLabel(toMonth, isBS, bsOpts)}`}
                </strong>
                <span style={{ fontSize: 12, color: "#c2410c", fontWeight: 700 }}>
                  Total {monthRange.length} Month{monthRange.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Step 2 — Monthly Breakdown table ────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>2</div>
              <strong style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Monthly Breakdown</strong>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Month", "Month Name", "From Date", "To Date", "Fee Types", "Action"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthRange.map((bm, idx) => {
                    const [by, bmon] = bm.split("-").map(Number);
                    const lastDay    = new Date(by, bmon, 0).getDate();
                    const clampedDue = Math.min(Math.max(parseInt(dueDay || "10", 10), 1), lastDay);
                    const toDate     = `${bm}-${String(clampedDue).padStart(2, "0")}`;
                    return (
                      <tr key={bm} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafcfd" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ width: 28, height: 28, borderRadius: 7, background: "#e0e7ff", color: "#3730a3", display: "inline-grid", placeItems: "center", fontWeight: 900, fontSize: 12 }}>
                            {idx + 1}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 800, color: "#1e293b" }}>
                          {toShortLabel(bm, isBS, bsOpts)}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12.5 }}>
                          <i className="fa-regular fa-calendar" style={{ marginRight: 5, color: "#94a3b8" }} />
                          {toShortLabel(bm, isBS, bsOpts)} 1
                        </td>
                        <td style={{ padding: "12px 14px", color: "#475569", fontSize: 12.5 }}>
                          <i className="fa-regular fa-calendar" style={{ marginRight: 5, color: "#94a3b8" }} />
                          Due: {toShortLabel(bm, isBS, bsOpts)} {clampedDue}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 5 }}>
                            {FEE_TYPES.map(ft => (
                              <span key={ft.value} style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: ft.bg, color: ft.color, border: `1px solid ${ft.border}` }}>
                                <i className={`fa-solid ${ft.icon}`} style={{ marginRight: 3, fontSize: 9 }} />
                                {ft.label.split(" ")[0]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", padding: "3px 9px", borderRadius: 6, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
                            <i className="fa-solid fa-clock" style={{ marginRight: 4 }} />Upcoming
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {monthRange.length > 1 && (
                  <tfoot>
                    <tr style={{ background: "#f0f7ff", borderTop: "2px solid #bfdbfe" }}>
                      <td colSpan={2} style={{ padding: "11px 14px", fontWeight: 900, color: "#1d4ed8", fontSize: 13 }}>
                        Total ({monthRange.length} Months)
                      </td>
                      <td colSpan={4} style={{ padding: "11px 14px", fontWeight: 700, color: "#1d4ed8", fontSize: 12.5 }}>
                        {monthRange.length} billing cycles · skips already-billed students
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Note */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 0 18px", marginTop: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>
                <i className="fa-solid fa-lightbulb" />
              </div>
              <div>
                <strong style={{ fontSize: 12.5, fontWeight: 800, color: "#15803d" }}>Note</strong>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#16a34a" }}>
                  Bills will be generated for all active students for the selected period.
                  Academic bills apply scholarship discounts automatically. Already-billed students are skipped.
                </p>
              </div>
            </div>
          </div>

          {/* Generate action bar — bottom of card ────────────────────────── */}
          <div style={{ borderTop: "1px solid #e2e8f0", padding: "14px 22px", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, marginRight: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fa-solid fa-circle-info" style={{ color: "#94a3b8" }} />
              Select fee type to generate bills for {monthRange.length} month{monthRange.length !== 1 ? "s" : ""}
            </span>
            {FEE_TYPES.map(ft => (
              <button key={ft.value}
                onClick={() => onClickGenerate(ft.value)}
                disabled={generating || !academicYearId}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "9px 20px", borderRadius: 9, fontFamily: "inherit",
                  fontSize: 13, fontWeight: 800,
                  cursor: generating || !academicYearId ? "not-allowed" : "pointer",
                  border: `2px solid ${ft.color}`,
                  background: ft.value === "academic" ? ft.color : "#fff",
                  color:      ft.value === "academic" ? "#fff"    : ft.color,
                  boxShadow:  ft.value === "academic" ? `0 3px 12px ${ft.color}44` : "none",
                  opacity:    !academicYearId ? 0.5 : 1,
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >
                {generating
                  ? <Spinner size={14} color={ft.value === "academic" ? "#fff" : ft.color} />
                  : <i className={`fa-solid ${ft.icon}`} />}
                {generating ? "Generating…" : ft.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            PENDING TABLE
            — month is always fromMonth (synced to generate panel)
            — only fee type tabs + search + due filter here (no month picker)
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>

          {/* Toolbar — fee type tabs + search + due filter ONLY */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#fafbfc" }}>

            {/* Fee type tabs — these switch which type is shown, also set which type's pending bills appear */}
            <div style={{ display: "flex", gap: 4, background: "#f1f5f9", borderRadius: 9, padding: 3 }}>
              {FEE_TYPES.map(ft => {
                const active = activeFeeType === ft.value;
                return (
                  <button key={ft.value}
                    onClick={() => { setActiveFeeType(ft.value); setPage(1); setSearch(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "7px 13px", borderRadius: 7, border: "none", cursor: "pointer",
                      fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                      background: active ? "#fff" : "transparent",
                      color:      active ? ft.color : "#64748b",
                      boxShadow:  active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                      transition: "all 0.14s",
                    }}
                  >
                    <i className={`fa-solid ${ft.icon}`} style={{ fontSize: 11 }} />
                    {ft.label.replace(" Fees", "")}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <label style={{
              flex: 1, minWidth: 180,
              display: "flex", alignItems: "center", gap: 8,
              border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "0 12px",
              background: "#fff", cursor: "text",
            }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 13 }} />
              <input
                type="search"
                placeholder="Search student, admission no, class…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ border: "none", background: "transparent", padding: "9px 0", width: "100%", fontFamily: "inherit", fontSize: 13.5, outline: "none", color: "#1e293b" }}
              />
            </label>

            {/* Due date filter */}
            <select value={dueFilter} onChange={e => { setDueFilter(e.target.value as any); setPage(1); }}
              style={{ ...INP, paddingRight: 28 }}>
              <option value="all">All due dates</option>
              <option value="overdue">Overdue</option>
              <option value="this_week">Due this week</option>
            </select>
          </div>

          {/* Table heading — shows WHICH month & fee type we're viewing */}
          <div style={{ padding: "13px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <strong style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>
                <i className={`fa-solid ${activeMeta.icon}`} style={{ marginRight: 7, color: activeMeta.color }} />
                {activeMeta.label} Pending — {viewLabel}
              </strong>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
                {filtered.length} student{filtered.length !== 1 ? "s" : ""} with outstanding fees
              </p>
            </div>
            {filtered.length > PAGE_SIZE && (
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                Page {currentPage} / {totalPages}
              </span>
            )}
          </div>

          {/* Table body */}
          {billsLoading ? (
            <div style={{ padding: 56, textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8" }}>
              <i className="fa-solid fa-inbox" style={{ fontSize: 30, display: "block", marginBottom: 10, opacity: 0.25 }} />
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>
                {allBills.length === 0
                  ? "No bills generated for this month yet."
                  : "No pending fees match this filter."}
              </p>
              <p style={{ fontSize: 12.5, marginTop: 5 }}>
                {allBills.length === 0
                  ? "Use the Generate panel above to create bills."
                  : "Try adjusting the fee type, due-date filter, or search."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[" ", "Student", "Class / Section", "Bills", "Total Billed", "Paid", "Outstanding", "Status"].map(h => (
                      <th key={h} style={{
                        padding: "11px 16px", textAlign: "left",
                        fontSize: 11, fontWeight: 900, color: "#64748b",
                        textTransform: "uppercase", letterSpacing: 0.5,
                        borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map(st => {
                    const expanded   = expandedStudent === st.student_id;
                    const leftColor  = st.overallStatus === "paid" ? "#22c55e" : st.overallStatus === "partial" ? "#f59e0b" : "#ef4444";
                    const rowBg      = st.overallStatus === "paid" ? "#f0fdf4" : st.overallStatus === "partial" ? "#fffbeb" : "#fff";
                    return [
                      // ── Summary row
                      <tr key={`s-${st.student_id}`} className="mb-tr"
                        style={{ background: rowBg, borderLeft: `3px solid ${leftColor}`, cursor: "pointer" }}
                        onClick={() => setExpandedStudent(expanded ? null : st.student_id)}>
                        <td style={{ padding: "12px 8px 12px 14px", width: 28 }}>
                          <i className={`fa-solid fa-chevron-${expanded ? "down" : "right"}`}
                            style={{ fontSize: 10, color: "#94a3b8" }} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ display: "block", color: "#1e293b" }}>{st.full_name}</strong>
                          <small style={{ color: "#94a3b8", fontWeight: 600 }}>{st.admission_number}</small>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#475569" }}>
                          {[st.class_name, st.section_name].filter(Boolean).join(" / ")}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6, padding: "2px 9px" }}>
                            {st.bills.length} fee{st.bills.length !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e293b" }}>{fmt(st.total_amount)}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#15803d" }}>{fmt(st.paid_amount)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ color: st.remaining_amount > 0 ? "#b91c1c" : "#15803d" }}>
                            {fmt(st.remaining_amount)}
                          </strong>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 800,
                            background: st.overallStatus === "paid" ? "#dcfce7" : st.overallStatus === "partial" ? "#fef9c3" : "#fee2e2",
                            color:      st.overallStatus === "paid" ? "#15803d" : st.overallStatus === "partial" ? "#92400e" : "#b91c1c",
                          }}>
                            {st.overallStatus === "paid" ? "Fully Paid" : st.overallStatus === "partial" ? "Partial" : "Not Paid"}
                          </span>
                        </td>
                      </tr>,

                      // ── Expanded bill detail rows
                      ...(expanded ? st.bills.map((bill: any) => (
                        <tr key={`b-${bill.id ?? `${st.student_id}-${bill.fee_name}`}`}
                          className="mb-sub-tr"
                          style={{ background: "#fafcff", borderLeft: "3px solid #FF9B51" }}>
                          <td />
                          <td colSpan={2} style={{ padding: "10px 16px", fontSize: 12.5 }}>
                            <strong style={{ color: "#334155" }}>{bill.fee_name}</strong>
                            <span style={{
                              marginLeft: 8, fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
                              background: bill.fee_type === "transport" ? "#fff7ed" : bill.fee_type === "hostel" ? "#f5f3ff" : "#eff6ff",
                              color:      bill.fee_type === "transport" ? "#c46a14" : bill.fee_type === "hostel" ? "#7c3aed"  : "#2563eb",
                              border: `1px solid ${bill.fee_type === "transport" ? "#fed7aa" : bill.fee_type === "hostel" ? "#ddd6fe" : "#bfdbfe"}`,
                            }}>
                              {bill.fee_type || "academic"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                            Due: {formatDate(String(bill.due_date).slice(0, 10))}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 12, fontWeight: 700 }}>
                            {fmt(bill.net_amount || bill.total_amount || 0)}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 12, color: "#15803d", fontWeight: 700 }}>
                            {fmt(bill.paid_amount || 0)}
                          </td>
                          <td style={{ padding: "10px 16px", fontSize: 12 }}>
                            <strong style={{ color: Number(bill.remaining_amount) > 0 ? "#b91c1c" : "#15803d" }}>
                              {fmt(bill.remaining_amount || 0)}
                            </strong>
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <StatusBadge status={bill.status} />
                          </td>
                        </tr>
                      )) : []),
                    ];
                  })}
                </tbody>

                {/* ── Summary footer row (inline, not separate cards) ──────── */}
                {summaries.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                      <td />
                      <td colSpan={2} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 16 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                            <span style={{ fontWeight: 900, color: "#1e293b", fontSize: 13 }}>{summaries.length}</span> Total Students
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>
                            <span style={{ fontWeight: 900, fontSize: 13 }}>{paidCount}</span> Fully Paid
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                            <span style={{ fontWeight: 900, fontSize: 13 }}>{partialCount}</span> Partial
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                            <span style={{ fontWeight: 900, fontSize: 13 }}>{unpaidCount}</span> Not Paid
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }} />
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: "#1e293b", fontSize: 13, whiteSpace: "nowrap" }}>
                        {fmt(totalBilledSum)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: "#15803d", fontSize: 13, whiteSpace: "nowrap" }}>
                        {fmt(totalPaidSum)}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: totalOutstanding > 0 ? "#b91c1c" : "#15803d", fontSize: 13, whiteSpace: "nowrap" }}>
                        {fmt(totalOutstanding)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600 }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <PgBtn disabled={currentPage === 1}         onClick={() => setPage(p => p - 1)}><i className="fa-solid fa-chevron-left" /></PgBtn>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…"
                      ? <span key={`e${i}`} style={{ width: 32, height: 32, display: "grid", placeItems: "center", fontSize: 12, color: "#94a3b8" }}>…</span>
                      : <PgBtn key={p} active={p === currentPage} onClick={() => setPage(p as number)}>{p}</PgBtn>
                  )}
                <PgBtn disabled={currentPage === totalPages} onClick={() => setPage(p => p + 1)}><i className="fa-solid fa-chevron-right" /></PgBtn>
              </div>
            </div>
          )}
        </div>

      </main>

      {/* ═══════════════════════════════════════════════════════════════
          TRANSPORT / HOSTEL STUDENT SELECT MODAL
      ══════════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "calc(100vh - 40px)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Modal head */}
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: modalMeta.bg, color: modalMeta.color, display: "grid", placeItems: "center", fontSize: 17, border: `1px solid ${modalMeta.border}` }}>
                <i className={`fa-solid ${modalMeta.icon}`} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 15, fontWeight: 900, color: "#1e293b" }}>Generate {modalMeta.label}</strong>
                <p style={{ margin: "3px 0 0", fontSize: 13, color: "#64748b" }}>
                  {toLabel(fromMonth, isBS, bsOpts)}
                  {fromMonth !== toMonth && ` → ${toLabel(toMonth, isBS, bsOpts)}`}
                  {monthRange.length > 1 && ` (${monthRange.length} months)`}
                  · Due day {dueDay}
                </p>
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "grid", placeItems: "center", fontSize: 14, color: "#64748b", flexShrink: 0 }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Preview list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                  {selectedStudentIds.length} of {billableRows.length} students selected
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setSelectedStudentIds(billableRows.map(r => r.student_id))}
                    style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                    Select all
                  </button>
                  <button onClick={() => setSelectedStudentIds([])}
                    style={{ border: "1px solid #e2e8f0", background: "#f8fafc", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                    Clear
                  </button>
                </div>
              </div>

              {previewLoading ? (
                <div style={{ padding: 32, textAlign: "center" }}><Spinner size={28} color="#64748b" /></div>
              ) : previewError ? (
                <div style={{ padding: 12, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13 }}>
                  {String(previewError)}
                </div>
              ) : previewRows.length === 0 ? (
                <div style={{ padding: 24, borderRadius: 10, background: "#f8fafc", color: "#64748b", fontSize: 13, textAlign: "center" }}>
                  No eligible active assignments found.
                </div>
              ) : (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr auto", gap: 12, padding: "9px 14px", background: "#f8fafc", fontSize: 10.5, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    <span /><span>Student</span><span>Assignment</span><span>Fee</span>
                  </div>
                  {previewRows.map(row => {
                    const checked = selectedStudentIds.includes(row.student_id);
                    return (
                      <label key={row.student_id} style={{
                        display: "grid", gridTemplateColumns: "32px 1fr 1fr auto", gap: 12,
                        alignItems: "center", padding: "11px 14px", borderTop: "1px solid #f1f5f9",
                        cursor: row.already_billed ? "default" : "pointer",
                        background: row.already_billed ? "#f8fafc" : checked ? "#f0fdf4" : "#fff",
                        opacity: row.already_billed ? 0.6 : 1, transition: "background 0.12s",
                      }}>
                        <input type="checkbox" checked={checked} disabled={row.already_billed}
                          onChange={() => setSelectedStudentIds(ids =>
                            checked ? ids.filter(id => id !== row.student_id) : [...ids, row.student_id]
                          )}
                          style={{ width: 15, height: 15, accentColor: modalMeta.color }}
                        />
                        <span>
                          <strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.full_name}</strong>
                          <small style={{ color: "#94a3b8" }}>{row.admission_number}</small>
                        </span>
                        <span style={{ fontSize: 12.5, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.assignment}</span>
                        <strong style={{ fontSize: 13, whiteSpace: "nowrap", color: modalMeta.color }}>{fmt(row.amount)}</strong>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 12, padding: "9px 14px", borderRadius: 8, background: "#fefce8", border: "1px solid #fde68a", fontSize: 12.5, color: "#92400e", fontWeight: 600, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <i className="fa-solid fa-shield-halved" style={{ flexShrink: 0, marginTop: 1 }} />
                Already-billed students are locked. A receipt is only issued after payment collection.
              </div>
            </div>

            {/* Modal actions */}
            <div style={{ padding: "14px 22px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowModal(false)}
                style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button
                onClick={() => handleGenerate(modalFeeType, selectedStudentIds)}
                disabled={generating || previewLoading || !!previewError || selectedStudentIds.length === 0}
                style={{
                  padding: "9px 20px", borderRadius: 9,
                  border: `2px solid ${modalMeta.color}`,
                  background: modalMeta.color, color: "#fff",
                  fontWeight: 800, fontSize: 13.5,
                  cursor: selectedStudentIds.length === 0 ? "not-allowed" : "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8,
                  opacity: selectedStudentIds.length === 0 ? 0.5 : 1,
                  boxShadow: `0 3px 12px ${modalMeta.color}44`,
                }}>
                {generating
                  ? <><Spinner size={14} color="#fff" /> Generating…</>
                  : <><i className={`fa-solid ${modalMeta.icon}`} /> Generate {selectedStudentIds.length} Bill{selectedStudentIds.length !== 1 ? "s" : ""}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
