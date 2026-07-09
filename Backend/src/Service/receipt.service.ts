// ── Service/receipt.service.ts ────────────────────────────────────────────────
// Orchestrates: DB → Worker thread (PDF) → Azure Blob → DB update
//
// Flow for generateReceiptPDF():
//   1. Load full payment detail from DB
//   2. Check if already ready  → return cached URL
//   3. Claim generation slot   → prevents duplicate workers
//   4. Spin up Worker thread   → PDFKit on separate thread, main loop free
//   5. Upload PDF buffer       → Azure Blob  school-receipts/School-Receipt/<id>/<rcp>.pdf
//   6. Save URL to DB          → status = 'ready'
//   7. Return URL
// ─────────────────────────────────────────────────────────────────────────────
import path from 'path';
import { getPaymentWithDetails }       from '../Repositories/fee.repository';
import {
  claimReceiptGeneration,
  saveReceiptUrl,
  markReceiptFailed,
  getReceiptPdfInfo,
}                                      from '../Repositories/receipt.repository';
import { uploadReceiptPDF, getReceiptURL } from '../config/blob';
import { runInWorker }                 from '../utils/workerRunner';
import AppError                        from '../utils/AppError';

// Absolute path to the worker TypeScript file
const RECEIPT_WORKER = path.resolve(__dirname, '../workers/receipt-pdf.worker.ts');

export interface ReceiptPdfResult {
  url:    string;
  status: 'ready' | 'generating';
  cached: boolean;
}

/**
 * Generate (or return cached) a receipt PDF for a fee payment.
 *
 * @param payment_id  The fee_payments.id
 * @param school_id   The school (for multi-tenant safety)
 * @returns           { url, status, cached }
 */
export const generateReceiptPDFService = async (
  payment_id: number,
  school_id:  number
): Promise<ReceiptPdfResult> => {

  // ── 1. Get full payment data ──
  const receipt = await getPaymentWithDetails(payment_id, school_id);
  if (!receipt) throw new AppError('Payment not found.', 404);

  // ── 2. Already generated? Return the cached blob URL ──
  const existing = await getReceiptPdfInfo(payment_id, school_id);

  if (existing?.receipt_pdf_status === 'ready' && existing.receipt_pdf_url) {
    return { url: existing.receipt_pdf_url, status: 'ready', cached: true };
  }

  // If currently generating (another request is already in flight) return 202
  if (existing?.receipt_pdf_status === 'generating') {
    return {
      url:    '',
      status: 'generating',
      cached: false,
    };
  }

  // ── 3. Claim the slot (idempotency guard) ──
  const claimed = await claimReceiptGeneration(payment_id, school_id);
  if (!claimed) {
    // Race condition — another request claimed it milliseconds ago
    return { url: '', status: 'generating', cached: false };
  }

  // ── 4 + 5 + 6. Run worker, upload, save — all async, main loop free ──
  // We intentionally do NOT await the background job here so the HTTP
  // response can return immediately with status=generating.
  // The client polls GET /fees/payments/:id/receipt-status until ready.
  setImmediate(async () => {
    try {
      // Worker thread generates the PDF (PDFKit — CPU-bound, off main loop)
      const pdfBuffer = await runInWorker<Buffer>(RECEIPT_WORKER, { receipt });

      // Upload to Azure Blob Storage
      const blobUrl = await uploadReceiptPDF(
        school_id,
        receipt.receipt_number,
        pdfBuffer
      );

      // Persist URL + mark ready
      await saveReceiptUrl(payment_id, school_id, blobUrl);

    } catch (err: any) {
      console.error(`[Receipt] generation failed for payment ${payment_id}:`, err.message);
      await markReceiptFailed(payment_id, school_id).catch(() => {});
    }
  });

  return { url: '', status: 'generating', cached: false };
};

/**
 * Poll endpoint — returns current status + URL if ready.
 */
export const getReceiptStatusService = async (
  payment_id: number,
  school_id:  number
): Promise<{ status: string; url: string | null }> => {
  const info = await getReceiptPdfInfo(payment_id, school_id);
  if (!info) throw new AppError('Payment not found.', 404);
  return { status: info.receipt_pdf_status ?? 'pending', url: info.receipt_pdf_url };
};
