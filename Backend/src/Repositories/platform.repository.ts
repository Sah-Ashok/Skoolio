import pool from '../config/db';
import { IPlatformSettings, IUpdatePlatformSettings } from '../types/platform.types';

export const getPlatformSettings = async (): Promise<IPlatformSettings> => {
  const result = await pool.query(`SELECT * FROM platform_settings ORDER BY id ASC LIMIT 1`);
  return result.rows[0];
};

export const updatePlatformSettings = async (
  updated_by: number,
  data: IUpdatePlatformSettings
): Promise<IPlatformSettings> => {
  const result = await pool.query(
    `UPDATE platform_settings SET
      platform_name    = COALESCE($1, platform_name),
      support_email    = COALESCE($2, support_email),
      maintenance_mode = COALESCE($3, maintenance_mode),
      updated_at       = NOW(),
      updated_by       = $4
     WHERE id = (SELECT id FROM platform_settings ORDER BY id ASC LIMIT 1)
     RETURNING *`,
    [
      data.platform_name || null,
      data.support_email || null,
      data.maintenance_mode ?? null,
      updated_by,
    ]
  );
  return result.rows[0];
};