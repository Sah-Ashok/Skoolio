import pool from '../config/db';
import { PoolClient } from 'pg';
import {
  ISubscriptionPlan, ICreatePlan, IUpdatePlan,
  ISchoolSubscription, IActivateSubscription,
} from '../types/subscription.types';

// ── SUBSCRIPTION PLAN QUERIES ──

export const getActivePlans = async (): Promise<ISubscriptionPlan[]> => {
  const result = await pool.query(
    `SELECT * FROM subscription_plans WHERE is_active = true ORDER BY id ASC`
  );
  return result.rows;
};

export const getAllPlans = async (): Promise<ISubscriptionPlan[]> => {
  const result = await pool.query(`SELECT * FROM subscription_plans ORDER BY id ASC`);
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
      (name, max_students, max_teachers, fee_management_enabled,
       price_npr_monthly, price_npr_yearly,
       price_inr_monthly, price_inr_yearly,
       price_usd_monthly, price_usd_yearly)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.name,
      data.max_students,
      data.max_teachers,
      data.fee_management_enabled,
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
  const result = await pool.query(
    `UPDATE subscription_plans SET
      name                   = COALESCE($1,  name),
      max_students           = COALESCE($2,  max_students),
      max_teachers           = COALESCE($3,  max_teachers),
      fee_management_enabled = COALESCE($4,  fee_management_enabled),
      price_npr_monthly      = COALESCE($5,  price_npr_monthly),
      price_npr_yearly       = COALESCE($6,  price_npr_yearly),
      price_inr_monthly      = COALESCE($7,  price_inr_monthly),
      price_inr_yearly       = COALESCE($8,  price_inr_yearly),
      price_usd_monthly      = COALESCE($9,  price_usd_monthly),
      price_usd_yearly       = COALESCE($10, price_usd_yearly),
      is_active              = COALESCE($11, is_active),
      updated_at             = NOW()
     WHERE id = $12
     RETURNING *`,
    [
      data.name              ?? null,
      data.max_students      ?? null,
      data.max_teachers      ?? null,
      data.fee_management_enabled ?? null,
      data.price_npr_monthly ?? null,
      data.price_npr_yearly  ?? null,
      data.price_inr_monthly ?? null,
      data.price_inr_yearly  ?? null,
      data.price_usd_monthly ?? null,
      data.price_usd_yearly  ?? null,
      data.is_active         ?? null,
      id,
    ]
  );
  return result.rows[0] || null;
};

// ── SCHOOL SUBSCRIPTION QUERIES ──

export const createSubscription = async (
  activated_by: number,
  data: IActivateSubscription
): Promise<ISchoolSubscription> => {
  const result = await pool.query(
    `INSERT INTO school_subscriptions
      (school_id, plan_id, billing_cycle, amount_paid, currency, start_date, end_date, status, payment_method, payment_reference, activated_by, notes)
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
  return result.rows[0];
};

export const getLatestSubscription = async (
  school_id: number
): Promise<(ISchoolSubscription & { plan_name: string; max_students: number | null; max_teachers: number | null; fee_management_enabled: boolean }) | null> => {
  const result = await pool.query(
    `SELECT ss.*, sp.name as plan_name, sp.max_students, sp.max_teachers, sp.fee_management_enabled
     FROM school_subscriptions ss
     INNER JOIN subscription_plans sp ON sp.id = ss.plan_id
     WHERE ss.school_id = $1
     ORDER BY ss.created_at DESC
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

export const updateSubscriptionStatus = async (
  id: number,
  status: string
): Promise<void> => {
  await pool.query(
    `UPDATE school_subscriptions SET status = $1 WHERE id = $2`,
    [status, id]
  );
};

export const getStudentCount = async (school_id: number): Promise<number> => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM students WHERE school_id = $1`,
    [school_id]
  );
  return Number(result.rows[0].count);
};

export const getTeacherCount = async (school_id: number): Promise<number> => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM teachers WHERE school_id = $1`,
    [school_id]
  );
  return Number(result.rows[0].count);
};

// ── ATOMIC GRACE-PERIOD DOWNGRADE ──
// Marks the current subscription expired AND inserts a new Free-plan row in
// one transaction, so a crash between the two steps can never leave a school
// permanently locked out with no active subscription.
export const downgradeToFreeTransaction = async (
  expiredSubscriptionId: number,
  school_id:             number,
  freePlanId:            number,
  notes:                 string
): Promise<void> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Mark the old subscription expired
    await client.query(
      `UPDATE school_subscriptions SET status = 'expired' WHERE id = $1`,
      [expiredSubscriptionId]
    );

    // 2. Insert the new Free plan row
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

// For super admin dashboard — list all schools with their current plan
export const getAllSchoolsWithSubscriptions = async (): Promise<any[]> => {
  const result = await pool.query(
    `SELECT DISTINCT ON (ss.school_id)
       s.id as school_id, s.school_name, s.email, s.is_account, s.country,
       s.is_verified, s.two_fa_enabled,
       ss.id as subscription_id, ss.plan_id, sp.name as plan_name,
       ss.billing_cycle, ss.start_date, ss.end_date, ss.status,
       sp.max_students, sp.max_teachers
     FROM schools s
     LEFT JOIN school_subscriptions ss ON ss.school_id = s.id
     LEFT JOIN subscription_plans sp ON sp.id = ss.plan_id
     ORDER BY ss.school_id, ss.created_at DESC`
  );
  return result.rows;
};