import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import { getFeeBillingPolicy, upsertFeeBillingPolicy } from '../Controllers/fee_billing_policy.controller';

const router = Router();

router.use(protect);
router.use(restrictTo('admin', 'super_admin', 'finance'));

router.get('/',  getFeeBillingPolicy);
router.put('/',  upsertFeeBillingPolicy);

export default router;
