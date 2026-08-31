"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "./fees.module.css";
import { useApi } from "@/lib/useApi";
import { apiRequest } from "@/lib/api";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useCurrency } from "@/lib/useCurrency";
import { useDateFormat } from "@/lib/useDateFormat";
import { Spinner } from "@/components/shared/Loader";
import { adToBS, bsToISO, isoToBS, BS_MONTH_NAMES } from "@/lib/bs-ad";

const s  = (c: string) => styles[c] || c;
const cx = (...cs: Array<string | false | undefined>) => cs.filter(Boolean).join(" ");

const getInitials = (name: string) =>
  (name || "?").split(" ").map((p: string) => p[0]).join("").substring(0, 2).toUpperCase();

// ─── colour maps ─────────────────────────────────────────────────────────────
const TYPE_COLOR:  Record<string, string> = { academic: "#3b5bdb", transport: "#c46a14", hostel: "#7c3aed" };
const TYPE_BG:     Record<string, string> = { academic: "#eef1fd", transport: "#fff4e6", hostel: "#f5f0ff" };
const TYPE_BORDER: Record<string, string> = { academic: "#c5cffa", transport: "#ffd8a8", hostel: "#d9c7fb" };

// ─── tiny components ─────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const t = type || "academic";
  return (
    <span style={{
      fontSize: 10, fontWeight: 900, padding: "2px 9px", borderRadius: 999,
      background: TYPE_BG[t]     || TYPE_BG.academic,
      color:      TYPE_COLOR[t]  || TYPE_COLOR.academic,
      border:     `1px solid ${TYPE_BORDER[t] || TYPE_BORDER.academic}`,
      textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap",
    }}>{t}</span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string, string]> = {
    paid:    ["#ecfdf5", "#059669", "#a7f3d0"],
    partial: ["#fffbeb", "#b45309", "#fde68a"],
    unpaid:  ["#fff1f2", "#be123c", "#fecdd3"],
    waived:  ["#eef1fd", "#3b5bdb", "#c5cffa"],
  };
  const [bg, color, border] = map[status] ?? ["#f8fafc", "#475569", "#e2e8f0"];
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 900,
      textTransform: "capitalize", background: bg, color, border: `1px solid ${border}`,
    }}>{status}</span>
  );
}

