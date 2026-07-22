-- ============================================================
-- Skoolio Migration: platform_settings table
-- Run this ONCE against your PostgreSQL database
-- This table controls platform-wide settings managed by super_admin
-- ============================================================

-- 1. Create the platform_settings table
CREATE TABLE IF NOT EXISTS platform_settings (
  id               SERIAL PRIMARY KEY,
  platform_name    VARCHAR(100)  NOT NULL DEFAULT 'Skoolio',
  support_email    VARCHAR(255)  NOT NULL DEFAULT 'support@skoolio.in',
  maintenance_mode BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by       INTEGER       REFERENCES schools(id) ON DELETE SET NULL
);

-- 2. Seed one default row (the app always reads the first row)
--    Use INSERT ... WHERE NOT EXISTS so re-running this file is safe
INSERT INTO platform_settings (platform_name, support_email, maintenance_mode)
SELECT 'Skoolio', 'support@skoolio.in', FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM platform_settings
);
