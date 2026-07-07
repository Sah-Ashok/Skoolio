import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createExpenseCategory, getExpenseCategories, updateExpenseCategory, deleteExpenseCategory,
  createExpense, getExpenses, getExpenseById, getExpensesByCategory,
  updateExpense, deleteExpense, getExpenseSummary,
} from '../Controllers/expense.controller';

const router = Router();

router.use(protect, restrictTo('admin', 'super_admin'));

// ── EXPENSE CATEGORY ROUTES ──
router.post('/categories', createExpenseCategory);
router.get('/categories', getExpenseCategories);
router.patch('/categories/:id', updateExpenseCategory);
router.delete('/categories/:id', deleteExpenseCategory);

// ── EXPENSE ROUTES ──
router.post('/', createExpense);
router.get('/', getExpenses);
router.get('/summary', getExpenseSummary);
router.get('/:id', getExpenseById);
router.get('/category/:categoryId', getExpensesByCategory);
router.patch('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;