import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getPublicPlans,
  getActivePlans, getAllPlans, getPlanById, createPlan, updatePlan,
  getMyPlanStatus, getMyPlanHistory,
  getSchoolPlanStatus, activateSubscription,
  getSchoolSubscriptionHistory, getAllSchoolsWithSubscriptions,
  getActiveOffers, getAllOffers, createOffer, updateOffer, deleteOffer,
} from '../Controllers/subscription.controller';

const router = Router();

// ── PUBLIC: For landing page pricing (unauthenticated) ────────────────────────
router.get('/public/plans', getPublicPlans);

router.use(protect);

// ── SCHOOL ADMIN ──────────────────────────────────────────────────────────────
router.get('/me/status',  restrictTo('admin', 'super_admin'), getMyPlanStatus);
router.get('/me/history', restrictTo('admin', 'super_admin'), getMyPlanHistory);
router.get('/plans',      restrictTo('admin', 'super_admin'), getActivePlans);
router.get('/offers',     restrictTo('admin', 'super_admin'), getActiveOffers);  // active only

// ── SUPER ADMIN: plans ────────────────────────────────────────────────────────
// NOTE: /plans/all and /plans/new must come before /plans/:id to avoid
//       'all' and 'new' being matched as an id parameter.
router.get ('/plans/all',  restrictTo('super_admin'), getAllPlans);
router.get ('/plans/:id',  restrictTo('super_admin'), getPlanById);   // ← new: single plan for edit page
router.post('/plans',      restrictTo('super_admin'), createPlan);
router.patch('/plans/:id', restrictTo('super_admin'), updatePlan);

// ── SUPER ADMIN: offers ───────────────────────────────────────────────────────
router.get   ('/offers/all',    restrictTo('super_admin'), getAllOffers);
router.post  ('/offers',        restrictTo('super_admin'), createOffer);
router.patch ('/offers/:id',    restrictTo('super_admin'), updateOffer);
router.delete('/offers/:id',    restrictTo('super_admin'), deleteOffer);

// ── SUPER ADMIN: schools ──────────────────────────────────────────────────────
router.get ('/schools',                   restrictTo('super_admin'), getAllSchoolsWithSubscriptions);
router.get ('/schools/:schoolId/status',  restrictTo('super_admin'), getSchoolPlanStatus);
router.get ('/schools/:schoolId/history', restrictTo('super_admin'), getSchoolSubscriptionHistory);
router.post('/activate',                  restrictTo('super_admin'), activateSubscription);

export default router;
