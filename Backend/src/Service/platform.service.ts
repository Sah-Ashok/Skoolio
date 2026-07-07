import { getPlatformSettings, updatePlatformSettings } from '../Repositories/platform.repository';
import { IUpdatePlatformSettings } from '../types/platform.types';

export const getPlatformSettingsService = async () => {
  return await getPlatformSettings();
};

export const updatePlatformSettingsService = async (
  updated_by: number,
  data: IUpdatePlatformSettings
) => {
  return await updatePlatformSettings(updated_by, data);
};

// Used by the login flow to check if the platform is locked down.
// Safe fallback: if the platform_settings table doesn't exist yet
// (e.g. migration hasn't been run), we treat maintenance_mode as false
// so login is never blocked by a missing table.
export const isMaintenanceModeActive = async (): Promise<boolean> => {
  try {
    const settings = await getPlatformSettings();
    return settings?.maintenance_mode ?? false;
  } catch (err: any) {
    // PostgreSQL error code 42P01 = "undefined_table"
    // Silently return false so login still works before migration is run
    if (err?.code === '42P01') {
      console.warn(
        '[platform.service] WARNING: "platform_settings" table not found. ' +
        'Run migration_platform_settings.sql to create it. ' +
        'Defaulting maintenance_mode to false.'
      );
      return false;
    }
    // Re-throw any other unexpected DB errors
    throw err;
  }
};