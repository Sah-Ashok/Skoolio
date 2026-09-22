import pool from '../config/db';

export interface IUserDeviceRecord {
  id: number;
  school_id: number | null;
  user_id: number;
  role: string;
  device_hash: string;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  is_trusted: boolean;
  created_at: Date;
  last_login_at: Date;
}

export interface ITOTPUserData {
  id: number;
  email: string;
  totp_secret: string | null;
  totp_enabled: boolean;
  totp_recovery_codes: string[] | null;
}

/**
  Map user role to DB table name for TOTP settings
 */
const getTableNameForRole = (role: string): string => {
  if (role === 'admin' || role === 'super_admin' || role === 'school_admin') {
    return 'public.schools';
  }
  if (role === 'finance' || role === 'finance_manager') {
    return 'public.finance_users';
  }
  if (role === 'teacher' || role === 'faculty') {
    return 'public.teachers';
  }
  return 'public.schools';
};

export const getTOTPSettingsRepo = async (
  userId: number,
  role: string
): Promise<ITOTPUserData | null> => {
  const table = getTableNameForRole(role);
  const query = `
    SELECT id, email, totp_secret, COALESCE(totp_enabled, false) AS totp_enabled, totp_recovery_codes
    FROM ${table}
    WHERE id = $1
    LIMIT 1;
  `;
  const res = await pool.query(query, [userId]);
  return res.rows[0] || null;
};

export const updateTOTPSecretRepo = async (
  userId: number,
  role: string,
  totpSecret: string | null,
  recoveryCodes: string[] | null
): Promise<void> => {
  const table = getTableNameForRole(role);
  const query = `
    UPDATE ${table}
    SET totp_secret = $1, totp_recovery_codes = $2
    WHERE id = $3;
  `;
  await pool.query(query, [totpSecret, recoveryCodes, userId]);
};

export const updateTOTPEnableRepo = async (
  userId: number,
  role: string,
  enabled: boolean
): Promise<void> => {
  const table = getTableNameForRole(role);
  const query = `
    UPDATE ${table}
    SET totp_enabled = $1
    WHERE id = $2;
  `;
  await pool.query(query, [enabled, userId]);
};

export const disableTOTPRepo = async (
  userId: number,
  role: string
): Promise<void> => {
  const table = getTableNameForRole(role);
  const query = `
    UPDATE ${table}
    SET totp_secret = NULL, totp_enabled = FALSE, totp_recovery_codes = NULL
    WHERE id = $1;
  `;
  await pool.query(query, [userId]);
};

// ── DEVICE FINGERPRINTING & LOGIN HISTORY ────────────────────────────────────

export const findDeviceByHashRepo = async (
  userId: number,
  role: string,
  deviceHash: string
): Promise<IUserDeviceRecord | null> => {
  const query = `
    SELECT * FROM public.user_devices
    WHERE user_id = $1 AND role = $2 AND device_hash = $3
    LIMIT 1;
  `;
  const res = await pool.query(query, [userId, role, deviceHash]);
  return res.rows[0] || null;
};

export const upsertUserDeviceRepo = async (
  schoolId: number | null,
  userId: number,
  role: string,
  deviceHash: string,
  browser: string,
  os: string,
  ipAddress: string,
  location: string = 'Unknown'
): Promise<{ isNew: boolean; device: IUserDeviceRecord }> => {
  const existing = await findDeviceByHashRepo(userId, role, deviceHash);

  if (existing) {
    const updateQuery = `
      UPDATE public.user_devices
      SET last_login_at = NOW(), ip_address = $1, browser = $2, os = $3
      WHERE id = $4
      RETURNING *;
    `;
    const res = await pool.query(updateQuery, [ipAddress, browser, os, existing.id]);
    return { isNew: false, device: res.rows[0] };
  } else {
    const insertQuery = `
      INSERT INTO public.user_devices
        (school_id, user_id, role, device_hash, browser, os, ip_address, location, is_trusted, created_at, last_login_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(insertQuery, [
      schoolId, userId, role, deviceHash, browser, os, ipAddress, location,
    ]);
    return { isNew: true, device: res.rows[0] };
  }
};

export const getUserDevicesRepo = async (
  userId: number,
  role: string
): Promise<IUserDeviceRecord[]> => {
  const query = `
    SELECT * FROM public.user_devices
    WHERE user_id = $1 AND role = $2
    ORDER BY last_login_at DESC;
  `;
  const res = await pool.query(query, [userId, role]);
  return res.rows;
};

export const deleteUserDeviceRepo = async (
  deviceId: number,
  userId: number,
  role: string
): Promise<boolean> => {
  const query = `
    DELETE FROM public.user_devices
    WHERE id = $1 AND user_id = $2 AND role = $3;
  `;
  const res = await pool.query(query, [deviceId, userId, role]);
  return (res.rowCount ?? 0) > 0;
};
