"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import DateInput from "@/components/shared/DateInput";
import { Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";

// ── Color & Style Tokens ────────────────────────────────────────────────────────
const col = {
  navy:       "#0f172a",
  slate:      "#334155",
  muted:      "#64748b",
  lightMuted: "#94a3b8",
  bg:         "#f8fafc",
  card:       "#ffffff",
  border:     "#e2e8f0",
  borderDark: "#cbd5e1",
  
  // Brand Orange Accent
  orange:     "#ea580c",
  orangeBg:   "#fff7ed",
  orangeBrd:  "#fed7aa",
  
  // Clean Functional Accents
  green:      "#16a34a",
  greenBg:    "#f0fdf4",
  greenBrd:   "#bbf7d0",
  
  blue:       "#2563eb",
  blueBg:     "#eff6ff",
  blueBrd:    "#bfdbfe",
  
  purple:     "#7c3aed",
  purpleBg:   "#f5f3ff",
  purpleBrd:  "#ddd6fe",
  
  amber:      "#d97706",
  amberBg:    "#fffbeb",
  amberBrd:   "#fde68a",
  
  red:        "#dc2626",
  redBg:      "#fef2f2",
  redBrd:     "#fecaca",
};

// ── Category Meta ─────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  academic:  { label: "Academic",  icon: "fa-graduation-cap", color: col.blue,   bg: col.blueBg,   border: col.blueBrd },
  transport: { label: "Transport", icon: "fa-bus-simple",     color: col.amber,  bg: col.amberBg,  border: col.amberBrd },
  hostel:    { label: "Hostel",    icon: "fa-building",       color: col.purple, bg: col.purpleBg, border: col.purpleBrd },
  misc:      { label: "One-Time",  icon: "fa-receipt",        color: col.slate,  bg: "#f1f5f9",    border: col.border },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.academic;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      display: "inline-flex", alignItems: "center", gap: 4, textTransform: "capitalize",
    }}>
      <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 9.5 }} />
      {cfg.label}
    </span>
  );
}

