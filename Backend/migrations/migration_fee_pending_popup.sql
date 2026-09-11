-- Migration: Add show_pending_popup_on_login to fee_billing_policy
ALTER TABLE fee_billing_policy
  ADD COLUMN IF NOT EXISTS show_pending_popup_on_login BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN fee_billing_policy.show_pending_popup_on_login IS
  'When true, students with pending fee balances see a table popup when logging in.';
