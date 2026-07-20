-- Migration: add USD pricing columns + country-based currency resolution support
-- Run once against your database.
--
-- Adding a new currency in future:
--   1. Add two columns here (price_xxx_monthly, price_xxx_yearly)
--   2. Add the type to Backend/src/types/subscription.types.ts (Currency union)
--   3. Add the country mapping to Backend/src/config/currencyConfig.ts
--   Done — no other files need to change.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS price_usd_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_usd_yearly  DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN subscription_plans.price_usd_monthly IS 'Monthly price in USD for international schools';
COMMENT ON COLUMN subscription_plans.price_usd_yearly  IS 'Yearly price in USD for international schools';
COMMENT ON COLUMN subscription_plans.price_npr_monthly IS 'Monthly price in NPR (Nepal)';
COMMENT ON COLUMN subscription_plans.price_npr_yearly  IS 'Yearly price in NPR (Nepal)';
COMMENT ON COLUMN subscription_plans.price_inr_monthly IS 'Monthly price in INR (India)';
COMMENT ON COLUMN subscription_plans.price_inr_yearly  IS 'Yearly price in INR (India)';
