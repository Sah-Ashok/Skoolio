-- Migration v3: Add currency_applies_to to subscription_offers
-- Allows offers to be restricted to NPR (Nepal) or INR (India) or NULL = all currencies
-- Run once against your database.

ALTER TABLE subscription_offers
  ADD COLUMN IF NOT EXISTS currency_applies_to VARCHAR(10) DEFAULT NULL;

COMMENT ON COLUMN subscription_offers.currency_applies_to
  IS 'Restrict offer to a currency: NPR | INR | USD | NULL = all currencies';

-- Update existing seed offer to apply to all currencies
UPDATE subscription_offers
  SET currency_applies_to = NULL
  WHERE code = 'SKOOLIO1MFREE';
