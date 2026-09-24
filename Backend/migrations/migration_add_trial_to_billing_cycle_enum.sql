-- ==============================================================================
-- Migration: Add 'trial' to billing_cycle_enum
-- Description:
--   Ensures that 'trial' is a valid billing_cycle_enum value in PostgreSQL,
--   allowing new schools to be automatically assigned a 14-Day Free Trial
--   on the Plus plan upon registration.
-- ==============================================================================

-- 1. Add 'trial' to billing_cycle_enum
ALTER TYPE billing_cycle_enum ADD VALUE IF NOT EXISTS 'trial';

-- 2. Ensure existing registered schools without active subscriptions get 14-Day Plus Trial
DO $$
DECLARE
  plus_plan_id INTEGER;
  r RECORD;
  new_sub_id INTEGER;
BEGIN
  -- Look for 'Plus' plan, fallback to 'Pro' or any paid plan
  SELECT id INTO plus_plan_id FROM subscription_plans WHERE LOWER(name) = 'plus' LIMIT 1;
  IF plus_plan_id IS NULL THEN
    SELECT id INTO plus_plan_id FROM subscription_plans WHERE LOWER(name) = 'pro' LIMIT 1;
  END IF;

  IF plus_plan_id IS NOT NULL THEN
    FOR r IN SELECT id FROM schools WHERE subscription_id IS NULL LOOP
      -- Expire previous subscriptions if any
      UPDATE school_subscriptions
      SET status = 'expired'
      WHERE school_id = r.id AND status IN ('active', 'grace_period');

      -- Insert 14-Day Trial on Plus plan
      INSERT INTO school_subscriptions (
        school_id, plan_id, billing_cycle, amount_paid, currency, start_date, end_date,
        status, notes, activated_by
      ) VALUES (
        r.id, plus_plan_id, 'trial', 0, 'NPR', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days',
        'active', 'Initial 14-Day Free Trial on Plus', r.id
      ) RETURNING id INTO new_sub_id;

      -- Link subscription_id back to schools table
      UPDATE schools SET subscription_id = new_sub_id, updated_at = NOW() WHERE id = r.id;
    END LOOP;
  END IF;
END $$;
