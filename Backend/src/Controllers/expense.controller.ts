import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  createExpenseCategoryService, getExpenseCategoriesService,
  updateExpenseCategoryService, deleteExpenseCategoryService,
  createExpenseService, getExpensesService, getExpenseByIdService,
  getExpensesByCategoryService, updateExpenseService, deleteExpenseService,
  getExpenseSummaryService,
} from '../Service/expense.service';

// ── EXPENSE CATEGORY CONTROLLERS ──

export const createExpenseCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createExpenseCategoryService(school_id, req.body);
  sendResponse(res, 201, true, 'Expense category created successfully', result);
});

export const getExpenseCategories = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await getExpenseCategoriesService(school_id);
  sendResponse(res, 200, true, 'Expense categories fetched successfully', result);
});

export const updateExpenseCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateExpenseCategoryService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Expense category updated successfully', result);
});

export const deleteExpenseCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteExpenseCategoryService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Expense category deleted successfully', null);
});

// ── EXPENSE CONTROLLERS ──

export const createExpense = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createExpenseService(school_id, school_id, req.body);
  sendResponse(res, 201, true, 'Expense created successfully', result);
});

export const getExpenses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getExpensesService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Expenses fetched successfully', result);
});

export const getExpenseById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await getExpenseByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Expense fetched successfully', result);
});

export const getExpensesByCategory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getExpensesByCategoryService(
    Number(req.params.categoryId),
    school_id,
    Number(academic_year_id)
  );
  sendResponse(res, 200, true, 'Expenses fetched successfully', result);
});

export const updateExpense = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateExpenseService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Expense updated successfully', result);
});

export const deleteExpense = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteExpenseService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Expense deleted successfully', null);
});

// ── EXPENSE SUMMARY CONTROLLER ──

export const getExpenseSummary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getExpenseSummaryService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Expense summary fetched successfully', result);
});