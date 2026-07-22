"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { useAppSelector } from "@/store/hooks";

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

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d?: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

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
    <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.c, textTransform: "capitalize" as const }}>
      {status}
    </span>
  );
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ paid, due, total }: { paid: number; due: number; total: number }) {
  const r     = 48;
  const cxcy  = 56;
  const circ  = 2 * Math.PI * r;
  const paidPct  = total > 0 ? paid / total : 0;
  const duePct   = total > 0 ? due  / total : (due > 0 ? 1 : 0);
  const paidDash = circ * paidPct;
  const dueDash  = circ * duePct;
  const dueOffset = circ * (1 - paidPct);
  const pct = total > 0 ? Math.round((paid / total) * 100) : (due === 0 ? 100 : 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg width={112} height={112} viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        <circle cx={cxcy} cy={cxcy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={13} />
        {due > 0 && (
          <circle cx={cxcy} cy={cxcy} r={r} fill="none" stroke="#dc2626" strokeWidth={13}
            strokeDasharray={`${dueDash} ${circ - dueDash}`}
            strokeDashoffset={dueOffset} strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cxcy}px ${cxcy}px` }} />
        )}
        {paid > 0 && (
          <circle cx={cxcy} cy={cxcy} r={r} fill="none" stroke="#059669" strokeWidth={13}
            strokeDasharray={`${paidDash} ${circ - paidDash}`}
            strokeDashoffset={0} strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cxcy}px ${cxcy}px` }} />
        )}
        <text x={cxcy} y={cxcy - 5}  textAnchor="middle" fill="#1e293b" fontSize={18} fontWeight={900}>{pct}%</text>
        <text x={cxcy} y={cxcy + 11} textAnchor="middle" fill="#94a3b8" fontSize={10}  fontWeight={700}>paid</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[
          { dot: "#059669", label: "Paid",    val: fmt(paid), valColor: "#059669" },
          { dot: "#dc2626", label: "Pending", val: fmt(due),  valColor: "#dc2626" },
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: item.dot, flexShrink: 0 }} />
            <div>
              <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#94a3b8", lineHeight: "1.2" }}>{item.label}</span>
              <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: item.valColor, lineHeight: "1.3" }}>{item.val}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentFeesPage() {
  // Read active academic year from Redux (populated by NoActiveYearGuard)
  const activeYear   = useAppSelector(s => s.academicYear?.activeYear);
  const academicYearId = activeYear?.id ?? null;

  const { data: collections, loading: colLoading } = useApi<any[]>(
    academicYearId ? `/fees/me/collections?academic_year_id=${academicYearId}` : "/fees/me/collections"
  );
  const { data: payments, loading: payLoading } = useApi<any[]>("/fees/me/payments");

  const loading = colLoading || payLoading;

  const totalAmount = (collections ?? []).reduce((s, c) => s + Number(c.total_amount    ?? 0), 0);
  const totalPaid   = (collections ?? []).reduce((s, c) => s + Number(c.paid_amount     ?? 0), 0);
  const totalDue    = (collections ?? []).reduce((s, c) => s + Number(c.remaining_amount ?? 0), 0);
  const count       = collections?.length ?? 0;
  const paidCount   = (collections ?? []).filter(c => c.status === "paid").length;
  const overdueCount = (collections ?? []).filter(c => c.status !== "paid" && c.status !== "waived" && new Date(c.due_date) < new Date()).length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        .sfp *, .sfp *::before, .sfp *::after { box-sizing: border-box; font-family: 'Plus+Jakarta+Sans', -apple-system, sans-serif; }
        .sfp { min-height: 100vh; background: #eef2f3; }
        .sfp-main { padding: 20px; max-width: 1020px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
        .sfp-card { background: #fff; border-radius: 14px; border: 1px solid #dce5e9; box-shadow: 0 2px 12px rgba(31,45,54,.05); overflow: hidden; }
        .sfp-card-head { padding: 14px 18px; border-bottom: 1px solid #eef2f3; display: flex; align-items: center; gap: 12px; }
        .sfp-card-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .sfp-card-title { font-size: 14px; font-weight: 900; color: #1f2d36; display: block; }
        .sfp-card-sub   { font-size: 11px; font-weight: 700; color: #6a7882; display: block; margin-top: 1px; }
        .sfp-hero { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: center; padding: 20px; }
        .sfp-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .sfp-stat { padding: 13px 14px; border-radius: 10px; border: 1px solid #dce5e9; display: flex; align-items: center; gap: 10px; }
        .sfp-stat-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
        .sfp-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sfp-table { width: 100%; border-collapse: collapse; }
        .sfp-table th { background: #f7fafb; color: #6a7882; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; padding: 11px 14px; border-bottom: 1px solid #dce5e9; white-space: nowrap; text-align: left; }
        .sfp-table td { padding: 13px 14px; font-size: 13px; color: #1f2d36; border-bottom: 1px solid #eef2f3; font-weight: 600; }
        .sfp-table tbody tr:last-child td { border-bottom: none; }
        .sfp-table tbody tr:hover { background: #f7fafb; }
        .sfp-empty { padding: 3rem; text-align: center; color: #94a3b8; font-size: 13px; font-weight: 700; }
        .sfp-overdue { background: #fff5f5 !important; }
        @media (max-width: 680px) {
          .sfp-hero { grid-template-columns: 1fr; }
          .sfp-main { padding: 14px; gap: 12px; }
        }
      `}</style>

      <div className="sfp">
        <Topbar title="My Fees" subtitle="Your fee records and payment history" />

        <div className="sfp-main">
          {loading ? (
            <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color="#FF9B51" /></div>
          ) : (
            <>
              {/* ── Hero summary ── */}
              <div className="sfp-card">
                <div className="sfp-hero">
                  <DonutChart paid={totalPaid} due={totalDue} total={totalAmount || (totalPaid + totalDue)} />
                  <div className="sfp-stats">
                    {[
                      { icon: "fa-file-invoice-dollar", label: "Total Billed",   val: fmt(totalAmount),                            iconBg: "#fff7ed", iconColor: "#FF9B51" },
                      { icon: "fa-circle-check",        label: "Total Paid",     val: fmt(totalPaid),                              iconBg: "#e2f6ee", iconColor: "#059669" },
                      { icon: "fa-hourglass-half",      label: "Pending",        val: fmt(totalDue),                               iconBg: "#fde7e7", iconColor: "#dc2626" },
                      { icon: "fa-list-check",          label: "Records",        val: `${paidCount}/${count} paid`,                iconBg: "#eff6ff", iconColor: "#3b5bdb" },
                    ].map(st => (
                      <div key={st.label} className="sfp-stat">
                        <div className="sfp-stat-icon" style={{ background: st.iconBg, color: st.iconColor }}>
                          <i className={`fa-solid ${st.icon}`} />
                        </div>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: 0.4, display: "block" }}>{st.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#1f2d36", display: "block", marginTop: 2 }}>{st.val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {overdueCount > 0 && (
                  <div style={{ margin: "0 18px 18px", padding: "11px 14px", borderRadius: 9, background: "#fff5f5", border: "1px solid #fecaca", display: "flex", alignItems: "center", gap: 10, color: "#b42318" }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 14, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 800 }}>
                      You have {overdueCount} overdue fee{overdueCount > 1 ? "s" : ""}. Please contact the admin to clear them.
                    </span>
                  </div>
                )}
                {activeYear && (
                  <div style={{ margin: "0 18px 18px", padding: "10px 13px", borderRadius: 9, background: "#f0f9ff", border: "1px solid #bae6fd", display: "flex", alignItems: "center", gap: 9, color: "#0369a1" }}>
                    <i className="fa-solid fa-calendar-check" style={{ fontSize: 13, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>Showing fees for Academic Year: <strong>{activeYear.year_name}</strong></span>
                  </div>
                )}
              </div>

              {/* ── Fee Collections table ── */}
              <div className="sfp-card">
                <div className="sfp-card-head">
                  <div className="sfp-card-icon" style={{ background: "#fff1df", color: "#FF9B51" }}>
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
                            <td style={{ fontWeight: 800, color: "#1f2d36", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                              {c.fee_name}
                              {isOverdue && <span style={{ display: "block", fontSize: 10, color: "#b42318", fontWeight: 800 }}>OVERDUE</span>}
                            </td>
                            <td><TypeBadge type={c.fee_type} /></td>
                            <td style={{ color: isOverdue ? "#b42318" : "#6a7882", fontWeight: 700, whiteSpace: "nowrap" as const }}>{fmtDate(c.due_date?.slice(0,10))}</td>
                            <td style={{ fontWeight: 800 }}>{fmt(c.total_amount)}</td>
                            <td style={{ color: "#059669", fontWeight: 700 }}>{Number(c.discount_amount) > 0 ? `−${fmt(c.discount_amount)}` : "—"}</td>
                            <td style={{ color: "#b42318", fontWeight: 700 }}>{Number(c.fine_amount) > 0 ? `+${fmt(c.fine_amount)}` : "—"}</td>
                            <td style={{ color: "#059669", fontWeight: 800 }}>{fmt(c.paid_amount)}</td>
                            <td style={{ color: Number(c.remaining_amount) > 0 ? "#b42318" : "#94a3b8", fontWeight: 800 }}>{fmt(c.remaining_amount)}</td>
                            <td><StatusBadge status={c.status} /></td>
                          </tr>
                        );
                      })}
                      {count === 0 && (
                        <tr>
                          <td colSpan={9} className="sfp-empty">
                            <i className="fa-solid fa-file-invoice-dollar" style={{ display: "block", fontSize: 28, marginBottom: 8, opacity: 0.2 }} />
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
                          <td style={{ fontWeight: 700, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{p.fee_name || "—"}</td>
                          <td><TypeBadge type={p.fee_type} /></td>
                          <td style={{ color: "#6a7882", whiteSpace: "nowrap" as const }}>{fmtDate(p.payment_date)}</td>
                          <td style={{ fontWeight: 900, color: "#059669" }}>{fmt(p.paid_amount)}</td>
                          <td>
                            {p.payment_method ? (
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, background: "#f7fafb", color: "#6a7882", fontSize: 10, fontWeight: 800, textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
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
                            <i className="fa-solid fa-receipt" style={{ display: "block", fontSize: 26, marginBottom: 8, opacity: 0.2 }} />
                            No payments recorded yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer note */}
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 9, alignItems: "flex-start" }}>
                <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, color: "#c2410c", marginTop: 1, fontSize: 13 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                  For any discrepancies in your fee records, please contact your school administration.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
