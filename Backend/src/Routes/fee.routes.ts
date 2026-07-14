import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createFeeStructure, getFeeStructures, updateFeeStructure, deleteFeeStructure,
  createFeeCollection, createMiscFeeCollection,
  getFeeCollections, getStudentFeeCollections, updateFeeCollection,
  createFeePayment, getPaymentsByCollection, getStudentPayments,
  getMyFeeCollections, getMyPayments,
  generateMonthlyFeeBills,
  generateTransportBills, getTransportFeeSummary,
  generateHostelBills, getHostelFeeSummary,
  getPaymentReceipt,
} from '../Controllers/fee.controller';
import { generateReceipt, getReceiptStatus } from '../Controllers/receipt.controller';

const router = Router();
router.use(protect);

// ── SELF-SERVICE (student's own fees + receipts) — STATIC before dynamic ──
router.get('/me/collections', restrictTo('student'), getMyFeeCollections);
router.get('/me/payments',    restrictTo('student'), getMyPayments);

// ── BILLING ──
router.post('/monthly/generate',   restrictTo('admin', 'super_admin'), generateMonthlyFeeBills);
router.post('/transport/generate', restrictTo('admin', 'super_admin'), generateTransportBills);
router.get ('/transport/summary',  restrictTo('admin', 'super_admin'), getTransportFeeSummary);
router.post('/hostel/generate',    restrictTo('admin', 'super_admin'), generateHostelBills);
router.get ('/hostel/summary',     restrictTo('admin', 'super_admin'), getHostelFeeSummary);

// ── FEE STRUCTURES ──
router.post  ('/structures',       restrictTo('admin', 'super_admin'), createFeeStructure);
router.get   ('/structures',       restrictTo('admin', 'super_admin'), getFeeStructures);
router.patch ('/structures/:id',   restrictTo('admin', 'super_admin'), updateFeeStructure);
router.delete('/structures/:id',   restrictTo('admin', 'super_admin'), deleteFeeStructure);

// ── FEE COLLECTIONS ──
// P3 FIX: /collections/misc must be BEFORE /collections to avoid route conflict
router.post('/collections/misc',          restrictTo('admin', 'super_admin'), createMiscFeeCollection);
router.post('/collections',               restrictTo('admin', 'super_admin'), createFeeCollection);
router.get ('/collections',               restrictTo('admin', 'super_admin'), getFeeCollections);
router.get ('/collections/student/:id',   restrictTo('admin', 'super_admin'), getStudentFeeCollections);
router.patch('/collections/:id',          restrictTo('admin', 'super_admin'), updateFeeCollection);

// ── FEE PAYMENTS ──
router.post('/payments',               restrictTo('admin', 'super_admin'), createFeePayment);
router.get ('/payments/collection/:id',restrictTo('admin', 'super_admin'), getPaymentsByCollection);
router.get ('/payments/student/:id',   restrictTo('admin', 'super_admin'), getStudentPayments);

// ── RECEIPT PDF ──
router.post('/payments/:id/generate-receipt', restrictTo('admin', 'super_admin', 'student'), generateReceipt);
router.get ('/payments/:id/receipt-status',   restrictTo('admin', 'super_admin', 'student'), getReceiptStatus);

// Generic payment detail (must be LAST — dynamic /:id)
router.get('/payments/:id', restrictTo('admin', 'super_admin', 'student'), getPaymentReceipt);

export default router;
