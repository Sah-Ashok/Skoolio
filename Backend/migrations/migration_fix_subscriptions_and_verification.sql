-- ============================================================
-- Skoolio Migration: Fix Subscription Plans, Plus 14-Day Trial & Auto-Verification
-- Safe to run multiple times (idempotent)
-- ============================================================

-- 1. Ensure subscription_plans table exists
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                      SERIAL PRIMARY KEY,
  name                    VARCHAR(50) UNIQUE NOT NULL,
  max_students            INTEGER,
  max_teachers            INTEGER,
  fee_management_enabled  BOOLEAN NOT NULL DEFAULT true,
  online_payment_enabled  BOOLEAN NOT NULL DEFAULT false,
  price_npr_monthly       DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_npr_yearly        DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_inr_monthly       DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_inr_yearly        DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_usd_monthly       DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_usd_yearly        DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ensure unique constraint on subscription_plans(name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_name_key'
  ) THEN
    ALTER TABLE subscription_plans ADD CONSTRAINT subscription_plans_name_key UNIQUE (name);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 2. Seed standard plans: Free, Pro, Plus, Ultra
INSERT INTO subscription_plans (
  name, max_students, max_teachers, fee_management_enabled, online_payment_enabled,
  price_npr_monthly, price_npr_yearly, price_inr_monthly, price_inr_yearly,
  price_usd_monthly, price_usd_yearly, is_active
)
VALUES
  ('Free',  50,   5,    false, false, 0,     0,      0,     0,      0,   0,    true),
  ('Pro',   500,  30,   true,  true,  2500,  25000,  1500,  15000,  25,  250,  true),
  ('Plus',  NULL, NULL, true,  true,  5000,  50000,  3000,  30000,  50,  500,  true),
  ('Ultra', NULL, NULL, true,  true,  10000, 100000, 6000,  60000,  100, 1000, true)
ON CONFLICT (name) DO UPDATE SET
  fee_management_enabled = EXCLUDED.fee_management_enabled,
  online_payment_enabled = EXCLUDED.online_payment_enabled,
  is_active = true,
  updated_at = NOW();

-- 3. Ensure platform_settings has auto_verify_schools
CREATE TABLE IF NOT EXISTS platform_settings (
  id               SERIAL PRIMARY KEY,
  platform_name    VARCHAR(100)  NOT NULL DEFAULT 'Skoolio',
  support_email    VARCHAR(255)  NOT NULL DEFAULT 'support@skoolio.in',
  maintenance_mode BOOLEAN       NOT NULL DEFAULT FALSE,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_by       INTEGER       REFERENCES schools(id) ON DELETE SET NULL
);

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS auto_verify_schools BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE platform_settings SET auto_verify_schools = TRUE;

-- 4. Verify existing schools so they can log in immediately
UPDATE schools 
SET is_verified = TRUE,
    storage_folder = COALESCE(storage_folder, 'school_' || id || '_' || LOWER(REGEXP_REPLACE(school_name, '[^a-zA-Z0-9]+', '_', 'g'))),
    updated_at = NOW()
WHERE is_verified = FALSE;

-- 5. Auto-assign 14-day Plus trial to any existing schools without a subscription
DO $$
DECLARE
  plus_plan_id INTEGER;
  r RECORD;
  new_sub_id INTEGER;
BEGIN
  SELECT id INTO plus_plan_id FROM subscription_plans WHERE name = 'Plus' LIMIT 1;
  IF plus_plan_id IS NOT NULL THEN
    FOR r IN SELECT id FROM schools WHERE subscription_id IS NULL LOOP
      -- Expire previous if any exist
      UPDATE school_subscriptions
      SET status = 'expired'
      WHERE school_id = r.id AND status IN ('active', 'grace_period');

      -- Insert 14-day Plus trial
      INSERT INTO school_subscriptions (
        school_id, plan_id, billing_cycle, amount_paid, currency, start_date, end_date,
        status, notes, activated_by
      ) VALUES (
        r.id, plus_plan_id, 'monthly', 0, 'INR', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days',
        'active', 'Initial 14-Day Free Trial on Plus', r.id
      ) RETURNING id INTO new_sub_id;

      -- Link subscription_id back to schools table
      UPDATE schools SET subscription_id = new_sub_id, updated_at = NOW() WHERE id = r.id;
    END LOOP;
  END IF;
END $$;
