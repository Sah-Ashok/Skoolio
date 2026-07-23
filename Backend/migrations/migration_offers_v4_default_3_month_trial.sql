-- Default starter promotion: a 3-month free Pro trial.
-- Safe to run multiple times. Change or disable it later from Super Admin > Subscriptions > Offers.

INSERT INTO subscription_offers
  (code, title, description, plan_name, discount_type, discount_value,
   applies_to_billing, max_uses, valid_from, is_active)
VALUES
  ('PRO3MONTHSFREE', '3 Months of Pro Free',
   'Try every Pro feature free for three months. The subscription automatically expires after the trial.',
   'Pro', 'free_months', 3, 'monthly', NULL, CURRENT_DATE, true)
ON CONFLICT (code) DO NOTHING;
