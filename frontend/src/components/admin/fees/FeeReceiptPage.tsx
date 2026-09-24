"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { Loader } from "@/components/shared/Loader";
import { amountToWords } from "@/lib/amountToWords";
import { useDateFormat } from "@/lib/useDateFormat";
import { useCurrency, CurrencyAmount } from "@/lib/useCurrency";

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

interface ReceiptLineGroup {
  title: string;
  count: number;
  rate: number;
  totalGross: number;
  discountAmt: number;
  netBillAmt: number;
  paidAmt: number;
  discountReason?: string;
  shortRange?: string;
}

function groupReceiptItems(items: any[], formatFeeName: (n: string) => string): ReceiptLineGroup[] {
  if (!items || !items.length) return [];

  const map = new Map<string, any[]>();
  for (const it of items) {
    const raw = it.fee_name || "Fee";
    const base = raw.replace(/\s*\([^)]*\)$/, '').trim() || raw;
    const key = it.fee_structure_id ? `struct_${it.fee_structure_id}` : `base_${base.toLowerCase()}_${it.fee_type || 'academic'}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }

  const groups: ReceiptLineGroup[] = [];
  for (const [, list] of map.entries()) {
    list.sort((a, b) => {
      const pA = a.billing_from_month || (a.due_date ? String(a.due_date).slice(0, 7) : "") || String(a.id);
      const pB = b.billing_from_month || (b.due_date ? String(b.due_date).slice(0, 7) : "") || String(b.id);
      if (pA !== pB) return pA.localeCompare(pB);
      return a.id - b.id;
    });

    const first = list[0];
    const last = list[list.length - 1];
    const baseName = (first.fee_name || "Fee").replace(/\s*\([^)]*\)$/, '').trim() || first.fee_name || "Fee";
    const cleanBase = baseName.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    const totalGross = list.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
    const discountAmt = list.reduce((s, r) => s + parseFloat(r.discount_amount || 0), 0);
    const netBillAmt = list.reduce((s, r) => s + parseFloat(r.net_amount || (parseFloat(r.total_amount || 0) - parseFloat(r.discount_amount || 0))), 0);
    const paidAmt = list.reduce((s, r) => s + parseFloat(r.paid_amount || 0), 0);

    if (list.length === 1) {
      const formatted = formatFeeName(first.fee_name || "Fee");
      groups.push({
        title: formatted.toUpperCase(),
        count: 1,
        rate: paidAmt,
        totalGross,
        discountAmt,
        netBillAmt,
        paidAmt,
        discountReason: first.discount_reason,
        shortRange: formatted,
      });
    } else {
      const getP = (b: any) => {
        const formatted = formatFeeName(b.fee_name || "");
        const match = formatted.match(/\(([^)]+)\)$/);
        return match ? match[1].trim() : (b.due_date ? b.due_date.slice(0, 7) : "");
      };
      const p1 = getP(first);
      const p2 = getP(last);

      const m1Match = p1.match(/^([A-Za-z]+)\s+(\d{4})$/);
      const m2Match = p2.match(/^([A-Za-z]+)\s+(\d{4})$/);

      let range = "";
      if (m1Match && m2Match) {
        range = m1Match[2] === m2Match[2] ? `${m1Match[1]} – ${m2Match[1]} ${m1Match[2]}` : `${p1} – ${p2}`;
      } else if (p1 && p2 && p1 !== p2) {
        range = `${p1} – ${p2}`;
      } else {
        range = `${list.length} Months`;
      }

      const title = `${cleanBase.toUpperCase()} (${range.toUpperCase()} · ${list.length} MONTHS)`;
      groups.push({
        title,
        count: list.length,
        rate: list.length > 0 ? (paidAmt / list.length) : paidAmt,
        totalGross,
        discountAmt,
        netBillAmt,
        paidAmt,
        discountReason: first.discount_reason,
        shortRange: range,
      });
    }
  }

  return groups;
}

interface Props {
  paymentId: string | number;
}

export default function FeeReceiptPage({ paymentId }: Props) {
  const { data: receipt, loading, error } = useApi<any>(`/fees/payments/${paymentId}`);
  const { formatDate, formatFeeName, isBS } = useDateFormat();
  const { fmt: formatCurrency, symbol: currSymbol } = useCurrency();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <Loader fullScreen={false} size="md" text="Loading receipt…" />
    </div>
  );

  if (error || !receipt) return (
    <div style={{ padding: "3rem", textAlign: "center", color: "#b42318", fontWeight: 700 }}>
      <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 28, display: "block", marginBottom: 10 }} />
      {error || "Receipt not found."}
    </div>
  );

  const totalGross = parseFloat(receipt.total_amount || 0);
  const discountAmt = parseFloat(receipt.discount_amount || 0);
  const fineAmt = parseFloat(receipt.fine_amount || 0);
  const netBillAmt = parseFloat(receipt.net_amount || (totalGross - discountAmt + fineAmt));
  const paidNow = parseFloat(receipt.paid_amount || 0);
  const totalPaidToDate = parseFloat(receipt.total_paid_to_date || paidNow);
  const remainingDue = parseFloat(receipt.remaining_amount || 0);
  const isWaived = receipt.collection_status === "waived" || (remainingDue === 0 && totalPaidToDate < netBillAmt);
  const waivedAmt = isWaived ? Math.max(0, netBillAmt - totalPaidToDate) : 0;
  const balanceDue = !isWaived && totalPaidToDate < netBillAmt ? Math.max(0, netBillAmt - totalPaidToDate) : 0;

  // Parse Fee Items (Supports both single-item legacy receipts and consolidated multi-item receipts)
  const rawItems = receipt.items && receipt.items.length > 0 ? receipt.items : [receipt];
  const itemGroups = groupReceiptItems(rawItems, formatFeeName);

  const formattedFee = formatFeeName(receipt.fee_name || "Fee");
  let cleanHead = formattedFee.replace(/\s*\([^)]*\)/g, "").trim() || receipt.fee_name || "Fee";
  cleanHead = cleanHead.split(" ").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  let fromMonth = "—";
  let toMonth = "—";
  let duration = "—";
  let monthsCount = 1;
  let feePeriod = "—";

  if (itemGroups.length > 1) {
    feePeriod = itemGroups.map(g => g.shortRange || g.title).join(", ");
    duration = `${rawItems.length} Fee Items`;
  } else if (itemGroups.length === 1 && itemGroups[0].count > 1) {
    feePeriod = itemGroups[0].shortRange || itemGroups[0].title;
    duration = `${itemGroups[0].count} Months`;
  } else {
    const parenMatch = formattedFee.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const inside = parenMatch[1].trim();
      const countMatch = inside.match(/·\s*(\d+)\s*Months?/i);
      if (countMatch) {
        monthsCount = parseInt(countMatch[1], 10);
        duration = `${monthsCount} Month${monthsCount > 1 ? "s" : ""}`;
      }

      const rangeMatch = inside.match(/([A-Za-z]+(?:\s+\d{4})?)\s+(?:to|–|-)\s+([A-Za-z]+(?:\s+\d{4})?)/i);
      if (rangeMatch) {
        fromMonth = rangeMatch[1].trim();
        toMonth = rangeMatch[2].trim();
        duration = countMatch ? `${monthsCount} Month${monthsCount > 1 ? "s" : ""}` : `${fromMonth} – ${toMonth}`;
        feePeriod = `${fromMonth} – ${toMonth}`;
      } else if (/^(?:AY\s*)?(\d{4}(?:[\/\-]\d{2,4})?)$/i.test(inside) || /annual|session/i.test(inside)) {
        feePeriod = receipt.year_name || inside;
        duration = "Annual";
      } else {
        feePeriod = inside;
        duration = "1 Month";
      }
    } else if (receipt.year_name) {
      feePeriod = receipt.year_name;
      duration = "Annual";
    } else {
      feePeriod = receipt.fee_type ? `${receipt.fee_type.charAt(0).toUpperCase()}${receipt.fee_type.slice(1)} Fee` : "General";
    }
  }

  const ratePerMonth = receipt.structure_amount
    ? Number(receipt.structure_amount)
    : (monthsCount > 1 ? totalGross / monthsCount : totalGross);

  const receiptNo = receipt.receipt_number || `REC-${String(paymentId).padStart(6, "0")}`;
  const classSection = [receipt.class_name, receipt.section_name].filter(Boolean).join(" - ") || "—";
  const schoolAddress = [receipt.school_city].filter(Boolean).join(", ") || "";

  return (
    <>
      <div
        className="receipt-no-print"
        style={{
          padding: "12px 28px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          background: "#fff",
          borderBottom: "1px solid #ddd",
          flexWrap: "wrap",
        }}
      >
        <AzureReceiptButton paymentId={paymentId} />
        <button
          onClick={handlePrint}
          style={{
            padding: "8px 18px",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 12.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "inherit",
          }}
        >
          <i className="fa-solid fa-print" /> Print Receipt
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#888", marginLeft: "auto" }}>
          {isBS ? "Bikram Sambat (BS)" : "AD Calendar"}
        </span>
      </div>

      <div ref={printRef} className="receipt-wrap">
        <style>{`
          @media print {
            .receipt-no-print { display: none !important; }
            body { margin: 0; padding: 0; background: #fff !important; }
            .receipt-wrap {
              box-shadow: none !important;
              margin: 0 !important;
              max-width: 100% !important;
              border: none !important;
              padding: 0 !important;
            }
          }

          .receipt-wrap {
            max-width: 800px;
            margin: 28px auto 56px;
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            color: #000;
          }

          .r-inner { padding: 40px 48px 44px; }

          /* Header */
          .r-header {
            display: flex;
            align-items: center;
            margin-bottom: 32px;
          }
          .r-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            margin-right: 20px;
          }
          .r-header-text {
            flex: 1;
            text-align: center;
            padding-right: 100px; /* offset logo width to truly center */
          }
          .r-school-name {
            font-size: 22px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 6px;
          }
          .r-school-addr {
            font-size: 11px;
            font-weight: bold;
          }

          /* Info Rows */
          .r-info-row {
            display: flex;
            align-items: flex-end;
            margin-bottom: 16px;
            font-size: 12.5px;
            font-weight: bold;
          }
          .r-lbl { white-space: nowrap; }
          .r-val {
            border-bottom: 1.5px solid #000;
            padding: 0 10px;
            text-align: center;
            white-space: nowrap;
          }

          /* Table */
          .r-table {
            width: 100%;
            border-collapse: collapse;
            border-spacing: 0;
            margin-top: 14px;
            margin-bottom: 20px;
            border: 1.5px solid #000;
            empty-cells: show;
          }
          .r-table th, .r-table td {
            border: 1px solid #000;
            padding: 6px 10px;
            font-size: 12px;
            text-align: center;
            vertical-align: middle;
          }
          .r-table th {
            font-weight: bold;
            padding: 7px 10px;
            background: #fff;
          }
          .r-table td {
            font-weight: bold;
          }
          .r-table tbody tr:last-child td {
            border-bottom: 1.5px solid #000;
          }

          /* Footer Info */
          .r-footer-row {
            display: flex;
            align-items: flex-end;
            margin-bottom: 12px;
            font-size: 12px;
            font-weight: bold;
          }
          .r-footer-val {
            border-bottom: 1.5px solid #000;
            padding: 0 8px;
            flex: 1;
            margin-left: 8px;
            font-weight: normal;
            white-space: nowrap;
          }

          /* Notes */
          .r-notes {
            margin-top: 28px;
            font-size: 10.5px;
            line-height: 1.5;
          }
          .r-notes strong {
            text-decoration: underline;
            font-size: 11.5px;
            display: inline-block;
            margin-bottom: 6px;
          }
          .r-disclaimer {
            text-align: center;
            font-size: 9px;
            margin-top: 24px;
            font-style: italic;
          }
        `}</style>

        <div className="r-inner">
          {/* Header */}
          <div className="r-header">
            {receipt.school_logo && <img src={receipt.school_logo} alt="Logo" className="r-logo" />}
            <div className="r-header-text" style={{ paddingRight: receipt.school_logo ? '100px' : '0' }}>
              <div className="r-school-name">{receipt.school_name || "SCHOOL NAME"}</div>
              <div className="r-school-addr">
                {[receipt.school_city, receipt.school_phone, receipt.school_email].filter(Boolean).join(", ")}
              </div>
            </div>
          </div>

          {/* Info Line 1 */}
          <div className="r-info-row" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flex: 1.5 }}>
              <span className="r-lbl">Receipt No &nbsp;:</span>
              <span className="r-val" style={{ flex: 1, marginLeft: 4 }}>{receiptNo}</span>
            </div>
            <div style={{ display: 'flex', flex: 1.5, marginLeft: 16 }}>
              <span className="r-lbl">UID:</span>
              <span className="r-val" style={{ flex: 1, marginLeft: 4 }}>{receipt.admission_number || ""}</span>
            </div>
            <div style={{ display: 'flex', flex: 1.5, marginLeft: 16 }}>
              <span className="r-lbl">Date:</span>
              <span className="r-val" style={{ flex: 1, marginLeft: 4 }}>{receipt.payment_date ? formatDate(receipt.payment_date.slice(0, 10)) : ""}</span>
            </div>
            <div style={{ display: 'flex', flex: 1, marginLeft: 16 }}>
              <span className="r-lbl">A. Year</span>
              <span className="r-val" style={{ flex: 1, marginLeft: 4 }}>{receipt.year_name || ""}</span>
            </div>
          </div>

          {/* Info Line 2 */}
          <div className="r-info-row">
            <span className="r-lbl">MR. / MS. &nbsp; &nbsp; &nbsp;:</span>
            <span className="r-val" style={{ flex: 1, marginLeft: 4, textAlign: 'left', paddingLeft: 16 }}>
              {receipt.student_name || ""}
            </span>
          </div>

          {/* Info Line 3 */}
          <div className="r-info-row">
            <span className="r-lbl">Class &amp; Section :</span>
            <span className="r-val" style={{ flex: 2, marginLeft: 4, textAlign: 'left', paddingLeft: 16 }}>
              {classSection}
            </span>
            <span className="r-lbl" style={{ marginLeft: 16 }}>Fee Period &nbsp;:</span>
            <span className="r-val" style={{ flex: 1.2, marginLeft: 4, whiteSpace: 'normal', fontSize: feePeriod.length > 25 ? 11 : 12.5 }}>
              {feePeriod}
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '3px double #000', margin: '14px 0 16px 0' }} />

          {/* Table */}
          <table className="r-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Sr. No.</th>
                <th style={{ textAlign: 'left', paddingLeft: '12px' }}>Particulars</th>
                <th style={{ width: '140px' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Fee Items (single or multi-item/multi-month consolidated) */}
              {itemGroups.map((g, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '6px 8px' }}>{idx + 1}</td>
                  <td style={{ textAlign: 'left', padding: '6px 12px' }}>
                    <div>
                      {g.title}
                      {g.discountAmt > 0 && (
                        <span style={{ fontSize: 11, color: '#333', marginLeft: 6, fontWeight: 'normal' }}>
                          (LESS DISCOUNT: <CurrencyAmount amount={g.discountAmt} />{g.discountReason ? ` · ${g.discountReason}` : ''})
                        </span>
                      )}
                    </div>
                    {g.count > 1 && (
                      <div style={{ fontSize: 10.5, color: '#555', fontWeight: 'normal', marginTop: 2 }}>
                        Rate: <CurrencyAmount amount={g.rate} /> / Month × {g.count} Months
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6px 8px' }}><CurrencyAmount amount={g.netBillAmt} /></td>
                </tr>
              ))}

              {/* Add: Fine Amount (if any fine was assessed) */}
              {fineAmt > 0 && (
                <tr>
                  <td style={{ padding: '6px 8px' }}>&nbsp;</td>
                  <td style={{ textAlign: 'left', padding: '6px 12px', fontStyle: 'italic', color: '#b42318' }}>
                    Add: Late Payment Fine {receipt.fine_reason ? `(${receipt.fine_reason})` : ''}
                  </td>
                  <td style={{ padding: '6px 8px', color: '#b42318' }}>+ <CurrencyAmount amount={fineAmt} /></td>
                </tr>
              )}

              {/* Less: Waived Amount (if any portion was waived) */}
              {waivedAmt > 0 && (
                <tr>
                  <td style={{ padding: '6px 8px' }}>&nbsp;</td>
                  <td style={{ textAlign: 'left', padding: '6px 12px', fontStyle: 'italic', color: '#333' }}>
                    Less: Waived by Management {receipt.fine_reason ? `(${receipt.fine_reason})` : ''}
                  </td>
                  <td style={{ padding: '6px 8px' }}>− <CurrencyAmount amount={waivedAmt} /></td>
                </tr>
              )}

              {/* Less: Balance Due (if partial payment, not waived) */}
              {balanceDue > 0 && (
                <tr>
                  <td style={{ padding: '6px 8px' }}>&nbsp;</td>
                  <td style={{ textAlign: 'left', padding: '6px 12px', fontStyle: 'italic', color: '#333' }}>
                    Less: Balance Due / Pending
                  </td>
                  <td style={{ padding: '6px 8px' }}>− <CurrencyAmount amount={balanceDue} /></td>
                </tr>
              )}

              {/* Total Paid Row */}
              <tr>
                <td style={{ padding: '6px 8px' }}>&nbsp;</td>
                <td style={{ textAlign: 'right', padding: '6px 12px', fontWeight: 'bold' }}>
                  TOTAL RECEIVED
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}><CurrencyAmount amount={paidNow} /></td>
              </tr>
            </tbody>
          </table>

          {/* Footer Info Lines */}
          <div className="r-footer-row">
            <span className="r-lbl">(In Words) &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;:</span>
            <span className="r-footer-val" style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
              {amountToWords(paidNow)}
            </span>
          </div>
          <div className="r-footer-row">
            <span className="r-lbl">By Cash / Cheque / D.D. No :</span>
            <span className="r-footer-val" style={{ flex: 1.5 }}>
              {(receipt.payment_method || "CASH").toUpperCase()}
            </span>
            <span className="r-lbl" style={{ marginLeft: 16 }}>Date &nbsp; &nbsp;:</span>
            <span className="r-footer-val" style={{ flex: 1 }}>
              {receipt.payment_date ? formatDate(receipt.payment_date.slice(0, 10)) : ""}
            </span>
          </div>
          <div className="r-footer-row">
            <span className="r-lbl">Bank Name &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;:</span>
            <span className="r-footer-val">
              {receipt.transaction_id || "-"}
            </span>
          </div>

          {/* Notes */}
          <div className="r-notes">
            <strong>Please Note:</strong>
            <ol style={{ margin: "4px 0 0", paddingLeft: 18, listStyleType: "decimal" }}>
              <li>Fees paid through cheque/demand draft are subject to clearing.</li>
              <li>If the cheque/draft is dishonored by the bank due to any reason, a penalty will be charged as per school fee policy along with late fee payment and bank charges as applicable.</li>
              <li>The fee paid is NON-TRANSFERABLE / NON-REFUNDABLE. (Subject to management decision)</li>
              <li>This is a system generated receipt and does not require a signature.</li>
              <li>On confirmation of admission, this will be considered as a part of Tuition fees.</li>
            </ol>
            <div className="r-disclaimer">
              This is an electronically generated report, hence does not require a signature
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

