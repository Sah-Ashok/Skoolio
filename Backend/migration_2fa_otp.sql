-- ============================================================
-- School-POS Migration: Email OTP + 2FA support
-- Run this once against your PostgreSQL database
-- ============================================================

-- 1. Add two_fa_enabled column to schools
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. OTP codes table (forgot_password + two_fa)
CREATE TABLE IF NOT EXISTS otp_codes (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255)  NOT NULL,
  code       VARCHAR(10)   NOT NULL,
  type       VARCHAR(30)   NOT NULL,   -- 'forgot_password' | 'two_fa'
  expires_at TIMESTAMPTZ   NOT NULL,
  used       BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_email_type
  ON otp_codes (email, type);
