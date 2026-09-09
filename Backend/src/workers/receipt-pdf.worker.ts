// -- receipt-pdf.worker.ts ----------------------------------------------------
// Runs in a Worker thread, generates a black-and-white school fee receipt PDF.
// Receives receipt data, generates a PDF with PDFKit, returns Buffer.
// ----------------------------------------------------------------------------
import { workerData, parentPort } from 'worker_threads';
import PDFDocument from 'pdfkit';
 
console.log("billing is generating")
interface ReceiptData {
  receipt_number: string;
  payment_date: string;
  payment_method: string;
  transaction_id?: string;
  payment_remarks?: string;
  bank_name?: string;
  paid_amount: number;
  fee_name: string;
  fee_type: string;
  total_amount: number;
  discount_amount: number;
  discount_reason?: string;
  fine_amount: number;
  fine_reason?: string;
  net_amount: number;
  due_date: string;
  year_name: string;
  student_name: string;
  admission_number: string;
  class_name?: string;
  section_name?: string;
  school_name: string;
  school_email?: string;
  school_phone?: string;
  school_city?: string;
  school_address?: string;
  school_logo_path?: string;

  // School billing options:
  // billing_cycle examples: Monthly, Bi-Monthly, Quarterly, Custom
  // billing_period examples: Jan-Mar, Jun-Aug, January 2026
  annual_fee?: number;
  billing_cycle?: string;
  billing_period?: string;
  period_from?: string;
  period_to?: string;
}

const fmtDate = (d?: string) => {
  if (!d) return '';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-GB');
};

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

const cap = (s?: string | null) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '';

const numberWordsBelow100 = (n: number): string => {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n < 20) return ones[n];
  return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
};

const numberWordsBelow1000 = (n: number): string => {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  return `${hundred ? `${numberWordsBelow100(hundred)} Hundred` : ''}${
    hundred && rest ? ' ' : ''
  }${rest ? numberWordsBelow100(rest) : ''}`;
};

const amountInWords = (amount: number) => {
  let n = Math.round(amount || 0);
  if (n === 0) return 'RUPEES ZERO ONLY';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  const parts = [
    crore ? `${numberWordsBelow1000(crore)} Crore` : '',
    lakh ? `${numberWordsBelow1000(lakh)} Lakh` : '',
    thousand ? `${numberWordsBelow1000(thousand)} Thousand` : '',
    n ? numberWordsBelow1000(n) : '',
  ].filter(Boolean);

  return `RUPEES ${parts.join(' ').toUpperCase()} ONLY`;
};

const monthShort = (d?: string) => {
  if (!d) return '';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short' });
};

const getBillingPeriod = (r: ReceiptData) => {
  if (r.billing_period) return r.billing_period;
  if (r.period_from && r.period_to) {
    const from = monthShort(r.period_from);
    const to = monthShort(r.period_to);
    return from && to ? `${from}-${to}` : `${fmtDate(r.period_from)} - ${fmtDate(r.period_to)}`;
  }
  return cap(r.billing_cycle) || cap(r.fee_type) || 'Monthly';
};

