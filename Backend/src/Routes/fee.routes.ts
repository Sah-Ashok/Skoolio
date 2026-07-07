import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createFeeStructure, getFeeStructures, updateFeeStructure, deleteFeeStructure,
  createFeeCollection, getFeeCollections, getStudentFeeCollections, updateFeeCollection,
  createFeePayment, getPaymentsByCollection, getStudentPayments,
  getMyFeeCollections, getMyPayments,
  generateMonthlyFeeBills,
  generateTransportBills, getTransportFeeSummary,
  generateHostelBills, getHostelFeeSummary,
} from '../Controllers/fee.controller';

const router = Router();
router.use(protect);

// ── SELF-SERVICE (student's own fees) ──
router.get('/me/collections', restrictTo('student'), getMyFeeCollections);
router.get('/me/payments',    restrictTo('student'), getMyPayments);

// ── ACADEMIC MONTHLY BILLING ──
router.post('/monthly/generate',  restrictTo('admin', 'super_admin'), generateMonthlyFeeBills);

// ── TRANSPORT BILLING ──
router.post('/transport/generate',  restrictTo('admin', 'super_admin'), generateTransportBills);
router.get('/transport/summary',    restrictTo('admin', 'super_admin'), getTransportFeeSummary);

// ── HOSTEL BILLING ──
router.post('/hostel/generate',  restrictTo('admin', 'super_admin'), generateHostelBills);
router.get('/hostel/summary',    restrictTo('admin', 'super_admin'), getHostelFeeSummary);

// ── FEE STRUCTURE ROUTES (ADMIN) ──
router.post('/structures', restrictTo('admin', 'super_admin'), createFeeStructure);
router.get('/structures', restrictTo('admin', 'super_admin'), getFeeStructures);
router.patch('/structures/:id', restrictTo('admin', 'super_admin'), updateFeeStructure);
router.delete('/structures/:id', restrictTo('admin', 'super_admin'), deleteFeeStructure);

// ── FEE COLLECTION ROUTES (ADMIN) ──
router.post('/collections', restrictTo('admin', 'super_admin'), createFeeCollection);
router.get('/collections', restrictTo('admin', 'super_admin'), getFeeCollections);
router.get('/collections/student/:id', restrictTo('admin', 'super_admin'), getStudentFeeCollections);
router.patch('/collections/:id', restrictTo('admin', 'super_admin'), updateFeeCollection);

// ── FEE PAYMENT ROUTES (ADMIN) ──
router.post('/payments', restrictTo('admin', 'super_admin'), createFeePayment);
router.get('/payments/collection/:id', restrictTo('admin', 'super_admin'), getPaymentsByCollection);
router.get('/payments/student/:id', restrictTo('admin', 'super_admin'), getStudentPayments);

export default router;
