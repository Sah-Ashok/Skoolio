import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import { getFeeReport, getIncomeExpenseReport } from '../Controllers/finance_report.controller';

const router = Router();

router.use(protect);

router.get('/fees', restrictTo('admin', 'super_admin', 'finance'), getFeeReport);
router.get('/income-expense', restrictTo('admin', 'super_admin', 'finance'), getIncomeExpenseReport);

export default router;
