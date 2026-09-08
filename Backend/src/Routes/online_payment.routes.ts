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

// ── ADMIN / FINANCE: bank account management ──────────────────────────────────────────
router.get   ('/bank-accounts',     restrictTo('admin', 'super_admin', 'finance'), getBankAccounts);
router.post  ('/bank-accounts',     restrictTo('admin', 'super_admin', 'finance'), createBankAccount);
router.patch ('/bank-accounts/:id', restrictTo('admin', 'super_admin', 'finance'), updateBankAccount);
router.delete('/bank-accounts/:id', restrictTo('admin', 'super_admin', 'finance'), deleteBankAccount);

// Static routes must come BEFORE /:id dynamic routes
router.get ('/requests/pending-count', restrictTo('admin', 'super_admin', 'finance'), getPendingCount);
router.get ('/pending',                restrictTo('admin', 'super_admin', 'finance'), getPendingCount);
router.get ('/requests',               restrictTo('admin', 'super_admin', 'finance'), getPaymentRequests);
router.get ('/requests/:id',           restrictTo('admin', 'super_admin', 'finance'), getPaymentRequestDetail);
router.post('/requests/:id/verify',    restrictTo('admin', 'super_admin', 'finance'), verifyPaymentRequest);
router.post('/requests/:id/reject',    restrictTo('admin', 'super_admin', 'finance'), rejectPaymentRequest);

// ── STUDENT: view active bank accounts ───────────────────────────────────────
// Frontend calls: GET /online-payments/active-bank-accounts
router.get('/active-bank-accounts', restrictTo('student'), getActiveBankAccounts);

// ── STUDENT: submit & list own payment requests ──────────────────────────────
// Frontend calls: POST /online-payments/requests  (submit)
// Frontend calls: GET  /online-payments/my-requests (list own)
router.post('/requests',    restrictTo('student'), submitPaymentRequest);
router.get ('/my-requests', restrictTo('student'), getMyPaymentRequests);

export default router;
