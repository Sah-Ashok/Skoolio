"use client";

import Link from "next/link";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/api";
import { Spinner } from "@/components/shared/Loader";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";
import { adToBS, bsToISO, BS_MONTH_NAMES } from "@/lib/bs-ad";
import DateInput from "@/components/shared/DateInput";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE = 15;

const FEE_TYPES = [
  { value: "academic",  label: "Academic",  icon: "fa-graduation-cap", color: "#2563eb", border: "#bfdbfe", bg: "#eff6ff" },
  { value: "transport", label: "Transport", icon: "fa-bus",            color: "#c46a14", border: "#fed7aa", bg: "#fff7ed" },
  { value: "hostel",    label: "Hostel",    icon: "fa-building",       color: "#7c3aed", border: "#ddd6fe", bg: "#f5f3ff" },
] as const;
type FeeTypeValue = "academic" | "transport" | "hostel";
const TYPE_META = Object.fromEntries(FEE_TYPES.map(t => [t.value, t])) as Record<FeeTypeValue, typeof FEE_TYPES[number]>;

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
      opts.push({ label: `${BS_MONTH_NAMES[m - 1]} ${y}`, adValue: `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, "0")}` });
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

const nowAD = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; };

const INP: React.CSSProperties = {
  height: 38, padding: "0 10px", border: "1.5px solid #d1d9e0", borderRadius: 8,
  fontSize: 13, fontWeight: 700, background: "#fff", outline: "none",
  fontFamily: "inherit", color: "#1e293b",
};

