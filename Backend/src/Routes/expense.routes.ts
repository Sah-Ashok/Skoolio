import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createExpenseCategory, getExpenseCategories, updateExpenseCategory, deleteExpenseCategory,
  createExpense, getExpenses, getExpenseById, getExpensesByCategory,
  updateExpense, deleteExpense, getExpenseSummary,
} from '../Controllers/expense.controller';

const router = Router();

router.use(protect);

// ── EXPENSE CATEGORY ROUTES ──
router.post('/categories',        restrictTo('finance', 'super_admin'), createExpenseCategory);
router.get('/categories',         restrictTo('admin', 'super_admin', 'finance'), getExpenseCategories);
router.patch('/categories/:id',   restrictTo('finance', 'super_admin'), updateExpenseCategory);
router.delete('/categories/:id',  restrictTo('finance', 'super_admin'), deleteExpenseCategory);

// ── EXPENSE ROUTES ──
router.post('/',                  restrictTo('finance', 'super_admin'), createExpense);
router.get('/',                   restrictTo('admin', 'super_admin', 'finance'), getExpenses);
router.get('/summary',            restrictTo('admin', 'super_admin', 'finance'), getExpenseSummary);
router.get('/:id',                restrictTo('admin', 'super_admin', 'finance'), getExpenseById);
router.get('/category/:categoryId', restrictTo('admin', 'super_admin', 'finance'), getExpensesByCategory);
router.patch('/:id',              restrictTo('finance', 'super_admin'), updateExpense);
router.delete('/:id',             restrictTo('finance', 'super_admin'), deleteExpense);

export default router;