-- Migration: Add online_payment_enabled to subscription_plans
-- Run once against your database.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS online_payment_enabled BOOLEAN NOT NULL DEFAULT false;

-- Pro and Plus get online payment; Free does not
UPDATE subscription_plans SET online_payment_enabled = true  WHERE name IN ('Pro', 'Plus');
UPDATE subscription_plans SET online_payment_enabled = false WHERE name = 'Free';

-- Add offers table for limited-time promotions
CREATE TABLE IF NOT EXISTS subscription_offers (
  id              SERIAL PRIMARY KEY,
  code            VARCHAR(50) UNIQUE NOT NULL,          -- e.g. 'FIRST_MONTH_FREE'
  title           VARCHAR(100) NOT NULL,                -- display title
  description     TEXT,
  plan_name       VARCHAR(50),                          -- NULL = any plan; 'Pro' = Pro only
  discount_type   VARCHAR(20) NOT NULL                  -- 'percent' | 'fixed' | 'free_months'
                    CHECK (discount_type IN ('percent', 'fixed', 'free_months')),
  discount_value  DECIMAL(10,2) NOT NULL,               -- % or fixed amount or months
  billing_cycle   VARCHAR(20),                          -- NULL = any; 'monthly'|'yearly'
  max_uses        INTEGER,                              -- NULL = unlimited
  uses_count      INTEGER NOT NULL DEFAULT 0,
  valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE,                                 -- NULL = never expires
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed the "1 month Pro free" offer
INSERT INTO subscription_offers
  (code, title, description, plan_name, discount_type, discount_value, billing_cycle, max_uses, valid_until)
VALUES
  ('SKOOLIO1MFREE', '1 Month Pro — Free', 'Get your first month on the Pro plan completely free. No payment needed.', 'Pro', 'free_months', 1, 'monthly', 500, '2025-12-31')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE subscription_offers IS 'Limited-time promotional offers for subscription plans';
COMMENT ON COLUMN subscription_plans.online_payment_enabled IS 'Whether schools on this plan can use the Online Payment module';

