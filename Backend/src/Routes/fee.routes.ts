import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createFeeStructure, getFeeStructures,
  getFeeStructureByIdController,
  updateFeeStructure, deleteFeeStructure,
  createFeeCollection, createMiscFeeCollection,
  getFeeCollections, getStudentFeeCollections, updateFeeCollection, waiveFeeCollection,
  createFeePayment, getPaymentsByCollection, getStudentPayments,
  getMyFeeCollections, getMyPayments,
  generateMonthlyFeeBills,
  generateMonthlyFeeBillsQueue,
  getMonthlyFeeBillsQueueStatus,
  generateTransportBills, getTransportFeeSummary, getTransportBillingPreview,
  generateHostelBills, getHostelFeeSummary, getHostelBillingPreview,
  getPaymentReceipt,
  assignOneTimeFeesController,
  getMonthlyBillingStatusController,
  voidMonthBillingController,
  getStudentBillingTimelineController,
  getUnbilledStudentsController,
} from '../Controllers/fee.controller';
import { generateReceipt, getReceiptStatus } from '../Controllers/receipt.controller';

const router = Router();
router.use(protect);

// ── SELF-SERVICE (student's own fees + receipts) — STATIC before dynamic ──
router.get('/me/collections', restrictTo('student'), getMyFeeCollections);
router.get('/me/payments',    restrictTo('student'), getMyPayments);

// ── BILLING ──
router.post  ('/monthly/generate',       restrictTo('admin', 'super_admin', 'finance'), generateMonthlyFeeBills);
router.post  ('/monthly/generate-queue', restrictTo('admin', 'super_admin', 'finance'), generateMonthlyFeeBillsQueue);
router.get   ('/monthly/queue-status/:jobId', restrictTo('admin', 'super_admin', 'finance'), getMonthlyFeeBillsQueueStatus);
router.get   ('/monthly/status',         restrictTo('admin', 'super_admin', 'finance'), getMonthlyBillingStatusController);
router.get   ('/monthly/timeline',   restrictTo('admin', 'super_admin', 'finance'), getStudentBillingTimelineController);
router.get   ('/monthly/unbilled',   restrictTo('admin', 'super_admin', 'finance'), getUnbilledStudentsController);
router.delete('/monthly/void',       restrictTo('admin', 'super_admin', 'finance'), voidMonthBillingController);
router.post('/one-time/assign',    restrictTo('admin', 'super_admin', 'finance'), assignOneTimeFeesController);
router.post('/transport/generate', restrictTo('admin', 'super_admin', 'finance'), generateTransportBills);
router.get ('/transport/preview',  restrictTo('admin', 'super_admin', 'finance'), getTransportBillingPreview);
router.get ('/transport/summary',  restrictTo('admin', 'super_admin', 'finance'), getTransportFeeSummary);
router.post('/hostel/generate',    restrictTo('admin', 'super_admin', 'finance'), generateHostelBills);
router.get ('/hostel/preview',     restrictTo('admin', 'super_admin', 'finance'), getHostelBillingPreview);
router.get ('/hostel/summary',     restrictTo('admin', 'super_admin', 'finance'), getHostelFeeSummary);

// ── FEE STRUCTURES ──
router.post  ('/structures',       restrictTo('admin', 'super_admin', 'finance'), createFeeStructure);
router.get   ('/structures',       restrictTo('admin', 'super_admin', 'finance'), getFeeStructures);
router.get   ('/structures/:id',   restrictTo('admin', 'super_admin', 'finance'), getFeeStructureByIdController);
router.patch ('/structures/:id',   restrictTo('admin', 'super_admin', 'finance'), updateFeeStructure);
router.delete('/structures/:id',   restrictTo('admin', 'super_admin', 'finance'), deleteFeeStructure);

// ── FEE COLLECTIONS ──
router.post('/collections/misc',          restrictTo('admin', 'super_admin', 'finance'), createMiscFeeCollection);
router.post('/collections',               restrictTo('admin', 'super_admin', 'finance'), createFeeCollection);
router.get ('/collections',               restrictTo('admin', 'super_admin', 'finance'), getFeeCollections);
router.get ('/collections/student/:id',   restrictTo('admin', 'super_admin', 'finance'), getStudentFeeCollections);
router.patch('/collections/:id',          restrictTo('admin', 'super_admin', 'finance'), updateFeeCollection);
router.post ('/collections/:id/waive',    restrictTo('admin', 'super_admin', 'finance'), waiveFeeCollection);

// ── FEE PAYMENTS ──
router.post('/payments',               restrictTo('admin', 'super_admin', 'finance'), createFeePayment);
router.get ('/payments/collection/:id',restrictTo('admin', 'super_admin', 'finance'), getPaymentsByCollection);
router.get ('/payments/student/:id',   restrictTo('admin', 'super_admin', 'finance'), getStudentPayments);

// ── RECEIPT PDF ──
router.post('/payments/:id/generate-receipt', restrictTo('admin', 'super_admin', 'student', 'finance'), generateReceipt);
router.get ('/payments/:id/receipt-status',   restrictTo('admin', 'super_admin', 'student', 'finance'), getReceiptStatus);

// Generic payment detail (must be LAST — dynamic /:id)
router.get('/payments/:id', restrictTo('admin', 'super_admin', 'student', 'finance'), getPaymentReceipt);

export default router;
