// Routes/online_payment.routes.ts

import { Router } from 'express';
import protect    from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  // Admin
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  getPaymentRequests,
  getPendingCount,
  getPaymentRequestDetail,
  verifyPaymentRequest,
  rejectPaymentRequest,
  // Student
  getActiveBankAccounts,
  submitPaymentRequest,
  getMyPaymentRequests,
} from '../Controllers/online_payment.controller';

const router = Router();
router.use(protect);

// ── ADMIN: bank account management ──────────────────────────────────────────
router.get   ('/bank-accounts',     restrictTo('admin', 'super_admin'), getBankAccounts);
router.post  ('/bank-accounts',     restrictTo('admin', 'super_admin'), createBankAccount);
router.patch ('/bank-accounts/:id', restrictTo('admin', 'super_admin'), updateBankAccount);
router.delete('/bank-accounts/:id', restrictTo('admin', 'super_admin'), deleteBankAccount);

// ── ADMIN: payment request queue ────────────────────────────────────────────
// Static routes must come BEFORE /:id dynamic routes
router.get ('/requests/pending-count', restrictTo('admin', 'super_admin'), getPendingCount);
router.get ('/requests',               restrictTo('admin', 'super_admin'), getPaymentRequests);
router.get ('/requests/:id',           restrictTo('admin', 'super_admin'), getPaymentRequestDetail);
router.post('/requests/:id/verify',    restrictTo('admin', 'super_admin'), verifyPaymentRequest);
router.post('/requests/:id/reject',    restrictTo('admin', 'super_admin'), rejectPaymentRequest);

// ── STUDENT: view active bank accounts ───────────────────────────────────────
// Frontend calls: GET /online-payments/active-bank-accounts
router.get('/active-bank-accounts', restrictTo('student'), getActiveBankAccounts);

// ── STUDENT: submit & list own payment requests ──────────────────────────────
// Frontend calls: POST /online-payments/requests  (submit)
// Frontend calls: GET  /online-payments/my-requests (list own)
router.post('/requests',    restrictTo('student'), submitPaymentRequest);
router.get ('/my-requests', restrictTo('student'), getMyPaymentRequests);

export default router;
