import {
  getActivePlans, getAllPlans, getPlanById, getPlanByName, createPlan, updatePlan,
  createSubscription, getLatestSubscription, getSubscriptionHistory,
  updateSubscriptionStatus, getStudentCount, getTeacherCount, getAllSchoolsWithSubscriptions,
  downgradeToFreeTransaction,
  getActiveOffers, getAllOffers, getOfferById, getActiveOfferByCode, consumeOffer, createOffer, updateOffer, deleteOffer,
} from '../Repositories/subscription.repository';
import {
  ICreatePlan, IUpdatePlan, IActivateSubscription, ICurrentPlanStatus,
  ISubscriptionPlanResolved, ICreateOffer, IUpdateOffer,
} from '../types/subscription.types';
import { resolvePlanPricing } from '../config/currencyConfig';
import AppError from '../utils/AppError';

const GRACE_PERIOD_DAYS = 10;

// ── PLAN SERVICES ──────────────────────────────────────────────────────────────

export const getActivePlansService = async (country?: string): Promise<ISubscriptionPlanResolved[]> => {
  const plans = await getActivePlans();
  return plans.map(plan => ({
    ...plan,
    resolved_pricing: resolvePlanPricing(plan, country),
  }));
};

export const getAllPlansService = async () => {
  return await getAllPlans();
};

