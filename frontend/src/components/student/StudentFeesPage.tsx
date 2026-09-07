"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import Loader, { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency } from "@/lib/useCurrency";

// ── Receipt PDF button ───────────────────────────────────────────────────────
type BtnState = "idle" | "generating" | "ready" | "error";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

function ReceiptButton({ paymentId }: { paymentId: number }) {
  const [state, setState]   = useState<BtnState>("idle");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pollRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPoll(), [stopPoll]);

  const openPdf = useCallback((url: string) => {
    setPdfUrl(url); setState("ready"); window.open(url, "_blank", "noreferrer");
  }, []);

  const startPoll = useCallback((id: number) => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/fees/payments/${id}/receipt-status`, { credentials: "include" });
        if (!r.ok) { stopPoll(); setState("error"); return; }
        const json = await r.json();
        const { status, url } = json?.data ?? {};
        if (status === "ready" && url) { stopPoll(); openPdf(url); }
        else if (status === "failed") { stopPoll(); setState("error"); }
      } catch { stopPoll(); setState("error"); }
    }, 1500);
  }, [openPdf, stopPoll]);

  const handleClick = useCallback(async () => {
    if (state === "generating") return;
    if (state === "ready" && pdfUrl) { window.open(pdfUrl, "_blank", "noreferrer"); return; }
    setState("generating");
    try {
      const r = await fetch(`${API_BASE_URL}/api/fees/payments/${paymentId}/generate-receipt`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) { setState("error"); return; }
      const json = await r.json();
      const { status, url } = json?.data ?? {};
      if (status === "ready" && url) openPdf(url);
      else if (status === "generating") startPoll(paymentId);
      else setState("error");
    } catch { setState("error"); }
  }, [state, pdfUrl, paymentId, openPdf, startPoll]);

  const label = state === "generating" ? "Generating…" : state === "ready" ? "Open PDF" : state === "error" ? "Retry" : "PDF";
  const icon  = state === "generating" ? "fa-spinner fa-spin" : state === "ready" ? "fa-file-pdf" : state === "error" ? "fa-rotate-right" : "fa-cloud-arrow-down";
  const bg    = state === "error" ? "#b42318" : state === "ready" ? "#15803d" : "#1e3a5f";

  return (
    <button onClick={handleClick} disabled={state === "generating"} title={state === "ready" ? "Click to re-open PDF" : "Download receipt PDF"}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "none", background: bg, color: "#fff", fontWeight: 800, fontSize: 11, cursor: state === "generating" ? "not-allowed" : "pointer", opacity: state === "generating" ? 0.75 : 1, transition: "background 0.2s", whiteSpace: "nowrap" as const }}>
      <i className={`fa-solid ${icon}`} style={{ fontSize: 10 }} />{label}
    </button>
  );
}

// ── Badges ──────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, string> = { academic: "#3b5bdb", transport: "#c46a14", hostel: "#7c3aed" };
const TYPE_BG:    Record<string, string> = { academic: "#e8edff", transport: "#fff1df", hostel: "#f3e8ff" };

function TypeBadge({ type }: { type?: string }) {
  const t = type || "academic";
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: TYPE_BG[t] || TYPE_BG.academic, color: TYPE_COLOR[t] || TYPE_COLOR.academic, whiteSpace: "nowrap" as const }}>
      {t.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; c: string }> = {
    paid:    { bg: "#e2f6ee", c: "#12805c" },
    partial: { bg: "#fff7ed", c: "#c2410c" },
    unpaid:  { bg: "#fde7e7", c: "#b42318" },
    waived:  { bg: "#eff6ff", c: "#1d4ed8" },
  };
  const st = map[status] ?? map.unpaid;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.c, textTransform: "capitalize" as const }}>
      {status}
    </span>
  );
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({
  paid,
  due,
  waived = 0,
  total,
  fmt
}: {
  paid: number;
  due: number;
  waived?: number;
  total: number;
  fmt: (n: number | string) => string;
}) {
  const r    = 48;
  const cxcy = 56;
  const circ = 2 * Math.PI * r;

  // When remaining/due is 0, the fees are 100% cleared/settled
  const payableBase = paid + due;
  const pct = due === 0
    ? 100
    : payableBase > 0
      ? Math.max(0, Math.min(100, Math.round((paid / payableBase) * 100)))
      : (total > 0 && due === 0 ? 100 : 0);

  const paidPct  = due === 0 ? 1 : (payableBase > 0 ? paid / payableBase : 0);
  const duePct   = due === 0 ? 0 : (payableBase > 0 ? due / payableBase : 0);
  const paidDash = circ * paidPct;
  const dueDash  = circ * duePct;
  const dueDeg   = paidPct * 360 - 90;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={112} height={112} viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        <circle cx={cxcy} cy={cxcy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={13} />
        {due > 0 && (
          <circle cx={cxcy} cy={cxcy} r={r} fill="none" stroke="#dc2626" strokeWidth={13}
            strokeDasharray={`${dueDash} ${circ - dueDash}`}
            strokeDashoffset={0} strokeLinecap="butt"
            style={{ transform: `rotate(${dueDeg}deg)`, transformOrigin: `${cxcy}px ${cxcy}px` }} />
        )}
        {paidPct > 0 && (
          <circle cx={cxcy} cy={cxcy} r={r} fill="none" stroke="#059669" strokeWidth={13}
            strokeDasharray={`${paidDash} ${circ - paidDash}`}
            strokeDashoffset={0} strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cxcy}px ${cxcy}px` }} />
        )}
        <text x={cxcy} y={cxcy - 5}  textAnchor="middle" fill="#0f172a" fontSize={18} fontWeight={900}>{pct}%</text>
        <text x={cxcy} y={cxcy + 11} textAnchor="middle" fill="#64748b" fontSize={10}  fontWeight={700}>
          {due === 0 ? "cleared" : "paid"}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#059669", flexShrink: 0 }} />
          <div>
            <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#64748b", lineHeight: "1.2" }}>Paid</span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: "#059669", lineHeight: "1.3" }}>{fmt(paid)}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: due > 0 ? "#dc2626" : "#94a3b8", flexShrink: 0 }} />
          <div>
            <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#64748b", lineHeight: "1.2" }}>Pending</span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: due > 0 ? "#dc2626" : "#0f172a", lineHeight: "1.3" }}>{fmt(due)}</span>
          </div>
        </div>

        {waived > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#7c3aed", flexShrink: 0 }} />
            <div>
              <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#64748b", lineHeight: "1.2" }}>Waived</span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 900, color: "#7c3aed", lineHeight: "1.3" }}>{fmt(waived)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentFeesPage() {
  const { formatDate, formatFeeName } = useDateFormat();
  const { fmt } = useCurrency();

  // Read active academic year from Redux
  const activeYear     = useAppSelector(s => s.academicYear?.activeYear);
  const academicYearId = activeYear?.id ?? null;

  const { data: collections, loading: colLoading } = useApi<any[]>(
    academicYearId ? `/fees/me/collections?academic_year_id=${academicYearId}` : "/fees/me/collections"
  );
  const { data: payments, loading: payLoading } = useApi<any[]>("/fees/me/payments");

  const loading = colLoading || payLoading;

  const totalAmount  = (collections ?? []).reduce((s, c) => s + Number(c.total_amount    ?? 0), 0);
  const totalPaid    = (collections ?? []).reduce((s, c) => s + Number(c.paid_amount     ?? 0), 0);
  const totalDue     = (collections ?? []).reduce((s, c) => s + Number(c.remaining_amount ?? 0), 0);
  
  // Calculate total waived amount across all waived records
  const totalWaived  = (collections ?? []).reduce((s, c) => {
    if (c.status === "waived") {
      const netRequired = Math.max(0, Number(c.total_amount || 0) + Number(c.fine_amount || 0) - Number(c.discount_amount || 0));
      const remainingWaived = Math.max(0, netRequired - Number(c.paid_amount || 0));
      return s + remainingWaived;
    }
    return s;
  }, 0);

  const count        = collections?.length ?? 0;
  const settledCount = (collections ?? []).filter(c => c.status === "paid" || c.status === "waived" || Number(c.remaining_amount) === 0).length;
  const overdueCount = (collections ?? []).filter(c => c.status !== "paid" && c.status !== "waived" && Number(c.remaining_amount) > 0 && new Date(c.due_date) < new Date()).length;

  return (
    <>
      <style>{`
        .sfp-page { min-height: 100vh; background: #f8fafc; }
        .sfp-content { padding: 20px 24px 48px; max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
        
        .sfp-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 4px; }
        .sfp-head h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
        .sfp-head p  { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #64748b; }
        
        .sfp-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .sfp-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 800; text-decoration: none; transition: all 0.15s ease; }
        .sfp-btn-primary { background: #ff9148; color: #fff; box-shadow: 0 1px 3px rgba(255,145,72,0.25); }
        .sfp-btn-primary:hover { background: #f07b2f; }
        .sfp-btn-secondary { background: #fff; color: #334155; border: 1px solid #cbd5e1; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .sfp-btn-secondary:hover { background: #f1f5f9; }

        .sfp-card { background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.02); overflow: hidden; }
        .sfp-card-head { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; }
        .sfp-card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        .sfp-card-title { font-size: 14.5px; font-weight: 900; color: #0f172a; display: block; }
        .sfp-card-sub   { font-size: 11.5px; font-weight: 700; color: #64748b; display: block; margin-top: 1px; }
        
        .sfp-hero { display: grid; grid-template-columns: auto 1fr; gap: 24px; align-items: center; padding: 20px; }
        .sfp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .sfp-stat { padding: 12px 14px; border-radius: 10px; border: 1px solid #f1f5f9; background: #fafafa; display: flex; align-items: center; gap: 12px; }
        .sfp-stat-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
        
        .sfp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sfp-table { width: 100%; border-collapse: collapse; }
        .sfp-table th { background: #f8fafc; color: #64748b; font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; text-align: left; }
        .sfp-table td { padding: 13px 16px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9; font-weight: 600; }
        .sfp-table tbody tr:last-child td { border-bottom: none; }
        .sfp-table tbody tr:hover { background: #f8fafc; }
        .sfp-empty { padding: 3rem; text-align: center; color: #64748b; font-size: 13px; font-weight: 700; }
        .sfp-overdue { background: #fff5f5 !important; }

        @media (max-width: 768px) {
          .sfp-content { padding: 14px 12px 32px; gap: 14px; }
          .sfp-head { flex-direction: column; align-items: flex-start; gap: 10px; }
          .sfp-actions { width: 100%; }
          .sfp-btn { flex: 1; justify-content: center; font-size: 12px; padding: 8px 10px; }
          .sfp-hero { grid-template-columns: 1fr; gap: 18px; padding: 16px; }
          .sfp-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
          .sfp-stat { padding: 10px 10px; gap: 8px; }
          .sfp-stat-icon { width: 30px; height: 30px; font-size: 13px; }
        }
        @media (max-width: 480px) {
          .sfp-stats { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="sfp-page">
        <main className="sfp-content">
          
          {/* ── Page Header ── */}
          <section className="sfp-head">
            <div>
              <h1>Fees Overview</h1>
              <p>Track your fee records, discounts, and payment history.</p>
            </div>
            <div className="sfp-actions">
              <Link href="/student/fees/bank-details" className="sfp-btn sfp-btn-primary">
                <i className="fa-solid fa-building-columns" /> School Bank Details
              </Link>
              <Link href="/student/fees/my-submissions" className="sfp-btn sfp-btn-secondary">
                <i className="fa-solid fa-clock-rotate-left" /> My Submissions
              </Link>
            </div>
          </section>

          {loading ? (
            <Loader fullScreen={false} size="md" text="Loading fees & dues…" />
          ) : (
            <>
              {/* ── Hero summary card ── */}
              <div className="sfp-card">
                <div className="sfp-hero">
                  <DonutChart
                    paid={totalPaid}
                    due={totalDue}
                    waived={totalWaived}
                    total={totalAmount || (totalPaid + totalDue)}
                    fmt={fmt}
                  />
                  
                  <div className="sfp-stats">
                    {[
                      { icon: "fa-file-invoice-dollar", label: "Total Billed", val: fmt(totalAmount), iconBg: "#fff7ed", iconColor: "#ff9148" },
                      { icon: "fa-circle-check", label: "Total Paid", val: fmt(totalPaid), iconBg: "#e2f6ee", iconColor: "#059669" },
                      { icon: "fa-hourglass-half", label: "Pending", val: fmt(totalDue), iconBg: totalDue > 0 ? "#fde7e7" : "#f1f5f9", iconColor: totalDue > 0 ? "#dc2626" : "#64748b" },
                      { icon: "fa-list-check", label: "Records", val: `${settledCount}/${count} paid`, iconBg: "#eff6ff", iconColor: "#3b5bdb" },
                    ].map(st => (
                      <div key={st.label} className="sfp-stat">
                        <div className="sfp-stat-icon" style={{ background: st.iconBg, color: st.iconColor }}>
                          <i className={`fa-solid ${st.icon}`} />
                        </div>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: 0.4, display: "block" }}>
                            {st.label}
                          </span>
                          <span style={{ fontSize: 14.5, fontWeight: 900, color: "#0f172a", display: "block", marginTop: 2 }}>
                            {st.val}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {overdueCount > 0 && (
                  <div style={{ margin: "0 18px 18px", padding: "11px 14px", borderRadius: 9, background: "#fff5f5", border: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10, color: "#b42318" }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 14, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                      You have {overdueCount} overdue fee{overdueCount > 1 ? "s" : ""}. Please contact the school office to clear them.
                    </span>
                  </div>
                )}

                {activeYear && (
                  <div style={{ margin: "0 18px 18px", padding: "10px 14px", borderRadius: 9, background: "#f0f9ff", border: "1px solid #bae6fd", display: "flex", alignItems: "center", gap: 9, color: "#0369a1" }}>
                    <i className="fa-solid fa-calendar-check" style={{ fontSize: 13, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                      Showing fees for Academic Year: <strong style={{ color: "#0c4a6e" }}>{activeYear.year_name}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* ── Fee Collections table ── */}
              <div className="sfp-card">
                <div className="sfp-card-head">
                  <div className="sfp-card-icon" style={{ background: "#fff1df", color: "#ff9148" }}>
                    <i className="fa-solid fa-file-invoice-dollar" />
                  </div>
                  <div>
                    <span className="sfp-card-title">Fee Collections</span>
                    <span className="sfp-card-sub">{count} record{count !== 1 ? "s" : ""} this academic year</span>
                  </div>
                </div>
                
                <div className="sfp-table-wrap">
                  <table className="sfp-table">
                    <thead>
                      <tr>
                        <th>Fee Name</th>
                        <th>Type</th>
                        <th>Due Date</th>
                        <th>Total</th>
                        <th>Discount</th>
                        <th>Fine</th>
                        <th>Paid</th>
                        <th>Remaining</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(collections ?? []).map(c => {
                        const isOverdue = c.status !== "paid" && c.status !== "waived" && new Date(c.due_date) < new Date();
                        return (
                          <tr key={c.id} className={isOverdue ? "sfp-overdue" : ""}>
                            <td style={{ fontWeight: 800, color: "#0f172a", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {formatFeeName(c.fee_name)}
                              {isOverdue && <span style={{ display: "block", fontSize: 9.5, color: "#b42318", fontWeight: 800, marginTop: 1 }}>OVERDUE</span>}
                            </td>
                            <td><TypeBadge type={c.fee_type} /></td>
                            <td style={{ color: isOverdue ? "#b42318" : "#64748b", fontWeight: 700, whiteSpace: "nowrap" as const }}>
                              {formatDate(c.due_date?.slice(0, 10))}
                            </td>
                            <td style={{ fontWeight: 800 }}>{fmt(c.total_amount)}</td>
                            <td style={{ color: "#059669", fontWeight: 700 }}>{Number(c.discount_amount) > 0 ? `−${fmt(c.discount_amount)}` : "—"}</td>
                            <td style={{ color: "#b42318", fontWeight: 700 }}>{Number(c.fine_amount) > 0 ? `+${fmt(c.fine_amount)}` : "—"}</td>
                            <td style={{ color: "#059669", fontWeight: 800 }}>{fmt(c.paid_amount)}</td>
                            <td style={{ color: Number(c.remaining_amount) > 0 ? "#b42318" : "#64748b", fontWeight: 800 }}>{fmt(c.remaining_amount)}</td>
                            <td><StatusBadge status={c.status} /></td>
                          </tr>
                        );
                      })}
                      {count === 0 && (
                        <tr>
                          <td colSpan={9} className="sfp-empty">
                            <i className="fa-solid fa-file-invoice-dollar" style={{ display: "block", fontSize: 28, marginBottom: 8, opacity: 0.3 }} />
                            No fee records for this academic year.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Payment History ── */}
              <div className="sfp-card">
                <div className="sfp-card-head">
                  <div className="sfp-card-icon" style={{ background: "#e8edff", color: "#3b5bdb" }}>
                    <i className="fa-solid fa-receipt" />
                  </div>
                  <div>
                    <span className="sfp-card-title">Payment History</span>
                    <span className="sfp-card-sub">{payments?.length ?? 0} payment{(payments?.length ?? 0) !== 1 ? "s" : ""} recorded</span>
                  </div>
                </div>

                <div className="sfp-table-wrap">
                  <table className="sfp-table">
                    <thead>
                      <tr>
                        <th>Receipt No.</th>
                        <th>Fee Name</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments ?? []).map((p: any) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 900, color: "#1e3a5f" }}>{p.receipt_number}</td>
                          <td style={{ fontWeight: 700, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {formatFeeName(p.fee_name)}
                          </td>
                          <td><TypeBadge type={p.fee_type} /></td>
                          <td style={{ color: "#64748b", whiteSpace: "nowrap" as const }}>{formatDate(p.payment_date?.slice(0, 10))}</td>
                          <td style={{ fontWeight: 900, color: "#059669" }}>{fmt(p.paid_amount)}</td>
                          <td>
                            {p.payment_method ? (
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
                                {p.payment_method.replace(/_/g, " ")}
                              </span>
                            ) : "—"}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <ReceiptButton paymentId={p.id} />
                              <a href={`/student/fees/receipt/${p.id}`} target="_blank" rel="noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 7, border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 800, fontSize: 11, textDecoration: "none", whiteSpace: "nowrap" as const }}>
                                <i className="fa-solid fa-print" style={{ fontSize: 10 }} /> Print
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!payments?.length && (
                        <tr>
                          <td colSpan={7} className="sfp-empty">
                            <i className="fa-solid fa-receipt" style={{ display: "block", fontSize: 26, marginBottom: 8, opacity: 0.3 }} />
                            No payments recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer note */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, color: "#c2410c", marginTop: 2, fontSize: 13 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e", lineHeight: 1.5 }}>
                  For any discrepancies in your fee records, please contact your school administration.
                </span>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
