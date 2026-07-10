"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { Spinner } from "@/components/shared/Loader";
import { amountToWords } from "@/lib/amountToWords";

// ── Azure PDF download button ───────────────────────────────────────────────
type AzureBtnState = 'idle' | 'generating' | 'ready' | 'error';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

function AzureReceiptButton({ paymentId }: { paymentId: string | number }) {
  const [st, setSt]       = useState<AzureBtnState>('idle');
  const [url, setUrl]     = useState<string | null>(null);
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => { 
    if (pollRef.current) { 
      clearInterval(pollRef.current); 
      pollRef.current = null; 
    } 
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPoll();
    };
  }, [stopPoll]);

  const openPdf = useCallback((pdfUrl: string) => {
    setUrl(pdfUrl); setSt('ready');
    window.open(pdfUrl, '_blank', 'noreferrer');
  }, []);

  const startPoll = useCallback((id: string | number) => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/fees/payments/${id}/receipt-status`, { 
          credentials: 'include' 
        });

        if (!r.ok) {
          stopPoll(); 
          setSt('error'); 
          return;
        }

        const json = await r.json();
        const { status, url: pdfUrl } = json?.data ?? {};
        if (status === 'ready' && pdfUrl) { stopPoll(); openPdf(pdfUrl); }
        else if (status === 'failed')     { stopPoll(); setSt('error'); }
      } catch { 
        stopPoll(); 
        setSt('error'); 
      }
    }, 1500);
  }, [openPdf, stopPoll]);

  const handleClick = useCallback(async () => {
    if (st === 'generating') return;
    if (st === 'ready' && url) { window.open(url, '_blank', 'noreferrer'); return; }
    
    setSt('generating');
    try {
      const r = await fetch(`${API_BASE_URL}/api/fees/payments/${paymentId}/generate-receipt`, { 
        method: 'POST', 
        credentials: 'include' 
      });

      if (!r.ok) {
        setSt('error');
        return;
      }

      const json = await r.json();
      const { status, url: pdfUrl } = json?.data ?? {};
      if (status === 'ready' && pdfUrl) { openPdf(pdfUrl); }
      else if (status === 'generating') { startPoll(paymentId); }
      else { setSt('error'); }
    } catch { 
      setSt('error'); 
    }
  }, [st, url, paymentId, openPdf, startPoll]);

  const label = st === 'generating' ? 'Generating…' : st === 'ready' ? 'Open PDF Again' : st === 'error' ? 'Retry PDF' : 'Download PDF';
  const icon  = st === 'generating' ? 'fa-spinner fa-spin' : st === 'ready' ? 'fa-file-pdf' : st === 'error' ? 'fa-rotate-right' : 'fa-cloud-arrow-down';
  const bg    = st === 'error' ? '#b42318' : st === 'ready' ? '#15803d' : '#1e3a5f';

  return (
    <button
      onClick={handleClick}
      disabled={st === 'generating'}
      title="Generate and download receipt PDF via Azure"
      style={{ padding: '9px 22px', background: bg, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: st === 'generating' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', opacity: st === 'generating' ? 0.75 : 1, transition: 'background 0.2s' }}
    >
      <i className={`fa-solid ${icon}`} />
      {label}
    </button>
  );
}

interface Props { paymentId: string | number; }

const fmt = (n: number | string) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const NOTES = [
  "Fees paid through cheque/demand draft are subject to clearing.",
  "If the cheque/draft is dishonoured by the bank due to any reason, a penalty will be charged as per school fee policy along with late fee payment and bank charges as applicable.",
  "The fee paid is NON-TRANSFERABLE / NON-REFUNDABLE. (Subject to management decision)",
  "This is a system generated receipt and does not require a signature.",
  "On confirmation of admission, this will be considered as a part of Tuition fees.",
];

export default function FeeReceiptPage({ paymentId }: Props) {
  const { data: receipt, loading, error } = useApi<any>(`/fees/payments/${paymentId}`);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Spinner size={36} color="#cc0000" />
    </div>
  );

  if (error || !receipt) return (
    <div style={{ padding: "3rem", textAlign: "center", color: "#b42318", fontWeight: 700 }}>
      <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
      {error || "Receipt not found."}
    </div>
  );

  const hasDiscount = Number(receipt.discount_amount) > 0;
  const hasFine     = Number(receipt.fine_amount) > 0;
  const netAmount   = Number(receipt.paid_amount);

  // Gender prefix
  const genderPrefix = receipt.gender === "female" ? "MS." : "MR.";

  // Class + Section label (e.g. "Class 1 - A")
  const classSection = [receipt.class_name, receipt.section_name]
    .filter(Boolean)
    .join(" - ") || "—";

  // School address composed
  const schoolAddress = [receipt.school_city].filter(Boolean).join(", ") || "";

  // Receipt number: use stored one or generate from payment_id
  const receiptNo = receipt.receipt_number || `REC-${String(paymentId).padStart(6, "0")}`;

  // Split receipt_number for display (e.g. "RCP-000023" → just show as is)
  const yearCode = receipt.year_name || new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);

  return (
    <>
      {/* ── Print button (hidden on print) ── */}
      <div className="receipt-no-print" style={{ padding: "16px 32px", display: "flex", gap: 12, alignItems: "center", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", flexWrap: "wrap" }}>
        {/* Azure cloud PDF — generate via backend */}
        <AzureReceiptButton paymentId={paymentId} />

        {/* Browser print / save as PDF */}
        <button
          onClick={handlePrint}
          style={{ padding: "9px 22px", background: "#cc0000", color: "#fff", border: "none", borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit" }}
        >
          <i className="fa-solid fa-print" /> Print / Save as PDF
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7b86" }}>
          "Download PDF" generates a cloud receipt &nbsp;·&nbsp; "Print" uses browser print dialog
        </span>
      </div>

      {/* ── Receipt wrapper ── */}
      <div ref={printRef} className="receipt-wrap">
        <style>{`
          @media print {
            .receipt-no-print { display: none !important; }
            body { margin: 0; padding: 0; }
            .receipt-wrap { box-shadow: none !important; margin: 0 !important; border: none !important; }
          }

          .receipt-wrap {
            max-width: 820px;
            margin: 28px auto;
            background: #fff;
            box-shadow: 0 4px 32px rgba(0,0,0,0.12);
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 13px;
            color: #000;
          }

          .receipt-inner {
            padding: 36px 48px 40px;
          }

          /* ── Header ── */
          .rh { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; }
          .rh-left { display: flex; align-items: flex-start; gap: 14px; }
          .rh-logo { width: 70px; height: 70px; border-radius: 12px; overflow: hidden; flex-shrink: 0; }
          .rh-logo img { width: 100%; height: 100%; object-fit: cover; }
          .rh-logo-initials {
            width: 100%; height: 100%;
            background: linear-gradient(135deg, #cc0000, #ff6600);
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; color: #fff; font-weight: 900; border-radius: 12px;
          }
          .rh-logo-initials span { font-size: 22px; line-height: 1.1; }
          .rh-logo-initials small { font-size: 9px; letter-spacing: 0.5px; opacity: 0.85; font-weight: 700; }
          .rh-school-left { display: flex; flex-direction: column; justify-content: center; }
          .rh-school-left .name-line { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.5; }
          .rh-right { text-align: center; }
          .rh-right .school-title { font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .rh-right .school-addr { font-size: 11.5px; color: #333; }

          /* ── Divider ── */
          .rdiv { border: 0; border-top: 1.5px solid #000; margin: 6px 0; }
          .rdiv-thin { border: 0; border-top: 0.5px solid #666; margin: 5px 0; }

          /* ── Row fields ── */
          .rrow { display: flex; align-items: center; flex-wrap: wrap; gap: 0; margin: 7px 0; }
          .rfield { display: flex; align-items: baseline; gap: 0; }
          .rfield-lbl { font-weight: 700; white-space: nowrap; }
          .rfield-sep { margin: 0 4px; font-weight: 700; }
          .rfield-val { border-bottom: 1px solid #000; min-width: 120px; padding: 0 4px; font-weight: 400; }
          .rfield-spacer { flex: 1; }
          .rname-row { display: flex; align-items: baseline; gap: 0; margin: 7px 0; }
          .rname-lbl { font-weight: 700; white-space: nowrap; }
          .rname-val { border-bottom: 1px solid #000; flex: 1; padding: 0 6px; font-weight: 700; letter-spacing: 0.3px; }
          .rdept-row { display: flex; align-items: baseline; margin: 7px 0; gap: 0; }
          .rdept-lbl { font-weight: 700; white-space: nowrap; flex-shrink: 0; }
          .rdept-val { border-bottom: 1px solid #000; flex: 1; padding: 0 6px; }
          .rsem-lbl  { font-weight: 700; white-space: nowrap; margin-left: 32px; flex-shrink: 0; }
          .rsem-val  { border-bottom: 1px solid #000; min-width: 100px; padding: 0 6px; }

          /* ── Table ── */
          .rtable { width: 100%; border-collapse: collapse; margin: 14px 0 10px; }
          .rtable th { border: 1px solid #000; padding: 7px 10px; font-weight: 700; text-align: center; background: #fff; font-size: 13px; }
          .rtable td { border: 1px solid #000; padding: 6px 10px; }
          .rtable .td-sr { text-align: center; width: 64px; }
          .rtable .td-amt { text-align: right; width: 130px; }
          .rtable .td-total { border-top: 1.5px solid #000; font-weight: 900; text-align: right; }
          .rtable .no-border-left  { border-left: 0; }
          .rtable .no-border-right { border-right: 0; }

          /* ── Footer rows ── */
          .rfrow { display: flex; align-items: baseline; margin: 8px 0; gap: 0; }
          .rfrow-lbl { font-weight: 700; white-space: nowrap; flex-shrink: 0; }
          .rfrow-sep { margin: 0 4px; font-weight: 700; }
          .rfrow-val { border-bottom: 1px solid #000; flex: 1; padding: 0 6px; max-width: 400px; }
          .rfrow-date-lbl { font-weight: 700; margin-left: 24px; white-space: nowrap; }
          .rfrow-date-val { border-bottom: 1px solid #000; min-width: 100px; padding: 0 6px; }

          /* ── Notes ── */
          .rnotes { margin-top: 18px; }
          .rnotes-title { font-weight: 700; text-decoration: underline; margin-bottom: 6px; }
          .rnotes ol { margin: 0; padding-left: 18px; }
          .rnotes li { margin-bottom: 4px; font-size: 12px; line-height: 1.5; }

          /* ── Footer ── */
          .rfooter { text-align: center; font-size: 11.5px; font-style: italic; margin-top: 22px; color: #444; border-top: 0.5px solid #999; padding-top: 10px; }
        `}</style>

        <div className="receipt-inner">
          {/* ═══ HEADER ═══ */}
          <div className="rh">
            {/* Left — logo + school name stacked */}
            <div className="rh-left">
              <div className="rh-logo">
                {receipt.school_logo ? (
                  <img src={receipt.school_logo} alt={receipt.school_name} />
                ) : (
                  <div className="rh-logo-initials">
                    {(receipt.school_name || "SC").split(" ").map((w: string) => w[0]).join("").slice(0, 3).split("").map((ch: string, i: number) => (
                      <span key={i}>{ch}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="rh-school-left">
                {(receipt.school_name || "School Name")
                  .split(" ")
                  .reduce((acc: string[][], word: string, i: number) => {
                    const chunk = Math.floor(i / 2);
                    if (!acc[chunk]) acc[chunk] = [];
                    acc[chunk].push(word);
                    return acc;
                  }, [] as string[][])
                  .map((words: string[], i: number) => (
                    <div key={i} className="name-line">{words.join(" ")}</div>
                  ))}
              </div>
            </div>

            {/* Right — bold school name + address */}
            <div className="rh-right">
              <div className="school-title">{receipt.school_name || "School Name"}</div>
              {schoolAddress && <div className="school-addr">{schoolAddress}</div>}
              {receipt.school_phone && <div className="school-addr">Ph: {receipt.school_phone}</div>}
              {receipt.school_email && <div className="school-addr">{receipt.school_email}</div>}
            </div>
          </div>

          <hr className="rdiv" />

          {/* ═══ RECEIPT INFO LINE ═══ */}
          <div className="rrow">
            <div className="rfield">
              <span className="rfield-lbl">Receipt No</span>
              <span className="rfield-sep">:</span>
              <span className="rfield-val">{receiptNo}</span>
            </div>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <div className="rfield">
              <span className="rfield-lbl">UID</span>
              <span className="rfield-sep">:</span>
              <span className="rfield-val" style={{ minWidth: 140 }}>{receipt.admission_number || "—"}</span>
            </div>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <div className="rfield">
              <span className="rfield-lbl">Date</span>
              <span className="rfield-sep">:</span>
              <span className="rfield-val">{fmtDate(receipt.payment_date)}</span>
            </div>
            &nbsp;&nbsp;&nbsp;&nbsp;
            <div className="rfield">
              <span className="rfield-lbl">A. Year</span>
              <span className="rfield-sep">:</span>
              <span className="rfield-val">{receipt.year_name || yearCode}</span>
            </div>
          </div>

          {/* ═══ STUDENT NAME ═══ */}
          <div className="rname-row">
            <span className="rname-lbl">MR. / MS.</span>
            <span className="rfield-sep">:</span>
            <span className="rname-val">{receipt.student_name?.toUpperCase() || "—"}</span>
          </div>

          {/* ═══ CLASS + SECTION / STREAM ═══ */}
          <div className="rdept-row">
            <span className="rdept-lbl">Class</span>
            <span className="rfield-sep">:</span>
            <span className="rdept-val">{classSection}</span>
            <span className="rsem-lbl">Fee Type</span>
            <span className="rfield-sep">:</span>
            <span className="rsem-val" style={{ textTransform: "capitalize" }}>{receipt.fee_type || "Academic"}</span>
          </div>

          <hr className="rdiv" />

          {/* ═══ FEE TABLE ═══ */}
          <table className="rtable">
            <thead>
              <tr>
                <th className="td-sr">Sr. No.</th>
                <th>Particulars</th>
                <th className="td-amt">Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Main fee row */}
              <tr>
                <td className="td-sr">1</td>
                <td>{receipt.fee_name || "Fee"}</td>
                <td className="td-amt">{fmt(receipt.total_amount)}</td>
              </tr>

              {/* Discount row — only if discount exists */}
              {hasDiscount && (
                <tr>
                  <td className="td-sr">2</td>
                  <td>
                    {receipt.discount_reason || "Scholarship / Discount"}
                    <span style={{ color: "#666", fontSize: 11, marginLeft: 6 }}>
                      (−{fmt(receipt.discount_amount)})
                    </span>
                  </td>
                  <td className="td-amt" style={{ color: "#15803d" }}>−{fmt(receipt.discount_amount)}</td>
                </tr>
              )}

              {/* Fine row — only if fine exists */}
              {hasFine && (
                <tr>
                  <td className="td-sr">{hasDiscount ? "3" : "2"}</td>
                  <td>{receipt.fine_reason || "Late Fee / Fine"}</td>
                  <td className="td-amt" style={{ color: "#b42318" }}>+{fmt(receipt.fine_amount)}</td>
                </tr>
              )}

              {/* Total row */}
              <tr>
                <td style={{ border: "1px solid #000" }} />
                <td style={{ border: "1px solid #000" }} />
                <td className="td-amt td-total">{fmt(netAmount)}</td>
              </tr>
            </tbody>
          </table>

          {/* ═══ IN WORDS ═══ */}
          <div className="rfrow">
            <span className="rfrow-lbl">(In Words)</span>
            <span className="rfrow-sep">:</span>
            <span style={{ fontWeight: 700, marginLeft: 4 }}>{amountToWords(netAmount)}</span>
          </div>

          {/* ═══ PAYMENT METHOD ═══ */}
          <div className="rfrow">
            <span className="rfrow-lbl">By Cash / Cheque / D.D. No</span>
            <span className="rfrow-sep">:</span>
            <span className="rfrow-val">
              {receipt.transaction_id
                ? `${receipt.transaction_id} — ${(receipt.payment_method || "cash").toUpperCase()}`
                : (receipt.payment_method || "Cash").toUpperCase()}
            </span>
            <span className="rfrow-date-lbl">Date</span>
            <span className="rfrow-sep">:</span>
            <span className="rfrow-date-val">{fmtDate(receipt.payment_date)}</span>
          </div>

          {/* ═══ BANK NAME ═══ */}
          <div className="rfrow">
            <span className="rfrow-lbl">Bank Name</span>
            <span className="rfrow-sep">:</span>
            <span className="rfrow-val">
              {["bank_transfer", "cheque", "online"].includes(receipt.payment_method)
                ? (receipt.payment_remarks || "—")
                : "—"}
            </span>
          </div>

          {/* ═══ NOTES ═══ */}
          <div className="rnotes">
            <div className="rnotes-title">Please Note:</div>
            <ol>
              {NOTES.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ol>
          </div>

          {/* ═══ FOOTER ═══ */}
          <div className="rfooter">
            This is an electronically generated report, hence does not require a signature
          </div>
        </div>
      </div>
    </>
  );
}