export const getPlanByIdService = async (id: number) => {
  const plan = await getPlanById(id);
  if (!plan) throw new AppError('Plan not found.', 404);
  return plan;
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

// ── OFFER SERVICES ────────────────────────────────────────────────────────────

export const getActiveOffersService = async () => {
  return await getActiveOffers();
};

export const getAllOffersService = async () => {
  return await getAllOffers();
};

export const createOfferService = async (data: ICreateOffer) => {
  if (!data.code || !data.title || !data.discount_type || data.discount_value === undefined) {
    throw new AppError('code, title, discount_type and discount_value are required.', 400);
  }
  if (!['percent', 'fixed', 'free_months'].includes(data.discount_type)) {
    throw new AppError('discount_type must be percent, fixed, or free_months.', 400);
  }
  if (data.discount_type === 'percent' && (data.discount_value < 0 || data.discount_value > 100)) {
    throw new AppError('Percent discount must be between 0 and 100.', 400);
  }
  if (data.discount_type === 'free_months' && (!Number.isInteger(Number(data.discount_value)) || Number(data.discount_value) < 1)) {
    throw new AppError('Free months must be a whole number of at least 1.', 400);
  }
  if (data.applies_to_billing && !['monthly', 'yearly'].includes(data.applies_to_billing)) {
    throw new AppError('applies_to_billing must be monthly or yearly.', 400);
  }
  return await createOffer(data);
};

export const updateOfferService = async (id: number, data: IUpdateOffer) => {
  const offer = await getOfferById(id);
  if (!offer) throw new AppError('Offer not found.', 404);
  const updated = await updateOffer(id, data);
  return updated;
};

export const deleteOfferService = async (id: number) => {
  const offer = await getOfferById(id);
  if (!offer) throw new AppError('Offer not found.', 404);
  await deleteOffer(id);
};

// ── CORE: RESOLVE A SCHOOL'S CURRENT PLAN STATUS ──────────────────────────────

export const resolveCurrentPlanStatus = async (school_id: number): Promise<ICurrentPlanStatus> => {
  let latest = await getLatestSubscription(school_id);

  if (!latest) {
    const proPlan = await getPlanByName('Pro');
    if (!proPlan) throw new AppError('Pro plan not configured.', 500);
    const startDate = new Date();
    const endDate = new Date(Date.now() + 14 * 86400000);
    await createSubscription(school_id, {
      school_id,
      plan_id: proPlan.id,
      billing_cycle: 'monthly',
      amount_paid: 0,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      notes: 'Initial 14-Day Free Trial on Pro',
    });
    latest = await getLatestSubscription(school_id);
  }

  if (!latest) throw new AppError('Unable to resolve subscription.', 500);

  let is_in_grace_period = false;
  let days_until_lock: number | null = null;

  if (latest.end_date) {
    const today = new Date();
    const endDate = new Date(latest.end_date);
    const daysSinceExpiry = Math.floor((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceExpiry > GRACE_PERIOD_DAYS) {
      if (latest.status !== 'expired') {
        await updateSubscriptionStatus(latest.id, 'expired');
        const refreshed = await getLatestSubscription(school_id);
        if (refreshed) latest = refreshed;
      }
      is_in_grace_period = false;
      days_until_lock = 0;
    } else if (daysSinceExpiry > 0) {
      is_in_grace_period = true;
      days_until_lock = GRACE_PERIOD_DAYS - daysSinceExpiry;
      if (latest.status === 'active') {
        await updateSubscriptionStatus(latest.id, 'grace_period');
        const refreshed = await getLatestSubscription(school_id);
        if (refreshed) latest = refreshed;
      }
    }
  }

  const currentSub = latest;
  const plan = await getPlanById(currentSub.plan_id);
  if (!plan) throw new AppError('Plan not found.', 404);

  const student_count = await getStudentCount(school_id);
  const teacher_count = await getTeacherCount(school_id);

  const can_add_student = plan.max_students === null || student_count < plan.max_students;
  const can_add_teacher = plan.max_teachers === null || teacher_count < plan.max_teachers;

  return {
    subscription: currentSub,
    plan,
    is_in_grace_period,
    days_until_lock,
    student_count,
    teacher_count,
    can_add_student,
    can_add_teacher,
  };
};

// ── ACTIVATE / RENEW (super_admin action) ──────────────────────────────────────

export const activateSubscriptionService = async (
  activated_by: number,
  data: IActivateSubscription
) => {
  const plan = await getPlanById(data.plan_id);
  if (!plan) throw new AppError('Plan not found.', 404);

  let activation = { ...data };
  if (data.offer_code) {
    const offer = await getActiveOfferByCode(data.offer_code);
    if (!offer) throw new AppError('This offer is inactive, expired, or fully used.', 400);

    const currency = (data.currency || 'NPR').toUpperCase() as 'NPR' | 'INR' | 'USD';
    const months = data.billing_cycle === 'yearly' ? 12 : data.billing_cycle === 'monthly' ? 1 : 0;
    if (data.billing_cycle === 'free') throw new AppError('Offers cannot be used with the Free plan.', 400);
    if (offer.plan_name && offer.plan_name !== plan.name) throw new AppError(`This offer applies to the ${offer.plan_name} plan only.`, 400);
    if (offer.applies_to_billing && offer.applies_to_billing !== data.billing_cycle) throw new AppError(`This offer applies to ${offer.applies_to_billing} billing only.`, 400);
    if (offer.currency_applies_to && offer.currency_applies_to !== currency) throw new AppError(`This offer applies to ${offer.currency_applies_to} payments only.`, 400);
    if (offer.min_months && months < offer.min_months) throw new AppError(`This offer requires at least ${offer.min_months} months of subscription.`, 400);

    const priceKey = `price_${currency.toLowerCase()}_${data.billing_cycle}` as keyof typeof plan;
    const basePrice = Number(plan[priceKey] ?? 0);
    let amount = basePrice;
    let endDate = data.end_date;
    if (offer.discount_type === 'percent') amount = basePrice * (1 - Number(offer.discount_value) / 100);
    if (offer.discount_type === 'fixed') amount = Math.max(0, basePrice - Number(offer.discount_value));
    if (offer.discount_type === 'free_months') {
      amount = 0;
      const start = new Date(data.start_date || new Date().toISOString().split('T')[0]);
      start.setMonth(start.getMonth() + Number(offer.discount_value));
      endDate = start.toISOString().split('T')[0];
    }
    activation = {
      ...data,
      currency,
      amount_paid: Math.round(amount * 100) / 100,
      end_date: endDate,
      notes: [data.notes, `Offer ${offer.code} applied: ${offer.title}`].filter(Boolean).join(' | '),
    };
    if (!await consumeOffer(offer.id)) throw new AppError('This offer has just reached its usage limit.', 409);
  }

  if (activation.billing_cycle !== 'free' && !activation.end_date) {
    throw new AppError('End date is required for paid subscriptions.', 400);
  }

  const subscription = await createSubscription(activated_by, activation);
  return subscription;
};

export const getSubscriptionHistoryService = async (school_id: number) => {
  return await getSubscriptionHistory(school_id);
};

export const getAllSchoolsWithSubscriptionsService = async () => {
  return await getAllSchoolsWithSubscriptions();
};

// ── GUARD HELPERS ──────────────────────────────────────────────────────────────

export const assertCanAddStudent = async (school_id: number) => {
  const status = await resolveCurrentPlanStatus(school_id);
  if (!status.can_add_student) {
    throw new AppError(
      `Your ${status.plan.name} plan allows a maximum of ${status.plan.max_students} students. Please upgrade to add more.`,
      403
    );
  }
};

export const assertCanAddTeacher = async (school_id: number) => {
  const status = await resolveCurrentPlanStatus(school_id);
  if (!status.can_add_teacher) {
    throw new AppError(
      `Your ${status.plan.name} plan allows a maximum of ${status.plan.max_teachers} teachers. Please upgrade to add more.`,
      403
    );
  }
};

export const assertFeeManagementEnabled = async (school_id: number) => {
  const status = await resolveCurrentPlanStatus(school_id);
  if (!status.plan.fee_management_enabled) {
    throw new AppError(
      `Fee Management is not available on the ${status.plan.name} plan. Please upgrade to Pro, Plus, or Ultra.`,
      403
    );
  }
};

export const assertOnlinePaymentEnabled = async (school_id: number) => {
  const status = await resolveCurrentPlanStatus(school_id);
  if (!status.plan.online_payment_enabled) {
    throw new AppError(
      `Online Payment is not available on the ${status.plan.name} plan. Please upgrade to Pro, Plus, or Ultra to accept online payments from students.`,
      403
    );
  }
};
