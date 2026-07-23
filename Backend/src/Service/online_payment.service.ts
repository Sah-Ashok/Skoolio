// Service/online_payment.service.ts

import AppError from '../utils/AppError';
import pool from '../config/db';
import {
  getBankAccountsBySchool,
  getActiveBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  createPaymentRequest,
  getPaymentRequestsBySchool,
  getPaymentRequestsByStudent,
  getPaymentRequestById,
  getPendingCountBySchool,
  verifyPaymentRequest,
  rejectPaymentRequest,
  getPendingRequestForCollection,
} from '../Repositories/online_payment.repository';
import { getFeeCollectionById, createFeePaymentAtomic } from '../Repositories/fee.repository';
import { ICreateBankAccount, ICreatePaymentRequest } from '../types/online_payment.types';

// ── BANK ACCOUNT SERVICES (admin) ────────────────────────────────────────────

export const getBankAccountsService = async (school_id: number) => {
  return await getBankAccountsBySchool(school_id);
};

export const createBankAccountService = async (school_id: number, data: ICreateBankAccount) => {
  if (!data.bank_name?.trim())      throw new AppError('Bank name is required.', 400);
  if (!data.account_name?.trim())   throw new AppError('Account name is required.', 400);
  if (!data.account_number?.trim()) throw new AppError('Account number is required.', 400);
  return await createBankAccount(school_id, data);
};

export const updateBankAccountService = async (
  id:        number,
  school_id: number,
  data:      Partial<ICreateBankAccount & { is_active: boolean }>
) => {
  const updated = await updateBankAccount(id, school_id, data);
  if (!updated) throw new AppError('Bank account not found.', 404);
  return updated;
};

export const deleteBankAccountService = async (id: number, school_id: number) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM online_payment_requests WHERE bank_account_id = $1 AND school_id = $2`,
    [id, school_id]
  );
  if ((rows[0]?.cnt ?? 0) > 0) {
    throw new AppError(
      'Cannot delete a bank account that has payment requests linked to it. Deactivate it instead.',
      400
    );
  }
  const deleted = await deleteBankAccount(id, school_id);
  if (!deleted) throw new AppError('Bank account not found.', 404);
};

// ── STUDENT: view active bank accounts ───────────────────────────────────────

export const getActiveBankAccountsService = async (school_id: number) => {
  return await getActiveBankAccounts(school_id);
};

// ── STUDENT: submit payment request ─────────────────────────────────────────

export const submitPaymentRequestService = async (
  school_id:  number,
  student_id: number,
  data:       ICreatePaymentRequest
) => {
  const collection = await getFeeCollectionById(data.collection_id, school_id);
  if (!collection) throw new AppError('Fee record not found.', 404);
  if (Number(collection.student_id) !== student_id) {
    throw new AppError('This fee record does not belong to you.', 403);
  }
  if (collection.status === 'paid') {
    throw new AppError('This fee is already fully paid.', 400);
  }
  if (collection.status === 'waived') {
    throw new AppError('This fee has been waived — no payment needed.', 400);
  }

  const existing = await getPendingRequestForCollection(data.collection_id, student_id);
  if (existing) {
    throw new AppError(
      'You already have a pending payment request for this fee. Please wait for admin verification.',
      400
    );
  }

  if (!data.amount || Number(data.amount) <= 0) {
    throw new AppError('Payment amount must be greater than zero.', 400);
  }
  if (Number(data.amount) > Number(collection.remaining_amount)) {
    throw new AppError(
      `Payment amount cannot exceed the remaining balance of ${collection.remaining_amount}.`,
      400
    );
  }
  if (!data.payment_date) throw new AppError('Payment date is required.', 400);

  return await createPaymentRequest(school_id, student_id, data);
};

// ── STUDENT: get my payment requests ────────────────────────────────────────

export const getMyPaymentRequestsService = async (student_id: number, school_id: number) => {
  return await getPaymentRequestsByStudent(student_id, school_id);
};

// ── ADMIN: list payment requests ─────────────────────────────────────────────

export const getPaymentRequestsService = async (school_id: number, status?: string) => {
  const validStatuses = ['pending', 'verified', 'rejected'];
  if (status && !validStatuses.includes(status)) {
    throw new AppError('Invalid status filter. Use: pending, verified, rejected.', 400);
  }
  return await getPaymentRequestsBySchool(school_id, status);
};

export const getPendingCountService = async (school_id: number) => {
  return await getPendingCountBySchool(school_id);
};

export const getPaymentRequestDetailService = async (id: number, school_id: number) => {
  const request = await getPaymentRequestById(id, school_id);
  if (!request) throw new AppError('Payment request not found.', 404);
  return request;
};

// ── ADMIN: verify (atomic — creates fee_payment + updates request) ────────────

export const verifyPaymentRequestService = async (
  id:        number,
  school_id: number,
  admin_id:  number,
  notes?:    string
) => {
  const request = await getPaymentRequestById(id, school_id);
  if (!request) throw new AppError('Payment request not found.', 404);
  if (request.status !== 'pending') {
    throw new AppError(`This request has already been ${request.status}.`, 400);
  }

  const collection = await getFeeCollectionById(request.collection_id, school_id);
  if (!collection) throw new AppError('Fee record no longer exists.', 404);
  if (collection.status === 'paid') {
    throw new AppError('This fee is already fully paid.', 400);
  }

  const feePayment = await createFeePaymentAtomic(school_id, admin_id, {
    student_id:     request.student_id,
    collection_id:  request.collection_id,
    paid_amount:    Number(request.amount),
    payment_method: 'online',
    payment_date:   request.payment_date,
    remarks:        notes || `Online transfer verified — Ref: ${request.transaction_ref || 'N/A'}`,
  });

  const verified = await verifyPaymentRequest(id, school_id, admin_id, feePayment.payment.id);
  if (!verified) throw new AppError('Failed to verify payment request.', 500);

  return { request: verified, fee_payment: feePayment };
};

// ── ADMIN: reject ─────────────────────────────────────────────────────────────

export const rejectPaymentRequestService = async (
  id:               number,
  school_id:        number,
  admin_id:         number,
  rejection_reason: string
) => {
  if (!rejection_reason?.trim()) throw new AppError('Rejection reason is required.', 400);

  const request = await getPaymentRequestById(id, school_id);
  if (!request) throw new AppError('Payment request not found.', 404);
  if (request.status !== 'pending') {
    throw new AppError(`This request has already been ${request.status}.`, 400);
  }

  const rejected = await rejectPaymentRequest(id, school_id, admin_id, rejection_reason.trim());
  if (!rejected) throw new AppError('Failed to reject payment request.', 500);
  return rejected;
};
