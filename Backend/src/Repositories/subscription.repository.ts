import pool from '../config/db';
import { PoolClient } from 'pg';
import {
  ISubscriptionPlan, ICreatePlan, IUpdatePlan,
  ISchoolSubscription, IActivateSubscription,
  ISubscriptionOffer, ICreateOffer, IUpdateOffer,
} from '../types/subscription.types';

// ── SUBSCRIPTION PLAN QUERIES ──────────────────────────────────────────────────

export const getActivePlans = async (): Promise<ISubscriptionPlan[]> => {
  const result = await pool.query(
    `SELECT * FROM subscription_plans WHERE is_active = true AND name != 'Free' ORDER BY id ASC`
  );
  return result.rows;
};

export const getAllPlans = async (): Promise<ISubscriptionPlan[]> => {
  const result = await pool.query(
    `SELECT * FROM subscription_plans WHERE name != 'Free' ORDER BY id ASC`
  );
  return result.rows;
};

export const getPlanById = async (id: number): Promise<ISubscriptionPlan | null> => {
  const result = await pool.query(`SELECT * FROM subscription_plans WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

export const getPlanByName = async (name: string): Promise<ISubscriptionPlan | null> => {
  const result = await pool.query(`SELECT * FROM subscription_plans WHERE name = $1`, [name]);
  return result.rows[0] || null;
};

export const createPlan = async (data: ICreatePlan): Promise<ISubscriptionPlan> => {
  const result = await pool.query(
    `INSERT INTO subscription_plans
      (name, max_students, max_teachers, fee_management_enabled, online_payment_enabled,
       price_npr_monthly, price_npr_yearly,
       price_inr_monthly, price_inr_yearly,
       price_usd_monthly, price_usd_yearly)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.name,
      data.max_students,
      data.max_teachers,
      data.fee_management_enabled,
      data.online_payment_enabled ?? false,
      data.price_npr_monthly,
      data.price_npr_yearly,
      data.price_inr_monthly,
      data.price_inr_yearly,
      data.price_usd_monthly ?? 0,
      data.price_usd_yearly  ?? 0,
    ]
  );
  return result.rows[0];
};

export const updatePlan = async (
  id: number,
  data: IUpdatePlan
): Promise<ISubscriptionPlan | null> => {
  const allowedFields: (keyof IUpdatePlan)[] = [
    'name',
    'max_students',
    'max_teachers',
    'fee_management_enabled',
    'online_payment_enabled',
    'price_npr_monthly',
    'price_npr_yearly',
    'price_inr_monthly',
    'price_inr_yearly',
    'price_usd_monthly',
    'price_usd_yearly',
    'is_active',
  ];

  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIdx = 1;

  for (const field of allowedFields) {
    if (field in data) {
      setClauses.push(`${field} = $${paramIdx++}`);
      values.push((data as any)[field] ?? null);
    }
  }

  if (setClauses.length === 0) {
    return getPlanById(id);
  }

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const query = `UPDATE subscription_plans SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
};

// ── SCHOOL SUBSCRIPTION QUERIES ────────────────────────────────────────────────

export const createSubscription = async (
  activated_by: number,
  data: IActivateSubscription
): Promise<ISchoolSubscription> => {
  // Expire any existing active or grace period subscriptions so only 1 active subscription exists
  await pool.query(
    `UPDATE school_subscriptions 
     SET status = 'expired' 
     WHERE school_id = $1 AND status IN ('active', 'grace_period')`,
    [data.school_id]
  );

  const result = await pool.query(
    `INSERT INTO school_subscriptions
      (school_id, plan_id, billing_cycle, amount_paid, currency, start_date, end_date,
       status, payment_method, payment_reference, activated_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9, $10, $11)
     RETURNING *`,
    [
      data.school_id,
      data.plan_id,
      data.billing_cycle,
      data.amount_paid || 0,
      data.currency || null,
      data.start_date || new Date().toISOString().split('T')[0],
      data.end_date || null,
      data.payment_method || null,
      data.payment_reference || null,
      activated_by,
      data.notes || null,
    ]
  );
  const sub = result.rows[0];
  if (sub?.id) {
    try {
      await pool.query(
        `UPDATE schools SET subscription_id = $1, updated_at = NOW() WHERE id = $2`,
        [sub.id, data.school_id]
      );
    } catch (err: any) {
      console.warn('[Subscription] Failed to update schools.subscription_id:', err.message);
    }
  }
  return sub;
};

export const getLatestSubscription = async (
  school_id: number
): Promise<(ISchoolSubscription & { plan_name: string; max_students: number | null; max_teachers: number | null; fee_management_enabled: boolean; online_payment_enabled: boolean }) | null> => {
  const result = await pool.query(
    `SELECT ss.*, sp.name as plan_name, sp.max_students, sp.max_teachers,
            sp.fee_management_enabled, sp.online_payment_enabled
     FROM school_subscriptions ss
     INNER JOIN subscription_plans sp ON sp.id = ss.plan_id
     WHERE ss.school_id = $1
     ORDER BY 
       CASE WHEN ss.status = 'active' THEN 1 WHEN ss.status = 'grace_period' THEN 2 ELSE 3 END ASC,
       ss.created_at DESC, ss.id DESC
     LIMIT 1`,
    [school_id]
  );
  return result.rows[0] || null;
};

export const getSubscriptionHistory = async (
  school_id: number
): Promise<ISchoolSubscription[]> => {
  const result = await pool.query(
    `SELECT ss.*, sp.name as plan_name
     FROM school_subscriptions ss
     INNER JOIN subscription_plans sp ON sp.id = ss.plan_id
     WHERE ss.school_id = $1
     ORDER BY ss.created_at DESC`,
    [school_id]
  );
  return result.rows;
};

export const updateSubscriptionStatus = async (id: number, status: string): Promise<void> => {
  await pool.query(`UPDATE school_subscriptions SET status = $1 WHERE id = $2`, [status, id]);
};

export const getStudentCount = async (school_id: number): Promise<number> => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM students WHERE school_id = $1`,
    [school_id]
  );
  return Number(result.rows[0].count);
};

