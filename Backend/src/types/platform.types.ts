export interface IPlatformSettings {
  id: number;
  platform_name: string;
  support_email: string;
  maintenance_mode: boolean;
  updated_at: Date;
  updated_by?: number;
}

export type IUpdatePlatformSettings = Partial<Pick<
  IPlatformSettings,
  'platform_name' | 'support_email' | 'maintenance_mode'
>>;