function SummaryCard({ label, value, sub, accent, border }: {
  label: string; value: string; sub?: string; accent: string; border: string;
}) {
  return (
    <div style={{ padding: "16px 20px", borderRadius: 12, background: "#fff", border: `1.5px solid ${border}`, flex: 1, minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <strong style={{ fontSize: 22, fontWeight: 900, color: accent, display: "block", margin: "4px 0 2px" }}>{value}</strong>
      {sub && <small style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{sub}</small>}
    </div>
  );
}

// ─── Pending months timeline ──────────────────────────────────────────────────
function buildMonthRange(startYYYYMM: string, endYYYYMM: string): string[] {
  const months: string[] = [];
  let [y, m] = startYYYYMM.split("-").map(Number);
  const [ey, em] = endYYYYMM.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

const SHORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type MonthStatus = "paid" | "partial" | "unbilled" | "pending" | "future";

function PendingTimeline({
  admissionDate,
  collections,
  fmt,
  isBS,
  activeYear,
}: {
  admissionDate: string;
  collections:   any[];
  fmt:           (n: number) => string;
  isBS:          boolean;
  activeYear:    any;
}) {
  const now = new Date();
  
  // Calculate start and end months based on isBS
  const monthItems: Array<{ key: string; label: string; ymList: string[] }> = [];

  if (isBS) {
    const startAD = admissionDate ? new Date(admissionDate) : (activeYear?.start_date ? new Date(activeYear.start_date) : now);
    const endAD   = activeYear?.end_date ? new Date(activeYear.end_date) : now;
    const startBS = adToBS(startAD);
    const endBS   = adToBS(endAD);

    let y = startBS.year, m = startBS.month;
    while (y < endBS.year || (y === endBS.year && m <= endBS.month)) {
      const midIso = bsToISO({ year: y, month: m, day: 15 });
      const [adY, adM] = midIso.split("-").slice(0, 2);
      const adYM = `${adY}-${adM}`;
      const bsKey = `${y}-${String(m).padStart(2, "0")}`;
      const label = `${BS_MONTH_NAMES[m - 1]} '${String(y).slice(-2)}`;
      monthItems.push({ key: bsKey, label, ymList: [adYM, bsKey] });

      if (m === 12) { y++; m = 1; } else m++;
    }
  } else {
    const startDate = admissionDate ? new Date(admissionDate) : now;
    const startYM   = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}`;
    const todayYM   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const allMonths = buildMonthRange(startYM, todayYM);
    for (const ym of allMonths) {
      const [y, m] = ym.split("-").map(Number);
      const label = `${SHORT_MONTHS[m - 1]} '${String(y).slice(-2)}`;
      monthItems.push({ key: ym, label, ymList: [ym] });
    }
  }

  // Check matching collections for each month
  const monthStatuses = monthItems.map(item => {
    const matched = collections.filter((c: any) => {
      const dueYM = c.due_date ? String(c.due_date).slice(0, 7) : null;
      if (dueYM && item.ymList.includes(dueYM)) return true;
      if (c.billing_from_month && c.billing_to_month) {
        return item.ymList.some(ym => ym >= c.billing_from_month && ym <= c.billing_to_month);
      }
      return false;
    });

    if (!matched.length) {
      return { key: item.key, label: item.label, status: "unbilled" as MonthStatus, pending: 0 };
    }

    const pending = matched.reduce((sum, c) => sum + parseFloat(c.remaining_amount || 0), 0);
    const paid    = matched.reduce((sum, c) => sum + parseFloat(c.paid_amount || 0), 0);
    const allPaid = matched.every(c => c.status === "paid" || c.status === "waived" || parseFloat(c.remaining_amount || 0) <= 0.01);
    const hasPartial = matched.some(c => c.status === "partial") || (paid > 0 && pending > 0);

    if (allPaid) return { key: item.key, label: item.label, status: "paid" as MonthStatus, pending: 0 };
    if (hasPartial) return { key: item.key, label: item.label, status: "partial" as MonthStatus, pending };
    return { key: item.key, label: item.label, status: "pending" as MonthStatus, pending };
  });

  const problemMonths = monthStatuses.filter(m => m.status === "pending" || m.status === "unbilled" || m.status === "partial");
  const totalMissingAmount = monthStatuses.reduce((a, m) => a + m.pending, 0);

  const statusColors: Record<MonthStatus, { bg: string; text: string; border: string }> = {
    paid:     { bg: "#dcfce7", text: "#166534", border: "#86efac" },
    partial:  { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
    pending:  { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
    unbilled: { bg: "#f1f5f9", text: "#64748b", border: "#cbd5e1" },
    future:   { bg: "#f8fafc", text: "#94a3b8", border: "#e2e8f0" },
  };

  return (
    <div style={{ padding: "18px 20px", borderRadius: 12, background: "#fff", border: "1.5px solid #e5ebee", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>
            <i className="fa-solid fa-calendar-days" style={{ marginRight: 7, color: "#ff9b51" }} />
            Month-by-Month Timeline
          </h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 600, color: "#6a7882" }}>
            Academic year timeline · {monthItems.length} month{monthItems.length !== 1 ? "s" : ""}
            {problemMonths.length > 0
              ? ` · ${problemMonths.length} month${problemMonths.length !== 1 ? "s" : ""} need attention`
              : " · All months cleared"}
          </p>
        </div>
        {totalMissingAmount > 0 && (
          <span style={{ padding: "5px 14px", borderRadius: 999, background: "#fff1f2", border: "1.5px solid #fecdd3", color: "#be123c", fontSize: 12, fontWeight: 900 }}>
            {fmt(totalMissingAmount)} total pending
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {monthStatuses.map(({ key, label, status, pending }) => {
          const clr = statusColors[status];
          return (
            <div
              key={key}
              title={status === "pending" || status === "partial"
                ? `${label}: ${fmt(pending)} pending`
                : status === "unbilled"
                ? `${label}: Not billed yet`
                : `${label}: Paid`}
              style={{
                padding: "5px 11px", borderRadius: 8,
                background: clr.bg, color: clr.text, border: `1.5px solid ${clr.border}`,
                fontSize: 11, fontWeight: 900, cursor: "default",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {status === "pending"  && <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 9 }} />}
              {status === "partial"  && <i className="fa-solid fa-circle-half-stroke" style={{ fontSize: 9 }} />}
              {status === "paid"     && <i className="fa-solid fa-circle-check"       style={{ fontSize: 9 }} />}
              {status === "unbilled" && <i className="fa-solid fa-circle-dot"         style={{ fontSize: 9 }} />}
              {label}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {([
          ["paid",     "#166534", "#dcfce7", "#86efac", "Paid"],
          ["partial",  "#854d0e", "#fef9c3", "#fde047", "Partial"],
          ["pending",  "#991b1b", "#fee2e2", "#fca5a5", "Unpaid (billed)"],
          ["unbilled", "#64748b", "#f1f5f9", "#cbd5e1", "Not billed"],
        ] as const).map(([, text, bg, border, label]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#6a7882" }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: bg, border: `1.5px solid ${border}`, display: "inline-block" }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Scholarship info strip ───────────────────────────────────────────────────
function ScholarshipStrip({ enrollment }: { enrollment: any }) {
  if (!enrollment?.scholarship_percent || Number(enrollment.scholarship_percent) <= 0) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "10px 18px", borderRadius: 10, background: "#f0fdf4",
      border: "1.5px solid #bbf7d0", marginBottom: 16,
    }}>
      <i className="fa-solid fa-graduation-cap" style={{ color: "#059669", fontSize: 16 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 13, fontWeight: 900, color: "#166534", display: "block" }}>
          {enrollment.scholarship_type || "Scholarship"} · {enrollment.scholarship_percent}% discount
        </strong>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#14532d" }}>
          This student receives a scholarship discount on eligible fee heads. Waived amount appears per bill below.
        </span>
      </div>
    </div>
  );
}

// ─── Fee structure mini-card shown on each billing row ───────────────────────
function StructureTag({ structure }: { structure: any }) {
  if (!structure) return null;
  const freq = (structure.frequency || "").replace("_", " ");
  return (
    <div style={{
      marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 6, background: "#f1f5f9",
      border: "1px solid #e2e8f0", fontSize: 10, fontWeight: 700, color: "#475569",
    }}>
      <i className="fa-solid fa-layer-group" style={{ fontSize: 9, color: "#94a3b8" }} />
      {freq} · {structure.scholarship_applies !== false ? "scholarship applies" : "no scholarship"}
    </div>
  );
}

// ─── Yearly fee clearance check banner ───────────────────────────────────────
// A2 fix: use frequency field from the joined structure, not fee_name substring matching
function YearlyFeesBanner({
  collections,
  feeStructures,
  fmt,
}: {
  collections:  any[];
  feeStructures: Record<number, any>;
  fmt:          (n: number) => string;
}) {
  // A collection is "yearly/one-time" if:
  //   1. Its linked fee structure has frequency = yearly | one_time, OR
  //   2. It has no fee_structure_id but its fee_name contains "annual"/"yearly" (fallback for misc)
  const yearly = collections.filter(c => {
    if (c.fee_structure_id) {
      const struct = feeStructures[c.fee_structure_id];
      return struct && (struct.frequency === "yearly" || struct.frequency === "one_time");
    }
    // fallback for transport/hostel/misc yearly bills that lack a structure
    return (
      c.fee_name?.toLowerCase().includes("annual") ||
      c.fee_name?.toLowerCase().includes("yearly")
    );
  });
  if (yearly.length === 0) return null;

  const allPaid   = yearly.every(c => c.status === "paid" || c.status === "waived");
  const totalDue  = yearly.reduce((a, c) => a + parseFloat(c.remaining_amount || 0), 0);

  if (allPaid) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 18px", borderRadius: 10,
        background: "#ecfdf5", border: "1.5px solid #a7f3d0", marginBottom: 16,
      }}>
        <i className="fa-solid fa-circle-check" style={{ color: "#059669", fontSize: 18 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: "#166534" }}>
          All yearly / one-time fees are cleared for this academic year.
        </span>
      </div>
    );
  }
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "10px 18px", borderRadius: 10,
      background: "#fff7ed", border: "1.5px solid #fed7aa", marginBottom: 16,
    }}>
      <i className="fa-solid fa-triangle-exclamation" style={{ color: "#ea580c", fontSize: 18 }} />
      <div style={{ flex: 1 }}>
        <strong style={{ fontSize: 13, fontWeight: 900, color: "#9a3412", display: "block" }}>
          Yearly / one-time fees not fully cleared — {fmt(totalDue)} outstanding
        </strong>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#7c2d12" }}>
          {yearly.filter(c => c.status !== "paid" && c.status !== "waived").length} annual bill{yearly.length !== 1 ? "s" : ""} pending
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function StudentFeeHistoryPage() {
  const { fmt }                                    = useCurrency();
  const { isBS, formatDate, formatFeeName, billingGroupKey } = useDateFormat();
  const { activeYear, academicYearId }             = useAcademicYear();
  const { data: allYears }                         = useApi<any[]>("/academic-years");
  const searchParams                               = useSearchParams();
  const studentId                                  = searchParams.get("student_id");

  // B5: allow admin to switch year — default to active AY
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  useEffect(() => {
    if (academicYearId && selectedYearId === null) setSelectedYearId(academicYearId);
  }, [academicYearId]);

  const { data: student, loading: studentLoading } = useApi<any>(
    studentId ? `/students/${studentId}` : ""
  );

  // Enrollment for SELECTED AY (holds scholarship info)
  const { data: enrollmentData } = useApi<any>(
    studentId && selectedYearId ? `/students/${studentId}/enrollment?academic_year_id=${selectedYearId}` : ""
  );

  const [payments,      setPayments]      = useState<any[]>([]);
  const [collections,   setCollections]   = useState<any[]>([]);
  const [feeStructures, setFeeStructures] = useState<Record<number, any>>({});
  const [loading,       setLoading]       = useState(false);

  // B5 fix: pass academic_year_id to both fetches
  const fetchData = useCallback(() => {
    if (!studentId || !selectedYearId) return;
    setLoading(true);
    const ayParam = `?academic_year_id=${selectedYearId}`;
    Promise.allSettled([
      apiRequest(`/fees/payments/student/${studentId}`),           // payments have no AY filter endpoint yet — filter client-side below
      apiRequest(`/fees/collections/student/${studentId}${ayParam}`),
    ]).then(async ([payRes, colRes]) => {
      const cols: any[] = colRes.status === "fulfilled"
        ? ((colRes.value as any)?.data ?? colRes.value ?? [])
        : [];
      const allPays: any[] = payRes.status === "fulfilled"
        ? ((payRes.value as any)?.data ?? payRes.value ?? [])
        : [];

      // Filter payments to only those whose collection_id is in the fetched cols
      const colIds = new Set(cols.map((c: any) => c.id));
      const filteredPays = allPays.filter((p: any) => colIds.has(p.collection_id));

      setPayments(filteredPays);
      setCollections(cols);

      // Fetch fee structures for any collection that has a fee_structure_id
      const structureIds = [...new Set(cols.filter(c => c.fee_structure_id).map(c => c.fee_structure_id))] as number[];
      if (structureIds.length > 0) {
        const structMap: Record<number, any> = {};
        await Promise.allSettled(
          structureIds.map(id =>
            apiRequest(`/fees/structures/${id}`)
              .then((res: any) => {
                const s = res?.data ?? res;
                if (s?.id) structMap[s.id] = s;
              })
              .catch(() => {})
          )
        );
        setFeeStructures(structMap);
      } else {
        setFeeStructures({});
      }
    }).finally(() => setLoading(false));
  }, [studentId, selectedYearId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── B6 fix: effectivePaid — waived bill = cash paid only, NOT full net_amount ──
  // A waived bill where the student paid Rs 200 of Rs 500 then got waived:
  //   cashPaid = 200 (correct)
  //   waivedAmt = 300 (the forgiven portion — shown separately, NOT added to paid total)
  // So effectivePaid for summary = paid_amount only, regardless of waive status.
  const effectivePaid = (c: any): number => parseFloat(c.paid_amount || 0);

  // ── Derived totals ──
  const pendingCollections = collections.filter(c => c.status !== "paid" && c.status !== "waived");
  const waivedCollections  = collections.filter(c => c.status === "waived");
  const totalBilled   = collections.reduce((a, c) => a + parseFloat(c.net_amount || c.total_amount || 0), 0);
  const totalPaid     = collections.reduce((a, c) => a + effectivePaid(c), 0);
  // totalWaived = sum of the forgiven portions (net - cashPaid) for waived bills
  const totalWaived   = waivedCollections.reduce((a, c) => {
    const net      = parseFloat(c.net_amount || c.total_amount || 0);
    const cashPaid = parseFloat(c.paid_amount || 0);
    return a + Math.max(0, net - cashPaid);
  }, 0);
  const totalPending  = pendingCollections.reduce((a, c) => a + parseFloat(c.remaining_amount || 0), 0);

  // ── Billing policy (needed for overdue_grace_days before overdueCt) ──
  const { data: billingPolicy } = useApi<any>("/fee-billing-policy");
  const graceDays: number = (billingPolicy?.data ?? billingPolicy)?.overdue_grace_days ?? 0;

  // An unpaid/partial bill is "overdue" only after due_date + grace period
  const isOverdueFn = (dueDate: string, status: string): boolean => {
    if (status === "paid" || status === "waived") return false;
    const due = new Date(dueDate);
    due.setDate(due.getDate() + graceDays);
    return due < new Date();
  };

  const overdueCt     = pendingCollections.filter(c => isOverdueFn(c.due_date, c.status)).length;
  // Progress: (cash paid + waived forgiven portion) / total billed
  const effectivePaidForProgress = totalPaid + totalWaived;
  const paidPct = totalBilled > 0 ? (effectivePaidForProgress / totalBilled) * 100 : 0;

  // ── Group by display month ──
  const collectionsByMonth: Record<string, { key: string; label: string; items: any[] }> = {};
  collections.forEach((c: any) => {
    if (!c.due_date) return;
    const { key, label } = billingGroupKey(c.due_date);
    if (!collectionsByMonth[key]) collectionsByMonth[key] = { key, label, items: [] };
    collectionsByMonth[key].items.push(c);
  });
  const sortedMonthGroups = Object.values(collectionsByMonth).sort((a, b) => b.key.localeCompare(a.key));

  // ── Payment map ──
  const paymentsByCollection: Record<number, any[]> = {};
  payments.forEach((p: any) => {
    if (!paymentsByCollection[p.collection_id]) paymentsByCollection[p.collection_id] = [];
    paymentsByCollection[p.collection_id].push(p);
  });

  // ── Fee type summary ──
  const byType: Record<string, { billed: number; paid: number; waived: number; pending: number }> = {};
  collections.forEach((c: any) => {
    const t = c.fee_type || "academic";
    if (!byType[t]) byType[t] = { billed: 0, paid: 0, waived: 0, pending: 0 };
    const net = parseFloat(c.net_amount || c.total_amount || 0);
    const paid = effectivePaid(c);
    byType[t].billed  += net;
    byType[t].paid    += paid;
    if (c.status === "waived") {
      byType[t].waived += Math.max(0, net - paid);
    }
    byType[t].pending += (c.status === "paid" || c.status === "waived") ? 0 : parseFloat(c.remaining_amount || 0);
  });

  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  useEffect(() => {
    const keysWithPending = new Set<string>();
    pendingCollections.forEach((c: any) => {
      if (c.due_date) keysWithPending.add(billingGroupKey(c.due_date).key);
    });
    if (keysWithPending.size > 0) setExpandedMonths(keysWithPending);
  }, [collections.length]);

  // ── Enrollment from student data or API ──
  const enrollment = enrollmentData?.data ?? enrollmentData ?? student;

  const initials = student ? getInitials(student.full_name || "") : "?";

  if (!studentId) {
    return (
      <div className={s("fees-page")}>
        <main className={s("page-content")}>
          <div style={{ padding: "80px 24px", textAlign: "center", border: "2px dashed #d4dde2", borderRadius: 14, background: "#fff", marginTop: 24 }}>
            <i className="fa-solid fa-user-graduate" style={{ fontSize: 40, color: "#c8d6de", display: "block", marginBottom: 16 }} />
            <strong style={{ fontSize: 16, color: "#1f2d36" }}>No student selected</strong>
            <p style={{ color: "#6a7882", marginTop: 8 }}>Open this page from a student's profile.</p>
            <Link href="/students" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 20, padding: "10px 22px", borderRadius: 9, background: "#1f2d36", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 900 }}>
              <i className="fa-solid fa-users" /> Browse Students
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={s("fees-page")}>
      <main className={s("page-content")}>

        {/* Page header */}
        <section className={s("page-head")}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#ea580c", textTransform: "uppercase", letterSpacing: 0.8, display: "inline-block", marginBottom: 3 }}>
              Student Billing · {student?.admission_number || "History"}
            </span>
            <h1>Fee History</h1>
            <p>Fee structures, scholarship discounts, payment records, and timeline</p>
          </div>
          <div className={s("head-actions")}>
            {/* B5: Academic Year Picker */}
            {allYears && allYears.length > 1 && (
              <select
                value={selectedYearId ?? ""}
                onChange={e => setSelectedYearId(Number(e.target.value))}
                style={{
                  padding: "8px 14px", borderRadius: 9, border: "1.5px solid #d4dde2",
                  fontSize: 13, fontWeight: 700, color: "#1f2d36", background: "#fff",
                  cursor: "pointer",
                }}
              >
                {allYears.map((y: any) => (
                  <option key={y.id} value={y.id}>{y.year_name}</option>
                ))}
              </select>
            )}
            {student && (
              <Link className={cx(s("btn"), s("btn-outline"))} href={`/students/profile?id=${studentId}`}>
                <i className="fa-solid fa-arrow-left" /> Back to Profile
              </Link>
            )}
            {student && (
              <Link className={cx(s("btn"), s("btn-primary"))} href={`/fees/collect?student_id=${studentId}`}>
                <i className="fa-solid fa-money-bill-wave" /> Collect Fee
              </Link>
            )}
          </div>
        </section>

        {/* Year indicator */}
        {activeYear && selectedYearId && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px",
            borderRadius: 8, background: "#eef1fd", border: "1px solid #c5cffa",
            fontSize: 12, fontWeight: 800, color: "#3b5bdb", marginBottom: 16,
          }}>
            <i className="fa-solid fa-calendar-star" style={{ fontSize: 11 }} />
            Viewing: {allYears?.find((y: any) => y.id === selectedYearId)?.year_name ?? activeYear?.year_name}
          </div>
        )}

        {(studentLoading || loading) && (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <Spinner size={32} color="#ff9b51" />
          </div>
        )}

        {!studentLoading && !loading && student && (
          <>
            {/* ── Student identity banner ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "18px 22px", borderRadius: 14, background: "#fff", border: "1.5px solid #e5ebee", marginBottom: 16 }}>
              <div style={{ width: 54, height: 54, borderRadius: 14, flexShrink: 0, background: student.photo ? "transparent" : "#1f2d36", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#ff9b51", overflow: "hidden" }}>
                {student.photo
                  ? <img src={student.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 18, fontWeight: 900, color: "#1f2d36", display: "block" }}>{student.full_name}</strong>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
                  {student.admission_number}
                  {student.class_name   ? ` · Class ${student.class_name}`   : ""}
                  {student.section_name ? ` · Sec ${student.section_name}`   : ""}
                  {student.admission_date
                    ? ` · Joined ${formatDate(String(student.admission_date).slice(0, 10))}`
                    : ""}
                </span>
              </div>
              {totalPending > 0 ? (
                <span style={{ padding: "6px 14px", borderRadius: 999, background: "#fff1f2", color: "#be123c", fontSize: 13, fontWeight: 900, border: "1.5px solid #fecdd3" }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{fmt(totalPending)} pending
                </span>
              ) : collections.length > 0 ? (
                <span style={{ padding: "6px 14px", borderRadius: 999, background: "#ecfdf5", color: "#059669", fontSize: 13, fontWeight: 900, border: "1.5px solid #a7f3d0" }}>
                  <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />All cleared
                </span>
              ) : null}
            </div>

            {/* ── Scholarship strip ── */}
            <ScholarshipStrip enrollment={enrollment} />

            {/* ── Yearly fee banner — A2 fix: uses feeStructures frequency ── */}
            <YearlyFeesBanner collections={collections} feeStructures={feeStructures} fmt={fmt} />

            {/* ── Summary stats ── */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
              <SummaryCard
                label="Total Billed"
                value={fmt(totalBilled)}
                sub={`${collections.length} invoices`}
                accent="#1f2d36"
                border="#d4dde2"
              />
              <SummaryCard
                label="Cash Paid"
                value={fmt(totalPaid)}
                sub={totalWaived > 0
                  ? `${payments.length} payments · ${fmt(totalWaived)} waived`
                  : `${payments.length} payments`}
                accent="#059669"
                border="#a7f3d0"
              />
              <SummaryCard
                label="Pending"
                value={fmt(totalPending)}
                sub={`${pendingCollections.length} unpaid`}
                accent={totalPending > 0 ? "#be123c" : "#059669"}
                border={totalPending > 0 ? "#fecdd3" : "#a7f3d0"}
              />
              {overdueCt > 0 && (
                <SummaryCard
                  label="Overdue"
                  value={`${overdueCt} bill${overdueCt !== 1 ? "s" : ""}`}
                  sub="past due date"
                  accent="#b45309"
                  border="#fde68a"
                />
              )}
            </div>

            {/* ── Overall progress bar ── */}
            {totalBilled > 0 && (
              <div style={{ padding: "14px 20px", borderRadius: 12, background: "#fff", border: "1.5px solid #e5ebee", marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#6a7882" }}>Overall Payment Progress</span>
                  <strong style={{ fontSize: 13, fontWeight: 900, color: paidPct >= 100 ? "#059669" : "#b45309" }}>
                    {paidPct.toFixed(0)}% cleared
                    {totalWaived > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#3b5bdb", marginLeft: 8 }}>(incl. {fmt(totalWaived)} waived)</span>
                    )}
                  </strong>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "#f1f5f9", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, paidPct).toFixed(1)}%`,
                    background: paidPct >= 100 ? "#059669" : "linear-gradient(90deg, #ff9b51, #ea580c)",
                    borderRadius: "inherit",
                    transition: "width .5s ease",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <small style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
                    {fmt(totalPaid)} cash paid{totalWaived > 0 ? ` + ${fmt(totalWaived)} waived` : ""}
                  </small>
                  <small style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>of {fmt(totalBilled)} billed</small>
                </div>
              </div>
            )}

            {/* ── Month-by-month pending timeline ── */}
            {student.admission_date && collections.length > 0 && (
              <PendingTimeline
                admissionDate={String(student.admission_date).slice(0, 10)}
                collections={collections}
                fmt={fmt}
                isBS={isBS}
                activeYear={activeYear}
              />
            )}

            {/* ── Fee breakdown by category ── */}
            {Object.keys(byType).length > 0 && (
              <div style={{ padding: "18px 20px", borderRadius: 12, background: "#fff", border: "1.5px solid #e5ebee", marginBottom: 20 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>Fee Breakdown by Category</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(byType).map(([type, data]) => {
                    const settled = data.paid + (data.waived || 0);
                    const typePct = data.billed > 0 ? (settled / data.billed) * 100 : 0;
                    const isFullySettled = data.pending === 0;
                    const tColor   = isFullySettled ? "#059669" : (TYPE_COLOR[type] || "#475569");
                    const tBorder  = isFullySettled ? "#bbf7d0" : (TYPE_BORDER[type] || "#e2e8f0");
                    const tBg      = isFullySettled ? "#f0fdf4" : (TYPE_BG[type] || "#f8fafc");
                    return (
                      <div key={type} style={{ padding: "12px 16px", borderRadius: 10, border: `1.5px solid ${tBorder}`, background: tBg }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <TypeBadge type={type} />
                            <span style={{ fontSize: 13, fontWeight: 800, color: tColor }}>
                              {type.charAt(0).toUpperCase() + type.slice(1)} Fees
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                            {([
                              { label: "Billed",  val: data.billed,  color: "#1f2d36" },
                              { label: "Paid",    val: data.paid,    color: "#059669" },
                              ...(data.waived > 0 ? [{ label: "Waived", val: data.waived, color: "#3b82f6" }] : []),
                              { label: "Pending", val: data.pending, color: data.pending > 0 ? "#be123c" : "#059669" },
                            ]).map(({ label, val, color }) => (
                              <div key={label} style={{ textAlign: "right" }}>
                                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#6a7882", textTransform: "uppercase" }}>{label}</p>
                                <strong style={{ fontSize: 14, fontWeight: 900, color }}>{fmt(val)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: "#fff", border: `1px solid ${tBorder}`, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(100, typePct).toFixed(1)}%`, background: tColor, borderRadius: "inherit", transition: "width .5s ease" }} />
                        </div>
                        <div style={{ marginTop: 4, textAlign: "right" }}>
                          <small style={{ fontSize: 10, fontWeight: 700, color: tColor }}>
                            {isFullySettled ? "100% cleared" : `${typePct.toFixed(0)}% paid`}
                            {data.waived > 0 && isFullySettled ? ` (incl. ${fmt(data.waived)} waived)` : ""}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Monthly billing records ── */}
            {sortedMonthGroups.length === 0 ? (
              <div style={{ padding: "60px 24px", textAlign: "center", border: "2px dashed #d4dde2", borderRadius: 14, background: "#fff" }}>
                <i className="fa-solid fa-file-invoice" style={{ fontSize: 36, color: "#c8d6de", display: "block", marginBottom: 12 }} />
                <strong style={{ fontSize: 15, color: "#6a7882" }}>No fee records for this academic year</strong>
                <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Bills will appear here once monthly billing is generated for this year.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>Monthly Fee Records</h3>

                {sortedMonthGroups.map((group) => {
                  const isExpanded   = expandedMonths.has(group.key);
                  const monthBilled  = group.items.reduce((a, c) => a + parseFloat(c.net_amount || c.total_amount || 0), 0);
                  const monthPaid    = group.items.reduce((a, c) => a + effectivePaid(c), 0);
                  const monthPending = group.items.reduce((a, c) => a + parseFloat(c.remaining_amount || 0), 0);
                  const allPaid      = monthPending <= 0;
                  const hasOverdue   = group.items.some(c => isOverdueFn(c.due_date, c.status));
                  const monthPct     = monthBilled > 0 ? (monthPaid / monthBilled) * 100 : 0;
                  const borderColor  = hasOverdue ? "#fecdd3" : allPaid ? "#a7f3d0" : "#d4dde2";
                  const headerBg     = hasOverdue ? "#fff8f8" : allPaid ? "#f0fdf4" : "#f8fafc";

                  return (
                    <div key={group.key} style={{ borderRadius: 12, background: "#fff", border: `1.5px solid ${borderColor}`, overflow: "hidden" }}>
                      {/* Month header row (clickable) */}
                      <button
                        onClick={() => toggleMonth(group.key)}
                        style={{ width: "100%", padding: "14px 18px", border: "none", background: headerBg, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left" }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: allPaid ? "#a7f3d0" : hasOverdue ? "#fecdd3" : "#e5ebee", color: allPaid ? "#059669" : hasOverdue ? "#be123c" : "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                          <i className={`fa-solid ${allPaid ? "fa-circle-check" : hasOverdue ? "fa-triangle-exclamation" : "fa-calendar-days"}`} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong style={{ fontSize: 15, fontWeight: 900, color: "#1f2d36", display: "block" }}>{group.label}</strong>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#6a7882" }}>
                            {group.items.length} fee{group.items.length !== 1 ? "s" : ""}
                            {allPaid ? " · All paid" : monthPaid > 0 ? " · Partially paid" : " · Unpaid"}
                            {hasOverdue ? " · Overdue" : ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Billed</p>
                            <strong style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36" }}>{fmt(monthBilled)}</strong>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Paid</p>
                            <strong style={{ fontSize: 14, fontWeight: 900, color: "#059669" }}>{fmt(monthPaid)}</strong>
                          </div>
                          {monthPending > 0 && (
                            <div style={{ textAlign: "right" }}>
                              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>Due</p>
                              <strong style={{ fontSize: 14, fontWeight: 900, color: "#be123c" }}>{fmt(monthPending)}</strong>
                            </div>
                          )}
                        </div>
                        <i className={`fa-solid fa-chevron-${isExpanded ? "up" : "down"}`} style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }} />
                      </button>

                      {/* Progress mini-bar */}
                      {monthBilled > 0 && (
                        <div style={{ padding: "0 18px 2px", background: headerBg, borderBottom: `1px solid ${borderColor}` }}>
                          <div style={{ height: 5, borderRadius: 999, background: "#e5ebee", overflow: "hidden", marginBottom: 8 }}>
                            <div style={{ height: "100%", width: `${Math.min(100, monthPct).toFixed(1)}%`, background: allPaid ? "#059669" : hasOverdue ? "#be123c" : "#ff9b51", borderRadius: "inherit", transition: "width .5s ease" }} />
                          </div>
                        </div>
                      )}

                      {/* Expanded table */}
                      {isExpanded && (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
                            <thead>
                              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                                {["Fee Name / Structure", "Type", "Billed", "Discount", "Cash Paid", "Waived", "Outstanding", "Due Date", "Status", ""].map(h => (
                                  <th key={h} style={{ padding: "9px 13px", textAlign: "left", fontSize: 10, fontWeight: 900, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((c: any, i: number) => {
                                const isOverdue  = isOverdueFn(c.due_date, c.status);
                                const cPays      = paymentsByCollection[c.id] || [];
                                const remaining  = parseFloat(c.remaining_amount || 0);
                                const cashPaid   = parseFloat(c.paid_amount || 0);
                                const net        = parseFloat(c.net_amount || c.total_amount || 0);
                                // B6 fix: waivedAmt = forgiven portion only (net - cash paid when status=waived)
                                const waivedAmt  = c.status === "waived" ? Math.max(0, net - cashPaid) : 0;
                                const structure  = c.fee_structure_id ? feeStructures[c.fee_structure_id] : null;
                                const discountAmt = parseFloat(c.discount_amount || 0);

                                return (
                                  <React.Fragment key={c.id}>
                                    <tr style={{ borderBottom: cPays.length ? "none" : "1px solid #f8fafc", background: i % 2 === 0 ? "#fff" : "#fafcfd" }}>
                                      {/* Fee name + structure tag */}
                                      <td style={{ padding: "11px 13px", fontWeight: 800, color: "#1f2d36", minWidth: 180 }}>
                                        <span style={{ display: "block" }}>{formatFeeName(c.fee_name)}</span>
                                        {isOverdue && (
                                          <span style={{ display: "inline-block", fontSize: 9, fontWeight: 900, color: "#be123c", letterSpacing: 0.5, marginTop: 2 }}>OVERDUE</span>
                                        )}
                                        <StructureTag structure={structure} />
                                        {discountAmt > 0 && c.discount_reason && (
                                          <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#059669", marginTop: 3 }}>
                                            <i className="fa-solid fa-tag" style={{ marginRight: 3 }} />
                                            {c.discount_reason}
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: "11px 13px" }}><TypeBadge type={c.fee_type || "academic"} /></td>
                                      <td style={{ padding: "11px 13px", fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>{fmt(net)}</td>
                                      <td style={{ padding: "11px 13px", fontWeight: 700, whiteSpace: "nowrap", color: discountAmt > 0 ? "#059669" : "#c8d6de" }}>
                                        {discountAmt > 0 ? `-${fmt(discountAmt)}` : "—"}
                                      </td>
                                      <td style={{ padding: "11px 13px", fontWeight: 700, color: "#059669", whiteSpace: "nowrap" }}>{fmt(cashPaid)}</td>
                                      <td style={{ padding: "11px 13px", fontWeight: 700, whiteSpace: "nowrap", color: waivedAmt > 0 ? "#3b5bdb" : "#c8d6de" }}>
                                        {waivedAmt > 0 ? fmt(waivedAmt) : "—"}
                                      </td>
                                      <td style={{ padding: "11px 13px", fontWeight: 900, whiteSpace: "nowrap", color: remaining > 0 ? "#be123c" : "#059669" }}>
                                        {fmt(remaining)}
                                      </td>
                                      <td style={{ padding: "11px 13px", fontSize: 12, fontWeight: 700, color: isOverdue ? "#be123c" : "#6a7882", whiteSpace: "nowrap" }}>
                                        {formatDate(c.due_date?.slice(0, 10))}
                                      </td>
                                      <td style={{ padding: "11px 13px" }}><StatusBadge status={c.status} /></td>
                                      <td style={{ padding: "11px 13px" }}>
                                        {c.status !== "paid" && c.status !== "waived" && (
                                          <Link
                                            href={`/fees/collect?student_id=${studentId}&collection_id=${c.id}`}
                                            style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 6, background: "#ea580c", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                                          >
                                            Pay
                                          </Link>
                                        )}
                                      </td>
                                    </tr>
                                    {/* Payment sub-rows */}
                                    {cPays.map((p: any) => (
                                      <tr key={`pay-${p.id}`} style={{ background: "#f0fdf4", borderBottom: "1px solid #dcfce7" }}>
                                        <td colSpan={2} style={{ padding: "7px 13px 7px 28px", fontSize: 11, fontWeight: 700, color: "#059669" }}>
                                          <i className="fa-solid fa-arrow-turn-down-right" style={{ marginRight: 6, opacity: 0.6 }} />
                                          <Link
                                            href={`/fees/receipt/${p.id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: "#c46a14", fontWeight: 900, textDecoration: "none", fontFamily: "monospace", fontSize: 12 }}
                                          >
                                            {p.receipt_number || `#${p.id}`}
                                          </Link>
                                        </td>
                                        <td colSpan={2} style={{ padding: "7px 13px", fontSize: 11, fontWeight: 700, color: "#6a7882", whiteSpace: "nowrap" }}>
                                          {formatDate(p.payment_date?.slice(0, 10))}
                                        </td>
                                        <td style={{ padding: "7px 13px", fontWeight: 900, color: "#059669", fontSize: 12, whiteSpace: "nowrap" }}>
                                          {fmt(parseFloat(p.paid_amount || 0))}
                                        </td>
                                        <td colSpan={5} style={{ padding: "7px 13px", fontSize: 11, color: "#6a7882", textTransform: "capitalize" }}>
                                          {(p.payment_method || "cash").replace(/_/g, " ")}
                                        </td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#f8fafc", borderTop: "1.5px solid #e5ebee" }}>
                                <td colSpan={2} style={{ padding: "10px 13px", fontSize: 12, fontWeight: 900, color: "#6a7882" }}>
                                  {group.label} Total
                                </td>
                                <td style={{ padding: "10px 13px", fontWeight: 900, color: "#1f2d36", whiteSpace: "nowrap" }}>{fmt(monthBilled)}</td>
                                <td />
                                <td style={{ padding: "10px 13px", fontWeight: 900, color: "#059669", whiteSpace: "nowrap" }}>{fmt(monthPaid)}</td>
                                <td colSpan={5} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}

                      {/* Collect now footer bar */}
                      {monthPending > 0 && (
                        <div style={{ padding: "10px 18px", borderTop: isExpanded ? `1px solid ${borderColor}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#fff" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#6a7882" }}>
                            {fmt(monthPending)} pending in {group.label}
                          </span>
                          <Link
                            href={`/fees/collect?student_id=${studentId}`}
                            style={{ padding: "6px 14px", borderRadius: 8, background: "#ff9b51", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
                          >
                            <i className="fa-solid fa-arrow-up-from-bracket" /> Collect Now
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── All-time summary footer ── */}
            {collections.length > 0 && (
              <div style={{ marginTop: 20, padding: "20px 24px", borderRadius: 14, background: "#fff", border: "1.5px solid #e5ebee", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#6a7882", textTransform: "uppercase", letterSpacing: 0.5 }}>Year Summary</p>
                  <strong style={{ fontSize: 22, fontWeight: 900, color: "#1f2d36", display: "block", marginTop: 4 }}>{fmt(totalPaid)} paid</strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8" }}>
                    {payments.length} payment{payments.length !== 1 ? "s" : ""}
                    {totalWaived > 0 ? ` · ${fmt(totalWaived)} waived` : ""}
                    {" · "}{sortedMonthGroups.length} month{sortedMonthGroups.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {([
                    { label: "Billed",  val: totalBilled,  color: "#1f2d36" },
                    { label: "Paid",    val: totalPaid,    color: "#059669" },
                    { label: "Pending", val: totalPending, color: totalPending > 0 ? "#be123c" : "#059669" },
                  ]).map(({ label, val, color }) => (
                    <div key={label} style={{ textAlign: "right" }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" }}>{label}</p>
                      <strong style={{ fontSize: 16, fontWeight: 900, color }}>{fmt(val)}</strong>
                    </div>
                  ))}
                </div>
                {totalPending > 0 && (
                  <Link
                    href={`/fees/collect?student_id=${studentId}`}
                    style={{ padding: "12px 22px", borderRadius: 10, background: "#ff9b51", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}
                  >
                    <i className="fa-solid fa-money-bill-wave" /> Collect {fmt(totalPending)}
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
