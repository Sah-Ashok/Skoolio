import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getActivePlans, getAllPlans, createPlan, updatePlan,
  getMyPlanStatus, getMyPlanHistory, getSchoolPlanStatus, activateSubscription,
  getSchoolSubscriptionHistory, getAllSchoolsWithSubscriptions,
} from '../Controllers/subscription.controller';

const router = Router();

router.use(protect);

// ── SCHOOL ADMIN ROUTES (their own plan) ──
router.get('/me/status', restrictTo('admin', 'super_admin'), getMyPlanStatus);
router.get('/me/history', restrictTo('admin', 'super_admin'), getMyPlanHistory);
router.get('/plans', restrictTo('admin', 'super_admin'), getActivePlans);

// ── SUPER ADMIN ROUTES ──
router.get('/plans/all', restrictTo('super_admin'), getAllPlans);
router.post('/plans', restrictTo('super_admin'), createPlan);
router.patch('/plans/:id', restrictTo('super_admin'), updatePlan);

router.get('/schools', restrictTo('super_admin'), getAllSchoolsWithSubscriptions);
router.get('/schools/:schoolId/status', restrictTo('super_admin'), getSchoolPlanStatus);
router.get('/schools/:schoolId/history', restrictTo('super_admin'), getSchoolSubscriptionHistory);
router.post('/activate', restrictTo('super_admin'), activateSubscription);

export default router;