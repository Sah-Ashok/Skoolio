import {
  getActivePlans, getAllPlans, getPlanById, getPlanByName, createPlan, updatePlan,
  createSubscription, getLatestSubscription, getSubscriptionHistory,
  updateSubscriptionStatus, getStudentCount, getTeacherCount, getAllSchoolsWithSubscriptions,
  downgradeToFreeTransaction,
} from '../Repositories/subscription.repository';
import { ICreatePlan, IUpdatePlan, IActivateSubscription, ICurrentPlanStatus } from '../types/subscription.types';
import AppError from '../utils/AppError';

const GRACE_PERIOD_DAYS = 10;

// ── PLAN SERVICES (super_admin manages the catalog) ──

export const getActivePlansService = async () => {
  return await getActivePlans();
};

export const getAllPlansService = async () => {
  return await getAllPlans();
};

export const createPlanService = async (data: ICreatePlan) => {
  const existing = await getPlanByName(data.name);
  if (existing) throw new AppError('A plan with this name already exists.', 400);
  return await createPlan(data);
};

export const updatePlanService = async (id: number, data: IUpdatePlan) => {
  const plan = await updatePlan(id, data);
  if (!plan) throw new AppError('Plan not found.', 404);
  return plan;
};

// ── CORE: RESOLVE A SCHOOL'S CURRENT PLAN STATUS ──
// This is the heart of the whole module — call this whenever you need to know
// if a school can add students/teachers, or whether they need a downgrade applied.

export const resolveCurrentPlanStatus = async (school_id: number): Promise<ICurrentPlanStatus> => {
  let latest = await getLatestSubscription(school_id);

  if (!latest) {
    // Safety net — should never happen after backfill, but just in case
    const freePlan = await getPlanByName('Free');
    if (!freePlan) throw new AppError('Free plan not configured.', 500);
    latest = await createSubscription(school_id, {
      school_id,
      plan_id: freePlan.id,
      billing_cycle: 'free',
    }) as any;
    latest = await getLatestSubscription(school_id);
  }

  if (!latest) throw new AppError('Unable to resolve subscription.', 500);

  let is_in_grace_period = false;
  let days_until_lock: number | null = null;

  // Free plan never expires — nothing to check
  if (latest.billing_cycle !== 'free' && latest.end_date) {
    const today = new Date();
    const endDate = new Date(latest.end_date);
    const daysSinceExpiry = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceExpiry > GRACE_PERIOD_DAYS) {
      // Grace period is over — downgrade to Free now.
      // Both steps (expire old + create Free) run in one transaction so a
      // crash between them can never leave the school permanently locked out.
      const freePlan = await getPlanByName('Free');
      if (!freePlan) throw new AppError('Free plan not configured.', 500);

      await downgradeToFreeTransaction(
        latest.id,
        school_id,
        freePlan.id,
        `Auto-downgraded from ${latest.plan_name} after grace period expired.`
      );

      latest = await getLatestSubscription(school_id);
      if (!latest) throw new AppError('Unable to resolve subscription.', 500);
    } else if (daysSinceExpiry > 0) {
      // Within grace period
      is_in_grace_period = true;
      days_until_lock = GRACE_PERIOD_DAYS - daysSinceExpiry;
      if (latest.status === 'active') {
        await updateSubscriptionStatus(latest.id, 'grace_period');
      }
    }
  }

  const plan = await getPlanById(latest.plan_id);
  if (!plan) throw new AppError('Plan not found.', 404);

  const student_count = await getStudentCount(school_id);
  const teacher_count = await getTeacherCount(school_id);

  const can_add_student = plan.max_students === null || student_count < plan.max_students;
  const can_add_teacher = plan.max_teachers === null || teacher_count < plan.max_teachers;

  return {
    subscription: latest,
    plan,
    is_in_grace_period,
    days_until_lock,
    student_count,
    teacher_count,
    can_add_student,
    can_add_teacher,
  };
};

// ── ACTIVATE / RENEW (super_admin action) ──

export const activateSubscriptionService = async (
  activated_by: number,
  data: IActivateSubscription
) => {
  const plan = await getPlanById(data.plan_id);
  if (!plan) throw new AppError('Plan not found.', 404);

  if (data.billing_cycle !== 'free' && !data.end_date) {
    throw new AppError('End date is required for paid subscriptions.', 400);
  }

  const subscription = await createSubscription(activated_by, data);
  return subscription;
};

export const getSubscriptionHistoryService = async (school_id: number) => {
  return await getSubscriptionHistory(school_id);
};

export const getAllSchoolsWithSubscriptionsService = async () => {
  return await getAllSchoolsWithSubscriptions();
};

// ── GUARD HELPERS (used by student/teacher creation) ──

export const assertCanAddStudent = async (school_id: number) => {
  const status = await resolveCurrentPlanStatus(school_id);
  if (!status.can_add_student) {
    throw new AppError(
      `Your ${status.plan.name} plan allows a maximum of ${status.plan.max_students} students. Please upgrade your plan to add more.`,
      403
    );
  }
};

export const assertCanAddTeacher = async (school_id: number) => {
  const status = await resolveCurrentPlanStatus(school_id);
  if (!status.can_add_teacher) {
    throw new AppError(
      `Your ${status.plan.name} plan allows a maximum of ${status.plan.max_teachers} teachers. Please upgrade your plan to add more.`,
      403
    );
  }
};

export const assertFeeManagementEnabled = async (school_id: number) => {
  const status = await resolveCurrentPlanStatus(school_id);
  if (!status.plan.fee_management_enabled) {
    throw new AppError(
      `Fee Management is not available on the ${status.plan.name} plan. Please upgrade to Pro or Plus to use this feature.`,
      403
    );
  }
};