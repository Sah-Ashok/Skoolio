import {
  createExpenseCategory, getExpenseCategoriesBySchool, getExpenseCategoryById,
  getExpenseCategoryByName, updateExpenseCategory, deleteExpenseCategory,
  createExpense, getExpensesBySchool, getExpenseById, getExpensesByCategory,
  updateExpense, deleteExpense, getExpenseSummaryByCategory, getTotalExpenses,
} from '../Repositories/expense.repository';
import { ICreateExpenseCategory, IUpdateExpenseCategory, ICreateExpense, IUpdateExpense } from '../types/expense.types';
import AppError from '../utils/AppError';

// ── EXPENSE CATEGORY SERVICES ──

export const createExpenseCategoryService = async (
  school_id: number,
  data: ICreateExpenseCategory
) => {
  const existing = await getExpenseCategoryByName(data.name, school_id);
  if (existing) throw new AppError('Category already exists.', 400);

  const category = await createExpenseCategory(school_id, data);
  return category;
};

export const getExpenseCategoriesService = async (school_id: number) => {
  const categories = await getExpenseCategoriesBySchool(school_id);
  return categories;
};

export const updateExpenseCategoryService = async (
  id: number,
  school_id: number,
  data: IUpdateExpenseCategory
) => {
  const category = await updateExpenseCategory(id, school_id, data);
  if (!category) throw new AppError('Category not found.', 404);
  return category;
};

export const deleteExpenseCategoryService = async (id: number, school_id: number) => {
  const category = await getExpenseCategoryById(id, school_id);
  if (!category) throw new AppError('Category not found.', 404);

  const deleted = await deleteExpenseCategory(id, school_id);
  if (!deleted) throw new AppError('Failed to delete category.', 500);
};

// ── EXPENSE SERVICES ──

export const createExpenseService = async (
  school_id: number,
  created_by: number,
  data: ICreateExpense
) => {
  const category = await getExpenseCategoryById(data.category_id, school_id);
  if (!category) throw new AppError('Category not found.', 404);

  if (data.amount <= 0) {
    throw new AppError('Amount must be greater than 0.', 400);
  }

  const expense = await createExpense(school_id, created_by, data);
  return expense;
};

export const getExpensesService = async (
  school_id: number,
  academic_year_id: number
) => {
  const expenses = await getExpensesBySchool(school_id, academic_year_id);
  return expenses;
};

export const getExpenseByIdService = async (id: number, school_id: number) => {
  const expense = await getExpenseById(id, school_id);
  if (!expense) throw new AppError('Expense not found.', 404);
  return expense;
};

export const getExpensesByCategoryService = async (
  category_id: number,
  school_id: number,
  academic_year_id: number
) => {
  const expenses = await getExpensesByCategory(category_id, school_id, academic_year_id);
  return expenses;
};

export const updateExpenseService = async (
  id: number,
  school_id: number,
  data: IUpdateExpense
) => {
  if (data.amount !== undefined && data.amount <= 0) {
    throw new AppError('Amount must be greater than 0.', 400);
  }

  const expense = await updateExpense(id, school_id, data);
  if (!expense) throw new AppError('Expense not found.', 404);
  return expense;
};

export const deleteExpenseService = async (id: number, school_id: number) => {
  const expense = await getExpenseById(id, school_id);
  if (!expense) throw new AppError('Expense not found.', 404);

  const deleted = await deleteExpense(id, school_id);
  if (!deleted) throw new AppError('Failed to delete expense.', 500);
};

// ── EXPENSE SUMMARY SERVICES ──

export const getExpenseSummaryService = async (
  school_id: number,
  academic_year_id: number
) => {
  const summary = await getExpenseSummaryByCategory(school_id, academic_year_id);
  const total = await getTotalExpenses(school_id, academic_year_id);

  return {
    total_expenses: total,
    by_category: summary,
  };
};