function getInitials(name: string) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map(p => p[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

type GroupedBill = {
  ids: number[];
  fee_name: string;
  fee_type: string;
  fee_structure_id: number | null;
  bills: any[];
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  earliest_due: string;
  latest_due: string;
  status: string;
  created_at: string;
  allLocked: boolean;
  anyLocked: boolean;
  lockedMsg: string | null;
};

function groupBills(bills: any[], lockedIds: Set<number>, lockedByStructure: Map<number, string>): GroupedBill[] {
  const map = new Map<string, GroupedBill>();
  for (const b of bills) {
    const genDate = b.created_at ? String(b.created_at).slice(0, 10) : "";
    const key = b.fee_structure_id
      ? `struct-${b.fee_structure_id}-${genDate}`
      : `name-${b.fee_name}-${b.fee_type}-${genDate}`;
    const cleanFeeName = (b.fee_name || "").replace(/\s*-\s*\d{4}-\d{2}$/, "");
    if (!map.has(key)) {
      map.set(key, {
        ids: [],
        fee_name: cleanFeeName,
        fee_type: b.fee_type || "academic",
        fee_structure_id: b.fee_structure_id || null,
        bills: [],
        total_amount: 0,
        paid_amount: 0,
        remaining_amount: 0,
        earliest_due: b.due_date,
        latest_due: b.due_date,
        status: b.status,
        created_at: b.created_at,
        allLocked: true,
        anyLocked: false,
        lockedMsg: null,
      });
    }
    const g = map.get(key)!;
    g.ids.push(b.id);
    g.bills.push(b);
    g.total_amount     += Number(b.net_amount || b.total_amount || 0);
    g.paid_amount      += Number(b.paid_amount || 0);
    g.remaining_amount += Number(b.remaining_amount || 0);
    if (b.due_date && b.due_date < g.earliest_due) g.earliest_due = b.due_date;
    if (b.due_date && b.due_date > g.latest_due)   g.latest_due   = b.due_date;

    const isLocked = lockedIds.has(b.id);
    if (!isLocked) g.allLocked = false;
    if (isLocked) {
      g.anyLocked = true;
      if (!g.lockedMsg && b.fee_structure_id) {
        g.lockedMsg = lockedByStructure.get(b.fee_structure_id) || "an earlier bill";
      }
    }

    if (b.status === "unpaid" || g.status === "unpaid") g.status = "unpaid";
    else if (b.status === "partial" || g.status === "partial") g.status = "partial";
  }
  return Array.from(map.values());
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", height: 38, padding: "0 12px",
  border: `1px solid ${col.border}`, borderRadius: 8,
  fontSize: 13, fontWeight: 600, outline: "none",
  background: "#fff", color: col.navy, boxSizing: "border-box",
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function CollectFeePage() {
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("student_id") || searchParams.get("studentId");
  const initialCollectionId = searchParams.get("collection_id") || searchParams.get("collectionId");
  const { academicYearId } = useAcademicYear();
  const { formatDate, formatFeeName, isBS } = useDateFormat();

  const currencySymbol = isBS ? "रू" : "₹";
  const fmt = useCallback((n: number | string) => `${currencySymbol} ${Number(n || 0).toLocaleString()}`, [currencySymbol]);

  // Search state
  const [query, setSearchQuery]               = useState("");
  const [searchResults, setSearchResults]     = useState<any[]>([]);
  const [searching, setSearching]             = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload from URL param
  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    apiRequest<any>(`/students/${initialId}`)
      .then(res => {
        if (cancelled) return;
        const st = res?.data || res;
        if (st && st.id) {
          const activeEnrollment = st.enrollments?.find((e: any) => e.status === "active") || st.enrollments?.[0];
          setSelectedStudent({
            ...st,
            class_name: st.class_name || activeEnrollment?.class_name || "",
            section_name: st.section_name || activeEnrollment?.section_name || "",
            enrollment_id: st.enrollment_id || activeEnrollment?.id || null,
          });
          setSearchQuery(st.full_name || "");
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initialId]);

  // Autocomplete search
  useEffect(() => {
    if (selectedStudent) return;
    if (query.trim().length < 2) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiRequest<{ data: any[] }>(`/students/search?q=${encodeURIComponent(query.trim())}`);
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
  }, [query, selectedStudent]);

  const selectStudent = (st: any) => {
    setSelectedStudent(st);
    setSearchQuery(st.full_name || "");
    setSearchResults([]);
    setSelectedIds(new Set());
    setBulkAmounts({});
    setLastReceipts([]);
  };

  const clearStudent = () => {
    setSelectedStudent(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedIds(new Set());
    setBulkAmounts({});
    setLastReceipts([]);
  };

  // Student Facilities (Hostel & Transport)
  const [hostelInfo, setHostelInfo]       = useState<any | null>(null);
  const [transportInfo, setTransportInfo] = useState<any | null>(null);

  useEffect(() => {
    if (!selectedStudent?.id) {
      setHostelInfo(null);
      setTransportInfo(null);
      return;
    }
    apiRequest<{ data: any }>(`/hostel/students/${selectedStudent.id}`)
      .then(res => setHostelInfo(res.data || null))
      .catch(() => setHostelInfo(null));

    apiRequest<{ data: any }>(`/transport/students/${selectedStudent.id}`)
      .then(res => setTransportInfo(res.data || null))
      .catch(() => setTransportInfo(null));
  }, [selectedStudent]);

  // Fee Collections for Student
  const { data: rawCollections, refetch: refetchCollections, loading: loadingFees } = useApi<any[]>(
    selectedStudent?.id ? `/fees/collections/student/${selectedStudent.id}` : ""
  );
  const allCollections = useMemo(() => rawCollections || [], [rawCollections]);

  // Sequential Locking Logic
  const { lockedIds, lockedByStructure } = useMemo(() => {
    const locked = new Set<number>();
    const byStruct = new Map<number, string>();
    const recurring = allCollections.filter(
      (c: any) => c.fee_structure_id && c.status !== "paid" && c.status !== "waived"
    );

    const groups = new Map<number, any[]>();
    for (const c of recurring) {
      if (!groups.has(c.fee_structure_id)) groups.set(c.fee_structure_id, []);
      groups.get(c.fee_structure_id)!.push(c);
    }

    for (const [structId, list] of groups) {
      list.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));
      const oldestUnpaid = list[0];
      for (let i = 1; i < list.length; i++) {
        locked.add(list[i].id);
        byStruct.set(structId, oldestUnpaid.fee_name || "Fee");
      }
    }
    return { lockedIds: locked, lockedByStructure: byStruct };
  }, [allCollections]);

  // Filter and Category state
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const pendingCollections = useMemo(
    () => allCollections.filter((c: any) => c.status !== "paid" && c.status !== "waived"),
    [allCollections]
  );
  const paidCollections = useMemo(
    () => allCollections.filter((c: any) => c.status === "paid" || c.status === "waived"),
    [allCollections]
  );

  const filteredPending = useMemo(() => {
    if (typeFilter === "all") return pendingCollections;
    return pendingCollections.filter((c: any) => (c.fee_type || "academic") === typeFilter);
  }, [pendingCollections, typeFilter]);

  const groupedPending = useMemo(
    () => groupBills(filteredPending, lockedIds, lockedByStructure),
    [filteredPending, lockedIds, lockedByStructure]
  );

  // Financial Stats
  const totalDue = useMemo(
    () => pendingCollections.reduce((s: number, c: any) => s + Number(c.remaining_amount || 0), 0),
    [pendingCollections]
  );
  const totalPaid = useMemo(
    () => allCollections.reduce((s: number, c: any) => s + Number(c.paid_amount || 0), 0),
    [allCollections]
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdueFn = (dueDate: string, status: string) =>
    dueDate && dueDate < todayStr && status !== "paid" && status !== "waived";

  // Selection & Bulk Payment State
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [bulkAmounts, setBulkAmounts]   = useState<Record<number, string>>({});
  const [paymentMode, setPaymentMode]   = useState("cash");
  const [paymentDate, setPaymentDate]   = useState(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo]   = useState("");
  const [remarks, setRemarks]           = useState("");
  const [isPaying, setIsPaying]         = useState(false);
  const [lastReceipts, setLastReceipts] = useState<Array<{ payment_id: number; receipt_number: string }>>([]);
  const needsRef = paymentMode !== "cash";

  // Auto-select specific bill when collection_id is provided in URL
  useEffect(() => {
    if (!initialCollectionId || pendingCollections.length === 0) return;
    const targetId = Number(initialCollectionId);
    const target = pendingCollections.find((c: any) => c.id === targetId);
    if (target && !lockedIds.has(target.id)) {
      setSelectedIds(new Set([target.id]));
      setBulkAmounts({ [target.id]: String(target.remaining_amount || "0") });
    }
  }, [initialCollectionId, pendingCollections, lockedIds]);

  const selectedCollections = useMemo(
    () => pendingCollections.filter((c: any) => selectedIds.has(c.id)),
    [pendingCollections, selectedIds]
  );

  const bulkTotal = useMemo(() => {
    return selectedCollections.reduce((s: number, c: any) => {
      const v = parseFloat(bulkAmounts[c.id] ?? c.remaining_amount ?? "0");
      return s + (isNaN(v) ? 0 : v);
    }, 0);
  }, [selectedCollections, bulkAmounts]);

  const toggleSelect = (ids: number[], remainingAmounts: any[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allIn = ids.every(id => next.has(id));
      ids.forEach((id, idx) => {
        if (allIn) {
          next.delete(id);
          setBulkAmounts(a => { const copy = { ...a }; delete copy[id]; return copy; });
        } else {
          next.add(id);
          setBulkAmounts(a => ({ ...a, [id]: String(remainingAmounts[idx] || "0") }));
        }
      });
      return next;
    });
  };

  const toggleAll = () => {
    const selectable = filteredPending.filter((c: any) => !lockedIds.has(c.id));
    if (selectedIds.size >= selectable.length && selectable.length > 0) {
      setSelectedIds(new Set());
      setBulkAmounts({});
    } else {
      const next = new Set<number>();
      const nextAmts: Record<number, string> = {};
      selectable.forEach((c: any) => {
        next.add(c.id);
        nextAmts[c.id] = String(c.remaining_amount || "0");
      });
      setSelectedIds(next);
      setBulkAmounts(nextAmts);
    }
  };

  // Submit Payment
  const handleBulkPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    if (selectedIds.size === 0) {
      dispatch(showToast({ type: "error", title: "Nothing Selected", message: "Select at least one fee bill to collect." }));
      return;
    }
    if (needsRef && !referenceNo.trim()) {
      dispatch(showToast({ type: "error", title: "Reference Required", message: "Enter transaction ID or cheque reference." }));
      return;
    }

    setIsPaying(true);
    const receipts: Array<{ payment_id: number; receipt_number: string }> = [];
    let ok = 0;

    for (const colItem of selectedCollections) {
      const amount = parseFloat(bulkAmounts[colItem.id] || colItem.remaining_amount || "0");
      if (amount <= 0) continue;
      try {
        const res: any = await apiRequest("/fees/payments", {
          method: "POST",
          body: JSON.stringify({
            collection_id:  colItem.id,
            student_id:     selectedStudent.id,
            paid_amount:    amount,
            payment_date:   paymentDate,
            payment_method: paymentMode,
            transaction_id: referenceNo || undefined,
            remarks:        remarks     || undefined,
          }),
        });
        if (res?.payment?.id) receipts.push({ payment_id: res.payment.id, receipt_number: res.receipt_number || res.payment?.receipt_number });
        else if (res?.id)    receipts.push({ payment_id: res.id, receipt_number: res.receipt_number });
        ok++;
      } catch (err: any) {
        dispatch(showToast({ type: "error", title: `Failed: ${colItem.fee_name}`, message: err.message || "Payment error" }));
      }
    }

    if (ok > 0) {
      setLastReceipts(receipts);
      dispatch(showToast({ type: "success", title: `${ok} Payment${ok > 1 ? "s" : ""} Recorded`, message: "Fees cleared successfully." }));
      refetchCollections();
      setSelectedIds(new Set());
      setBulkAmounts({});
      setReferenceNo("");
      setRemarks("");
    }
    setIsPaying(false);
  };

  // Instant Add Misc / One-time Fee
  const [showMisc,     setShowMisc]     = useState(false);
  const [miscFeeName,  setMiscFeeName]  = useState("");
  const [miscAmount,   setMiscAmount]   = useState("");
  const [miscDueDate,  setMiscDueDate]  = useState(new Date().toISOString().split("T")[0]);
  const [miscType,     setMiscType]     = useState("academic");
  const [addingMisc,   setAddingMisc]   = useState(false);

  const handleAddMiscFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !academicYearId) return;
    if (!miscFeeName.trim()) {
      dispatch(showToast({ type: "error", title: "Error", message: "Fee name required" }));
      return;
    }
    if (!miscAmount || Number(miscAmount) <= 0) {
      dispatch(showToast({ type: "error", title: "Error", message: "Valid amount required" }));
      return;
    }
    setAddingMisc(true);
    try {
      await apiRequest("/fees/collections/misc", {
        method: "POST",
        body: JSON.stringify({
          student_id: selectedStudent.id,
          academic_year_id: academicYearId,
          fee_name: miscFeeName.trim(),
          fee_type: miscType,
          due_date: miscDueDate,
          total_amount: Number(miscAmount),
        }),
      });
      dispatch(showToast({ type: "success", title: "Fee Added", message: `"${miscFeeName}" added to student ledger.` }));
      refetchCollections();
      setMiscFeeName("");
      setMiscAmount("");
      setShowMisc(false);
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message || "Could not add fee." }));
    } finally {
      setAddingMisc(false);
    }
  };

  // Quick Instant Bill Hostel / Transport
  const handleQuickBill = async (type: "hostel" | "transport") => {
    if (!selectedStudent || !academicYearId) return;
    const isHostel = type === "hostel";
    const title = isHostel
      ? `Hostel Fee (${hostelInfo?.room_number ? `Room ${hostelInfo.room_number}` : "Room"})`
      : `Transport Fee (${transportInfo?.route_name || "Bus"})`;
    const amt = isHostel ? Number(hostelInfo?.monthly_fee || 0) : Number(transportInfo?.monthly_fare || 0);

    if (amt <= 0) {
      dispatch(showToast({ type: "error", title: "Rate Missing", message: "No monthly rate set for this facility." }));
      return;
    }

    try {
      await apiRequest("/fees/collections/misc", {
        method: "POST",
        body: JSON.stringify({
          student_id: selectedStudent.id,
          academic_year_id: academicYearId,
          fee_name: title,
          fee_type: type,
          due_date: new Date().toISOString().slice(0, 10),
          total_amount: amt,
        }),
      });
      dispatch(showToast({ type: "success", title: "Bill Added", message: `${title} (${fmt(amt)}) added to pending dues.` }));
      refetchCollections();
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message }));
    }
  };

  // Waive & Fine Modals
  const [waiveTarget, setWaiveTarget] = useState<any | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [waiving,     setWaiving]     = useState(false);

  const handleWaive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiveTarget) return;
    setWaiving(true);
    try {
      await apiRequest(`/fees/collections/${waiveTarget.id}/waive`, {
        method: "POST",
        body: JSON.stringify({ reason: waiveReason || "Waived by admin" }),
      });
      dispatch(showToast({ type: "success", title: "Fee Waived", message: `"${waiveTarget.fee_name}" has been waived.` }));
      refetchCollections();
      setWaiveTarget(null);
      setWaiveReason("");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message }));
    } finally {
      setWaiving(false);
    }
  };

  const [fineTarget, setFineTarget] = useState<any | null>(null);
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [addingFine, setAddingFine] = useState(false);

  const handleAddFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fineTarget) return;
    if (!fineAmount || Number(fineAmount) <= 0) {
      dispatch(showToast({ type: "error", title: "Error", message: "Valid fine amount required." }));
      return;
    }
    setAddingFine(true);
    try {
      await apiRequest(`/fees/collections/${fineTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ fine_amount: Number(fineAmount), fine_reason: fineReason || "Late payment fine" }),
      });
      dispatch(showToast({ type: "success", title: "Fine Applied", message: `${fmt(fineAmount)} added to ${fineTarget.fee_name}.` }));
      refetchCollections();
      setFineTarget(null);
      setFineAmount("");
      setFineReason("");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Failed", message: err.message }));
    } finally {
      setAddingFine(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: col.bg, display: "flex", flexDirection: "column" }}>
      <main style={{ padding: "20px 24px 48px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1400, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

        {/* ── Top Header Toolbar ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap", borderBottom: `1px solid ${col.border}`, paddingBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: col.orangeBg,
              border: `1px solid ${col.orangeBrd}`, color: col.orange,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>
              <i className="fa-solid fa-cash-register" />
            </div>
            <div>
              <h1 style={{ fontSize: 19, fontWeight: 800, color: col.navy, margin: 0, letterSpacing: "-0.01em" }}>
                Fee Collection Counter
              </h1>
              <p style={{ fontSize: 12, color: col.muted, fontWeight: 500, margin: "2px 0 0" }}>
                POS Cashier Desk • Search student, select active dues, and generate receipts
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {selectedStudent && (
              <Link
                href={`/fees/history?student_id=${selectedStudent.id}`}
                style={{
                  height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${col.border}`,
                  background: "#fff", color: col.navy, fontWeight: 600, fontSize: 12,
                  display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
                }}
              >
                <i className="fa-solid fa-clock-rotate-left" style={{ color: col.blue, fontSize: 11 }} /> Payment History
              </Link>
            )}
            <Link
              href="/fees/monthly-billing"
              style={{
                height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${col.border}`,
                background: "#fff", color: col.navy, fontWeight: 600, fontSize: 12,
                display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-file-invoice-dollar" style={{ color: col.purple, fontSize: 11 }} /> Monthly Billing
            </Link>
            <Link
              href="/fees/records"
              style={{
                height: 34, padding: "0 12px", borderRadius: 8, border: `1px solid ${col.border}`,
                background: "#fff", color: col.navy, fontWeight: 600, fontSize: 12,
                display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
              }}
            >
              <i className="fa-solid fa-table-list" style={{ color: col.slate, fontSize: 11 }} /> All Records
            </Link>
          </div>
        </div>

        {/* ── Payment Success & Print Banner ── */}
        {lastReceipts.length > 0 && (
          <div style={{
            background: col.greenBg, border: `1px solid ${col.greenBrd}`, borderRadius: 10,
            padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, flexWrap: "wrap",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: col.green }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: 20 }} />
              <div>
                <strong style={{ fontSize: 13.5, color: "#166534", display: "block" }}>
                  {lastReceipts.length} Payment{lastReceipts.length > 1 ? "s" : ""} Recorded Successfully
                </strong>
                <span style={{ fontSize: 12, color: "#15803d" }}>
                  Receipts generated: {lastReceipts.map(r => r.receipt_number).filter(Boolean).join(", ")}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {lastReceipts.slice(0, 3).map(r => (
                <a
                  key={r.payment_id}
                  href={`/fees/receipt/${r.payment_id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "6px 12px", borderRadius: 6, background: col.green, color: "#fff",
                    fontSize: 12, fontWeight: 700, textDecoration: "none", display: "inline-flex",
                    alignItems: "center", gap: 6,
                  }}
                >
                  <i className="fa-solid fa-print" style={{ fontSize: 11 }} /> Print Receipt
                </a>
              ))}
              <button
                onClick={() => setLastReceipts([])}
                style={{ border: "none", background: "none", color: col.muted, cursor: "pointer", fontSize: 14, padding: 4 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ── ZONE 1: STUDENT SEARCH & 360° PROFILE BAR ── */}
        <div style={{
          background: "#fff", border: `1px solid ${col.border}`, borderRadius: 12,
          padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12,
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}>
          {/* Search Row */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 280 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, border: `1px solid ${col.border}`,
                borderRadius: 8, padding: "0 12px", background: "#f8fafc", height: 40,
              }}>
                <i className="fa-solid fa-magnifying-glass" style={{ color: col.lightMuted, fontSize: 13 }} />
                <input
                  type="search"
                  placeholder="Search student by name, admission no, or roll number…"
                  value={query}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    if (selectedStudent) setSelectedStudent(null);
                  }}
                  style={{ border: "none", background: "transparent", width: "100%", fontSize: 13, outline: "none", color: col.navy, fontWeight: 600 }}
                />
                {searching && <Spinner size={14} color={col.orange} />}
                {(query || selectedStudent) && (
                  <button
                    onClick={clearStudent}
                    style={{ border: "none", background: "none", color: col.lightMuted, cursor: "pointer", padding: 4, fontSize: 12 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {searchResults.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "#fff", border: `1px solid ${col.border}`, borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(15,23,42,0.12)", maxHeight: 260, overflowY: "auto", zIndex: 50,
                }}>
                  {searchResults.map((st: any) => (
                    <button
                      key={st.id}
                      onClick={() => selectStudent(st)}
                      style={{
                        width: "100%", padding: "10px 14px", display: "flex", alignItems: "center",
                        gap: 12, border: "none", borderBottom: `1px solid #f1f5f9`, background: "#fff",
                        cursor: "pointer", textAlign: "left", transition: "background 0.12s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
                    >
                      <span style={{
                        width: 32, height: 32, borderRadius: 6, background: col.blueBg, color: col.blue,
                        border: `1px solid ${col.blueBrd}`, fontSize: 11, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {getInitials(st.full_name)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 13, color: col.navy, display: "block" }}>{st.full_name}</strong>
                        <span style={{ fontSize: 11.5, color: col.muted, fontWeight: 500 }}>
                          Adm: {st.admission_number || "—"} {st.class_name ? `• Class ${st.class_name} ${st.section_name || ""}` : ""}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedStudent && (
              <button
                onClick={clearStudent}
                style={{
                  height: 40, padding: "0 14px", borderRadius: 8, border: `1px solid ${col.border}`,
                  background: "#fff", color: col.slate, fontWeight: 700, fontSize: 12, cursor: "pointer",
                }}
              >
                Change Student
              </button>
            )}
          </div>

          {/* 360° Selected Student Profile Banner */}
          {selectedStudent && (
            <div style={{
              background: "#f8fafc", border: `1px solid ${col.border}`, borderRadius: 10,
              padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 14, flexWrap: "wrap",
            }}>
              {/* Left Details */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: col.navy,
                  color: "#fff", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0,
                }}>
                  {getInitials(selectedStudent.full_name)}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15, fontWeight: 800, color: col.navy }}>
                      {selectedStudent.full_name}
                    </strong>
                    {selectedStudent.class_name && (
                      <span style={{
                        padding: "2px 7px", borderRadius: 5, background: col.blueBg,
                        color: col.blue, border: `1px solid ${col.blueBrd}`, fontSize: 11, fontWeight: 700,
                      }}>
                        Class {selectedStudent.class_name} {selectedStudent.section_name ? `- ${selectedStudent.section_name}` : ""}
                      </span>
                    )}
                    {selectedStudent.admission_number && (
                      <span style={{ fontSize: 11.5, color: col.muted, fontWeight: 600 }}>
                        Adm No: <strong>{selectedStudent.admission_number}</strong>
                      </span>
                    )}
                  </div>

                  {/* Badges strip: Scholarship, Hostel, Transport */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                    {selectedStudent.scholarship_percent && Number(selectedStudent.scholarship_percent) > 0 && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px",
                        borderRadius: 5, background: col.purpleBg, color: col.purple, border: `1px solid ${col.purpleBrd}`,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        <i className="fa-solid fa-graduation-cap" style={{ fontSize: 10 }} />
                        {selectedStudent.scholarship_percent}% {selectedStudent.scholarship_type?.replace(/_/g, " ") || "Scholarship"}
                      </span>
                    )}

                    {hostelInfo ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px",
                        borderRadius: 5, background: col.purpleBg, color: col.purple, border: `1px solid ${col.purpleBrd}`,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        <i className="fa-solid fa-building" style={{ fontSize: 10 }} />
                        Hostel: {hostelInfo.hostel_name || "Boarding"} • Room {hostelInfo.room_number} ({fmt(hostelInfo.monthly_fee)}/mo)
                      </span>
                    ) : null}

                    {transportInfo ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px",
                        borderRadius: 5, background: col.amberBg, color: col.amber, border: `1px solid ${col.amberBrd}`,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        <i className="fa-solid fa-bus-simple" style={{ fontSize: 10 }} />
                        Bus: {transportInfo.route_name || "Route"} • {transportInfo.stop_name} ({fmt(transportInfo.monthly_fare)}/mo)
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Quick Facility Add Buttons */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {hostelInfo && (
                  <button
                    onClick={() => handleQuickBill("hostel")}
                    style={{
                      height: 30, padding: "0 10px", borderRadius: 6, border: `1px solid ${col.purpleBrd}`,
                      background: col.purpleBg, color: col.purple, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <i className="fa-solid fa-plus" style={{ fontSize: 10 }} /> Add Hostel Fee ({fmt(hostelInfo.monthly_fee)})
                  </button>
                )}

                {transportInfo && (
                  <button
                    onClick={() => handleQuickBill("transport")}
                    style={{
                      height: 30, padding: "0 10px", borderRadius: 6, border: `1px solid ${col.amberBrd}`,
                      background: col.amberBg, color: col.amber, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <i className="fa-solid fa-plus" style={{ fontSize: 10 }} /> Add Bus Fee ({fmt(transportInfo.monthly_fare)})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── ZONE 2: 2-COLUMN POS CASHIER GRID (60% Left Fee Bills | 40% Right Cashier Box) ── */}
        {!selectedStudent ? (
          <div style={{
            background: "#fff", border: `1px solid ${col.border}`, borderRadius: 12,
            padding: "4rem 2rem", textAlign: "center", color: col.muted,
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 12, background: "#f1f5f9",
              color: col.lightMuted, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, margin: "0 auto 12px",
            }}>
              <i className="fa-solid fa-user-magnifying-glass" />
            </div>
            <strong style={{ fontSize: 16, color: col.navy, display: "block" }}>No Student Selected</strong>
            <p style={{ fontSize: 13, marginTop: 4, color: col.muted }}>
              Search for a student using name, admission number, or roll number above to collect fees.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(360px, 1fr)", gap: 16, alignItems: "start" }}>

            {/* ── LEFT COLUMN: FEE BILLS BREAKDOWN ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Sequential Lock Warning Banner */}
              {lockedIds.size > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  borderRadius: 8, background: col.amberBg, border: `1px solid ${col.amberBrd}`,
                  fontSize: 12, color: "#92400e", fontWeight: 600,
                }}>
                  <i className="fa-solid fa-lock" style={{ fontSize: 11 }} />
                  <span>
                    <strong>Sequential payment active:</strong> Earlier unpaid bills must be settled or waived before newer bills.
                  </span>
                </div>
              )}

              {/* Pending Bills Card */}
              <div style={{
                background: "#fff", border: `1px solid ${col.border}`, borderRadius: 12,
                overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
              }}>
                {/* Filter Toolbar */}
                <div style={{
                  padding: "10px 14px", borderBottom: `1px solid ${col.border}`,
                  display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
                }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                    {[
                      { id: "all",       label: "All Fees",   count: pendingCollections.length },
                      { id: "academic",  label: "Academic",   count: pendingCollections.filter(c => (c.fee_type || "academic") === "academic").length },
                      { id: "hostel",    label: "Hostel",     count: pendingCollections.filter(c => c.fee_type === "hostel").length },
                      { id: "transport", label: "Transport",  count: pendingCollections.filter(c => c.fee_type === "transport").length },
                    ].map(f => {
                      const active = typeFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => { setTypeFilter(f.id); setSelectedIds(new Set()); setBulkAmounts({}); }}
                          style={{
                            padding: "4px 10px", borderRadius: 6, border: `1px solid ${active ? col.navy : "transparent"}`,
                            cursor: "pointer", fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5,
                            background: active ? col.navy : "#f1f5f9",
                            color: active ? "#fff" : col.slate,
                            transition: "all 0.12s",
                          }}
                        >
                          {f.label}
                          <span style={{
                            background: active ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                            color: active ? "#fff" : col.slate,
                            fontSize: 10, fontWeight: 800, padding: "1px 5px", borderRadius: 99,
                          }}>
                            {f.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={toggleAll}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: `1px solid ${col.border}`,
                      background: "#fff", color: col.slate, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Select All
                  </button>
                </div>

                {/* Bills Table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{ width: 38, textAlign: "center", padding: "8px 6px", borderBottom: `1px solid ${col.border}` }}>
                          <input
                            type="checkbox"
                            checked={
                              filteredPending.filter((c: any) => !lockedIds.has(c.id)).length > 0 &&
                              selectedIds.size === filteredPending.filter((c: any) => !lockedIds.has(c.id)).length
                            }
                            onChange={toggleAll}
                            style={{ cursor: "pointer", accentColor: col.orange }}
                          />
                        </th>
                        <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${col.border}`, fontWeight: 700, fontSize: 11, color: col.muted, textTransform: "uppercase" }}>Fee Bill</th>
                        <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${col.border}`, fontWeight: 700, fontSize: 11, color: col.muted, textTransform: "uppercase" }}>Type</th>
                        <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: `1px solid ${col.border}`, fontWeight: 700, fontSize: 11, color: col.muted, textTransform: "uppercase" }}>Net Fee</th>
                        <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: `1px solid ${col.border}`, fontWeight: 700, fontSize: 11, color: col.muted, textTransform: "uppercase" }}>Paid</th>
                        <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: `1px solid ${col.border}`, fontWeight: 700, fontSize: 11, color: col.muted, textTransform: "uppercase" }}>Due Amount</th>
                        <th style={{ width: 85, textAlign: "right", padding: "8px 12px", borderBottom: `1px solid ${col.border}`, fontWeight: 700, fontSize: 11, color: col.muted, textTransform: "uppercase" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingFees ? (
                        <tr><td colSpan={7} style={{ textAlign: "center", padding: "2.5rem" }}><Spinner size={24} color={col.orange} /></td></tr>
                      ) : groupedPending.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "2.5rem", color: col.green, fontWeight: 700 }}>
                            <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />
                            All dues cleared in this category!
                          </td>
                        </tr>
                      ) : (
                        groupedPending.map((g: GroupedBill) => {
                          const isOverdue   = isOverdueFn(g.earliest_due, g.status);
                          const allSelected = g.ids.every(id => selectedIds.has(id));
                          const anyLocked   = g.anyLocked;

                          return (
                            <tr
                              key={g.ids.join("-")}
                              onClick={() => !anyLocked && toggleSelect(g.ids, g.bills.map(b => b.remaining_amount))}
                              style={{
                                borderBottom: `1px solid #f1f5f9`,
                                background: allSelected ? "#eff6ff" : isOverdue ? "#fffdfa" : "#fff",
                                cursor: anyLocked ? "not-allowed" : "pointer",
                                opacity: anyLocked ? 0.6 : 1,
                                transition: "background 0.1s",
                              }}
                              onMouseEnter={e => { if (!anyLocked && !allSelected) e.currentTarget.style.background = "#f8fafc"; }}
                              onMouseLeave={e => { if (!anyLocked && !allSelected) e.currentTarget.style.background = isOverdue ? "#fffdfa" : "#fff"; }}
                            >
                              <td style={{ textAlign: "center", padding: "8px 6px" }}>
                                {anyLocked ? (
                                  <span style={{ color: col.lightMuted, fontSize: 11 }} title={`Pay "${g.lockedMsg}" first`}>
                                    <i className="fa-solid fa-lock" />
                                  </span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={() => toggleSelect(g.ids, g.bills.map(b => b.remaining_amount))}
                                    onClick={e => e.stopPropagation()}
                                    style={{ cursor: "pointer", accentColor: col.orange }}
                                  />
                                )}
                              </td>

                              <td style={{ padding: "8px 10px" }}>
                                <div>
                                  <strong style={{ fontSize: 13, color: col.navy, display: "block" }}>
                                    {formatFeeName(g.fee_name)}
                                  </strong>
                                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                                    {isOverdue && !anyLocked && (
                                      <span style={{ fontSize: 9.5, color: col.red, fontWeight: 800, background: col.redBg, padding: "1px 5px", borderRadius: 4, border: `1px solid ${col.redBrd}` }}>
                                        OVERDUE
                                      </span>
                                    )}
                                    {anyLocked && (
                                      <span style={{ fontSize: 10, color: "#b45309", fontWeight: 600 }}>
                                        <i className="fa-solid fa-lock" style={{ marginRight: 3, fontSize: 8 }} />
                                        Pay &quot;{formatFeeName(g.lockedMsg)}&quot; first
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: "8px 10px" }}>
                                <TypeBadge type={g.fee_type} />
                              </td>

                              <td style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, color: col.slate }}>
                                {fmt(g.total_amount)}
                              </td>

                              <td style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, color: col.green }}>
                                {fmt(g.paid_amount)}
                              </td>

                              <td style={{ textAlign: "right", padding: "8px 10px", fontWeight: 800, color: col.red, fontSize: 13.5 }}>
                                {fmt(g.remaining_amount)}
                              </td>

                              <td style={{ textAlign: "right", padding: "8px 12px" }}>
                                <div style={{ display: "inline-flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                                  {isOverdue && !anyLocked && (
                                    <button
                                      onClick={() => { setFineTarget(g.bills[0]); setFineAmount(""); setFineReason(""); }}
                                      style={{
                                        padding: "2px 6px", borderRadius: 4, border: `1px solid ${col.orangeBrd}`,
                                        background: col.orangeBg, color: col.orange, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                                      }}
                                    >
                                      Fine
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setWaiveTarget(g.bills[0]); setWaiveReason(""); }}
                                    style={{
                                      padding: "2px 6px", borderRadius: 4, border: `1px solid ${col.blueBrd}`,
                                      background: col.blueBg, color: col.blue, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                                    }}
                                  >
                                    Waive
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add One-Time / Misc Fee Accordion */}
              <div style={{
                background: "#fff", border: `1px solid ${col.border}`, borderRadius: 10,
                padding: "10px 14px", boxShadow: "0 1px 2px rgba(0,0,0,0.01)",
              }}>
                <button
                  onClick={() => setShowMisc(v => !v)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 8,
                    border: "none", background: "none", cursor: "pointer", textAlign: "left", padding: 0,
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, background: col.orangeBg, color: col.orange,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                  }}>
                    <i className={`fa-solid fa-${showMisc ? "minus" : "plus"}`} />
                  </span>
                  <div>
                    <strong style={{ fontSize: 12.5, color: col.navy, display: "block" }}>Add One-Time / Custom Fee</strong>
                    <span style={{ fontSize: 11, color: col.muted }}>Dress, Books, Uniform, ID Card, Fine…</span>
                  </div>
                  <i className={`fa-solid fa-chevron-${showMisc ? "up" : "down"}`} style={{ marginLeft: "auto", color: col.lightMuted, fontSize: 10 }} />
                </button>

                {showMisc && (
                  <form onSubmit={handleAddMiscFee} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid #f1f5f9` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>Fee Name *</label>
                        <input value={miscFeeName} onChange={e => setMiscFeeName(e.target.value)} placeholder="e.g. Exam Fee" required style={INPUT_STYLE} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>Category</label>
                        <select value={miscType} onChange={e => setMiscType(e.target.value)} style={INPUT_STYLE}>
                          <option value="academic">Academic</option>
                          <option value="hostel">Hostel</option>
                          <option value="transport">Transport</option>
                          <option value="misc">Misc / Other</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>Amount ({currencySymbol}) *</label>
                        <input value={miscAmount} onChange={e => setMiscAmount(e.target.value)} type="number" min="1" required placeholder="0" style={INPUT_STYLE} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>Due Date</label>
                        <DateInput value={miscDueDate} onChange={e => setMiscDueDate(e.target.value)} style={{ width: "100%", height: 38 }} />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={addingMisc}
                      style={{
                        marginTop: 10, height: 34, padding: "0 14px", borderRadius: 6, border: "none",
                        background: col.navy, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      {addingMisc ? <Spinner size={13} color="#fff" /> : <i className="fa-solid fa-plus" style={{ fontSize: 10 }} />} Add Fee to Ledger
                    </button>
                  </form>
                )}
              </div>

              {/* Cleared & Paid Fees Collapsible Accordion */}
              {paidCollections.length > 0 && (
                <details style={{ background: "#fff", border: `1px solid ${col.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <summary style={{ padding: "8px 12px", background: "#f8fafc", fontSize: 11.5, fontWeight: 700, color: col.muted, cursor: "pointer" }}>
                    <i className="fa-solid fa-circle-check" style={{ color: col.green, marginRight: 6 }} />
                    Show Paid / Waived Bills ({paidCollections.length})
                  </summary>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <tbody>
                        {paidCollections.map((c: any) => (
                          <tr key={c.id} style={{ borderBottom: `1px solid #f1f5f9` }}>
                            <td style={{ padding: "6px 12px", fontWeight: 600, color: col.navy }}>{formatFeeName(c.fee_name)}</td>
                            <td style={{ padding: "6px 12px" }}><TypeBadge type={c.fee_type} /></td>
                            <td style={{ padding: "6px 12px", fontWeight: 700, color: col.green }}>{fmt(c.paid_amount || c.total_amount)}</td>
                            <td style={{ padding: "6px 12px", color: col.muted }}>{c.due_date ? formatDate(c.due_date.slice(0, 10)) : "—"}</td>
                            <td style={{ padding: "6px 12px", textAlign: "right" }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: col.green, background: col.greenBg, padding: "2px 5px", borderRadius: 4 }}>
                                {c.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>

            {/* ── RIGHT COLUMN: POS CASHIER CHECKOUT BOX ── */}
            <div style={{ position: "sticky", top: 16 }}>
              <form
                onSubmit={handleBulkPayment}
                style={{
                  background: "#fff", border: `1px solid ${col.border}`, borderRadius: 12,
                  padding: "16px", boxShadow: "0 2px 10px rgba(15,23,42,0.04)", display: "flex",
                  flexDirection: "column", gap: 14,
                }}
              >
                {/* POS Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${col.border}`, paddingBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6, background: col.orangeBg,
                      color: col.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    }}>
                      <i className="fa-solid fa-receipt" />
                    </div>
                    <div>
                      <strong style={{ fontSize: 14, fontWeight: 800, color: col.navy, display: "block" }}>Payment Summary</strong>
                      <span style={{ fontSize: 11, color: col.muted }}>{selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""} selected</span>
                    </div>
                  </div>

                  {selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => { setSelectedIds(new Set()); setBulkAmounts({}); }}
                      style={{ border: "none", background: "none", color: col.red, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Ledger Balance Summary */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                  padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: `1px solid ${col.border}`,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: "0.02em", display: "block" }}>
                      Total Outstanding
                    </span>
                    <strong style={{ fontSize: 15, fontWeight: 800, color: totalDue > 0 ? col.red : col.green, display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fmt(totalDue)}
                    </strong>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: "0.02em", display: "block" }}>
                      Total Collected
                    </span>
                    <strong style={{ fontSize: 15, fontWeight: 800, color: col.green, display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fmt(totalPaid)}
                    </strong>
                  </div>
                </div>

                {/* Selected Bills List for Payment with Partial Payment Cards */}
                {selectedCollections.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto", paddingRight: 2 }}>
                    {selectedCollections.map((c: any) => {
                      const totalDueForFee = parseFloat(c.remaining_amount || "0");
                      const payingAmt = parseFloat(bulkAmounts[c.id] ?? c.remaining_amount ?? "0");
                      const remainingAfter = Math.max(0, totalDueForFee - (isNaN(payingAmt) ? 0 : payingAmt));
                      const isPartial = payingAmt < totalDueForFee && payingAmt > 0;

                      return (
                        <div
                          key={c.id}
                          style={{
                            padding: "10px 12px", borderRadius: 8, background: "#fff",
                            border: `1px solid ${col.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                            display: "flex", flexDirection: "column", gap: 8,
                          }}
                        >
                          {/* Fee Title and Full Due */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                                <TypeBadge type={c.fee_type} />
                              </div>
                              <strong style={{ fontSize: 12.5, fontWeight: 700, color: col.navy, display: "block", wordBreak: "break-word" }}>
                                {formatFeeName(c.fee_name)}
                              </strong>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <span style={{ fontSize: 10, color: col.muted, fontWeight: 600, display: "block" }}>Total Due</span>
                              <strong style={{ fontSize: 13, fontWeight: 800, color: col.navy }}>{fmt(totalDueForFee)}</strong>
                            </div>
                          </div>

                          {/* Paying Amount Input Box */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "6px 10px", borderRadius: 6, border: `1px solid ${col.border}` }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0 }}>
                              Paying ({currencySymbol}):
                            </span>
                            <input
                              type="number"
                              value={bulkAmounts[c.id] ?? c.remaining_amount}
                              onChange={ev => setBulkAmounts(a => ({ ...a, [c.id]: ev.target.value }))}
                              min="0.01"
                              max={totalDueForFee}
                              step="0.01"
                              required
                              style={{
                                flex: 1, height: 30, padding: "0 8px", borderRadius: 5,
                                border: `1px solid ${col.borderDark}`, fontSize: 13, fontWeight: 800,
                                color: col.navy, textAlign: "right", outline: "none", background: "#fff",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setBulkAmounts(a => ({ ...a, [c.id]: String(totalDueForFee) }))}
                              style={{
                                height: 26, padding: "0 8px", borderRadius: 4, border: `1px solid ${col.border}`,
                                background: "#fff", color: col.blue, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                                flexShrink: 0,
                              }}
                              title="Pay full due amount"
                            >
                              Full
                            </button>
                          </div>

                          {/* Remaining / Status Note */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                            {isPartial ? (
                              <span style={{ color: col.amber, fontWeight: 700 }}>
                                <i className="fa-solid fa-circle-half-stroke" style={{ marginRight: 4 }} />
                                Partial: Leaves {fmt(remainingAfter)} due
                              </span>
                            ) : payingAmt >= totalDueForFee ? (
                              <span style={{ color: col.green, fontWeight: 700 }}>
                                <i className="fa-solid fa-check" style={{ marginRight: 4 }} />
                                Full Settlement
                              </span>
                            ) : (
                              <span style={{ color: col.red, fontWeight: 700 }}>
                                Enter valid amount
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "1.2rem", textAlign: "center", color: col.muted, fontSize: 12, fontWeight: 500, border: `1px dashed ${col.border}`, borderRadius: 8 }}>
                    <i className="fa-solid fa-arrow-left" style={{ marginRight: 6, color: col.lightMuted }} />
                    Select pending dues from the left table
                  </div>
                )}

                {/* Payment Fields */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>
                      Payment Date *
                    </label>
                    <DateInput value={paymentDate} onChange={e => setPaymentDate(e.target.value)} required style={{ width: "100%", height: 36 }} />
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>
                      Payment Method
                    </label>
                    <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={INPUT_STYLE}>
                      <option value="cash">Cash Counter</option>
                      <option value="online">Online (eSewa / Khalti / Fonepay)</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>

                  {needsRef && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>
                        Transaction / Reference No. *
                      </label>
                      <input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="eSewa / Khalti / Bank Ref ID" required style={INPUT_STYLE} />
                    </div>
                  )}

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: col.navy, display: "block", marginBottom: 2 }}>
                      Remarks / Note (Optional)
                    </label>
                    <input value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Cashier note…" style={INPUT_STYLE} />
                  </div>
                </div>

                {/* Total Paying Summary & Big Button */}
                <div style={{ borderTop: `1px solid ${col.border}`, paddingTop: 10, marginTop: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col.muted, textTransform: "uppercase" }}>Net Paying Amount</span>
                    <strong style={{ fontSize: 22, fontWeight: 800, color: col.green }}>{fmt(bulkTotal)}</strong>
                  </div>

                  <button
                    type="submit"
                    disabled={isPaying || selectedIds.size === 0 || bulkTotal <= 0}
                    style={{
                      width: "100%", height: 42, borderRadius: 8, border: "none",
                      background: col.orange, color: "#fff", fontSize: 13.5, fontWeight: 800,
                      cursor: isPaying || selectedIds.size === 0 || bulkTotal <= 0 ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      opacity: isPaying || selectedIds.size === 0 ? 0.6 : 1,
                      boxShadow: "0 2px 8px rgba(234,88,12,0.2)",
                      transition: "background 0.15s, opacity 0.15s",
                    }}
                  >
                    {isPaying ? (
                      <Spinner size={15} color="#fff" />
                    ) : (
                      <>
                        <i className="fa-solid fa-print" style={{ fontSize: 12 }} />
                        Collect &amp; Print Receipt ({fmt(bulkTotal)})
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>

          </div>
        )}

      </main>

      {/* ── MODALS ── */}
      {/* Waive Modal */}
      {waiveTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(2px)",
        }} onClick={() => setWaiveTarget(null)}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 420, border: `1px solid ${col.border}`, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${col.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: col.navy }}>Waive Fee Bill</h3>
              <button onClick={() => setWaiveTarget(null)} style={{ border: "none", background: "none", fontSize: 14, cursor: "pointer", color: col.muted }}>✕</button>
            </div>
            <form onSubmit={handleWaive} style={{ padding: "14px 16px" }}>
              <p style={{ fontSize: 12.5, color: col.muted, margin: "0 0 10px" }}>
                Waiving sets the remaining balance for <strong>{waiveTarget.fee_name}</strong> ({fmt(waiveTarget.remaining_amount)}) to zero.
              </p>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: col.navy, display: "block", marginBottom: 3 }}>Reason for Waiving</label>
              <input value={waiveReason} onChange={e => setWaiveReason(e.target.value)} placeholder="e.g. Scholarship adjustment, financial aid…" style={INPUT_STYLE} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={() => setWaiveTarget(null)} style={{ height: 34, padding: "0 12px", borderRadius: 6, border: `1px solid ${col.border}`, background: "#fff", cursor: "pointer", fontSize: 12 }}>Cancel</button>
                <button type="submit" disabled={waiving} style={{ height: 34, padding: "0 14px", borderRadius: 6, border: "none", background: col.blue, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                  {waiving ? "Waiving…" : "Confirm Waive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fine Modal */}
      {fineTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(2px)",
        }} onClick={() => setFineTarget(null)}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 420, border: `1px solid ${col.border}`, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${col.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: col.navy }}>Add Late Fine</h3>
              <button onClick={() => setFineTarget(null)} style={{ border: "none", background: "none", fontSize: 14, cursor: "pointer", color: col.muted }}>✕</button>
            </div>
            <form onSubmit={handleAddFine} style={{ padding: "14px 16px" }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: col.navy, display: "block", marginBottom: 3 }}>Fine Amount ({currencySymbol}) *</label>
              <input value={fineAmount} onChange={e => setFineAmount(e.target.value)} type="number" min="1" required placeholder="100" style={INPUT_STYLE} />
              <label style={{ fontSize: 11.5, fontWeight: 700, color: col.navy, display: "block", margin: "8px 0 3px" }}>Reason</label>
              <input value={fineReason} onChange={e => setFineReason(e.target.value)} placeholder="Late payment fine" style={INPUT_STYLE} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button type="button" onClick={() => setFineTarget(null)} style={{ height: 34, padding: "0 12px", borderRadius: 6, border: `1px solid ${col.border}`, background: "#fff", cursor: "pointer", fontSize: 12 }}>Cancel</button>
                <button type="submit" disabled={addingFine} style={{ height: 34, padding: "0 14px", borderRadius: 6, border: "none", background: col.orange, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                  {addingFine ? "Applying…" : "Apply Fine"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
