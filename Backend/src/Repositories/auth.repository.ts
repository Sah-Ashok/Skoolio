import pool from '../config/db';
import { IRegisterSchool, ISchool } from '../types/auth.types';

// ── SCHOOL CRUD ─────────────────────────────────────────────────────────────

export const createSchool = async (
  data: IRegisterSchool & { school_code: string }
): Promise<ISchool> => {
  const result = await pool.query(
    `INSERT INTO schools
      (school_name, school_code, city, state, country, pincode, phone, email, owner_full_name, password, logo, established_year, school_type, timezone)
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING id, school_name, school_code, city, state, country, pincode, phone, email, owner_full_name, logo, established_year, school_type, role, is_account, is_verified, timezone, two_fa_enabled, subscription_id, created_at, updated_at`,
    [
      data.school_name, data.school_code, data.city, data.state,
      data.country, data.pincode || null, data.phone, data.email,
      data.owner_full_name, data.password, data.logo || null,
      data.established_year || null, data.school_type, data.timezone,
    ]
  );
  return result.rows[0];
};

export const findSchoolByEmailSafe = async (
  email: string
): Promise<Omit<ISchool, 'password'> | null> => {
  const result = await pool.query(
    `SELECT id, school_name, school_code, city, state, country, pincode, phone, email, owner_full_name,
            logo, established_year, school_type, role, is_account, is_verified, timezone,
            two_fa_enabled, subscription_id, created_at, updated_at
     FROM schools WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

export const findSchoolByEmail = async (email: string): Promise<ISchool | null> => {
  const result = await pool.query(`SELECT * FROM schools WHERE email = $1`, [email]);
  return result.rows[0] || null;
};

export const findSchoolByPhone = async (phone: string): Promise<ISchool | null> => {
  const result = await pool.query(`SELECT * FROM schools WHERE phone = $1`, [phone]);
  return result.rows[0] || null;
};

export const findSchoolById = async (id: number): Promise<ISchool | null> => {
  const result = await pool.query(`SELECT * FROM schools WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

export const findSchoolByIdSafe = async (id: number): Promise<Omit<ISchool, 'password'> | null> => {
  const result = await pool.query(
    `SELECT id, school_name, school_code, city, state, country, pincode, phone, email, owner_full_name,
            logo, established_year, school_type, role, is_account, is_verified, timezone,
            two_fa_enabled, subscription_id, created_at, updated_at
     FROM schools WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// ── SCHOOL SETTINGS ──────────────────────────────────────────────────────────

export type IUpdateSchoolSettings = {
  school_name?:      string;
  school_type?:      string;
  established_year?: number | null;
  city?:             string;
  state?:            string;
  country?:          string;
  pincode?:          string;
  phone?:            string;
  logo?:             string;
  timezone?:         string;
  owner_full_name?:  string;
};

export const updateSchoolSettingsRepo = async (
  schoolId: number,
  data: IUpdateSchoolSettings
): Promise<Omit<ISchool, 'password'> | null> => {
  const fields: string[] = [];
  const values: any[]    = [];
  let   idx              = 1;

  const allowed: (keyof IUpdateSchoolSettings)[] = [
    'school_name', 'school_type', 'established_year', 'city',
    'state', 'country', 'pincode', 'phone', 'logo', 'timezone', 'owner_full_name',
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return findSchoolByIdSafe(schoolId);

  values.push(schoolId);

  const result = await pool.query(
    `UPDATE schools
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING id, school_name, school_code, city, state, country, pincode, phone, email, owner_full_name,
               logo, established_year, school_type, role, is_account, is_verified, timezone,
               two_fa_enabled, subscription_id, created_at, updated_at`,
    values
  );
  return result.rows[0] || null;
};

export const updateSchoolPassword = async (
  schoolId: number,
  hashedPassword: string
): Promise<void> => {
  await pool.query(
    `UPDATE schools SET password = $1, updated_at = NOW() WHERE id = $2`,
    [hashedPassword, schoolId]
  );
};

// ── 2FA ──────────────────────────────────────────────────────────────────────

export const toggleSchoolTwoFA = async (
  schoolId: number,
  enabled: boolean
): Promise<void> => {
  await pool.query(
    `UPDATE schools SET two_fa_enabled = $1, updated_at = NOW() WHERE id = $2`,
    [enabled, schoolId]
  );
};

export const blockUnblockSchool = async (
  schoolId: number,
  action: 'block' | 'unblock'
): Promise<Omit<ISchool, 'password'> | null> => {
  const result = await pool.query(
    `UPDATE schools
     SET is_account = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, school_name, is_account`,
    [action === 'block' ? 'blocked' : 'active', schoolId]
  );
  return result.rows[0] || null;
};

// ── OTP ──────────────────────────────────────────────────────────────────────

export const createOTP = async (
  email: string,
  code: string,
  type: 'forgot_password' | 'two_fa',
  expiresAt: Date
): Promise<void> => {
  // Invalidate any existing unused OTPs of this type for this email first
  await pool.query(
    `UPDATE otp_codes SET used = TRUE
     WHERE email = $1 AND type = $2 AND used = FALSE`,
    [email, type]
  );
  await pool.query(
    `INSERT INTO otp_codes (email, code, type, expires_at) VALUES ($1, $2, $3, $4)`,
    [email, code, type, expiresAt]
  );
};

export const findValidOTP = async (
  email: string,
  code: string,
  type: 'forgot_password' | 'two_fa'
): Promise<{ id: number } | null> => {
  const result = await pool.query(
    `SELECT id FROM otp_codes
     WHERE email = $1 AND code = $2 AND type = $3
       AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, code, type]
  );
  return result.rows[0] || null;
};

export const markOTPUsed = async (id: number): Promise<void> => {
  await pool.query(`UPDATE otp_codes SET used = TRUE WHERE id = $1`, [id]);
};
