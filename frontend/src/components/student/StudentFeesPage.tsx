"use client";

import { useState, useRef, useCallback } from "react";
import Topbar from "@/components/shared/Topbar";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";

// ── Receipt PDF button — calls backend Azure PDF generation ──────────────────
type BtnState = 'idle' | 'generating' | 'ready' | 'error';

function ReceiptButton({ paymentId }: { paymentId: number }) {
  const [state, setState] = useState<BtnState>('idle');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const openPdf = useCallback((url: string) => {
    setPdfUrl(url);
    setState('ready');
    window.open(url, '_blank', 'noreferrer');
  }, []);

  const startPoll = useCallback((id: number) => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/fees/payments/${id}/receipt-status`, { credentials: 'include' });
        const json = await r.json();
        const { status, url } = json?.data ?? {};
        if (status === 'ready' && url) { stopPoll(); openPdf(url); }
        else if (status === 'failed')  { stopPoll(); setState('error'); }
      } catch { stopPoll(); setState('error'); }
    }, 1500);
  }, [openPdf]);

  const handleClick = useCallback(async () => {
    if (state === 'generating') return;
    // If already ready, just open the cached URL
    if (state === 'ready' && pdfUrl) { window.open(pdfUrl, '_blank', 'noreferrer'); return; }

    setState('generating');
    try {
      const r = await fetch(`/api/fees/payments/${paymentId}/generate-receipt`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = await r.json();
      const { status, url } = json?.data ?? {};
      if (status === 'ready' && url) { openPdf(url); }
      else if (status === 'generating') { startPoll(paymentId); }
      else { setState('error'); }
    } catch { setState('error'); }
  }, [state, pdfUrl, paymentId, openPdf, startPoll]);

  const C_navy = '#1e3a5f';
  const label =
    state === 'generating' ? 'Generating…' :
    state === 'ready'      ? 'Open PDF'    :
    state === 'error'      ? 'Retry'       : 'PDF';
  const icon =
    state === 'generating' ? 'fa-spinner fa-spin' :
    state === 'ready'      ? 'fa-file-pdf'         :
    state === 'error'      ? 'fa-rotate-right'     : 'fa-cloud-arrow-down';
  const bg =
    state === 'error' ? '#b42318' :
    state === 'ready' ? '#15803d' : C_navy;

  return (
    <button
      onClick={handleClick}
      disabled={state === 'generating'}
      title={state === 'ready' ? 'Click to re-open PDF' : 'Generate & download receipt PDF from cloud'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 11px', borderRadius: 7, border: 'none',
        background: bg, color: '#fff',
        fontWeight: 800, fontSize: 11, cursor: state === 'generating' ? 'not-allowed' : 'pointer',
        opacity: state === 'generating' ? 0.75 : 1,
        transition: 'background 0.2s',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      <i className={`fa-solid ${icon}`} style={{ fontSize: 10 }} />
      {label}
    </button>
  );
}

const FONT = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');`;

const C = {
  brand:   "#ff9b51",
  dark:    "#1f2d36",
  mid:     "#6a7882",
  border:  "#dce5e9",
  bg:      "#eef2f3",
  white:   "#ffffff",
  green:   "#059669",
  greenBg: "#ecfdf5",
  red:     "#dc2626",
  redBg:   "#fef2f2",
  light:   "#f8fafc",
  navy:    "#1e3a5f",
};

const fmt = (n: number | string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

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
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <svg width={112} height={112} viewBox="0 0 112 112" style={{ flexShrink: 0 }}>
        <circle cx={cxcy} cy={cxcy} r={r} fill="none" stroke="#e9ecef" strokeWidth={13} />
        {due > 0 && (
          <circle cx={cxcy} cy={cxcy} r={r} fill="none"
            stroke={C.red} strokeWidth={13}
            strokeDasharray={`${dueDash} ${circ - dueDash}`}
            strokeDashoffset={dueOffset}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cxcy}px ${cxcy}px` }}
          />
        )}
        {paid > 0 && (
          <circle cx={cxcy} cy={cxcy} r={r} fill="none"
            stroke={C.green} strokeWidth={13}
            strokeDasharray={`${paidDash} ${circ - paidDash}`}
            strokeDashoffset={0}
            strokeLinecap="butt"
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cxcy}px ${cxcy}px` }}
          />
        )}
        <text x={cxcy} y={cxcy - 5} textAnchor="middle" fill={C.dark} fontSize={18} fontWeight={900} fontFamily="Plus Jakarta Sans, sans-serif">{pct}%</text>
        <text x={cxcy} y={cxcy + 11} textAnchor="middle" fill={C.mid} fontSize={9.5} fontWeight={700} fontFamily="Plus Jakarta Sans, sans-serif">paid</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.green, flexShrink: 0 }} />
          <div>
            <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.mid, lineHeight: "1.2" }}>Paid</span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: C.green, lineHeight: "1.3" }}>{fmt(paid)}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.red, flexShrink: 0 }} />
          <div>
            <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.mid, lineHeight: "1.2" }}>Pending</span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 900, color: C.red, lineHeight: "1.3" }}>{fmt(due)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    paid:    { bg: C.greenBg, color: C.green   },
    partial: { bg: "#fff7ed", color: "#c2410c" },
    unpaid:  { bg: C.redBg,  color: C.red      },
    waived:  { bg: "#eff6ff", color: "#1d4ed8" },
  };
  const st = map[status] ?? map.unpaid;
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: st.bg, color: st.color, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