export const getTotalStaffCount = async (school_id: number): Promise<number> => {
  const result = await pool.query(
    `SELECT 
      (SELECT COUNT(*) FROM teachers WHERE school_id = $1 AND (status IS NULL OR status != 'inactive')) +
      (SELECT COUNT(*) FROM staff WHERE school_id = $1 AND (status IS NULL OR status != 'inactive')) as count`,
    [school_id]
  );
  return Number(result.rows[0].count);
};

export const getTeacherCount = async (school_id: number): Promise<number> => {
  return getTotalStaffCount(school_id);
};

export const downgradeToFreeTransaction = async (
  expiredSubscriptionId: number,
  school_id:             number,
  freePlanId:            number,
  notes:                 string
): Promise<void> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE school_subscriptions SET status = 'expired' WHERE id = $1`,
      [expiredSubscriptionId]
    );
    await client.query(
      `INSERT INTO school_subscriptions
        (school_id, plan_id, billing_cycle, amount_paid, start_date, end_date, status, activated_by, notes)
       VALUES ($1, $2, 'free', 0, NOW()::date, NULL, 'active', $1, $3)`,
      [school_id, freePlanId, notes]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getAllSchoolsWithSubscriptions = async (): Promise<any[]> => {
  const result = await pool.query(
    `SELECT DISTINCT ON (s.id)
       s.id as school_id, s.school_name, s.email, s.is_account, s.country,
       s.is_verified, s.two_fa_enabled,
       ss.id as subscription_id, ss.plan_id, sp.name as plan_name,
       ss.billing_cycle, ss.start_date, ss.end_date, ss.status, ss.amount_paid, ss.currency,
       sp.max_students, sp.max_teachers, sp.fee_management_enabled, sp.online_payment_enabled
     FROM schools s
     LEFT JOIN school_subscriptions ss ON ss.school_id = s.id
     LEFT JOIN subscription_plans sp ON sp.id = ss.plan_id
     ORDER BY s.id,
       CASE WHEN ss.status = 'active' THEN 1 WHEN ss.status = 'grace_period' THEN 2 ELSE 3 END ASC,
       ss.created_at DESC NULLS LAST, ss.id DESC NULLS LAST`
  );
  return result.rows;
};

// ── OFFERS QUERIES ────────────────────────────────────────────────────────────

export const getActiveOffers = async (): Promise<ISubscriptionOffer[]> => {
  const result = await pool.query(
    `SELECT * FROM subscription_offers
     WHERE is_active = true
       AND valid_from <= CURRENT_DATE
       AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
       AND (max_uses IS NULL OR uses_count < max_uses)
     ORDER BY created_at ASC`
  );
  return result.rows;
};

export const getAllOffers = async (): Promise<ISubscriptionOffer[]> => {
  const result = await pool.query(
    `SELECT * FROM subscription_offers ORDER BY created_at DESC`
  );
  return result.rows;
};

export const getOfferById = async (id: number): Promise<ISubscriptionOffer | null> => {
  const result = await pool.query(`SELECT * FROM subscription_offers WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

