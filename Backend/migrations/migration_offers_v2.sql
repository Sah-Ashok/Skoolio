-- Migration: Enhance subscription_offers table for full dynamic offer management
-- Run once against your database.

-- Add missing columns to subscription_offers
ALTER TABLE subscription_offers
  ADD COLUMN IF NOT EXISTS min_months        INTEGER,           -- minimum subscription duration to qualify
  ADD COLUMN IF NOT EXISTS applies_to_billing VARCHAR(20),       -- 'monthly'|'yearly'|NULL=both
  ADD COLUMN IF NOT EXISTS saving_text        VARCHAR(150);      -- e.g. 'Save NPR 2,400/yr vs monthly'

-- Drop old billing_cycle column and rename to applies_to_billing (if billing_cycle exists and applies_to_billing doesn't)
-- (applies_to_billing was added above; billing_cycle is still there for backwards compat)

COMMENT ON COLUMN subscription_offers.min_months IS 'Minimum number of months customer must subscribe to get the offer';
COMMENT ON COLUMN subscription_offers.applies_to_billing IS 'Which billing cycle this offer applies to: monthly | yearly | NULL = both';
COMMENT ON COLUMN subscription_offers.saving_text IS 'Human-readable saving description shown on upgrade page, e.g. Save NPR 2,400/yr';