export default function StudentFeesPage() {
  const { data: collections, loading: colLoading } = useApi<any[]>("/fees/me/collections");
  const { data: payments,    loading: payLoading  } = useApi<any[]>("/fees/me/payments");

  const totalAmount = (collections ?? []).reduce((s, c) => s + Number(c.total_amount    ?? 0), 0);
  const totalPaid   = (collections ?? []).reduce((s, c) => s + Number(c.paid_amount     ?? 0), 0);
  const totalDue    = (collections ?? []).reduce((s, c) => s + Number(c.remaining_amount ?? 0), 0);
  const count       = collections?.length ?? 0;
  const paidCount   = (collections ?? []).filter(c => c.status === "paid").length;

  const loading = colLoading || payLoading;

  return (
    <>
      <style>{FONT}</style>
      <style>{`
        .sf { min-height: 100vh; background: ${C.bg}; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; box-sizing: border-box; }
        .sf *, .sf *::before, .sf *::after { box-sizing: border-box; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif !important; }
        .sf p { margin: 0 !important; font-size: 13px !important; font-weight: 600 !important; text-transform: none !important; letter-spacing: 0 !important; color: ${C.mid}; line-height: 1.4; }
        .sf h1, .sf h2, .sf h3, .sf h4 { margin: 0 !important; font-size: 15px !important; font-weight: 800 !important; text-transform: none !important; letter-spacing: 0 !important; color: ${C.dark}; line-height: 1.3; }
        .sf strong { font-weight: 900; text-transform: none !important; letter-spacing: 0 !important; }
        .sf-main { padding: 14px; max-width: 960px; margin: 0 auto; }
        @media (min-width: 640px) { .sf-main { padding: 22px 26px 44px; } }
        .sf-hero { display: flex; flex-direction: column; gap: 14px; }
        @media (min-width: 580px) { .sf-hero { flex-direction: row; align-items: center; } }
        .sf-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; flex: 1; }
        .sf-card { background: ${C.white}; border-radius: 14px; border: 1px solid ${C.border}; box-shadow: 0 1px 8px rgba(31,45,54,.05); overflow: hidden; }
        .sf-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .sf-table { width: 100%; border-collapse: collapse; }
        .sf-table th { background: ${C.light}; color: ${C.mid} !important; font-size: 11px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0.4px !important; padding: 11px 14px; border-bottom: 1px solid ${C.border}; white-space: nowrap; }
        .sf-table td { padding: 13px 14px; font-size: 13px !important; color: ${C.dark}; border-bottom: 1px solid ${C.border}; font-weight: 600 !important; text-transform: none !important; letter-spacing: 0 !important; }
        .sf-table tbody tr:last-child td { border-bottom: none; }
        .sf-table tbody tr:hover { background: ${C.light}; }
        .sf-method { display: inline-block; padding: 2px 8px; border-radius: 6px; background: ${C.light}; color: ${C.mid} !important; font-size: 10px !important; font-weight: 800 !important; text-transform: uppercase !important; letter-spacing: 0.4px !important; white-space: nowrap; }
        .sf-empty { padding: 2.5rem; text-align: center; color: ${C.mid}; font-size: 13px !important; font-weight: 600 !important; }
        .print-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 7px; border: none; background: ${C.navy}; color: #fff !important; font-weight: 800 !important; font-size: 11px !important; text-decoration: none; cursor: pointer; text-transform: none !important; letter-spacing: 0 !important; }
        .print-btn:hover { background: #2d5a8e; }
      `}</style>

      <div className="sf">
        <Topbar title="My Fees" subtitle="Your fee records and payment receipts" />
        <div className="sf-main">
          {loading ? (
            <div style={{ padding: "4rem", textAlign: "center" }}><Spinner size={32} color={C.brand} /></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Hero ── */}
              <div className="sf-hero">
                <div style={{ flexShrink: 0, padding: "4px 0" }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.mid, textTransform: "uppercase", letterSpacing: 0.4 }}>Fee Overview</span>
                  <div style={{ marginTop: 12 }}>
                    <DonutChart paid={totalPaid} due={totalDue} total={totalAmount || totalPaid + totalDue} />
                  </div>
                </div>
                <div className="sf-stats">
                  {[
                    { icon: "fa-file-invoice-dollar", label: "Total Billed", val: fmt(totalAmount), iconBg: "#fff7ed", iconColor: C.brand   },
                    { icon: "fa-circle-check",        label: "Total Paid",   val: fmt(totalPaid),   iconBg: C.greenBg, iconColor: C.green   },
                    { icon: "fa-hourglass-half",      label: "Pending",      val: fmt(totalDue),    iconBg: C.redBg,   iconColor: C.red     },
                    { icon: "fa-list-check",          label: "Records",      val: `${paidCount}/${count} paid`, iconBg: "#f0f9ff", iconColor: "#0284c7" },
                  ].map(st => (
                    <div key={st.label} className="sf-card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0, background: st.iconBg, color: st.iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                        <i className={`fa-solid ${st.icon}`} />
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: C.mid, textTransform: "uppercase", letterSpacing: 0.4 }}>{st.label}</span>
                        <span style={{ display: "block", fontSize: 14, fontWeight: 900, color: C.dark, marginTop: 2 }}>{st.val}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Fee Collections ── */}
              <div className="sf-card">
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: C.dark }}>Fee Collections</span>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.mid, marginTop: 3 }}>{count} record{count !== 1 ? "s" : ""} this academic year</span>
                </div>
                <div className="sf-table-wrap">
                  <table className="sf-table">
                    <thead>
                      <tr>
                        <th>Fee Name</th>
                        <th>Total</th>
                        <th>Discount</th>
                        <th>Fine</th>
                        <th>Paid</th>
                        <th>Remaining</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(collections ?? []).map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 800, color: C.dark, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.fee_name}</td>
                          <td style={{ fontWeight: 800 }}>{fmt(c.total_amount)}</td>
                          <td style={{ color: C.green, fontWeight: 700 }}>{Number(c.discount_amount) > 0 ? `−${fmt(c.discount_amount)}` : "—"}</td>
                          <td style={{ color: C.red, fontWeight: 700 }}>{Number(c.fine_amount) > 0 ? `+${fmt(c.fine_amount)}` : "—"}</td>
                          <td style={{ color: C.green, fontWeight: 800 }}>{fmt(c.paid_amount)}</td>
                          <td style={{ color: Number(c.remaining_amount) > 0 ? C.red : C.mid, fontWeight: 800 }}>{fmt(c.remaining_amount)}</td>
                          <td><Badge status={c.status} /></td>
                        </tr>
                      ))}
                      {count === 0 && (
                        <tr><td colSpan={7} className="sf-empty">
                          <i className="fa-solid fa-file-invoice-dollar" style={{ display: "block", fontSize: 26, marginBottom: 8, opacity: 0.25 }} />
                          No fee records found.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Payment History with Print Receipts ── */}
              <div className="sf-card">
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 800, color: C.dark }}>
                      <i className="fa-solid fa-receipt" style={{ marginRight: 8, color: C.brand }} />
                      Payment History
                    </span>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.mid, marginTop: 3 }}>
                      {payments?.length ?? 0} payment{(payments?.length ?? 0) !== 1 ? "s" : ""} — click Print to open a receipt
                    </span>
                  </div>
                </div>
                <div className="sf-table-wrap">
                  <table className="sf-table">
                    <thead>
                      <tr>
                        <th>Receipt No.</th>
                        <th>Fee Name</th>
                        <th>Date</th>
                        <th>Amount Paid</th>
                        <th>Method</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payments ?? []).map((p: any) => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 900, color: C.navy }}>{p.receipt_number}</td>
                          <td style={{ fontWeight: 700, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.fee_name || "—"}</td>
                          <td style={{ color: C.mid, whiteSpace: "nowrap" }}>{fmtDate(p.payment_date)}</td>
                          <td style={{ fontWeight: 900, color: C.green }}>{fmt(p.paid_amount)}</td>
                          <td>
                            {p.payment_method
                              ? <span className="sf-method">{p.payment_method.replace(/_/g, " ")}</span>
                              : <span style={{ color: C.mid, fontSize: 12 }}>—</span>}
                          </td>
                          <td>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                               <ReceiptButton paymentId={p.id} />
                               <a
                                 className="print-btn"
                                 href={`/student/fees/receipt/${p.id}`}
                                 target="_blank"
                                 rel="noreferrer"
                                 title="Open printable HTML receipt"
                               >
                                 <i className="fa-solid fa-print" style={{ fontSize: 10 }} />
                                 Print
                               </a>
                             </div>
                           </td>
                        </tr>
                      ))}
                      {!payments?.length && (
                        <tr><td colSpan={6} className="sf-empty">
                          <i className="fa-solid fa-receipt" style={{ display: "block", fontSize: 24, marginBottom: 8, opacity: 0.2 }} />
                          No payments recorded yet.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer note */}
              <div style={{ padding: "11px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", gap: 9, alignItems: "flex-start" }}>
                <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, color: "#c2410c", marginTop: 1, fontSize: 13 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>
                  For any discrepancies in your fee records, please contact your school administration.
                </span>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