export const getActiveOfferByCode = async (code: string): Promise<ISubscriptionOffer | null> => {
  const result = await pool.query(
    `SELECT * FROM subscription_offers
     WHERE UPPER(code) = UPPER($1) AND is_active = true
       AND valid_from <= CURRENT_DATE
       AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
       AND (max_uses IS NULL OR uses_count < max_uses)
     LIMIT 1`,
    [code.trim()]
  );
  return result.rows[0] || null;
};

/** Returns false when another activation has consumed the final available use. */
export const consumeOffer = async (id: number): Promise<boolean> => {
  const result = await pool.query(
    `UPDATE subscription_offers SET uses_count = uses_count + 1, updated_at = NOW()
     WHERE id = $1 AND (max_uses IS NULL OR uses_count < max_uses)
     RETURNING id`,
    [id]
  );
  return result.rowCount === 1;
};

export const createOffer = async (data: ICreateOffer): Promise<ISubscriptionOffer> => {
  const result = await pool.query(
    `INSERT INTO subscription_offers
      (code, title, description, plan_name, discount_type, discount_value,
       applies_to_billing, min_months, saving_text, currency_applies_to,
       max_uses, valid_from, valid_until, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      data.code.trim().toUpperCase(),
      data.title,
      data.description           || null,
      data.plan_name             || null,
      data.discount_type,
      data.discount_value,
      data.applies_to_billing    || null,
      data.min_months            || null,
      data.saving_text           || null,
      data.currency_applies_to   || null,
      data.max_uses              || null,
      data.valid_from            || new Date().toISOString().split('T')[0],
      data.valid_until           || null,
      data.is_active             ?? true,
    ]
  );
  return result.rows[0];
};

export const updateOffer = async (
  id: number,
  data: IUpdateOffer
): Promise<ISubscriptionOffer | null> => {
  const result = await pool.query(
    `UPDATE subscription_offers SET
      title              = COALESCE($1,  title),
      description        = COALESCE($2,  description),
      plan_name          = COALESCE($3,  plan_name),
      discount_type      = COALESCE($4,  discount_type),
      discount_value     = COALESCE($5,  discount_value),
      applies_to_billing = COALESCE($6,  applies_to_billing),
      min_months         = COALESCE($7,  min_months),
      saving_text        = COALESCE($8,  saving_text),
      currency_applies_to = COALESCE($9, currency_applies_to),
      max_uses           = COALESCE($10, max_uses),
      valid_from         = COALESCE($11, valid_from),
      valid_until        = COALESCE($12, valid_until),
      is_active          = COALESCE($13, is_active),
      updated_at         = NOW()
     WHERE id = $14
     RETURNING *`,
    [
      data.title              ?? null,
      data.description        ?? null,
      data.plan_name          ?? null,
      data.discount_type      ?? null,
      data.discount_value     ?? null,
      data.applies_to_billing ?? null,
      data.min_months         ?? null,
      data.saving_text        ?? null,
      data.currency_applies_to ?? null,
      data.max_uses           ?? null,
      data.valid_from         ?? null,
      data.valid_until        ?? null,
      data.is_active          ?? null,
      id,
    ]
  );
  return result.rows[0] || null;
};

export const deleteOffer = async (id: number): Promise<void> => {
  await pool.query(`DELETE FROM subscription_offers WHERE id = $1`, [id]);
};
