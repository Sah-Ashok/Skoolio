-- ============================================================
-- Skoolio Cloud ERP: 2FA TOTP Authenticator & Device Login History
-- Run this migration against your PostgreSQL Database
-- ============================================================

-- 1. Add TOTP Authenticator columns to Schools (Admin / Super Admin)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT[];

-- 2. Add TOTP Authenticator columns to Finance Users (Finance Portal)
ALTER TABLE public.finance_users
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT[];

-- 3. Add TOTP Authenticator columns to Teachers (Faculty Portal)
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS totp_recovery_codes TEXT[];

-- 4. Create User Devices & Smart Login History Table
CREATE TABLE IF NOT EXISTS public.user_devices (
    id SERIAL PRIMARY KEY,
    school_id INT REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id INT NOT NULL,
    role VARCHAR(50) NOT NULL,
    device_hash VARCHAR(64) NOT NULL,
    browser VARCHAR(100),
    os VARCHAR(100),
    ip_address VARCHAR(45),
    location VARCHAR(100),
    is_trusted BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_user_role_device UNIQUE (user_id, role, device_hash)
);

-- 5. Create Fast Indexes for Device Fingerprint & Telemetry Lookups
CREATE INDEX IF NOT EXISTS idx_user_devices_lookup
  ON public.user_devices (user_id, role, device_hash);

CREATE INDEX IF NOT EXISTS idx_user_devices_school
  ON public.user_devices (school_id);
