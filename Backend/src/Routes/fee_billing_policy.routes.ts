import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import { getFeeBillingPolicy, upsertFeeBillingPolicy } from '../Controllers/fee_billing_policy.controller';

const router = Router();

router.use(protect);

router.get('/', restrictTo('admin', 'super_admin', 'finance', 'student'), getFeeBillingPolicy);
router.put('/', restrictTo('admin', 'super_admin', 'finance'), upsertFeeBillingPolicy);

export default router;
