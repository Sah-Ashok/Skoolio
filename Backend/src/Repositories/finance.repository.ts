import pool from '../config/db';
import { IFinanceUser, ICreateFinanceUser, IUpdateFinanceUser } from '../types/finance.types';

export const findFinanceUserBySchoolId = async (
  school_id: number
): Promise<Omit<IFinanceUser, 'password'> | null> => {
  const result = await pool.query(
    `SELECT id, school_id, full_name, email, phone, status, photo, role, last_login_at, created_at, updated_at
     FROM finance_users
     WHERE school_id = $1`,
    [school_id]
  );
  return result.rows[0] || null;
};

export const findFinanceUserById = async (
  id: number
): Promise<(Omit<IFinanceUser, 'password'> & {
  school_name: string;
  school_code: string;
  logo: string | null;
  timezone: string;
  calendar_system: string;
  is_account: 'active' | 'blocked';
}) | null> => {
  const result = await pool.query(
    `SELECT f.id, f.school_id, f.full_name, f.email, f.phone, f.status, f.photo, f.role,
            f.last_login_at, f.created_at, f.updated_at,
            s.school_name, s.school_code, s.logo, s.timezone, s.calendar_system, s.is_account
     FROM finance_users f
     INNER JOIN schools s ON s.id = f.school_id
     WHERE f.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

export const findFinanceUserByEmailGlobal = async (
  email: string
): Promise<(IFinanceUser & {
  school_name: string;
  school_code: string;
  school_logo: string | null;
  school_timezone: string;
  school_account_status: string;
  school_calendar_system: string;
  plan_name: string | null;
}) | null> => {
  const result = await pool.query(
    `SELECT f.*,
            s.school_name,
            s.school_code,
            s.logo AS school_logo,
            s.timezone AS school_timezone,
            s.is_account AS school_account_status,
            s.calendar_system AS school_calendar_system,
            latest_sub.plan_name
     FROM finance_users f
     INNER JOIN schools s ON s.id = f.school_id
     LEFT JOIN LATERAL (
       SELECT sp.name AS plan_name
       FROM school_subscriptions ss
       INNER JOIN subscription_plans sp ON sp.id = ss.plan_id
       WHERE ss.school_id = f.school_id
       ORDER BY 
         CASE WHEN ss.status = 'active' THEN 1 WHEN ss.status = 'grace_period' THEN 2 ELSE 3 END ASC,
         ss.created_at DESC, ss.id DESC
       LIMIT 1
     ) latest_sub ON true
     WHERE LOWER(f.email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
};

export const createFinanceUser = async (
  school_id: number,
  data: ICreateFinanceUser,
  hashedPassword: string
): Promise<Omit<IFinanceUser, 'password'>> => {
  const result = await pool.query(
    `INSERT INTO finance_users (school_id, full_name, email, phone, password, status, role)
     VALUES ($1, $2, LOWER($3), $4, $5, 'active', 'finance')
     RETURNING id, school_id, full_name, email, phone, status, photo, role, last_login_at, created_at, updated_at`,
    [school_id, data.full_name, data.email, data.phone || null, hashedPassword]
  );
  return result.rows[0];
};

export const updateFinanceUser = async (
  school_id: number,
  data: IUpdateFinanceUser,
  hashedPassword?: string
): Promise<Omit<IFinanceUser, 'password'> | null> => {
  const fields: string[] = ['updated_at = NOW()'];
  const values: any[] = [];
  let paramIdx = 1;

  if (data.full_name !== undefined) {
    fields.push(`full_name = $${paramIdx++}`);
    values.push(data.full_name);
  }
  if (data.email !== undefined) {
    fields.push(`email = LOWER($${paramIdx++})`);
    values.push(data.email);
  }
  if (data.phone !== undefined) {
    fields.push(`phone = $${paramIdx++}`);
    values.push(data.phone);
  }
  if (data.status !== undefined) {
    fields.push(`status = $${paramIdx++}`);
    values.push(data.status);
  }
  if (hashedPassword) {
    fields.push(`password = $${paramIdx++}`);
    values.push(hashedPassword);
  }

  values.push(school_id);

  const result = await pool.query(
    `UPDATE finance_users
     SET ${fields.join(', ')}
     WHERE school_id = $${paramIdx}
     RETURNING id, school_id, full_name, email, phone, status, photo, role, last_login_at, created_at, updated_at`,
    values
  );
  return result.rows[0] || null;
};

export const deleteFinanceUser = async (school_id: number): Promise<boolean> => {
  const result = await pool.query(`DELETE FROM finance_users WHERE school_id = $1`, [school_id]);
  return (result.rowCount ?? 0) > 0;
};

export const updateFinanceLastLogin = async (id: number): Promise<void> => {
  await pool.query(`UPDATE finance_users SET last_login_at = NOW() WHERE id = $1`, [id]);
};
