import pool from '../config/db';
import {
  IExpenseCategory, ICreateExpenseCategory, IUpdateExpenseCategory,
  IExpense, ICreateExpense, IUpdateExpense, IExpenseSummary
} from '../types/expense.types';

// ── EXPENSE CATEGORY QUERIES ──

export const createExpenseCategory = async (
  school_id: number,
  data: ICreateExpenseCategory
): Promise<IExpenseCategory> => {
  const result = await pool.query(
    `INSERT INTO expense_categories (school_id, name)
     VALUES ($1, $2)
     RETURNING *`,
    [school_id, data.name]
  );
  return result.rows[0];
};

export const getExpenseCategoriesBySchool = async (
  school_id: number
): Promise<IExpenseCategory[]> => {
  const result = await pool.query(
    `SELECT * FROM expense_categories WHERE school_id = $1 ORDER BY name ASC`,
    [school_id]
  );
  return result.rows;
};

export const getExpenseCategoryById = async (
  id: number,
  school_id: number
): Promise<IExpenseCategory | null> => {
  const result = await pool.query(
    `SELECT * FROM expense_categories WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const getExpenseCategoryByName = async (
  name: string,
  school_id: number
): Promise<IExpenseCategory | null> => {
  const result = await pool.query(
    `SELECT * FROM expense_categories WHERE name = $1 AND school_id = $2`,
    [name, school_id]
  );
  return result.rows[0] || null;
};

export const updateExpenseCategory = async (
  id: number,
  school_id: number,
  data: IUpdateExpenseCategory
): Promise<IExpenseCategory | null> => {
  const result = await pool.query(
    `UPDATE expense_categories SET
      name       = COALESCE($1, name),
      updated_at = NOW()
     WHERE id = $2 AND school_id = $3
     RETURNING *`,
    [data.name || null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteExpenseCategory = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM expense_categories WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── EXPENSE QUERIES ──

export const createExpense = async (
  school_id: number,
  created_by: number,
  data: ICreateExpense
): Promise<IExpense> => {
  const result = await pool.query(
    `INSERT INTO expenses
      (school_id, academic_year_id, category_id, title, amount, expense_date,
       payment_method, receipt_number, vendor_name, attachment_url, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, school_id, academic_year_id, category_id, title, amount,
       expense_date::text, payment_method, receipt_number, vendor_name,
       attachment_url, description, created_by, created_at, updated_at`,
    [
      school_id,
      data.academic_year_id,
      data.category_id,
      data.title,
      data.amount,
      data.expense_date,
      data.payment_method,
      data.receipt_number || null,
      data.vendor_name || null,
      data.attachment_url || null,
      data.description || null,
      created_by,
    ]
  );
  return result.rows[0];
};

export const getExpensesBySchool = async (
  school_id: number,
  academic_year_id: number
): Promise<IExpense[]> => {
  const result = await pool.query(
    `SELECT e.id, e.school_id, e.academic_year_id, e.category_id, e.title, e.amount,
       e.expense_date::text, e.payment_method, e.receipt_number, e.vendor_name,
       e.attachment_url, e.description, e.created_by, e.created_at, e.updated_at,
       ec.name as category_name
     FROM expenses e
     INNER JOIN expense_categories ec ON ec.id = e.category_id
     WHERE e.school_id = $1 AND e.academic_year_id = $2
     ORDER BY e.expense_date DESC`,
    [school_id, academic_year_id]
  );
  return result.rows;
};

export const getExpenseById = async (
  id: number,
  school_id: number
): Promise<IExpense | null> => {
  const result = await pool.query(
    `SELECT id, school_id, academic_year_id, category_id, title, amount,
       expense_date::text, payment_method, receipt_number, vendor_name,
       attachment_url, description, created_by, created_at, updated_at
     FROM expenses WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const getExpensesByCategory = async (
  category_id: number,
  school_id: number,
  academic_year_id: number
): Promise<IExpense[]> => {
  const result = await pool.query(
    `SELECT id, school_id, academic_year_id, category_id, title, amount,
       expense_date::text, payment_method, receipt_number, vendor_name,
       attachment_url, description, created_by, created_at, updated_at
     FROM expenses
     WHERE category_id = $1 AND school_id = $2 AND academic_year_id = $3
     ORDER BY expense_date DESC`,
    [category_id, school_id, academic_year_id]
  );
  return result.rows;
};

export const updateExpense = async (
  id: number,
  school_id: number,
  data: IUpdateExpense
): Promise<IExpense | null> => {
  const result = await pool.query(
    `UPDATE expenses SET
      category_id     = COALESCE($1, category_id),
      title           = COALESCE($2, title),
      amount          = COALESCE($3, amount),
      expense_date    = COALESCE($4, expense_date),
      payment_method  = COALESCE($5, payment_method),
      receipt_number  = COALESCE($6, receipt_number),
      vendor_name     = COALESCE($7, vendor_name),
      attachment_url  = COALESCE($8, attachment_url),
      description     = COALESCE($9, description),
      updated_at      = NOW()
     WHERE id = $10 AND school_id = $11
     RETURNING id, school_id, academic_year_id, category_id, title, amount,
       expense_date::text, payment_method, receipt_number, vendor_name,
       attachment_url, description, created_by, created_at, updated_at`,
    [
      data.category_id || null,
      data.title || null,
      data.amount || null,
      data.expense_date || null,
      data.payment_method || null,
      data.receipt_number || null,
      data.vendor_name || null,
      data.attachment_url || null,
      data.description || null,
      id,
      school_id,
    ]
  );
  return result.rows[0] || null;
};

export const deleteExpense = async (
  id: number,
  school_id: number
): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM expenses WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── EXPENSE SUMMARY ──

export const getExpenseSummaryByCategory = async (
  school_id: number,
  academic_year_id: number
): Promise<IExpenseSummary[]> => {
  const result = await pool.query(
    `SELECT ec.name as category_name,
       SUM(e.amount) as total_amount,
       COUNT(e.id) as count
     FROM expenses e
     INNER JOIN expense_categories ec ON ec.id = e.category_id
     WHERE e.school_id = $1 AND e.academic_year_id = $2
     GROUP BY ec.name
     ORDER BY total_amount DESC`,
    [school_id, academic_year_id]
  );
  return result.rows;
};

export const getTotalExpenses = async (
  school_id: number,
  academic_year_id: number
): Promise<number> => {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total
     FROM expenses WHERE school_id = $1 AND academic_year_id = $2`,
    [school_id, academic_year_id]
  );
  return Number(result.rows[0].total);
};