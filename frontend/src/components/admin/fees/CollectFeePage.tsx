"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAppDispatch } from "@/store/hooks";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { showToast } from "@/store/toastSlice";
import DateInput from "@/components/shared/DateInput";
import { Loader, Spinner } from "@/components/shared/Loader";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";

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
  store:     { label: "Store",     icon: "fa-bag-shopping",   color: col.green,  bg: col.greenBg,  border: col.greenBrd },
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

function compareFeeChronological(a: any, b: any): number {
  const periodA = a.billing_from_month || (a.due_date ? String(a.due_date).slice(0, 7) : "") || String(a.id || 0);
  const periodB = b.billing_from_month || (b.due_date ? String(b.due_date).slice(0, 7) : "") || String(b.id || 0);
  if (periodA !== periodB) return periodA.localeCompare(periodB);
  const dueA = a.due_date ? String(a.due_date) : "";
  const dueB = b.due_date ? String(b.due_date) : "";
  if (dueA !== dueB) return dueA.localeCompare(dueB);
  return (a.id || 0) - (b.id || 0);
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
  return bills.map(b => {
    const isLocked = lockedIds.has(b.id);
    const lockedMsg = isLocked ? (lockedByStructure.get(b.id) || "an earlier bill") : null;
    return {
      ids: [b.id],
      fee_name: b.fee_name || "Fee",
      fee_type: b.fee_type || "academic",
      fee_structure_id: b.fee_structure_id || null,
      bills: [b],
      total_amount: Number(b.net_amount ?? b.total_amount ?? 0),
      paid_amount: Number(b.paid_amount ?? 0),
      remaining_amount: Number(b.remaining_amount ?? 0),
      earliest_due: b.due_date,
      latest_due: b.due_date,
      status: b.status,
      created_at: b.created_at,
      allLocked: isLocked,
      anyLocked: isLocked,
      lockedMsg,
    };
  });
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialId = searchParams.get("student_id") || searchParams.get("studentId");
  const initialCollectionId = searchParams.get("collection_id") || searchParams.get("collectionId");
  const { academicYearId } = useAcademicYear();
  const { formatDate, formatFeeName, isBS, billingGroupKey } = useDateFormat();

  const { fmt, symbol: currencySymbol } = useCurrency();
  const isFinance = pathname?.startsWith("/finance");
  const receiptBaseUrl = isFinance ? "/finance/fees/receipt" : "/fees/receipt";

  const { data: financeAccount } = useApi<any>(
    !isFinance ? "/school/finance-account" : null
  );
  const hasActiveFinanceAccount = Boolean(
    !isFinance && financeAccount && (financeAccount.id || financeAccount.email) && financeAccount.status !== "inactive"
  );

  // Search state
  const [query, setSearchQuery]               = useState("");
  const [searchResults, setSearchResults]     = useState<any[]>([]);
  const [searching, setSearching]             = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSelectedRef = useRef<string | null>(null);

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
    const activeEnrollment = st.enrollments?.find((e: any) => e.status === "active") || st.enrollments?.[0];
    setSelectedStudent({
      ...st,
      enrollment_id: st.enrollment_id || activeEnrollment?.id || null,
    });
    setSearchQuery(st.full_name || "");
    setSearchResults([]);
    setSelectedIds(new Set());
    setBulkAmounts({});
    setLastReceipts([]);
    autoSelectedRef.current = null;
  };

  const clearStudent = () => {
    setSelectedStudent(null);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedIds(new Set());
    setBulkAmounts({});
    setLastReceipts([]);
    autoSelectedRef.current = null;
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
    const ayParam = academicYearId ? `?academic_year_id=${academicYearId}` : "";
    apiRequest<{ data: any }>(`/hostel/students/${selectedStudent.id}${ayParam}`)
      .then(res => setHostelInfo(res.data || null))
      .catch(() => setHostelInfo(null));

    apiRequest<{ data: any }>(`/transport/students/${selectedStudent.id}${ayParam}`)
      .then(res => setTransportInfo(res.data || null))
      .catch(() => setTransportInfo(null));
  }, [selectedStudent, academicYearId]);

  // Fee Collections for Student
  const studentCollectionsUrl = useMemo(() => {
    if (!selectedStudent?.id) return "";
    const ay = academicYearId ? `?academic_year_id=${academicYearId}` : "";
    return `/fees/collections/student/${selectedStudent.id}${ay}`;
  }, [selectedStudent?.id, academicYearId]);

  const { data: rawCollections, refetch: refetchCollections, loading: loadingFees } = useApi<any[]>(
    studentCollectionsUrl,
    [studentCollectionsUrl]
  );
  const allCollections = useMemo(() => rawCollections || [], [rawCollections]);

  // Selection & Bulk Payment State
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [bulkAmounts, setBulkAmounts]   = useState<Record<number, string>>({});
  const [groupInputOverrides, setGroupInputOverrides] = useState<Record<string, string>>({});
  const [paymentMode, setPaymentMode]   = useState("cash");
  const [paymentDate, setPaymentDate]   = useState(new Date().toISOString().slice(0, 10));
  const [referenceNo, setReferenceNo]   = useState("");
  const [remarks, setRemarks]           = useState("");
  const [isPaying, setIsPaying]         = useState(false);
  const [lastReceipts, setLastReceipts] = useState<Array<{ payment_id: number; receipt_number: string }>>([]);
  const needsRef = paymentMode !== "cash";

  // Sequential Locking Logic with Dynamic Unlocking
  const { lockedIds, lockedByStructure } = useMemo(() => {
    const locked = new Set<number>();
    const byStruct = new Map<number, string>();
    const recurring = allCollections.filter(
      (c: any) =>
        c.fee_structure_id &&
        c.status !== "paid" &&
        c.status !== "waived" &&
        (c.fee_type || "academic") === "academic"
    );

    const groups = new Map<number, any[]>();
    for (const c of recurring) {
      if (!groups.has(c.fee_structure_id)) groups.set(c.fee_structure_id, []);
      groups.get(c.fee_structure_id)!.push(c);
    }

    for (const [, list] of groups) {
      list.sort(compareFeeChronological);

      // Sequential lock:
      // Item 0 is always unlocked.
      // Item i is unlocked if all preceding unpaid bills 0..i-1 are selected in selectedIds.
      let chainIntact = true;
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        if (!selectedIds.has(prev.id)) {
          chainIntact = false;
        }
        if (!chainIntact) {
          locked.add(list[i].id);
          byStruct.set(list[i].id, prev.fee_name || "earlier month");
        }
      }
    }
    return { lockedIds: locked, lockedByStructure: byStruct };
  }, [allCollections, selectedIds]);

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
    if (typeFilter === "misc") return pendingCollections.filter((c: any) => c.fee_type === "misc" || c.fee_type === "store");
    return pendingCollections.filter((c: any) => (c.fee_type || "academic") === typeFilter);
  }, [pendingCollections, typeFilter]);

  const groupedPending = useMemo(() => {
    const grouped = groupBills(filteredPending, lockedIds, lockedByStructure);
    return grouped.sort((a, b) => {
      const billA = a.bills[0] || {};
      const billB = b.bills[0] || {};
      const periodA = billA.billing_from_month || (billA.due_date ? String(billA.due_date).slice(0, 7) : "") || String(billA.id || 0);
      const periodB = billB.billing_from_month || (billB.due_date ? String(billB.due_date).slice(0, 7) : "") || String(billB.id || 0);
      if (periodA !== periodB) return periodA.localeCompare(periodB);
      return (billA.id || 0) - (billB.id || 0);
    });
  }, [filteredPending, lockedIds, lockedByStructure]);

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

  // Auto-select specific bill when collection_id is provided in URL
  useEffect(() => {
    if (!initialCollectionId || pendingCollections.length === 0) return;
    if (autoSelectedRef.current === initialCollectionId) return;

    const targetId = Number(initialCollectionId);
    const target = pendingCollections.find((c: any) => c.id === targetId);
    if (!target) return;

    autoSelectedRef.current = initialCollectionId;

    // If target is recurring academic tuition, auto-select preceding unpaid months so chain is intact
    const toSelect: any[] = [];
    if (target.fee_structure_id && (target.fee_type || "academic") === "academic") {
      const sameGroup = pendingCollections.filter(
        (c: any) => c.fee_structure_id === target.fee_structure_id
      );
      sameGroup.sort(compareFeeChronological);
      const targetIdx = sameGroup.findIndex((c: any) => c.id === targetId);
      if (targetIdx >= 0) {
        for (let i = 0; i <= targetIdx; i++) {
          toSelect.push(sameGroup[i]);
        }
      } else {
        toSelect.push(target);
      }
    } else {
      toSelect.push(target);
    }

    const nextIds = new Set<number>();
    const nextAmts: Record<number, string> = {};
    for (const item of toSelect) {
      nextIds.add(item.id);
      nextAmts[item.id] = String(item.remaining_amount || "0");
    }

    setSelectedIds(nextIds);
    setBulkAmounts(nextAmts);
  }, [initialCollectionId, pendingCollections]);

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

  // Group selected items: consolidate multi-month tuition into a single period card (Start – End Month)
  const selectedGroups = useMemo(() => {
    const sorted = [...selectedCollections].sort(compareFeeChronological);

    const groupMap = new Map<string, any[]>();
    for (const c of sorted) {
      const baseName = (c.fee_name || "Fee").replace(/\s*\([^)]*\)$/, "").trim() || c.fee_name || "Fee";
      const key = c.fee_structure_id
        ? `struct_${c.fee_structure_id}`
        : `name_${baseName.toLowerCase()}_${c.fee_type || "academic"}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(c);
    }

    const result: Array<{
      groupKey: string;
      isMultiMonth: boolean;
      baseFeeName: string;
      formattedTitle: string;
      feeType: string;
      bills: any[];
      totalDue: number;
      ratePerMonth: number;
      monthCount: number;
      startMonthLabel: string;
      endMonthLabel: string;
    }> = [];

    for (const [key, bills] of groupMap.entries()) {
      const first = bills[0];
      const last = bills[bills.length - 1];
      const baseFeeName = (first.fee_name || "Fee").replace(/\s*\([^)]*\)$/, "").trim() || first.fee_name || "Fee";
      const totalDue = bills.reduce((sum, b) => sum + parseFloat(b.remaining_amount || "0"), 0);
      const isMultiMonth = bills.length > 1;

      if (!isMultiMonth) {
        result.push({
          groupKey: key,
          isMultiMonth: false,
          baseFeeName,
          formattedTitle: formatFeeName(first.fee_name),
          feeType: first.fee_type || "academic",
          bills,
          totalDue,
          ratePerMonth: totalDue,
          monthCount: 1,
          startMonthLabel: "",
          endMonthLabel: "",
        });
      } else {
        const getPeriod = (bill: any) => {
          const formatted = formatFeeName(bill.fee_name);
          const match = formatted.match(/\(([^)]+)\)$/);
          if (match) return match[1].trim();
          if (bill.due_date) return billingGroupKey(bill.due_date).label;
          return "";
        };

        const pStart = getPeriod(first);
        const pEnd   = getPeriod(last);

        const startMatch = pStart.match(/^([A-Za-z]+)\s+(\d{4})$/);
        const endMatch   = pEnd.match(/^([A-Za-z]+)\s+(\d{4})$/);

        let rangeLabel = "";
        if (startMatch && endMatch) {
          const [, m1, y1] = startMatch;
          const [, m2, y2] = endMatch;
          if (y1 === y2) {
            rangeLabel = `${m1} – ${m2} ${y1}`;
          } else {
            rangeLabel = `${m1} ${y1} – ${m2} ${y2}`;
          }
        } else if (pStart && pEnd && pStart !== pEnd) {
          rangeLabel = `${pStart} – ${pEnd}`;
        } else if (pStart) {
          rangeLabel = pStart;
        } else {
          rangeLabel = `${bills.length} Months`;
        }

        const formattedTitle = `${baseFeeName} (${rangeLabel} · ${bills.length} Months)`;
        const ratePerMonth = bills.length > 0 ? (totalDue / bills.length) : totalDue;

        result.push({
          groupKey: key,
          isMultiMonth: true,
          baseFeeName,
          formattedTitle,
          feeType: first.fee_type || "academic",
          bills,
          totalDue,
          ratePerMonth,
          monthCount: bills.length,
          startMonthLabel: pStart,
          endMonthLabel: pEnd,
        });
      }
    }
    return result;
  }, [selectedCollections, formatFeeName, billingGroupKey]);

  // Group amount change: distributes input value sequentially (FIFO) to underlying bills
  const handleGroupAmountChange = (group: any, rawValue: string) => {
    setGroupInputOverrides(prev => ({ ...prev, [group.groupKey]: rawValue }));

    const totalEntered = parseFloat(rawValue);
    let budget = isNaN(totalEntered) ? 0 : Math.max(0, totalEntered);

    setBulkAmounts(prev => {
      const next = { ...prev };
      for (const b of group.bills) {
        const due = parseFloat(b.remaining_amount || "0");
        if (budget >= due) {
          next[b.id] = String(due);
          budget -= due;
        } else if (budget > 0) {
          next[b.id] = String(Number(budget.toFixed(2)));
          budget = 0;
        } else {
          next[b.id] = "0";
        }
      }
      return next;
    });
  };

  // Group full settlement: sets all underlying bills to 100% remaining amount
  const handleGroupSetFull = (group: any) => {
    setGroupInputOverrides(prev => {
      const next = { ...prev };
      delete next[group.groupKey];
      return next;
    });
    setBulkAmounts(prev => {
      const next = { ...prev };
      for (const b of group.bills) {
        next[b.id] = String(b.remaining_amount || "0");
      }
      return next;
    });
  };

  const toggleSelect = (ids: number[], remainingAmounts: any[]) => {
    setGroupInputOverrides({});
    const allIn = ids.every(id => selectedIds.has(id));
    const nextIds = new Set(selectedIds);
    const nextBulk = { ...bulkAmounts };

    if (allIn) {
      // Deselecting these items
      ids.forEach(id => {
        nextIds.delete(id);
        delete nextBulk[id];
      });

      // Also deselect any subsequent dependent bills in the same structure
      for (const deselectedId of ids) {
        const deselectedBill = allCollections.find((c: any) => c.id === deselectedId);
        if (deselectedBill && deselectedBill.fee_structure_id) {
          const sameGroup = allCollections.filter(
            (c: any) => c.fee_structure_id === deselectedBill.fee_structure_id && c.status !== "paid" && c.status !== "waived"
          );
          sameGroup.sort(compareFeeChronological);
          const idx = sameGroup.findIndex((c: any) => c.id === deselectedId);
          if (idx >= 0) {
            for (let j = idx + 1; j < sameGroup.length; j++) {
              nextIds.delete(sameGroup[j].id);
              delete nextBulk[sameGroup[j].id];
            }
          }
        }
      }
    } else {
      // Selecting these items
      ids.forEach((id, idx) => {
        nextIds.add(id);
        nextBulk[id] = String(remainingAmounts[idx] || "0");
      });
    }

    setSelectedIds(nextIds);
    setBulkAmounts(nextBulk);
  };

  const toggleAll = () => {
    setGroupInputOverrides({});
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

  // Quick 1-Click Multi-Month Selection Helpers
  const selectNMonths = (n: number) => {
    setGroupInputOverrides({});
    const candidates = filteredPending.filter((c: any) => c.status !== "paid" && c.status !== "waived");
    const groups = new Map<string, any[]>();
    for (const c of candidates) {
      const key = c.fee_structure_id ? `struct-${c.fee_structure_id}` : `type-${c.fee_type}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    }

    const nextSelected = new Set<number>();
    const nextAmounts: Record<number, string> = {};

    for (const [, list] of groups) {
      list.sort(compareFeeChronological);

      const toPick = list.slice(0, n);
      for (const item of toPick) {
        nextSelected.add(item.id);
        nextAmounts[item.id] = String(item.remaining_amount || "0");
      }
    }

    setSelectedIds(nextSelected);
    setBulkAmounts(nextAmounts);
  };

  const selectAllContiguous = () => {
    setGroupInputOverrides({});
    const nextSelected = new Set<number>();
    const nextAmounts: Record<number, string> = {};
    for (const c of filteredPending) {
      nextSelected.add(c.id);
      nextAmounts[c.id] = String(c.remaining_amount || "0");
    }
    setSelectedIds(nextSelected);
    setBulkAmounts(nextAmounts);
  };

  // Submit Payment in Chronological Sequence
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

    const validItems = selectedCollections
      .map(colItem => ({
        colItem,
        amount: parseFloat(bulkAmounts[colItem.id] || colItem.remaining_amount || "0"),
      }))
      .filter(item => item.amount > 0);

    // Sort validItems chronologically so older bills commit before newer ones
    validItems.sort((a, b) => compareFeeChronological(a.colItem, b.colItem));

    if (validItems.length === 0) {
      dispatch(showToast({ type: "error", title: "Invalid Amounts", message: "Please enter a valid payment amount greater than 0." }));
      setIsPaying(false);
      return;
    }

    try {
      const res: any = await apiRequest("/fees/payments/bulk", {
        method: "POST",
        body: JSON.stringify({
          student_id:     selectedStudent.id,
          payment_date:   paymentDate,
          payment_method: paymentMode,
          transaction_id: referenceNo || undefined,
          remarks:        remarks     || undefined,
          items: validItems.map(it => ({
            collection_id: it.colItem.id,
            paid_amount:   it.amount,
          })),
        }),
      });

      const resData = res?.data || res;
      const receiptNo = resData?.receipt_number || res?.receipt_number || "—";
      const paymentId = resData?.payment_id || resData?.payments?.[0]?.id || res?.payment_id;

      if (paymentId) {
        setLastReceipts([{ payment_id: paymentId, receipt_number: receiptNo }]);
      }

      dispatch(showToast({
        type: "success",
        title: `Payment Recorded (${receiptNo})`,
        message: `${validItems.length} fee item${validItems.length > 1 ? "s" : ""} cleared on single receipt ${receiptNo}.`,
      }));
      refetchCollections();
      setSelectedIds(new Set());
      setBulkAmounts({});
      setGroupInputOverrides({});
      setReferenceNo("");
      setRemarks("");
    } catch (err: any) {
      dispatch(showToast({ type: "error", title: "Payment Failed", message: err.message || "Payment error" }));
      setGroupInputOverrides({});
    } finally {
      setIsPaying(false);
    }
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
          enrollment_id: selectedStudent.enrollment_id || selectedStudent.enrollments?.[0]?.id || null,
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
          enrollment_id: selectedStudent.enrollment_id || selectedStudent.enrollments?.[0]?.id || null,
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
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(waiveTarget.id);
        return next;
      });
      setBulkAmounts(prev => {
        const next = { ...prev };
        delete next[waiveTarget.id];
        return next;
      });
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

  if (!isFinance && hasActiveFinanceAccount) {
    return (
      <div style={{ minHeight: "80vh", background: col.bg, display: "grid", placeItems: "center", padding: "40px 20px" }}>
        <div style={{
          background: "#fff",
          border: `1.5px solid ${col.border}`,
          borderRadius: 16,
          maxWidth: 560,
          width: "100%",
          padding: "36px 32px",
          textAlign: "center",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#ecfdf5",
            color: "#059669",
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            margin: "0 auto 18px",
            border: "1px solid #a7f3d0",
          }}>
            <i className="fa-solid fa-lock" />
          </div>

          <span style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: "#ecfdf5",
            color: "#047857",
            fontSize: 11.5,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            display: "inline-block",
            marginBottom: 10,
          }}>
            Fee Counter Delegated
          </span>

          <h2 style={{ fontSize: 20, fontWeight: 900, color: col.navy, margin: "0 0 10px" }}>
            Fee Counter Managed by Finance Officer
          </h2>

          <p style={{ fontSize: 13.5, color: col.muted, lineHeight: 1.6, margin: "0 0 20px" }}>
            Your school has assigned an active <strong>Finance Manager</strong> ({financeAccount?.full_name} &bull; {financeAccount?.email}).
            To maintain cash drawer integrity and strict segregation of duties, fee collections and POS receipt issuing are exclusively conducted via the <strong>Finance Portal</strong>.
          </p>

          <div style={{
            background: "#f8fafc",
            border: `1px solid ${col.border}`,
            borderRadius: 10,
            padding: "14px 18px",
            textAlign: "left",
            fontSize: 12.5,
            color: col.slate,
            marginBottom: 24,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: col.navy, marginBottom: 4 }}>
              <i className="fa-solid fa-circle-info" style={{ color: col.blue }} />
              Auditor Access &amp; Fallback
            </div>
            <div>
              You retain complete audit and view access to all student ledgers, fee structures, and receipts. If the Finance Manager is unavailable and you need to collect fees as Admin, you can revoke access in <strong>Settings &rarr; Finance Account</strong> to unlock this counter.
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link
              href={initialId ? `/fees/history?student_id=${initialId}` : "/fees/history"}
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 9,
                background: col.navy,
                color: "#fff",
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fa-solid fa-clock-rotate-left" /> View Student Ledgers
            </Link>

            <Link
              href="/settings?tab=finance"
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 9,
                background: "#fff",
                color: col.navy,
                border: `1px solid ${col.border}`,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fa-solid fa-gear" /> Finance Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
                  Payment Recorded Successfully
                </strong>
                <span style={{ fontSize: 12, color: "#15803d" }}>
                  Receipt Number: <strong>{lastReceipts.map(r => r.receipt_number).filter(Boolean).join(", ")}</strong>
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {lastReceipts.map(r => (
                <a
                  key={r.payment_id}
                  href={`${receiptBaseUrl}/${r.payment_id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "6px 14px", borderRadius: 6, background: col.green, color: "#fff",
                    fontSize: 12, fontWeight: 700, textDecoration: "none", display: "inline-flex",
                    alignItems: "center", gap: 6,
                  }}
                >
                  <i className="fa-solid fa-print" style={{ fontSize: 11 }} /> Print Receipt ({r.receipt_number})
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
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
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
                    type="button"
                    onClick={clearStudent}
                    aria-label="Clear student search"
                    style={{
                      border: "none",
                      background: "none",
                      color: col.lightMuted,
                      cursor: "pointer",
                      padding: "2px 4px",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      borderRadius: 4,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = col.navy)}
                    onMouseLeave={e => (e.currentTarget.style.color = col.lightMuted)}
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
                      { id: "all",       label: "All Dues",   count: pendingCollections.length },
                      { id: "academic",  label: "Academic",   count: pendingCollections.filter(c => (c.fee_type || "academic") === "academic").length },
                      { id: "hostel",    label: "Hostel",     count: pendingCollections.filter(c => c.fee_type === "hostel").length },
                      { id: "transport", label: "Transport",  count: pendingCollections.filter(c => c.fee_type === "transport").length },
                      { id: "misc",      label: "One-Time / Misc", count: pendingCollections.filter(c => c.fee_type === "misc" || c.fee_type === "store").length },
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

                  {/* 1-Click Quick Select Shortcuts */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                      <i className="fa-solid fa-bolt" style={{ color: col.orange, marginRight: 4 }} />
                      Quick:
                    </span>
                    <button
                      type="button"
                      onClick={() => selectNMonths(1)}
                      style={{
                        padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.border}`,
                        background: "#fff", color: col.navy, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                      title="Select earliest unpaid month"
                    >
                      1 Mo
                    </button>
                    <button
                      type="button"
                      onClick={() => selectNMonths(2)}
                      style={{
                        padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.border}`,
                        background: "#fff", color: col.navy, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                      title="Select 2 consecutive unpaid months"
                    >
                      2 Mos
                    </button>
                    <button
                      type="button"
                      onClick={() => selectNMonths(3)}
                      style={{
                        padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.border}`,
                        background: "#fff", color: col.navy, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                      title="Select 3 consecutive months (Quarterly)"
                    >
                      3 Mos (Quarter)
                    </button>
                    <button
                      type="button"
                      onClick={selectAllContiguous}
                      style={{
                        padding: "4px 9px", borderRadius: 6, border: `1px solid ${col.orangeBrd}`,
                        background: col.orangeBg, color: col.orange, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      }}
                      title="Select all pending dues"
                    >
                      Pay All Due
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => { setSelectedIds(new Set()); setBulkAmounts({}); }}
                        style={{
                          padding: "4px 8px", borderRadius: 6, border: `1px solid ${col.redBrd}`,
                          background: col.redBg, color: col.red, fontSize: 11, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
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
                        <tr><td colSpan={7} style={{ textAlign: "center", padding: "2rem" }}><Loader fullScreen={false} size="md" text="Loading dues…" /></td></tr>
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
                    {/* Quick Presets */}
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: col.muted, display: "block", marginBottom: 6 }}>
                        <i className="fa-solid fa-wand-magic-sparkles" style={{ color: col.orange, marginRight: 5 }} />
                        1-Click Quick Presets:
                      </span>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[
                          { name: "Uniform / Dress", icon: "fa-shirt", type: "misc" },
                          { name: "Books & Stationery", icon: "fa-book", type: "misc" },
                          { name: "School Tie & Belt", icon: "fa-ribbon", type: "misc" },
                          { name: "Student ID Card", icon: "fa-id-card", type: "misc" },
                          { name: "Late Fine", icon: "fa-triangle-exclamation", type: "misc" },
                          { name: "Exam / Admit Card Fee", icon: "fa-file-invoice", type: "academic" },
                        ].map(p => (
                          <button
                            key={p.name}
                            type="button"
                            onClick={() => {
                              setMiscFeeName(p.name);
                              setMiscType(p.type);
                            }}
                            style={{
                              padding: "4px 10px", borderRadius: 6,
                              border: miscFeeName === p.name ? `1.5px solid ${col.orange}` : `1px solid ${col.border}`,
                              background: miscFeeName === p.name ? col.orangeBg : "#f8fafc",
                              color: miscFeeName === p.name ? col.orange : col.navy,
                              fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                              display: "inline-flex", alignItems: "center", gap: 5,
                              transition: "all 0.12s",
                            }}
                          >
                            <i className={`fa-solid ${p.icon}`} style={{ fontSize: 10 }} />
                            {p.name}
                          </button>
                        ))}
                      </div>
                    </div>

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

                {/* Selected Bills List for Payment with Consolidated Multi-Month Cards */}
                {selectedGroups.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 2 }}>
                    {selectedGroups.map((group) => {
                      const isMulti = group.isMultiMonth;
                      const singleBill = group.bills[0];
                      const groupTotalDue = group.totalDue;

                      const groupPayingAmt = group.bills.reduce((sum, b) => {
                        const val = parseFloat(bulkAmounts[b.id] ?? b.remaining_amount ?? "0");
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0);

                      const inputValue = groupInputOverrides[group.groupKey] !== undefined
                        ? groupInputOverrides[group.groupKey]
                        : (isMulti ? (groupPayingAmt > 0 ? String(groupPayingAmt) : "") : (bulkAmounts[singleBill.id] ?? singleBill.remaining_amount));

                      const remainingAfter = Math.max(0, groupTotalDue - (isNaN(groupPayingAmt) ? 0 : groupPayingAmt));
                      const isPartial = groupPayingAmt < groupTotalDue && groupPayingAmt > 0;
                      const isFull = groupPayingAmt >= groupTotalDue;

                      // Multi-month partial breakdown:
                      const clearedBills = group.bills.filter(b => {
                        const paid = parseFloat(bulkAmounts[b.id] || "0");
                        const due = parseFloat(b.remaining_amount || "0");
                        return paid >= due && due > 0;
                      });
                      const partialBill = group.bills.find(b => {
                        const paid = parseFloat(bulkAmounts[b.id] || "0");
                        const due = parseFloat(b.remaining_amount || "0");
                        return paid > 0 && paid < due;
                      });

                      return (
                        <div
                          key={group.groupKey}
                          style={{
                            padding: "10px 12px", borderRadius: 8, background: "#fff",
                            border: `1px solid ${col.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                            display: "flex", flexDirection: "column", gap: 8,
                          }}
                        >
                          {/* Fee Title and Full Due */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                                <TypeBadge type={group.feeType} />
                                {isMulti && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 800, color: col.blue, background: col.blueBg,
                                    padding: "1px 6px", borderRadius: 4, border: `1px solid ${col.blueBrd}`,
                                  }}>
                                    {group.monthCount} Months
                                  </span>
                                )}
                              </div>
                              <strong style={{ fontSize: 12.5, fontWeight: 700, color: col.navy, display: "block", wordBreak: "break-word" }}>
                                {group.formattedTitle}
                              </strong>
                              {isMulti && (
                                <span style={{ fontSize: 11, color: col.muted, fontWeight: 600, display: "block", marginTop: 2 }}>
                                  Rate: {fmt(group.ratePerMonth)} / mo × {group.monthCount} Months
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <span style={{ fontSize: 10, color: col.muted, fontWeight: 600, display: "block" }}>Total Due</span>
                              <strong style={{ fontSize: 13, fontWeight: 800, color: col.navy }}>{fmt(groupTotalDue)}</strong>
                            </div>
                          </div>

                          {/* Paying Amount Input Box */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f8fafc", padding: "6px 10px", borderRadius: 6, border: `1px solid ${col.border}` }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0 }}>
                              Paying ({currencySymbol}):
                            </span>
                            <input
                              type="number"
                              value={inputValue}
                              onChange={ev => {
                                if (isMulti) {
                                  handleGroupAmountChange(group, ev.target.value);
                                } else {
                                  setBulkAmounts(a => ({ ...a, [singleBill.id]: ev.target.value }));
                                }
                              }}
                              min="0.01"
                              max={groupTotalDue}
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
                              onClick={() => {
                                if (isMulti) {
                                  handleGroupSetFull(group);
                                } else {
                                  setBulkAmounts(a => ({ ...a, [singleBill.id]: String(groupTotalDue) }));
                                }
                              }}
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
                                {isMulti ? (
                                  `Partial: Leaves ${fmt(remainingAfter)} due (${clearedBills.length} of ${group.monthCount} mos cleared${partialBill ? ` + partial ${formatFeeName(partialBill.fee_name).replace(/^.*\(|\)$/g, "")}` : ""})`
                                ) : (
                                  `Partial: Leaves ${fmt(remainingAfter)} due`
                                )}
                              </span>
                            ) : isFull ? (
                              <span style={{ color: col.green, fontWeight: 700 }}>
                                <i className="fa-solid fa-check" style={{ marginRight: 4 }} />
                                {isMulti ? `Full Settlement (${group.monthCount} Months Cleared)` : "Full Settlement"}
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
