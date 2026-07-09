// ── receipt-pdf.worker.ts ─────────────────────────────────────────────────────
// Runs in a Worker thread — never blocks the main event loop.
// Receives receipt data, generates a PDF with PDFKit, returns Buffer.
// ─────────────────────────────────────────────────────────────────────────────
import { workerData, parentPort } from 'worker_threads';
import PDFDocument from 'pdfkit';

interface ReceiptData {
  receipt_number:   string;
  payment_date:     string;
  payment_method:   string;
  transaction_id?:  string;
  payment_remarks?: string;
  paid_amount:      number;
  fee_name:         string;
  fee_type:         string;
  total_amount:     number;
  discount_amount:  number;
  discount_reason?: string;
  fine_amount:      number;
  fine_reason?:     string;
  net_amount:       number;
  due_date:         string;
  year_name:        string;
  student_name:     string;
  admission_number: string;
  class_name?:      string;
  section_name?:    string;
  school_name:      string;
  school_email?:    string;
  school_phone?:    string;
  school_city?:     string;
}

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';

function generateReceiptPDF(r: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: [595, 842], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    doc.on('data',  (c: Buffer) => chunks.push(c));
    doc.on('end',   ()          => resolve(Buffer.concat(chunks)));
    doc.on('error', (e: Error)  => reject(e));

    const W      = 595;
    const PL     = 48;
    const CW     = W - PL * 2;
    const ORANGE = '#FF9B51';
    const NAVY   = '#25343F';
    const SLATE  = '#64748b';
    const LIGHT  = '#f8fafc';
    const BORDER = '#e2e8f0';

    // ── header band ──
    doc.rect(0, 0, W, 110).fill(NAVY);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(18).text(r.school_name, PL, 26, { width: CW });
    const sub = [r.school_city, r.school_email, r.school_phone].filter(Boolean).join('  |  ');
    if (sub) doc.fillColor('rgba(255,255,255,0.55)').font('Helvetica').fontSize(9).text(sub, PL, 52, { width: CW });
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(22).text('RECEIPT', 0, 28, { width: W - PL, align: 'right' });
    doc.fillColor('rgba(255,255,255,0.5)').font('Helvetica').fontSize(9).text(r.receipt_number, 0, 56, { width: W - PL, align: 'right' });
    doc.rect(0, 110, W, 4).fill(ORANGE);

    let y = 130;

    // ── meta row ──
    const meta = [
      { label: 'Date',   val: fmtDate(r.payment_date) },
      { label: 'Method', val: cap(r.payment_method)   },
      { label: 'Year',   val: r.year_name             },
      ...(r.transaction_id ? [{ label: 'Txn ID', val: r.transaction_id }] : []),
    ];
    const mw = CW / meta.length;
    meta.forEach((m, i) => {
      const x = PL + i * mw;
      doc.fillColor(SLATE).font('Helvetica').fontSize(8).text(m.label.toUpperCase(), x, y);
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text(m.val, x, y + 12, { width: mw - 8 });
    });
    y += 40;
    doc.rect(PL, y, CW, 1).fill(BORDER); y += 14;

    // ── two-column: student | fee ──
    const cw2 = (CW - 20) / 2;
    const cx2 = PL + cw2 + 20;
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(8)
       .text('STUDENT DETAILS', PL, y).text('FEE DETAILS', cx2, y);
    y += 14;

    const sRows: [string, string][] = [
      ['Name', r.student_name], ['Admission #', r.admission_number],
      ...(r.class_name ? [['Class', r.section_name ? `${r.class_name} — Sec ${r.section_name}` : r.class_name] as [string, string]] : []),
    ];
    const fRows: [string, string][] = [
      ['Fee Name', r.fee_name], ['Fee Type', cap(r.fee_type)], ['Due Date', fmtDate(r.due_date)],
    ];
    const maxR = Math.max(sRows.length, fRows.length);
    for (let i = 0; i < maxR; i++) {
      const ry = y + i * 26;
      if (sRows[i]) {
        doc.fillColor(SLATE).font('Helvetica').fontSize(8).text(sRows[i][0], PL, ry);
        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text(sRows[i][1], PL, ry + 11, { width: cw2 });
      }
      if (fRows[i]) {
        doc.fillColor(SLATE).font('Helvetica').fontSize(8).text(fRows[i][0], cx2, ry);
        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text(fRows[i][1], cx2, ry + 11, { width: cw2 });
      }
    }
    y += maxR * 26 + 18;

    // ── amount table ──
    doc.rect(PL, y, CW, 1).fill(BORDER); y += 12;
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(8).text('AMOUNT BREAKDOWN', PL, y); y += 14;

    const rows: { label: string; val: string; bold?: boolean; color?: string }[] = [
      { label: 'Gross Amount', val: fmtINR(r.total_amount) },
      ...(r.discount_amount > 0 ? [{ label: `Discount${r.discount_reason ? ` (${r.discount_reason})` : ''}`, val: `− ${fmtINR(r.discount_amount)}`, color: '#16a34a' }] : []),
      ...(r.fine_amount > 0     ? [{ label: `Fine${r.fine_reason ? ` (${r.fine_reason})` : ''}`, val: `+ ${fmtINR(r.fine_amount)}`, color: '#dc2626' }] : []),
      { label: 'Net Payable',    val: fmtINR(r.net_amount) },
      { label: 'Amount Paid',    val: fmtINR(r.paid_amount), bold: true, color: '#16a34a' },
      ...((r.net_amount - r.paid_amount) > 0.01 ? [{ label: 'Remaining Balance', val: fmtINR(r.net_amount - r.paid_amount), color: '#dc2626' }] : []),
    ];

    rows.forEach((row, i) => {
      const ry = y + i * 22;
      if (i % 2 === 0) doc.rect(PL, ry - 3, CW, 22).fill(LIGHT);
      doc.fillColor(row.color || NAVY).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
         .text(row.label, PL + 8, ry + 3);
      doc.fillColor(row.color || NAVY).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
         .text(row.val, 0, ry + 3, { width: W - PL, align: 'right' });
    });
    y += rows.length * 22 + 14;

    // ── paid highlight box ──
    doc.rect(PL, y, CW, 54).fill(NAVY);
    doc.fillColor('rgba(255,255,255,0.5)').font('Helvetica').fontSize(9).text('AMOUNT PAID', PL + 16, y + 10);
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(24).text(fmtINR(r.paid_amount), PL + 16, y + 22);
    const isPaid = (r.net_amount - r.paid_amount) <= 0.01;
    doc.fillColor(isPaid ? '#4ade80' : '#fbbf24').font('Helvetica-Bold').fontSize(10)
       .text(isPaid ? '✓  FULLY PAID' : '⬤  PARTIAL PAYMENT', 0, y + 32, { width: W - PL, align: 'right' });
    y += 70;

    // ── remarks ──
    if (r.payment_remarks) {
      doc.rect(PL, y, CW, 1).fill(BORDER); y += 10;
      doc.fillColor(SLATE).font('Helvetica').fontSize(8).text('REMARKS', PL, y); y += 12;
      doc.fillColor(NAVY).font('Helvetica').fontSize(9).text(r.payment_remarks, PL, y, { width: CW }); y += 20;
    }

    // ── footer ──
    doc.rect(0, 800, W, 42).fill(LIGHT);
    doc.rect(0, 800, W, 1).fill(BORDER);
    doc.fillColor(SLATE).font('Helvetica').fontSize(8)
       .text(
         `Computer-generated receipt · No signature required  |  ${r.school_name}  |  ${fmtDate(new Date().toISOString())}`,
         PL, 816, { width: CW, align: 'center' }
       );

    doc.end();
  });
}

async function main() {
  try {
    const buf = await generateReceiptPDF(workerData.receipt as ReceiptData);
    parentPort?.postMessage({ success: true, buffer: buf });
  } catch (err: any) {
    parentPort?.postMessage({ success: false, error: err.message });
  }
}

main();