function generateReceiptPDF(r: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: [595, 842],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (e: Error) => reject(e));

    const W = 595;
    const PL = 42;
    const CW = W - PL * 2;
    const BLACK = '#111111';
    const MID = '#444444';
    const LIGHT = '#f5f5f5';
    const annualFee = r.annual_fee ?? 36000;
    const paidAmount = r.paid_amount || r.net_amount || r.total_amount || annualFee;
    const period = getBillingPeriod(r);
    const classText = [r.class_name, r.section_name].filter(Boolean).join(' - ');
    const schoolSubLine = [r.school_address || r.school_city, r.school_phone, r.school_email]
      .filter(Boolean)
      .join(' | ');

    const lineField = (
      label: string,
      value: string,
      x: number,
      y: number,
      labelWidth: number,
      valueWidth: number,
    ) => {
      doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9).text(label, x, y);
      doc.font('Helvetica').fontSize(9).text(':', x + labelWidth - 8, y);
      doc.text(value || '-', x + labelWidth, y, { width: valueWidth });
      doc.moveTo(x + labelWidth, y + 13).lineTo(x + labelWidth + valueWidth, y + 13).strokeColor(BLACK).lineWidth(0.7).stroke();
    };

    doc.fillColor(BLACK);

    // Header
    if (r.school_logo_path) {
      try {
        doc.image(r.school_logo_path, PL, 44, { width: 74, height: 74, fit: [74, 74] });
      } catch {
        doc.rect(PL, 44, 74, 74).strokeColor(BLACK).lineWidth(1).stroke();
      }
    }

    doc.font('Helvetica-Bold').fontSize(16).text(r.school_name.toUpperCase(), PL, 52, {
      width: CW,
      align: 'center',
    });
    if (schoolSubLine) {
      doc.font('Helvetica-Bold').fontSize(8.5).text(schoolSubLine, PL, 78, {
        width: CW,
        align: 'center',
      });
    }

    let y = 150;

    // Receipt metadata
    lineField('Receipt No', r.receipt_number, PL, y, 76, 108);
    lineField('UID', r.admission_number, 230, y, 36, 100);
    lineField('Date', fmtDate(r.payment_date), 380, y, 42, 88);
    y += 28;
    lineField('Academic Year', r.year_name, 380, y, 86, 74);
    lineField('MR. / MS.', r.student_name.toUpperCase(), PL, y, 76, 290);
    y += 28;
    lineField('Class', classText, PL, y, 76, 180);
    lineField('Fee Period', period, 300, y, 76, 170);
    y += 34;

    // Fee table
    const tableX = PL;
    const tableW = CW;
    const srW = 66;
    const amountW = 122;
    const particularW = tableW - srW - amountW;
    const rowH = 26;

    // Build rows from items or single receipt
    interface PdfRow {
      sr: number;
      particular: string;
      amount: number;
    }
    const tableRows: PdfRow[] = [];
    const itemsList = (r as any).items && (r as any).items.length > 0 ? (r as any).items : null;

    if (itemsList && itemsList.length > 1) {
      const map = new Map<string, any[]>();
      for (const it of itemsList) {
        const raw = it.fee_name || 'Fee';
        const base = raw.replace(/\s*\([^)]*\)$/, '').trim() || raw;
        const k = it.fee_structure_id ? `s_${it.fee_structure_id}` : `b_${base.toLowerCase()}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(it);
      }
      let sr = 1;
      for (const [, list] of map.entries()) {
        const first = list[0];
        const base = (first.fee_name || 'Fee').replace(/\s*\([^)]*\)$/, '').trim() || first.fee_name;
        const paid = list.reduce((s, it) => s + Number(it.paid_amount || 0), 0);
        if (list.length === 1) {
          tableRows.push({
            sr: sr++,
            particular: first.fee_name || 'Fee',
            amount: paid,
          });
        } else {
          tableRows.push({
            sr: sr++,
            particular: `${base} (${list.length} Months)`,
            amount: paid,
          });
        }
      }
    } else {
      tableRows.push({
        sr: 1,
        particular: `${r.fee_name || 'School Fee'} (${period})`,
        amount: paidAmount,
      });
    }

    const totalRowsCount = tableRows.length + 1; // data rows + total row
    doc.rect(tableX, y, tableW, rowH).fillAndStroke(LIGHT, BLACK);
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9);
    doc.text('Sr. No.', tableX, y + 8, { width: srW, align: 'center' });
    doc.text('Particulars', tableX + srW, y + 8, { width: particularW, align: 'center' });
    doc.text('Amount', tableX + srW + particularW, y + 8, { width: amountW, align: 'center' });
    doc.moveTo(tableX + srW, y).lineTo(tableX + srW, y + rowH * (totalRowsCount + 1)).stroke();
    doc.moveTo(tableX + srW + particularW, y).lineTo(tableX + srW + particularW, y + rowH * (totalRowsCount + 1)).stroke();
    y += rowH;

    for (const row of tableRows) {
      doc.rect(tableX, y, tableW, rowH).strokeColor(BLACK).lineWidth(1).stroke();
      doc.font('Helvetica').fontSize(9).text(String(row.sr), tableX, y + 8, { width: srW, align: 'center' });
      doc.text(row.particular, tableX + srW + 6, y + 8, { width: particularW - 12 });
      doc.font('Helvetica-Bold').text(fmtAmount(row.amount), tableX + srW + particularW, y + 8, {
        width: amountW,
        align: 'center',
      });
      y += rowH;
    }

    doc.rect(tableX, y, tableW, rowH).strokeColor(BLACK).lineWidth(1).stroke();
    doc.font('Helvetica-Bold').fontSize(9).text('Total', tableX + srW, y + 8, {
      width: particularW - 8,
      align: 'right',
    });
    doc.text(fmtAmount(paidAmount), tableX + srW + particularW, y + 8, {
      width: amountW,
      align: 'center',
    });
    y += rowH + 18;

    doc.font('Helvetica-Bold').fontSize(10).text('(In Words)', PL, y);
    doc.font('Helvetica').fontSize(10).text(`:  ${amountInWords(paidAmount)}`, PL + 82, y, { width: CW - 82 });
    doc.moveTo(PL + 82, y + 14).lineTo(PL + CW, y + 14).strokeColor(BLACK).lineWidth(0.7).stroke();
    y += 28;

    lineField('Annual Fee', fmtAmount(annualFee), PL, y, 84, 112);
    lineField('Billing Cycle', cap(r.billing_cycle) || cap(r.fee_type), 290, y, 86, 142);
    y += 28;

    lineField('By Cash / Cheque / D.D. No', `${r.transaction_id || '-'}${r.payment_method ? ` - ${cap(r.payment_method)}` : ''}`, PL, y, 170, 202);
    lineField('Date', fmtDate(r.payment_date), 425, y, 40, 88);
    y += 28;
    lineField('Bank Name', r.bank_name || '-', PL, y, 84, 430);
    y += 36;

    // Static notes. These can later be replaced with school-specific notes.
    doc.font('Helvetica-Bold').fontSize(10).text('Please Note:', PL, y, { underline: true });
    y += 24;
    const notes = [
      'Fees paid through cheque/demand draft are subject to clearing.',
      'If the cheque/draft is dishonored by the bank, penalty and bank charges will apply as per school fee policy.',
      'The fee paid is non-transferable and non-refundable, subject to management decision.',
      'This is a system generated receipt and does not require a signature.',
      'On confirmation of admission, this amount will be considered as a part of tuition fees.',
    ];

    doc.font('Helvetica').fontSize(9).fillColor(BLACK);
    notes.forEach((note, i) => {
      doc.text(`${i + 1}. ${note}`, PL, y, { width: CW });
      y += 18;
    });

    doc.font('Helvetica').fontSize(8).fillColor(MID).text(
      'This is an electronically generated report, hence does not require a signature.',
      PL,
      730,
      { width: CW, align: 'center' },
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