function MonthSelect({ label, value, onChange, isBS, bsOpts }: {
  label?: string; value: string; onChange: (v: string) => void;
  isBS: boolean; bsOpts: { label: string; adValue: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>}
      {isBS ? (
        <select value={value} onChange={e => onChange(e.target.value)} style={{ ...INP, minWidth: 160, paddingRight: 28 }}>
          {bsOpts.map((o, i) => <option key={`${o.adValue}-${i}`} value={o.adValue}>{o.label}</option>)}
        </select>
      ) : (
        <input type="month" value={value} onChange={e => onChange(e.target.value)} style={{ ...INP, minWidth: 150 }} />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const MAP: Record<string, { bg: string; color: string; label: string }> = {
    paid:    { bg: "#dcfce7", color: "#15803d", label: "Fully Paid" },
    partial: { bg: "#fef9c3", color: "#92400e", label: "Partial" },
    unpaid:  { bg: "#fee2e2", color: "#b91c1c", label: "Not Paid" },
    waived:  { bg: "#e0e7ff", color: "#3730a3", label: "Waived" },
  };
  const s = MAP[status] ?? { bg: "#f1f5f9", color: "#64748b", label: status };
  return (
    <span style={{ padding: "3px 11px", borderRadius: 20, fontSize: 11.5, fontWeight: 800, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function PgBtn({ onClick, disabled, active, children }: { onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 32, height: 32, borderRadius: 7,
      border: active ? "2px solid #FF9B51" : "1px solid #e2e8f0",
      background: active ? "#FF9B51" : disabled ? "#f8fafc" : "#fff",
      color: active ? "#fff" : disabled ? "#d1d5db" : "#374151",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700, fontSize: 12.5, display: "grid", placeItems: "center",
      fontFamily: "inherit", transition: "all 0.12s",
    }}>{children}</button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function MonthlyBillingPage() {
  const dispatch = useAppDispatch();
  const { isBS, formatDate } = useDateFormat();
  const { fmt } = useCurrency();
  const { activeYear, academicYearId } = useAcademicYear();
  const bsOpts = useBsMonthOptions(isBS, activeYear);

  const [fromMonth,  setFromMonth]  = useState(nowAD);
  const [toMonth,    setToMonth]    = useState(nowAD);
  const [dueDate,    setDueDate]    = useState("");
  const [generating, setGenerating] = useState(false);

  // activeFeeType drives BOTH the generate buttons AND the view table
  const [activeFeeType,   setActiveFeeType]   = useState<FeeTypeValue>("academic");
  const [search,          setSearch]          = useState("");
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);
  const [page,            setPage]            = useState(1);

  const [selectedClassId,   setSelectedClassId]   = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [classesList,       setClassesList]       = useState<any[]>([]);
  const [sectionsList,      setSectionsList]      = useState<any[]>([]);

  // Queue Live Progress state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [queueProgress,     setQueueProgress]     = useState(0);
  const [queueStatus,       setQueueStatus]       = useState<string>("queued");
  const [jobFeeType,        setJobFeeType]        = useState<FeeTypeValue>("academic");
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch classes for active academic year
  useEffect(() => {
    if (!academicYearId) return;
    apiRequest<any>(`/classes?academic_year_id=${academicYearId}`)
      .then(res => {
        const cls = Array.isArray(res) ? res : (res?.data ?? []);
        setClassesList(cls);
      })
      .catch(() => setClassesList([]));
  }, [academicYearId]);

  // Fetch sections when class changes
  useEffect(() => {
    if (!selectedClassId) {
      setSectionsList([]);
      setSelectedSectionId("");
      return;
    }
    apiRequest<any>(`/classes/${selectedClassId}/sections`)
      .then(res => {
        const secs = Array.isArray(res) ? res : (res?.data ?? []);
        setSectionsList(secs);
      })
      .catch(() => setSectionsList([]));
  }, [selectedClassId]);

  // Multi-select fee types for generate (replaces modal approach)
  const [selectedFeeTypes, setSelectedFeeTypes] = useState<Set<FeeTypeValue>>(new Set(["academic"]));

  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [voidTargetMonth, setVoidTargetMonth] = useState<string>("");
  const [voiding,         setVoiding]         = useState(false);

  // Month range for generate loop
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

  // ── VIEW MODE: "unbilled" (pre-generate) vs "billed" (post-generate) ──────
  const [viewMode, setViewMode] = useState<"unbilled" | "billed">("unbilled");

  // ── BILLED: existing bills fetched for the selected range ─────────────────
  const [allBills,      setAllBills]      = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const [isRefreshing,  setIsRefreshing]  = useState(false);

  const refetchAll = useCallback(async (isFirst = false) => {
    if (!academicYearId || monthRange.length === 0) { setAllBills([]); return; }
    if (isFirst) setIsInitialLoad(true); else setIsRefreshing(true);
    try {
      const results = await Promise.all(
        monthRange.map(bm => apiRequest<any>(`/fees/collections?academic_year_id=${academicYearId}&billing_month=${bm}`))
      );
      const merged = results.flatMap(r => Array.isArray(r) ? r : (r?.data ?? []));
      const deduped = new Map<number, any>();
      for (const b of merged) if (b.id) deduped.set(b.id, b);
      setAllBills(Array.from(deduped.values()));
    } catch { setAllBills([]); }
    finally { setIsInitialLoad(false); setIsRefreshing(false); }
  }, [academicYearId, monthRange.join(",")]);

  useEffect(() => { refetchAll(true); setPage(1); }, [refetchAll]);

  // ── UNBILLED: students without any bill in the range for the active fee type
  const [unbilledStudents,   setUnbilledStudents]   = useState<any[]>([]);
  const [unbilledLoading,    setUnbilledLoading]    = useState(false);
  const unbilledAbortRef = useRef<AbortController | null>(null);

  const refetchUnbilled = useCallback(async () => {
    if (!academicYearId || monthRange.length === 0) { setUnbilledStudents([]); return; }
    // abort any in-flight request
    unbilledAbortRef.current?.abort();
    unbilledAbortRef.current = new AbortController();
    setUnbilledLoading(true);
    try {
      const monthsParam = monthRange.join(",");
      const res = await apiRequest<any>(
        `/fees/monthly/unbilled?academic_year_id=${academicYearId}&billing_months=${encodeURIComponent(monthsParam)}&fee_type=${activeFeeType}`
      );
      setUnbilledStudents(Array.isArray(res) ? res : (res?.data ?? []));
    } catch { setUnbilledStudents([]); }
    finally { setUnbilledLoading(false); }
  }, [academicYearId, monthRange.join(","), activeFeeType]);

  useEffect(() => {
    if (viewMode === "unbilled") { refetchUnbilled(); setPage(1); }
  }, [refetchUnbilled, viewMode]);

  // Group allBills by student for the active fee type (billed view)
  const billedSummaries = useMemo(() => {
    const typeBills = allBills.filter(b => (b.fee_type || "academic") === activeFeeType);
    return groupByStudent(typeBills);
  }, [allBills, activeFeeType]);

  const debouncedSearch = useDebounce(search, 300);

  // Search & Class/Section filter — applied to whichever view is active
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    const source = viewMode === "unbilled" ? unbilledStudents : billedSummaries;
    return source.filter((st: any) => {
      const matchesSearch = !q
        || (st.full_name        || "").toLowerCase().includes(q)
        || (st.admission_number || "").toLowerCase().includes(q)
        || (st.class_name       || "").toLowerCase().includes(q);

      const selCls = classesList.find(c => String(c.id) === String(selectedClassId));
      const matchesClass = !selectedClassId
        || String(st.class_id) === String(selectedClassId)
        || (selCls && (st.class_name || "").toLowerCase() === (selCls.name || "").toLowerCase());

      const selSec = sectionsList.find(s => String(s.id) === String(selectedSectionId));
      const matchesSection = !selectedSectionId
        || String(st.section_id) === String(selectedSectionId)
        || (selSec && (st.section_name || "").toLowerCase() === (selSec.name || "").toLowerCase());

      return matchesSearch && matchesClass && matchesSection;
    });
  }, [viewMode, unbilledStudents, billedSummaries, debouncedSearch, selectedClassId, selectedSectionId, classesList, sectionsList]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageSlice   = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Footer totals
  const footerTotalBilled  = filtered.reduce((s, st) => s + st.total_amount,     0);
  const footerTotalPaid    = filtered.reduce((s, st) => s + st.paid_amount,      0);
  const footerTotalPending = filtered.reduce((s, st) => s + st.remaining_amount, 0);
  const footerPaidCount    = filtered.filter(st => st.overallStatus === "paid").length;
  const footerPartialCount = filtered.filter(st => st.overallStatus === "partial").length;
  const footerUnpaidCount  = filtered.filter(st => st.overallStatus === "unpaid").length;

  // Months without any bill yet (for breakdown table status)
  const notGeneratedMonths = useMemo(() =>
    monthRange.filter(bm => !allBills.some(b => {
      if (b.billing_from_month && b.billing_to_month) {
        return bm >= b.billing_from_month && bm <= b.billing_to_month;
      }
      if (b.due_date) return String(b.due_date).slice(0, 7) === bm;
      return false;
    }))
  , [monthRange, allBills]);

  // Queue Polling Worker
  const startPollingJob = useCallback((jobId: string, feeType: FeeTypeValue) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await apiRequest<{ data: any }>(`/fees/monthly/queue-status/${jobId}`);
        const jobData = res.data ?? res;
        if (!jobData) return;

        setQueueProgress(jobData.progress || 0);
        setQueueStatus(jobData.state || "active");

        if (jobData.state === "completed") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setGenerating(false);
          setQueueProgress(100);
          setTimeout(() => {
            setShowProgressModal(false);
          }, 1200);

          const result = jobData.result || {};
          dispatch(showToast({
            type: "success",
            title: `${TYPE_META[feeType].label} Bills Generated`,
            message: `${result.created ?? 0} bills created, ${result.skipped ?? 0} already existed`
          }));
          refetchAll(false);
          refetchUnbilled();
        } else if (jobData.state === "failed") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setGenerating(false);
          setShowProgressModal(false);
          dispatch(showToast({
            type: "error",
            title: "Generation Failed",
            message: jobData.failedReason || "Background generation failed"
          }));
        }
      } catch {
        // Network blip — keep polling
      }
    }, 800);
  }, [dispatch, refetchAll, refetchUnbilled]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Generate handler via Redis Queue
  const handleGenerate = async (feeType: FeeTypeValue) => {
    if (!academicYearId) return;
    setGenerating(true);
    const yearStart = activeYear?.start_date ? String(activeYear.start_date).slice(0, 7) : null;
    const yearEnd   = activeYear?.end_date   ? String(activeYear.end_date).slice(0, 7)   : null;
    const validMonths = monthRange.filter(bm => (!yearStart || bm >= yearStart) && (!yearEnd || bm <= yearEnd));
    if (!validMonths.length) {
      dispatch(showToast({ type: "error", title: "Outside Academic Year", message: `Selected months are outside the active academic year.` }));
      setGenerating(false); return;
    }

    try {
      const body: Record<string, any> = {
        academic_year_id: academicYearId,
        from_month: validMonths[0],
        to_month: validMonths[validMonths.length - 1],
        billing_month: validMonths[validMonths.length - 1],
        class_id: selectedClassId ? Number(selectedClassId) : null,
        section_id: selectedSectionId ? Number(selectedSectionId) : null,
        fee_type: feeType,
      };
      if (dueDate) {
        body.due_date = dueDate;
        body.custom_due_date = dueDate;
      }

      const res = await apiRequest<{ data: any }>("/fees/monthly/generate-queue", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const job = res.data ?? res;
      if (job?.jobId) {
        setJobFeeType(feeType);
        setQueueProgress(5);
        setQueueStatus("queued");
        setShowProgressModal(true);
        startPollingJob(job.jobId, feeType);
      }
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Generation Failed", message: err.message || "Could not start bill generation" }));
      setGenerating(false);
    }
  };

  // Fire generate for all selected fee types in sequence
  const handleGenerateAll = async () => {
    if (!academicYearId || selectedFeeTypes.size === 0) return;
    for (const ft of (["academic", "transport", "hostel"] as FeeTypeValue[]).filter(f => selectedFeeTypes.has(f))) {
      await handleGenerate(ft);
    }
  };

  const handleVoid = async () => {
    if (!academicYearId || !voidTargetMonth) return;
    setVoiding(true); setShowVoidConfirm(false);
    try {
      const res = await apiRequest<{ data: any }>("/fees/monthly/void", {
        method: "DELETE",
        body: JSON.stringify({ academic_year_id: academicYearId, billing_month: voidTargetMonth, fee_type: activeFeeType }),
      });
      const { voided = 0, protected_paid = 0, protected_partial = 0 } = res.data ?? res;
      dispatch(showToast({
        type: voided > 0 ? "success" : "info",
        title: voided > 0 ? "Bills Removed" : "Nothing to Remove",
        message: voided > 0
          ? `${voided} unpaid bill(s) removed for ${toShortLabel(voidTargetMonth, isBS, bsOpts)}.`
            + (protected_paid + protected_partial > 0 ? ` ${protected_paid + protected_partial} bill(s) with payments were kept.` : "")
          : `No unpaid bills found for this month.`,
      }));
      refetchAll(false);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Void Failed", message: err.message || "Could not remove bills" }));
    } finally { setVoiding(false); setVoidTargetMonth(""); }
  };

  const switchFeeType = (ft: FeeTypeValue) => { setActiveFeeType(ft); setPage(1); setSearch(""); };

  const activeMeta = TYPE_META[activeFeeType];
  const rangeLabel = fromMonth === toMonth
    ? toShortLabel(fromMonth, isBS, bsOpts)
    : `${toShortLabel(fromMonth, isBS, bsOpts)} – ${toShortLabel(toMonth, isBS, bsOpts)}`;

  return (
    <div style={{ minHeight: "100vh", background: "#EAEFEF" }}>
      <style>{`
        .mb-tr:hover td { background: #f8fafc !important; }
        .mb-sub-tr:hover td { background: #f0f9ff !important; }
      `}</style>

      <main style={{ padding: "24px 28px 72px", maxWidth: 1280, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase", color: "#FF9B51", margin: 0 }}>Finance · {activeYear?.year_name ?? "…"}</p>
            <h1 style={{ fontSize: 23, fontWeight: 900, color: "#25343F", letterSpacing: -0.4, margin: "4px 0 0" }}>Monthly Billing System</h1>
            <p style={{ fontSize: 13, color: "#64748b", fontWeight: 500, marginTop: 3 }}>Generate and manage monthly fee bills for students with flexible date range.</p>
          </div>
          <Link href="/fees/history" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "1.5px solid #d1d9e0", background: "#fff", color: "#374151", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            <i className="fa-solid fa-clock-rotate-left" /> Billing History
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            GENERATE CARD
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)" }}>

          {/* Info banner */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 22px", background: "#f0f7ff", borderBottom: "1px solid #dbeafe" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, flexShrink: 0 }}>
              <i className="fa-solid fa-circle-info" />
            </div>
            <div>
              <strong style={{ fontSize: 13, fontWeight: 900, color: "#1e40af" }}>Bill for Multiple Months</strong>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#1d4ed8", fontWeight: 500 }}>Create fee bills for any consecutive months (e.g., Jan – Mar, Apr – Jun).</p>
            </div>
          </div>

          <div style={{ padding: "20px 22px 0" }}>
            {/* Step 1 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>1</div>
              <strong style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Select Date Range (Months)</strong>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
              <MonthSelect label="From Month" value={fromMonth} onChange={v => { setFromMonth(v); if (v > toMonth) setToMonth(v); setPage(1); }} isBS={isBS} bsOpts={bsOpts} />
              <div style={{ paddingBottom: 6, color: "#94a3b8", fontSize: 20, fontWeight: 900 }}>→</div>
              <MonthSelect label="To Month" value={toMonth} onChange={v => setToMonth(v < fromMonth ? fromMonth : v)} isBS={isBS} bsOpts={bsOpts} />
              
              {/* Class Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <i className="fa-solid fa-school" style={{ marginRight: 4, color: "#94a3b8" }} /> Class
                </span>
                <select
                  value={selectedClassId}
                  onChange={e => { setSelectedClassId(e.target.value); setSelectedSectionId(""); setPage(1); }}
                  style={{ ...INP, minWidth: 160 }}
                >
                  <option value="">All Classes (Whole School)</option>
                  {classesList.map(c => (
                    <option key={c.id} value={c.id}>{c.name || `Class ${c.id}`}</option>
                  ))}
                </select>
              </div>

              {/* Section Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <i className="fa-solid fa-layer-group" style={{ marginRight: 4, color: "#94a3b8" }} /> Section
                </span>
                <select
                  value={selectedSectionId}
                  onChange={e => { setSelectedSectionId(e.target.value); setPage(1); }}
                  disabled={!selectedClassId}
                  style={{ ...INP, minWidth: 130, opacity: !selectedClassId ? 0.6 : 1 }}
                >
                  <option value="">All Sections</option>
                  {sectionsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name || `Section ${s.id}`}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Due Date <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>(optional)</span>
                </span>
                <div style={{ width: 140 }}>
                  <DateInput
                    value={dueDate}
                    onChange={(e: any) => setDueDate(e.target.value)}
                    minDate={`${toMonth}-01`}
                    placeholder="Optional"
                    style={isBS ? { width: "100%" } : { ...INP, width: "100%" }}
                  />
                </div>
              </div>

              {/* Selected period card */}
              <div style={{ marginLeft: "auto", padding: "12px 20px", borderRadius: 12, background: "linear-gradient(135deg,#fff7ed,#ffedd5)", border: "1.5px solid #fed7aa", minWidth: 200 }}>
                <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 800, color: "#c2410c", textTransform: "uppercase", letterSpacing: 0.4 }}>
                  <i className="fa-solid fa-calendar-days" style={{ marginRight: 5 }} />Selected Period
                </p>
                <strong style={{ fontSize: 15, fontWeight: 900, color: "#9a3412", display: "block" }}>{rangeLabel}</strong>
                <span style={{ fontSize: 12, color: "#c2410c", fontWeight: 700 }}>Total {monthRange.length} Month{monthRange.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Step 2 — Monthly Breakdown */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>2</div>
              <strong style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>Monthly Breakdown</strong>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Month", "Month Name", "Fee Types", "Status", "Action"].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthRange.map((bm, idx) => {
                    const [by, bmon] = bm.split("-").map(Number);
                    const monthBills = allBills.filter(b => {
                      if (b.billing_from_month && b.billing_to_month) {
                        return bm >= b.billing_from_month && bm <= b.billing_to_month;
                      }
                      if (b.due_date) return String(b.due_date).slice(0, 7) === bm;
                      return false;
                    });
                    const totalBillsM    = monthBills.length;
                    const pendingBillsM  = monthBills.filter(b => b.status !== "paid" && b.status !== "waived" && Number(b.remaining_amount || 0) > 0).length;
                    const isGenerated    = totalBillsM > 0;
                    return (
                      <tr key={bm} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#fff" : "#fafcfd" }}>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ width: 28, height: 28, borderRadius: 7, background: "#e0e7ff", color: "#3730a3", display: "inline-grid", placeItems: "center", fontWeight: 900, fontSize: 12 }}>{idx + 1}</span>
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: 800, color: "#1e293b" }}>{toShortLabel(bm, isBS, bsOpts)}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ display: "flex", gap: 5 }}>
                            {FEE_TYPES.map(ft => (
                              <span key={ft.value} style={{ fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: ft.bg, color: ft.color, border: `1px solid ${ft.border}` }}>
                                <i className={`fa-solid ${ft.icon}`} style={{ marginRight: 3, fontSize: 9 }} />{ft.label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {(isInitialLoad || isRefreshing)
                            ? <span style={{ fontSize: 11, color: "#94a3b8" }}><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 4 }} />Loading…</span>
                            : !isGenerated
                              ? <span style={{ fontSize: 11, fontWeight: 800, color: "#b45309", padding: "3px 10px", borderRadius: 6, background: "#fef9c3", border: "1px solid #fde68a", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 10 }} />Not Generated
                                </span>
                              : pendingBillsM > 0
                                ? <span style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c", padding: "3px 10px", borderRadius: 6, background: "#fee2e2", border: "1px solid #fca5a5", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <i className="fa-solid fa-hourglass-half" style={{ fontSize: 10 }} />{pendingBillsM} Pending
                                  </span>
                                : <span style={{ fontSize: 11, fontWeight: 800, color: "#15803d", padding: "3px 10px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <i className="fa-solid fa-circle-check" style={{ fontSize: 10 }} />All Paid ({totalBillsM - pendingBillsM})
                                  </span>}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {isGenerated && (
                            <button
                              onClick={e => { e.stopPropagation(); setVoidTargetMonth(bm); setShowVoidConfirm(true); }}
                              disabled={voiding || generating}
                              title="Remove unpaid bills for this month (paid bills are never touched)"
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                padding: "4px 10px", borderRadius: 6, fontFamily: "inherit",
                                fontSize: 11, fontWeight: 800, cursor: "pointer",
                                border: "1.5px solid #fecdd3", background: "#fff5f5",
                                color: "#be123c", opacity: voiding || generating ? 0.5 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              <i className="fa-solid fa-rotate-left" style={{ fontSize: 10 }} /> Undo
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {monthRange.length > 1 && (
                  <tfoot>
                    <tr style={{ background: "#f0f7ff", borderTop: "2px solid #bfdbfe" }}>
                      <td colSpan={2} style={{ padding: "11px 14px", fontWeight: 900, color: "#1d4ed8", fontSize: 13 }}>Total ({monthRange.length} Months)</td>
                      <td colSpan={3} style={{ padding: "11px 14px", fontWeight: 700, color: "#1d4ed8", fontSize: 12.5 }}>{monthRange.length} billing cycles · skips already-billed students</td>
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
                  Bills will be generated for all active students for the selected period. Academic bills apply scholarship discounts automatically. Already-billed students are skipped.
                </p>
              </div>
            </div>
          </div>

          {/* Generate action bar — toggleable fee type selectors + single Generate button */}
          <div style={{ borderTop: "1px solid #e2e8f0", padding: "13px 22px", background: "#f8fafc", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              <i className="fa-solid fa-circle-info" style={{ color: "#94a3b8" }} />
              Select fee type{selectedFeeTypes.size !== 1 ? "s" : ""} to generate:
            </span>
            {FEE_TYPES.map(ft => {
              const active = selectedFeeTypes.has(ft.value);
              return (
                <button key={ft.value}
                  onClick={() => {
                    setSelectedFeeTypes(prev => {
                      const next = new Set(prev);
                      if (next.has(ft.value)) { if (next.size > 1) next.delete(ft.value); }
                      else next.add(ft.value);
                      return next;
                    });
                  }}
                  disabled={generating || voiding || !academicYearId}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "8px 18px", borderRadius: 9, fontFamily: "inherit",
                    fontSize: 13, fontWeight: 800, cursor: "pointer",
                    border: `2px solid ${active ? ft.color : "#d1d9e0"}`,
                    background: active ? ft.bg : "#fff",
                    color: active ? ft.color : "#94a3b8",
                    boxShadow: active ? `0 2px 8px ${ft.color}33` : "none",
                    transition: "all 0.15s", whiteSpace: "nowrap",
                    opacity: !academicYearId ? 0.5 : 1,
                  }}
                >
                  <i className={`fa-solid ${ft.icon}`} style={{ fontSize: 12 }} />
                  {ft.label}
                  {active && <i className="fa-solid fa-check" style={{ fontSize: 10, marginLeft: 2 }} />}
                </button>
              );
            })}
            <button
              onClick={handleGenerateAll}
              disabled={generating || voiding || !academicYearId || selectedFeeTypes.size === 0}
              style={{
                marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8,
                padding: "9px 22px", borderRadius: 9, fontFamily: "inherit",
                fontSize: 13.5, fontWeight: 900, cursor: "pointer",
                border: "2px solid #2563eb", background: "#2563eb", color: "#fff",
                boxShadow: "0 3px 12px #2563eb44",
                opacity: !academicYearId || selectedFeeTypes.size === 0 ? 0.5 : 1,
                transition: "all 0.15s", whiteSpace: "nowrap",
              }}
            >
              {generating
                ? <><Spinner size={14} color="#fff" /> Generating…</>
                : <><i className="fa-solid fa-bolt" /> Generate Bills</>}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            VIEW TABLE — billed students with Total Billed / Paid / Pending
        ════════════════════════════════════════════════════════════════ */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>

          {/* Toolbar */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "#fafbfc" }}>
            {/* Unbilled / Billed mode toggle */}
            <div style={{ display: "flex", gap: 3, background: "#f1f5f9", borderRadius: 9, padding: 3 }}>
              {([
                { key: "unbilled", label: "To Generate", icon: "fa-circle-exclamation", color: "#b45309", activeColor: "#fef9c3", activeBorder: "#fde68a" },
                { key: "billed",   label: "Generated",   icon: "fa-circle-check",       color: "#15803d", activeColor: "#f0fdf4", activeBorder: "#bbf7d0" },
              ] as const).map(m => {
                const active = viewMode === m.key;
                return (
                  <button key={m.key} onClick={() => { setViewMode(m.key); setSearch(""); setPage(1); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 14px", borderRadius: 7, fontFamily: "inherit",
                      fontSize: 12.5, fontWeight: 800, cursor: "pointer",
                      border: active ? `1.5px solid ${m.activeBorder}` : "1.5px solid transparent",
                      background: active ? m.activeColor : "transparent",
                      color: active ? m.color : "#64748b",
                      boxShadow: active ? "0 1px 4px rgba(0,0,0,.08)" : "none",
                      transition: "all 0.13s",
                    }}
                  >
                    <i className={`fa-solid ${m.icon}`} style={{ fontSize: 11 }} />{m.label}
                  </button>
                );
              })}
            </div>

            {/* Fee type pills — view-only switcher */}
            <div style={{ display: "flex", gap: 3, background: "#f1f5f9", borderRadius: 9, padding: 3 }}>
              {FEE_TYPES.map(ft => {
                const active = activeFeeType === ft.value;
                return (
                  <button key={ft.value} onClick={() => switchFeeType(ft.value)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 13px", borderRadius: 7, border: "none", cursor: "pointer",
                      fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                      background: active ? "#fff" : "transparent",
                      color: active ? ft.color : "#64748b",
                      boxShadow: active ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                      transition: "all 0.13s",
                    }}
                  >
                    <i className={`fa-solid ${ft.icon}`} style={{ fontSize: 10 }} />{ft.label}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <label style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 8, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "0 12px", background: "#fff", cursor: "text" }}>
              <i className="fa-solid fa-magnifying-glass" style={{ color: "#94a3b8", fontSize: 13 }} />
              <input type="search" placeholder="Search student, admission no, class…" value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ border: "none", background: "transparent", padding: "9px 0", width: "100%", fontFamily: "inherit", fontSize: 13.5, outline: "none", color: "#1e293b" }}
              />
            </label>

            {(isRefreshing || unbilledLoading) && (
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <i className="fa-solid fa-arrows-rotate fa-spin" style={{ fontSize: 11 }} /> Loading…
              </span>
            )}
          </div>

          {/* Table heading */}
          <div style={{ padding: "13px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <strong style={{ fontSize: 14, fontWeight: 900, color: "#1e293b" }}>
                <i className={`fa-solid ${activeMeta.icon}`} style={{ marginRight: 7, color: activeMeta.color }} />
                {activeMeta.label} Fees — {rangeLabel}
              </strong>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
                {(isInitialLoad || unbilledLoading) ? "Loading…"
                  : viewMode === "unbilled"
                    ? filtered.length > 0
                        ? `${filtered.length} student${filtered.length !== 1 ? "s" : ""} without ${activeMeta.label.toLowerCase()} bills for this period`
                        : `All students billed — nothing to generate`
                    : filtered.length > 0
                        ? `${filtered.length} student${filtered.length !== 1 ? "s" : ""} with bills for this period`
                        : allBills.length === 0
                            ? `No bills generated yet — click Generate Bills above`
                            : `No ${activeMeta.label.toLowerCase()} bills found for this period`}
              </p>
            </div>
            {filtered.length > PAGE_SIZE && (
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Page {currentPage} / {totalPages}</span>
            )}
          </div>

          {/* Table body */}
          {(isInitialLoad || unbilledLoading) ? (
            <div style={{ padding: 56, textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "44px 24px", textAlign: "center", color: "#94a3b8" }}>
              <i className={`fa-solid ${viewMode === "unbilled" ? "fa-circle-check" : "fa-inbox"}`} style={{ fontSize: 30, display: "block", marginBottom: 10, opacity: 0.25, color: viewMode === "unbilled" ? "#16a34a" : undefined }} />
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: viewMode === "unbilled" ? "#15803d" : undefined }}>
                {viewMode === "unbilled"
                  ? `All students already have ${activeMeta.label.toLowerCase()} bills for ${rangeLabel}.`
                  : allBills.length === 0
                      ? `No bills generated for ${rangeLabel} yet.`
                      : `No ${activeMeta.label.toLowerCase()} bills in this period.`}
              </p>
              <p style={{ fontSize: 12.5, marginTop: 5 }}>
                {viewMode === "unbilled"
                  ? "Nothing to generate — switch to Generated tab to review existing bills."
                  : allBills.length === 0
                      ? "Use Generate Bills above to create bills."
                      : "Switch fee type or adjust the date range."}
              </p>
            </div>
          ) : viewMode === "unbilled" ? (
            /* ══════ UNBILLED VIEW — simple list, no expand ══════ */
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#fef9c3" }}>
                    {["#", "Student", "Class / Section", "Fee History"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, fontWeight: 900, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1.5px solid #fde68a", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map((st: any, idx: number) => (
                    <tr key={st.student_id} className="mb-tr"
                      style={{ borderBottom: "1px solid #f1f5f9", borderLeft: "3px solid #f59e0b", background: "#fff" }}
                    >
                      <td style={{ padding: "11px 16px", color: "#94a3b8", fontWeight: 700, width: 40 }}>
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <strong style={{ display: "block", color: "#1e293b" }}>{st.full_name}</strong>
                        <small style={{ color: "#94a3b8", fontWeight: 600 }}>{st.admission_number}</small>
                      </td>
                      <td style={{ padding: "11px 16px", color: "#475569" }}>
                        {[st.class_name, st.section_name].filter(Boolean).join(" / ") || "—"}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <Link href={`/fees/history?student_id=${st.student_id}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#2563eb", fontWeight: 800, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
                          <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: 10 }} /> History
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#fffbeb", borderTop: "1.5px solid #fde68a" }}>
                    <td colSpan={4} style={{ padding: "11px 16px" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#b45309" }}>
                        <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />
                        {filtered.length} student{filtered.length !== 1 ? "s" : ""} have no {activeMeta.label.toLowerCase()} bill for {rangeLabel}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            /* ══════ BILLED VIEW — full expandable table ══════ */
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[" ", "Student", "Class / Section", "Billed Months", "Total Billed", "Paid", "Pending", "Status", "Fee History"].map(h => (
                      <th key={h} style={{ padding: "11px 16px", textAlign: h === "Total Billed" || h === "Paid" || h === "Pending" ? "right" : "left", fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, borderBottom: "1.5px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.map(st => {
                    const expanded  = expandedStudent === st.student_id;
                    const leftColor = st.overallStatus === "paid" ? "#22c55e" : st.overallStatus === "partial" ? "#f59e0b" : "#ef4444";
                    const rowBg     = st.overallStatus === "paid" ? "#f0fdf4" : st.overallStatus === "partial" ? "#fffbeb" : "#fff";
                    return [
                      <tr key={`s-${st.student_id}`} className="mb-tr"
                        style={{ borderBottom: "1px solid #f1f5f9", borderLeft: `3px solid ${leftColor}`, background: rowBg, cursor: "pointer" }}
                        onClick={() => setExpandedStudent(expanded ? null : st.student_id)}
                      >
                        <td style={{ padding: "12px 8px 12px 12px", width: 28 }}>
                          <i className={`fa-solid fa-chevron-${expanded ? "down" : "right"}`} style={{ fontSize: 10, color: "#94a3b8" }} />
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ display: "block", color: "#1e293b" }}>{st.full_name}</strong>
                          <small style={{ color: "#94a3b8", fontWeight: 600 }}>{st.admission_number}</small>
                        </td>
                        <td style={{ padding: "12px 16px", color: "#475569" }}>
                          {[st.class_name, st.section_name].filter(Boolean).join(" / ") || "—"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          {(() => {
                            const periodLabels = st.bills.map((b: any) => {
                              if (b.billing_from_month && b.billing_to_month) {
                                const from = toShortLabel(b.billing_from_month, isBS, bsOpts);
                                const to   = toShortLabel(b.billing_to_month, isBS, bsOpts);
                                return from === to ? from : `${from} – ${to}`;
                              }
                              if (b.due_date) return toShortLabel(String(b.due_date).slice(0, 7), isBS, bsOpts);
                              return rangeLabel;
                            });
                            const uniquePeriods = [...new Set(periodLabels)];
                            const text = uniquePeriods.join(", ") || rangeLabel;
                            return (
                              <span style={{ fontSize: 11.5, fontWeight: 800, color: "#1e40af", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "3px 9px", display: "inline-flex", alignItems: "center", gap: 5, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={text}>
                                <i className="fa-regular fa-calendar-check" style={{ color: "#3b82f6", fontSize: 10 }} />
                                {text}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e293b", textAlign: "right" }}>{fmt(st.total_amount)}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#15803d", textAlign: "right" }}>{fmt(st.paid_amount)}</td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <strong style={{ color: st.remaining_amount > 0 ? "#b91c1c" : "#15803d" }}>{fmt(st.remaining_amount)}</strong>
                        </td>
                        <td style={{ padding: "12px 16px" }}><StatusPill status={st.overallStatus} /></td>
                        <td style={{ padding: "12px 16px" }}>
                          <Link href={`/fees/history?student_id=${st.student_id}`}
                            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#2563eb", fontWeight: 800, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
                            <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: 10 }} /> History
                          </Link>
                        </td>
                      </tr>,
                      ...(expanded ? st.bills.map((bill: any, bi: number) => (
                        <tr key={`b-${bill.id ?? bi}`} className="mb-sub-tr"
                          style={{ background: "#f8fcff", borderLeft: "3px solid #FF9B51", borderBottom: "1px solid #f1f5f9" }}
                        >
                          <td />
                          <td colSpan={2} style={{ padding: "9px 16px", fontSize: 12.5 }}>
                            <strong style={{ color: "#334155" }}>{bill.fee_name}</strong>
                            {bill.billing_from_month && bill.billing_to_month ? (
                              <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 5, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                                {toShortLabel(bill.billing_from_month, isBS, bsOpts)} – {toShortLabel(bill.billing_to_month, isBS, bsOpts)}
                              </span>
                            ) : bill.due_date ? (
                              <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 5, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>
                                {toShortLabel(String(bill.due_date).slice(0, 7), isBS, bsOpts)}
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: "9px 16px", fontSize: 12, color: "#64748b" }}>
                            {bill.due_date ? `Due: ${formatDate(String(bill.due_date).slice(0, 10))}` : "No due date"}
                          </td>
                          <td style={{ padding: "9px 16px", fontSize: 12, fontWeight: 700, textAlign: "right" }}>{fmt(bill.net_amount || bill.total_amount || 0)}</td>
                          <td style={{ padding: "9px 16px", fontSize: 12, color: "#15803d", fontWeight: 700, textAlign: "right" }}>{fmt(bill.paid_amount || 0)}</td>
                          <td style={{ padding: "9px 16px", fontSize: 12, textAlign: "right" }}>
                            <strong style={{ color: Number(bill.remaining_amount) > 0 ? "#b91c1c" : "#15803d" }}>{fmt(bill.remaining_amount || 0)}</strong>
                          </td>
                          <td style={{ padding: "9px 16px" }}>
                            <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: bill.status === "paid" ? "#dcfce7" : bill.status === "partial" ? "#fef9c3" : "#fee2e2", color: bill.status === "paid" ? "#15803d" : bill.status === "partial" ? "#92400e" : "#b91c1c", textTransform: "capitalize" }}>
                              {bill.status}
                            </span>
                          </td>
                          <td />
                        </tr>
                      )) : []),
                    ];
                  })}
                </tbody>
                {filtered.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
                      <td />
                      <td colSpan={2} style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}><span style={{ fontWeight: 900, color: "#1e293b", fontSize: 13 }}>{filtered.length}</span> Students</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}><span style={{ fontWeight: 900, fontSize: 13 }}>{footerPaidCount}</span> Fully Paid</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}><span style={{ fontWeight: 900, fontSize: 13 }}>{footerPartialCount}</span> Partial</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}><span style={{ fontWeight: 900, fontSize: 13 }}>{footerUnpaidCount}</span> Not Paid</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }} />
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: "#1e293b", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(footerTotalBilled)}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: "#15803d", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(footerTotalPaid)}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 900, color: footerTotalPending > 0 ? "#b91c1c" : "#15803d", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" }}>{fmt(footerTotalPending)}</td>
                      <td /><td />
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

      {/* ── Void (Undo) Confirmation Modal ── */}
      {showVoidConfirm && voidTargetMonth && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            {/* Modal header */}
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #fee2e2", background: "#fff5f5", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: "#fee2e2", color: "#be123c", display: "grid", placeItems: "center", fontSize: 18 }}>
                <i className="fa-solid fa-triangle-exclamation" />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 15, fontWeight: 900, color: "#1e293b", display: "block" }}>
                  Undo Billing — {toShortLabel(voidTargetMonth, isBS, bsOpts)}
                </strong>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  {activeMeta.label} · {toShortLabel(voidTargetMonth, isBS, bsOpts)}
                </p>
              </div>
              <button onClick={() => { setShowVoidConfirm(false); setVoidTargetMonth(""); }}
                style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "grid", placeItems: "center", fontSize: 14, color: "#64748b", flexShrink: 0 }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "18px 22px" }}>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fef9c3", border: "1px solid #fde68a", marginBottom: 14 }}>
                <strong style={{ fontSize: 12.5, fontWeight: 900, color: "#92400e", display: "block", marginBottom: 4 }}>
                  <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }} />What gets removed:
                </strong>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#78350f", lineHeight: 1.8 }}>
                  <li>Only <strong>unpaid</strong> {activeMeta.label.toLowerCase()} bills for {toShortLabel(voidTargetMonth, isBS, bsOpts)}</li>
                  <li>Bills with any payment received are <strong>never touched</strong></li>
                  <li>Partial and fully-paid bills stay intact</li>
                </ul>
              </div>
              <p style={{ fontSize: 12.5, color: "#64748b", margin: 0, lineHeight: 1.6 }}>
                This is useful when bills were generated by mistake. You can re-generate the correct bills after undoing.
              </p>
            </div>

            {/* Modal actions */}
            <div style={{ padding: "14px 22px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => { setShowVoidConfirm(false); setVoidTargetMonth(""); }}
                style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleVoid} disabled={voiding}
                style={{ padding: "9px 20px", borderRadius: 9, border: "2px solid #be123c", background: "#be123c", color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: voiding ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, opacity: voiding ? 0.7 : 1 }}>
                {voiding
                  ? <><i className="fa-solid fa-spinner fa-spin" /> Removing…</>
                  : <><i className="fa-solid fa-rotate-left" /> Yes, Undo Bills</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIVE BACKGROUND QUEUE PROGRESS MODAL ── */}
      {showProgressModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)",
          display: "grid", placeItems: "center", padding: 16,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, width: "100%", maxWidth: 460,
            padding: "28px 24px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", gap: 16, textAlign: "center",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: queueProgress === 100 ? "#f0fdf4" : "#eff6ff",
              color: queueProgress === 100 ? "#16a34a" : "#2563eb",
              display: "grid", placeItems: "center", fontSize: 24, margin: "0 auto",
            }}>
              {queueProgress === 100
                ? <i className="fa-solid fa-check" />
                : <i className="fa-solid fa-bolt fa-bounce" />}
            </div>

            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#1e293b" }}>
                {queueProgress === 100 ? "Bills Generated Successfully!" : `Generating ${TYPE_META[jobFeeType].label} Bills...`}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                {selectedClassId
                  ? `Target: ${classesList.find(c => String(c.id) === String(selectedClassId))?.name || "Class"} ${selectedSectionId ? `· ${sectionsList.find(s => String(s.id) === String(selectedSectionId))?.name || "Section"}` : "(All Sections)"}`
                  : "Target: All Classes (Whole School)"}
                <br />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Period: {rangeLabel}</span>
              </p>
            </div>

            {/* Progress Bar */}
            <div style={{ width: "100%", background: "#e2e8f0", borderRadius: 10, height: 12, overflow: "hidden", position: "relative" }}>
              <div style={{
                height: "100%",
                width: `${queueProgress}%`,
                background: queueProgress === 100 ? "#16a34a" : "linear-gradient(90deg, #2563eb, #3b82f6)",
                borderRadius: 10,
                transition: "width 0.4s ease",
              }} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 800, color: "#475569" }}>
              <span>Status: <span style={{ color: "#2563eb", textTransform: "capitalize" }}>{queueStatus}</span></span>
              <span>{queueProgress}%</span>
            </div>

            <div style={{
              background: "#f8fafc", borderRadius: 10, padding: "10px 14px",
              fontSize: 11.5, color: "#64748b", fontWeight: 600, display: "flex", alignItems: "center", gap: 8, textAlign: "left"
            }}>
              <i className="fa-solid fa-shield-halved" style={{ color: "#10b981", fontSize: 14, flexShrink: 0 }} />
              <span>Offline Safe: This job runs in the server's background. You can safely close this modal or navigate away.</span>
            </div>

            <button
              onClick={() => setShowProgressModal(false)}
              style={{
                marginTop: 4, padding: "10px 18px", borderRadius: 10,
                background: "#f1f5f9", border: "1px solid #cbd5e1",
                color: "#334155", fontWeight: 800, fontSize: 13, cursor: "pointer",
              }}
            >
              {queueProgress === 100 ? "Done" : "Run in Background & Close"}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
